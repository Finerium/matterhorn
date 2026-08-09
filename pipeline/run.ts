/**
 * The Gate C pipeline runner. Blueprint 5.4, thirteen stages, one CLI.
 *
 *   tsx pipeline/run.ts stage <A1..A13> --run <run dir> [--narrative <id>] [--out <content root>]
 *
 * `--run` is a run directory, the only thing a stage reads state from and writes state to.
 * Per-narrative stages take `--narrative`. A12 and A13 take `--out`, the content root they
 * write into, so a test or a dry run never publishes into `content/`.
 *
 * Exit 0 on success. Exit 1 on a refusal, with a line naming the narrative and the reason.
 * Exit 2 on a usage error: an unknown flag is rejected rather than ignored, because a silently
 * dropped flag is how an unimplemented option ships green (the Gate 1 lesson, same parser shape
 * as scripts/validate-content.ts).
 *
 * The deterministic stages (A1 to A4, A12, A13) run here in full. The seven LLM slots (A5 to
 * A11) do not: under the claude-code executor the Orchestrator's subagents produce them. For a
 * slot stage the runner writes `<role>.input.json`, exactly the input that slot is given, and
 * when the staged `<role>.json` output exists it validates that output against
 * `pipeline/agents/<role>.schema.json` and ingests it. So every stage is independently CLI
 * drivable and the run resumes from wherever it stopped.
 *
 * Two rules the rest of the build leans on:
 *   - A10 and A11 mint the gate token, never the model. A token is a sha256 over the artifact
 *     bytes, which no language model can compute; the slot returns a judgment and the runner
 *     stamps the hash.
 *   - A12 publishes nothing without both tokens verifying against the bytes it is about to
 *     write, and reads no clock. Every field of a published artifact comes from run inputs, so
 *     two runs over the same inputs are byte identical.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import type { AnySchema, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js'; // the schemas declare draft 2020-12
import { gateToken } from './lib/canonical';
import { SLOT_ROLES, assertWired, executor, requestedModel, type SlotRole } from './config';

const REPO = resolve(import.meta.dirname, '..');
const CONTRACTS = join(REPO, 'contracts');
const SCHEMA_DIR = join(CONTRACTS, 'schemas');
const AGENTS = join(REPO, 'pipeline', 'agents');
const REGISTRY = join(REPO, 'pipeline', 'snapshot', 'registry.json');

const STAGES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'A11', 'A12', 'A13',
] as const;
type Stage = (typeof STAGES)[number];

/** Loaded into ajv by filename so `$ref: "value.schema.json"` resolves inside slot schemas too. */
const CONTRACT_SCHEMAS = [
  'source.schema.json',
  'value.schema.json',
  'narrative.schema.json',
  'feed.schema.json',
  'url_index.schema.json',
  'case_library.schema.json',
  'constellation.schema.json',
  'methodology.schema.json',
  'corrections.schema.json',
  'og_attribution.schema.json',
  'replay.schema.json',
];

// --- tiny unknown-shaped-data helpers, same idiom as the validator ----------------------

type Dict = Record<string, unknown>;
const isObj = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown): string => (typeof v === 'string' ? v : '');
const at = (v: unknown, ...path: string[]): unknown => {
  let cur: unknown = v;
  for (const k of path) {
    if (!isObj(cur)) return undefined;
    cur = cur[k];
  }
  return cur;
};

const readJson = <T = Dict>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const nowIso = (): string => `${new Date().toISOString().slice(0, 19)}Z`;

function usage(message: string): never {
  console.error(`pipeline: ${message}`);
  console.error('usage: tsx pipeline/run.ts stage <A1..A13> --run <dir> [--narrative <id>] [--out <root>]');
  process.exit(2);
}

function refuse(message: string): never {
  console.error(`REFUSED ${message}`);
  process.exit(1);
}

// --- argv ------------------------------------------------------------------------------

interface Args {
  stage: Stage;
  run: string;
  narrative: string | undefined;
  out: string | undefined;
}

function parseArgs(argv: string[]): Args {
  if (argv[0] !== 'stage') usage(`expected the "stage" command, got ${JSON.stringify(argv[0] ?? '')}`);
  const stage = argv[1] ?? '';
  if (!(STAGES as readonly string[]).includes(stage)) usage(`unknown stage ${JSON.stringify(stage)}`);

  // Every flag takes exactly one value, so step by two. Unknown flags are a usage error.
  const flags = new Map<string, string>();
  for (let i = 2; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--run' && flag !== '--narrative' && flag !== '--out') usage(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usage(`${flag} needs a value`);
    if (flags.has(flag)) usage(`${flag} was given twice`);
    flags.set(flag, value);
  }
  const run = flags.get('--run');
  if (run === undefined) usage('--run <dir> is required');

  const args: Args = {
    stage: stage as Stage,
    run: resolve(run),
    narrative: flags.get('--narrative'),
    out: flags.get('--out'),
  };
  const perNarrative = [...SLOT_ROLES, 'A12'] as readonly string[];
  if (perNarrative.includes(args.stage) && args.narrative === undefined) {
    usage(`stage ${args.stage} is per narrative and needs --narrative <id>`);
  }
  if ((args.stage === 'A12' || args.stage === 'A13') && args.out === undefined) {
    usage(`stage ${args.stage} writes a content root and needs --out <root>`);
  }
  return args;
}

// --- run directory layout ---------------------------------------------------------------

const stagePath = (run: string, name: string): string => join(run, 'stages', `${name}.json`);
const slotDir = (run: string, narrative: string): string => join(run, 'slots', narrative);
const slotPath = (run: string, narrative: string, file: string): string => join(slotDir(run, narrative), file);

interface RunManifest {
  run_id: string;
  generated_at: string;
  narratives: string[];
  fresh_demo?: { narrative_id: string; url: string };
}

function readRunManifest(run: string): RunManifest {
  const path = join(run, 'run.json');
  if (!existsSync(path)) refuse(`no run manifest at ${path}: stage A1 writes it`);
  return readJson<RunManifest>(path);
}

// --- the authored snapshot registry ------------------------------------------------------

interface RegistryMember {
  id: string;
  lang: 'en' | 'id';
  headline: string;
  outlet: string;
  date: string;
  url: string;
  reconstructed?: boolean;
  note?: string;
}

interface RegistryNarrative {
  id: string;
  pack: 'en' | 'id';
  lean: 'gov' | 'neutral' | 'opp';
  status?: 'published' | 'under_review';
  skeleton: string;
  original: { text: string; lang: 'en' | 'id' };
  headline: { en: string; id?: string };
  outlet: string;
  published_date: string;
  url: string;
  tags: string[];
  scaffold_default: 'S3' | 'S2' | 'S1' | 'S0';
  panels: string[];
  og?: Dict;
  members: RegistryMember[];
}

interface Registry {
  fresh_demo: { narrative_id: string; url: string };
  narratives: RegistryNarrative[];
}

const readRegistry = (): Registry => readJson<Registry>(REGISTRY);

function registryEntry(id: string): RegistryNarrative | undefined {
  if (!existsSync(REGISTRY)) return undefined;
  return readRegistry().narratives.find((n) => n.id === id);
}

// --- schema validation -------------------------------------------------------------------

let ajvInstance: InstanceType<typeof Ajv2020> | undefined;
function ajv(): InstanceType<typeof Ajv2020> {
  if (ajvInstance === undefined) {
    ajvInstance = new Ajv2020({ allErrors: true, strict: true });
    for (const name of CONTRACT_SCHEMAS) {
      ajvInstance.addSchema(readJson<AnySchema>(join(SCHEMA_DIR, name)) as AnySchema, name);
    }
  }
  return ajvInstance;
}

function formatErrors(validate: ValidateFunction): string {
  const errors = validate.errors ?? [];
  const shown = errors
    .slice(0, 5)
    .map((e) => `${e.instancePath === '' ? '(root)' : e.instancePath} ${e.message ?? 'invalid'}`);
  if (errors.length > shown.length) shown.push(`plus ${errors.length - shown.length} more`);
  return shown.join('; ');
}

/** Undefined when the data conforms, else the formatted reason. */
function schemaFault(schema: AnySchema, data: unknown): string | undefined {
  // Compiling registers by $id, and one process may validate the same slot schema twice
  // (a later stage re-ingests an earlier slot to build its input), so look up first.
  const id = typeof schema === 'object' ? (schema as { $id?: string }).$id : undefined;
  const validate = (id === undefined ? undefined : ajv().getSchema(id)) ?? ajv().compile(schema);
  return validate(data) ? undefined : formatErrors(validate);
}

// --- derivation (6.5) ---------------------------------------------------------------------

/**
 * The 6.5 counts plus the CF-1 additive optional `conflicts`. A12 derives them and refuses a
 * candidate that disagrees, rather than rewriting bytes the gates already judged.
 *
 * ponytail: yes, scripts/validate-content.ts derives the same thing. That is the point: the
 * checker must not be the stamper, or check 3 would be asserting a function against itself.
 */
function deriveCounts(panels: unknown[]): Record<string, number> {
  const claimMap = panels.find((p) => at(p, 'type') === 'claim_map');
  const edges = asArr(at(claimMap, 'edges'));
  const hidden = asArr(at(claimMap, 'hidden'));
  const withStatus = (s: string): number => edges.filter((e) => at(e, 'status') === s).length;
  const counts: Record<string, number> = {
    missing: withStatus('missing'),
    unsourced: withStatus('unsourced') + hidden.filter((h) => at(h, 'ev') === undefined).length,
    disputed: withStatus('disputed'),
    supported: withStatus('supported'),
    hidden: hidden.length,
  };
  const dueling = panels.find((p) => at(p, 'type') === 'dueling');
  if (dueling !== undefined) counts.conflicts = asArr(at(dueling, 'counts')).length;
  return counts;
}

/** Every registry id a subtree references: `source_id` keys and `citations` arrays. */
function referencedSources(node: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) referencedSources(item, into);
    return into;
  }
  if (!isObj(node)) return into;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'source_id' && typeof v === 'string') {
      into.add(v);
    } else if (k === 'citations' && Array.isArray(v)) {
      for (const c of v) if (typeof c === 'string') into.add(c);
    } else {
      referencedSources(v, into);
    }
  }
  return into;
}

// --- A1 Scout -----------------------------------------------------------------------------

function stageA1(args: Args): void {
  if (!existsSync(REGISTRY)) refuse(`A1: no snapshot registry at ${REGISTRY}`);
  const registry = readRegistry();
  const records = registry.narratives
    .flatMap((n) => n.members)
    .map(({ id, lang, headline, outlet, date, url }) => ({ id, lang, headline, outlet, date, url }))
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(stagePath(args.run, 'A1'), { records });

  const manifest = join(args.run, 'run.json');
  if (!existsSync(manifest)) {
    writeJson(manifest, {
      run_id: basename(args.run),
      generated_at: nowIso(),
      narratives: registry.narratives.map((n) => n.id),
      fresh_demo: registry.fresh_demo,
    });
  }
  console.log(`A1 scout: ${records.length} record(s) from the snapshot registry -> stages/A1.json`);
}

// --- A2 Ingestor ----------------------------------------------------------------------------

const MONTHS: Record<string, string> = {
  jan: '01', januari: '01', january: '01', feb: '02', februari: '02', february: '02',
  mar: '03', maret: '03', march: '03', apr: '04', april: '04', may: '05', mei: '05',
  jun: '06', juni: '06', june: '06', jul: '07', juli: '07', july: '07', agu: '08', aug: '08',
  agustus: '08', august: '08', sep: '09', september: '09', okt: '10', oct: '10', oktober: '10',
  october: '10', nov: '11', november: '11', des: '12', dec: '12', desember: '12', december: '12',
};

/** `5 Mar 2031` and `20 Februari 2031` become `2031-03-05`. Anything already ISO is left alone. */
function normalizeDate(raw: string): string {
  const text = raw.trim();
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(text)) return text;
  const parts = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(text);
  const month = parts === null ? undefined : MONTHS[(parts[2] ?? '').toLowerCase()];
  if (parts === null || month === undefined) return text;
  return `${parts[3]}-${month}-${(parts[1] ?? '').padStart(2, '0')}`;
}

/** Tracking parameters only. A query string can be load bearing (`/berita/view?id=1465`). */
const TRACKING = /^(utm_[a-z_]+|fbclid|gclid|igshid|mc_[a-z]+|ref|ref_src|source|src)$/i;

function normalizeUrl(raw: string): string {
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return text;
  }
  for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
  url.hash = '';
  return url.toString().replace(/\?$/, '');
}

const tidy = (s: string): string => s.replace(/\s+/g, ' ').trim();

function stageA2(args: Args): void {
  const source = stagePath(args.run, 'A1');
  if (!existsSync(source)) refuse(`A2: no scout output at ${source}`);
  const records = asArr(at(readJson(source), 'records'))
    .map((record) => ({
      id: asStr(at(record, 'id')).trim(),
      lang: asStr(at(record, 'lang')).trim().toLowerCase(),
      headline: tidy(asStr(at(record, 'headline'))),
      outlet: tidy(asStr(at(record, 'outlet'))),
      date: normalizeDate(asStr(at(record, 'date'))),
      url: normalizeUrl(asStr(at(record, 'url'))),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  writeJson(stagePath(args.run, 'A2'), { records });
  console.log(`A2 normalize: ${records.length} record(s) -> stages/A2.json`);
}

// --- A3 Clusterer ----------------------------------------------------------------------------

async function stageA3(args: Args): Promise<void> {
  const source = stagePath(args.run, 'A2');
  if (!existsSync(source)) refuse(`A3: no normalized records at ${source}`);
  const records = asArr(at(readJson(source), 'records')).map((r) => ({
    id: asStr(at(r, 'id')),
    headline: asStr(at(r, 'headline')),
  }));
  const { cluster, THRESHOLD } = await import('./lib/cluster');
  const assignments = (await cluster(records)).sort((a, b) => a.id.localeCompare(b.id));
  writeJson(stagePath(args.run, 'A3'), { threshold: THRESHOLD, assignments });
  const clusters = new Set(assignments.map((a) => a.cluster)).size;
  console.log(`A3 cluster: ${assignments.length} record(s) into ${clusters} cluster(s) at cosine ${THRESHOLD}`);
}

// --- A4 Prioritizer ----------------------------------------------------------------------------

/**
 * Causal markers: the phrases a headline uses to assert that one thing produced another. A
 * family whose headlines assert more steps carries more causal structure to dissect, which is
 * the "causal density" half of the 5.4 heuristic at headline scope.
 */
const CAUSAL_MARKERS = [
  'pays for', 'pay for', 'funds', 'fund', 'causes', 'cause', 'because', 'so that', 'in order to',
  'to save', 'saves', 'leads to', 'drives', 'triggers', 'result of', 'thanks to', 'covers',
  'membiayai', 'menutup', 'menyebabkan', 'karena', 'demi', 'akibat', 'memicu', 'selamatkan',
  'menyelamatkan', 'sebab', 'agar', 'supaya', 'menghemat', 'menekan',
];

const dayNumber = (date: string): number | undefined => {
  const parsed = Date.parse(`${date.length === 7 ? `${date}-01` : date}T00:00:00Z`);
  return Number.isNaN(parsed) ? undefined : Math.floor(parsed / 86_400_000);
};

function stageA4(args: Args): void {
  const normalized = stagePath(args.run, 'A2');
  const grouped = stagePath(args.run, 'A3');
  for (const path of [normalized, grouped]) if (!existsSync(path)) refuse(`A4: missing input ${path}`);

  const byId = new Map(
    asArr(at(readJson(normalized), 'records')).map((r) => [asStr(at(r, 'id')), r] as const),
  );
  const members = new Map<string, unknown[]>();
  for (const assignment of asArr(at(readJson(grouped), 'assignments'))) {
    const name = asStr(at(assignment, 'cluster'));
    const record = byId.get(asStr(at(assignment, 'id')));
    if (record !== undefined) members.set(name, [...(members.get(name) ?? []), record]);
  }

  const ranked = [...members.entries()]
    .map(([name, records]) => {
      const days = records.map((r) => dayNumber(asStr(at(r, 'date')))).filter((d): d is number => d !== undefined);
      const span = days.length === 0 ? 1 : Math.max(...days) - Math.min(...days) + 1;
      // Velocity: articles per day across the window the family occupied. A family that
      // arrived in one day is moving faster than the same family spread over a fortnight.
      const velocity = records.length / span;
      const asserted = records.filter((r) => {
        const headline = asStr(at(r, 'headline')).toLowerCase();
        return CAUSAL_MARKERS.some((marker) => headline.includes(marker));
      }).length;
      const causalDensity = records.length === 0 ? 0 : asserted / records.length;
      const outlets = new Set(records.map((r) => asStr(at(r, 'outlet')))).size;
      return {
        cluster: name,
        score: Number((velocity + 2 * causalDensity + 0.25 * outlets).toFixed(6)),
        rank: 0,
        size: records.length,
        outlets,
        span_days: span,
        velocity: Number(velocity.toFixed(6)),
        causal_density: Number(causalDensity.toFixed(6)),
        members: records.map((r) => asStr(at(r, 'id'))).sort((a, b) => a.localeCompare(b)),
      };
    })
    // Score descending, cluster name ascending on a tie, so the order is total and stable.
    .sort((a, b) => b.score - a.score || a.cluster.localeCompare(b.cluster))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  writeJson(stagePath(args.run, 'A4'), { ranked });

  // The work order fixes the families: 7.1 names ten narratives and the registry names each
  // one's member articles. So the family A5 and A6 are handed is the registry's, not A3's, and
  // A3 groups; it does not route. The families that ship are AUTHORED in the snapshot registry,
  // and A12 publishes those. This once claimed A3 was the evidence that embeddings recover the
  // same grouping: the Gate C eval measured it and they do not (pairwise recall 0.083 on the
  // golden set, 0.160 on the work order, against purity 1.000 that was paid for splitting). The
  // claim is removed rather than left standing; tests/pipeline/evals/cluster.spec.ts carries the
  // figures and the reason a headline alone cannot carry the referent. A run directory with no
  // registry narrative in it (the fixtures) is handed nothing and keeps its staged cluster.json.
  let handed = 0;
  if (existsSync(REGISTRY)) {
    for (const narrative of readRegistry().narratives) {
      // Normalized where A2 saw the record, and always carrying the registry's honesty flags:
      // a slot has to know which headlines are verbatim titles and which are descriptions,
      // because quoting a reconstructed one as a title is the fault this product exists to catch.
      const members = narrative.members.map(({ id, lang, headline, outlet, date, url, reconstructed, note }) => ({
        ...(byId.get(id) ?? { id, lang, headline, outlet, date, url }),
        ...(reconstructed === true ? { reconstructed } : {}),
        ...(note === undefined ? {} : { note }),
      }));
      if (members.length === 0) continue;
      writeJson(slotPath(args.run, narrative.id, 'cluster.json'), {
        narrative_id: narrative.id,
        family_skeleton: narrative.skeleton,
        members,
      });
      handed += 1;
    }
  }
  console.log(`A4 rank: ${ranked.length} cluster(s) scored, ${handed} work-order famil(ies) handed to a narrative slot`);
}

// --- slot stages A5..A11 -----------------------------------------------------------------------

interface Step {
  role: string;
  model: string;
  started_at: string;
  finished_at: string;
  input_hash: string;
}

function readSteps(run: string, narrative: string): Step[] {
  const path = slotPath(run, narrative, 'steps.json');
  return existsSync(path) ? asArr(at(readJson(path), 'steps')).map((s) => s as unknown as Step) : [];
}

function writeSteps(run: string, narrative: string, steps: Step[]): void {
  const order = new Map(SLOT_ROLES.map((role, i) => [role as string, i]));
  writeJson(slotPath(run, narrative, 'steps.json'), {
    steps: [...steps].sort((a, b) => (order.get(a.role) ?? 99) - (order.get(b.role) ?? 99)),
  });
}

function recordInput(run: string, narrative: string, role: SlotRole, input: unknown): void {
  const path = slotPath(run, narrative, `${role}.input.json`);
  writeJson(path, input);
  const hash = sha256(readFileSync(path, 'utf8'));
  const steps = readSteps(run, narrative);
  const existing = steps.find((s) => s.role === role);
  if (existing !== undefined && existing.input_hash === hash) return;
  const step: Step = {
    role,
    model: requestedModel(role),
    started_at: nowIso(),
    finished_at: '',
    input_hash: hash,
  };
  writeSteps(run, narrative, [...steps.filter((s) => s.role !== role), step]);
}

function recordOutput(run: string, narrative: string, role: SlotRole, output: unknown): void {
  const steps = readSteps(run, narrative);
  const step = steps.find((s) => s.role === role);
  if (step === undefined) return;
  const reported = asStr(at(output, 'model'));
  step.model = reported === '' ? requestedModel(role) : reported;
  step.finished_at = nowIso();
  writeSteps(run, narrative, steps);
}

/** The staged slot output, validated against its schema. Undefined when the slot has not run. */
function ingestSlot(run: string, narrative: string, role: SlotRole): Dict | undefined {
  const path = slotPath(run, narrative, `${role}.json`);
  if (!existsSync(path)) return undefined;
  const output = readJson(path);
  const schema = join(AGENTS, `${role}.schema.json`);
  if (!existsSync(schema)) refuse(`${role} ${narrative}: no slot schema at ${schema}`);
  const fault = schemaFault(readJson<AnySchema>(schema), output);
  if (fault !== undefined) refuse(`${role} ${narrative}: slot output fails ${role}.schema.json: ${fault}`);
  return output;
}

function requireSlot(run: string, narrative: string, role: SlotRole): Dict {
  const output = ingestSlot(run, narrative, role);
  if (output === undefined) {
    refuse(`${narrative}: this stage depends on ${role}.json, which the ${role} slot has not produced yet`);
  }
  return output;
}

function readCluster(run: string, narrative: string): Dict {
  const path = slotPath(run, narrative, 'cluster.json');
  if (!existsSync(path)) refuse(`${narrative}: no cluster at ${path}, which stage A4 writes`);
  return readJson(path);
}

/** The source registry a grounding slot is constrained to: the target content root, else content/. */
function sourceRegistry(out: string | undefined): unknown[] {
  const path = out === undefined ? join(REPO, 'content', 'sources.json') : join(out, 'sources.json');
  return existsSync(path) ? asArr(readJson<unknown[]>(path)) : [];
}

function readIfPresent(path: string): unknown {
  return existsSync(path) ? readJson(path) : null;
}

/** Builds the input for one slot. This is the whole disjoint-context guarantee, in one place. */
function slotInput(args: Args, role: SlotRole, narrative: string): unknown {
  const run = args.run;
  const cluster = readCluster(run, narrative);
  const entry = registryEntry(narrative);
  switch (role) {
    case 'A5':
      return {
        narrative_id: narrative,
        cluster,
        panel_plan: entry?.panels ?? [],
        original: entry?.original ?? null,
      };
    // PRD D5: A6 gets the cluster and the asserted graph. Not A5's transcript, not A5's notes,
    // not A5's panel skeleton. Adding a field here is what "disjoint context" would lose.
    case 'A6':
      return {
        narrative_id: narrative,
        cluster,
        asserted_graph: at(requireSlot(run, narrative, 'A5'), 'asserted_graph'),
      };
    case 'A7':
      return {
        narrative_id: narrative,
        cluster,
        asserted_graph: at(requireSlot(run, narrative, 'A5'), 'asserted_graph'),
        panel_skeleton: at(requireSlot(run, narrative, 'A5'), 'panel_skeleton'),
        hidden_candidates: at(requireSlot(run, narrative, 'A6'), 'hidden'),
        panel_plan: entry?.panels ?? [],
        sources: sourceRegistry(args.out),
      };
    case 'A8':
      return {
        narrative_id: narrative,
        cluster,
        asserted_graph: at(requireSlot(run, narrative, 'A5'), 'asserted_graph'),
        case_library: readIfPresent(
          args.out === undefined
            ? join(REPO, 'content', 'case_library.json')
            : join(args.out, 'case_library.json'),
        ),
      };
    case 'A9':
      return {
        narrative_id: narrative,
        headline: entry?.headline ?? null,
        original: entry?.original ?? null,
        panels: shippingPanels(requireSlot(run, narrative, 'A7'), narrative),
        echo: at(ingestSlot(run, narrative, 'A8') ?? {}, 'echo') ?? null,
        lexicon: readJson(join(CONTRACTS, 'lexicon.json')),
      };
    case 'A10':
      return {
        narrative_id: narrative,
        candidate: readCandidate(run, narrative),
        mirror_brief: readIfPresent(slotPath(run, narrative, 'mirror-brief.json')),
      };
    case 'A11':
      return {
        narrative_id: narrative,
        candidate: readCandidate(run, narrative),
        lexicon: readJson(join(CONTRACTS, 'lexicon.json')),
      };
  }
}

/**
 * A7's grounded panels normalised to the shipping panel set. Two scope rules, both
 * deterministic: the echo never rides in panels[] (A8 is the historian; the contract carries
 * the echo at the artifact root, seed convention), and the family strip is a marker panel
 * (6.4) joined last: from A7's own family field when it emitted one, else synthesised as
 * `<narrative>-p-family` when the registry work order lists family. Both the A9 input and the
 * candidate must show the same shipping panel set, or narration binds against a universe the
 * fidelity gate will not recognise.
 */
function shippingPanels(grounded: Dict, narrative: string): unknown[] {
  const panels = asArr(at(grounded, 'panels')).filter((p) => asStr(at(p, 'type')) !== 'echo');
  const hasMarker = panels.some((p) => asStr(at(p, 'type')) === 'family');
  const marker = at(grounded, 'family');
  if (!hasMarker && asStr(at(marker, 'type')) === 'family' && asStr(at(marker, 'el_id')) !== '') {
    panels.push({ type: 'family', el_id: asStr(at(marker, 'el_id')) });
  } else if (!hasMarker && marker === undefined && (registryEntry(narrative)?.panels ?? []).includes('family')) {
    panels.push({ type: 'family', el_id: `${narrative}-p-family` });
  }
  return panels;
}

function readCandidate(run: string, narrative: string): Dict {
  const path = slotPath(run, narrative, 'candidate.json');
  if (!existsSync(path)) refuse(`${narrative}: no candidate at ${path}, which stage A9 assembles`);
  return readJson(path);
}

/** A5 to A9: write the input, and ingest the staged output if the slot has produced one. */
function stageAuthoringSlot(args: Args, role: SlotRole): void {
  const narrative = args.narrative as string;
  recordInput(args.run, narrative, role, slotInput(args, role, narrative));
  const output = ingestSlot(args.run, narrative, role);
  if (output === undefined) {
    console.log(`${role} ${narrative}: input written to ${role}.input.json, awaiting the slot output`);
    return;
  }
  recordOutput(args.run, narrative, role, output);
  console.log(`${role} ${narrative}: slot output validated against ${role}.schema.json and ingested`);
  if (role === 'A9') assembleCandidate(args, narrative);
}

/**
 * A9 is the last authoring slot, so this is where the artifact stops being slot outputs and
 * becomes a candidate. Everything mechanical is derived here (counts, source_count, the step
 * chain); everything editorial comes from a slot; everything factual about the article itself
 * comes from the snapshot registry.
 */
function assembleCandidate(args: Args, narrative: string): void {
  const entry = registryEntry(narrative);
  if (entry === undefined) {
    const existing = slotPath(args.run, narrative, 'candidate.json');
    if (!existsSync(existing)) {
      refuse(`A9 ${narrative}: no registry entry and no staged candidate, so there is nothing to assemble`);
    }
    console.log(`A9 ${narrative}: no registry entry, keeping the staged candidate as it stands`);
    return;
  }
  const manifest = readRunManifest(args.run);
  const cluster = readCluster(args.run, narrative);
  const grounded = requireSlot(args.run, narrative, 'A7');
  const narrated = requireSlot(args.run, narrative, 'A9');
  // D-2: provenance chips name the model that actually executed, as the step log reports it,
  // not the one the config requested. analyzed_by is the causal analysis (A5), narrated_by A9.
  const steps = readSteps(args.run, narrative);
  const reportedModel = (role: SlotRole): string => {
    const step = steps.find((s) => s.role === role);
    return step === undefined || step.model === '' ? requestedModel(role) : step.model;
  };
  const echo = at(ingestSlot(args.run, narrative, 'A8') ?? {}, 'echo') ?? null;
  const panels = shippingPanels(grounded, narrative);

  const candidate: Dict = {
    id: entry.id,
    pack: entry.pack,
    lean: entry.lean,
    status: entry.status ?? 'published',
    headline: entry.headline,
    // Field by field, not spread: the registry carries operator annotations beside the copy
    // (`reconstructed`, `note`), and the artifact root is closed.
    original: { text: entry.original.text, lang: entry.original.lang },
    outlet: entry.outlet,
    published_date: entry.published_date,
    url: entry.url,
    og: entry.og ?? { image_path: null, fetched_at: null, attribution: '', fallback: true },
    tags: entry.tags,
    counts: deriveCounts(panels),
    provenance: {
      analyzed_by: reportedModel('A5'),
      narrated_by: reportedModel('A9'),
      source_count: 0,
      computed_at: manifest.generated_at.slice(0, 10),
      run_id: manifest.run_id,
    },
    family: {
      skeleton: asStr(at(cluster, 'family_skeleton')),
      members: asArr(at(cluster, 'members')).map((m) => ({
        outlet: asStr(at(m, 'outlet')),
        headline: asStr(at(m, 'headline')),
        url: asStr(at(m, 'url')),
        date: asStr(at(m, 'date')),
      })),
    },
    scaffold_default: entry.scaffold_default,
    sparring: at(narrated, 'sparring'),
    prediction_tap: at(narrated, 'prediction_tap'),
    panels,
    echo,
    narration: at(narrated, 'narration'),
    manifest: {
      run_id: manifest.run_id,
      generated_at: manifest.generated_at,
      steps: readSteps(args.run, narrative).filter((s) => s.finished_at !== ''),
    },
  };
  (candidate.provenance as Dict).source_count = referencedSources(candidate).size;
  writeJson(slotPath(args.run, narrative, 'candidate.json'), candidate);
  console.log(`A9 ${narrative}: candidate assembled, ${asArr(candidate.panels).length} panel(s)`);
}

// --- A10 Symmetry Auditor, A11 Fidelity Guard --------------------------------------------------

/** PRD's per-dissection latency claim. AC-PIPE-8 keys the metric's `kind` off it. */
const LATENCY_TARGET_SECONDS = 180;

const GATE_OF: Record<'A10' | 'A11', 'symmetry' | 'fidelity'> = { A10: 'symmetry', A11: 'fidelity' };

/**
 * A gate slot returns a judgment. The token is a sha256 over the artifact bytes, which no
 * language model can compute, so the runner mints it: on pass it stamps `gateToken(candidate)`
 * into the verdict file, and on block it writes a durable record naming the narrative, because
 * a resumable run has to read a block back rather than remember a line of stdout.
 */
function stageGate(args: Args, role: 'A10' | 'A11'): void {
  const narrative = args.narrative as string;
  recordInput(args.run, narrative, role, slotInput(args, role, narrative));
  const verdictPath = slotPath(args.run, narrative, `${role}.json`);
  const output = ingestSlot(args.run, narrative, role);
  if (output === undefined) {
    console.log(`${role} ${narrative}: input written to ${role}.input.json, awaiting the gate verdict`);
    return;
  }
  recordOutput(args.run, narrative, role, output);

  const gate = GATE_OF[role];
  const verdict = asStr(output.verdict);
  const reasons = asArr(output.reasons);
  if (verdict !== 'pass') {
    // One file per block, never overwritten: a narrative a gate sent back twice is two blocks,
    // and the methodology metric counts them. Collapsing them would let a re-run quietly erase
    // the record of the first objection.
    const dir = join(args.run, 'blocked');
    const taken = existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith(`${narrative}-${role}-`)).length : 0;
    writeJson(join(dir, `${narrative}-${role}-${String(taken + 1)}.json`), {
      narrative_id: narrative,
      run_id: readRunManifest(args.run).run_id,
      role,
      gate,
      verdict: 'block',
      // The bytes the gate actually judged. Without it a block record cannot be told apart
      // from a block against some later revision of the same narrative.
      candidate_sha256: sha256(readFileSync(slotPath(args.run, narrative, 'candidate.json'), 'utf8')),
      reasons,
      recorded_at: nowIso(),
    });
    console.log(
      `${role} ${narrative}: BLOCK on the ${gate} gate, recorded in blocked/${narrative}-${role}.json` +
        `${reasons.length === 0 ? '' : `\n  ${reasons.map(String).join('\n  ')}`}`,
    );
    return;
  }
  const token = gateToken(readCandidate(args.run, narrative));
  writeJson(verdictPath, { ...output, token });
  console.log(`${role} ${narrative}: pass on the ${gate} gate, token ${token.slice(0, 12)} minted over the candidate`);
}

// --- A12 Publisher -------------------------------------------------------------------------------

/**
 * Publishes one narrative, or refuses. Byte deterministic: nothing here reads a clock, a random
 * source or an unsorted directory, so two runs over the same run directory produce the same
 * bytes. The only thing A12 adds to the candidate is `manifest.gates`, which the token recipe
 * nulls out, so `gateToken(published) === gateToken(candidate)` by construction.
 */
function stageA12(args: Args): void {
  const narrative = args.narrative as string;
  const out = args.out as string;
  const candidatePath = slotPath(args.run, narrative, 'candidate.json');
  if (!existsSync(candidatePath)) refuse(`A12 ${narrative}: no candidate at ${candidatePath}`);
  const candidate = readJson(candidatePath);

  // A block blocks the BYTES it judged. `blocked/` is the run's permanent ledger, so a
  // narrative that was sent back, fixed, and re-judged still carries its earlier block records
  // forever; treating every record as live would mean no narrative could ever recover from a
  // block, which is not what "a block is not appealable" means. It means you may not publish the
  // same bytes a gate refused. So a record is live when its `candidate_sha256` matches the
  // candidate now on the table, and superseded when it does not.
  //
  // A record with no hash cannot be matched either way. Those are the reconstructions
  // transcribed into this run's ledger after the fact, and they are treated as superseded and
  // named in the log rather than silently skipped. Nothing is weakened by that: the guard below
  // still requires both gate verdicts to read `pass` AND both tokens to verify against these
  // exact bytes, so bytes a gate refused cannot publish whatever the ledger says.
  const blockedDir = join(args.run, 'blocked');
  const records = (existsSync(blockedDir) ? readdirSync(blockedDir) : [])
    .filter((f) => f.startsWith(`${narrative}-`))
    .map((f) => ({ file: f, sha: asStr(at(readJson(join(blockedDir, f)), 'candidate_sha256')) }));
  const candidateSha = sha256(readFileSync(candidatePath, 'utf8'));
  const live = records.filter((r) => r.sha === candidateSha);
  if (live.length > 0) {
    refuse(
      `A12 ${narrative}: a gate blocked these exact bytes (${live.map((r) => r.file).join(', ')}) and a block is not appealable by publishing`,
    );
  }
  if (records.length > 0) {
    console.log(
      `A12 ${narrative}: ${String(records.length)} superseded block record(s) on earlier bytes (${records.map((r) => r.file).join(', ')})`,
    );
  }

  const gates: Dict = {};
  for (const role of ['A10', 'A11'] as const) {
    const gate = GATE_OF[role];
    const path = slotPath(args.run, narrative, `${role}.json`);
    if (!existsSync(path)) refuse(`A12 ${narrative}: the ${gate} gate verdict ${role}.json is absent, so there is no token to verify`);
    const verdict = readJson(path);
    if (asStr(verdict.verdict) !== 'pass') {
      refuse(`A12 ${narrative}: the ${gate} gate verdict is "${asStr(verdict.verdict)}", not pass, so this narrative is blocked`);
    }
    const token = asStr(verdict.token);
    if (token === '') refuse(`A12 ${narrative}: the ${gate} gate verdict carries no token`);
    gates[gate] = { verdict: 'pass', token };
  }

  const manifest = isObj(candidate.manifest) ? candidate.manifest : {};
  const published: Dict = { ...candidate, manifest: { ...manifest, gates } };

  const fault = schemaFault({ $ref: 'narrative.schema.json' }, published);
  if (fault !== undefined) refuse(`A12 ${narrative}: the artifact is invalid against narrative.schema.json: ${fault}`);

  // A12 derives, it does not rewrite: bytes the gates judged are the bytes that ship. A stored
  // derivation that disagrees is a pipeline fault upstream, not something to paper over here.
  const counts = deriveCounts(asArr(published.panels));
  const storedCounts = isObj(published.counts) ? published.counts : {};
  const countFault = [...new Set([...Object.keys(storedCounts), ...Object.keys(counts)])].find(
    (key) => storedCounts[key] !== counts[key],
  );
  if (countFault !== undefined) {
    refuse(`A12 ${narrative}: stored counts.${countFault} is ${JSON.stringify(storedCounts[countFault])} and the 6.5 recomputation is ${JSON.stringify(counts[countFault])}`);
  }
  const sourceCount = referencedSources(published).size;
  if (at(published, 'provenance', 'source_count') !== sourceCount) {
    refuse(`A12 ${narrative}: stored provenance.source_count is ${JSON.stringify(at(published, 'provenance', 'source_count'))} and the artifact references ${sourceCount} registry id(s)`);
  }

  const expected = gateToken(published);
  for (const gate of ['symmetry', 'fidelity'] as const) {
    const token = asStr(at(gates, gate, 'token'));
    if (token !== expected) {
      refuse(`A12 ${narrative}: the ${gate} token does not verify against the artifact bytes (stored ${token.slice(0, 12)}, computed ${expected.slice(0, 12)}); the artifact changed after the gates judged it`);
    }
  }

  writeJson(join(out, 'narratives', `${narrative}.json`), published);
  console.log(`A12 ${narrative}: published, both gate tokens verify (${expected.slice(0, 12)})`);
}

// --- A13 Librarian ---------------------------------------------------------------------------------

interface Published {
  id: string;
  pack: 'en' | 'id';
  lean: 'gov' | 'neutral' | 'opp';
  url: string;
  headline: { en: string; id?: string };
  family: { members: Array<{ url: string }> };
  manifest: { steps: Array<{ started_at: string; finished_at: string }> };
  provenance: { run_id: string };
}

function readPublished(out: string): Published[] {
  const dir = join(out, 'narratives');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((f) => readJson<Published>(join(dir, f)));
}

/** Wall time of one narrative: first slot start to last slot finish, in seconds. */
function wallSeconds(steps: Array<{ started_at: string; finished_at: string }>): number | undefined {
  const stamps = steps.flatMap((s) => [Date.parse(s.started_at), Date.parse(s.finished_at)]).filter((n) => !Number.isNaN(n));
  if (stamps.length === 0) return undefined;
  return Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000);
}

function humanDuration(seconds: number): string {
  if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  if (seconds >= 60) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function stageA13(args: Args): void {
  const out = args.out as string;
  const manifest = readRunManifest(args.run);
  // Registry order, not directory order: the work order names each pack's hero (mbg-stop,
  // tariffs-pay) by listing it first, and the pack-feed hero pick below is order-derived.
  const registryIndex = new Map(
    readJson<Registry>(REGISTRY).narratives.map((n, i) => [n.id, i] as const),
  );
  const published = readPublished(out).sort(
    (a, b) => (registryIndex.get(a.id) ?? 99) - (registryIndex.get(b.id) ?? 99),
  );
  if (published.length === 0) refuse('A13: the content root holds no published narrative, so there is nothing to aggregate');
  const ids = new Set(published.map((n) => n.id));

  // --- url_index: canonical per narrative, family members, exactly one fresh demo (check 8)
  const demo = manifest.fresh_demo;
  if (demo !== undefined && !ids.has(demo.narrative_id)) {
    refuse(`A13: run.json names ${demo.narrative_id} as the fresh demo and that narrative is not published`);
  }
  const entries: Array<{ match: string; pattern: string; narrative_id: string; role: string }> = [];
  const seen = new Set<string>();
  const addEntry = (pattern: string, narrativeId: string, role: string): void => {
    if (pattern === '' || seen.has(pattern)) return;
    seen.add(pattern);
    entries.push({ match: 'exact', pattern, narrative_id: narrativeId, role });
  };
  if (demo !== undefined) addEntry(demo.url, demo.narrative_id, 'fresh_demo');
  for (const artifact of published) addEntry(artifact.url, artifact.id, 'canonical');
  for (const artifact of published) {
    for (const member of artifact.family?.members ?? []) addEntry(member.url, artifact.id, 'family_member');
  }
  writeJson(join(out, 'url_index.json'), { entries });

  // --- constellation: one node per narrative, linked where two narratives cite the same body
  const publishers = new Map(
    asArr(readIfPresent(join(out, 'sources.json'))).map(
      (s) => [asStr(at(s, 'id')), asStr(at(s, 'publisher'))] as const,
    ),
  );
  const nodes = published.map((artifact) => ({
    id: `node-${artifact.id}`,
    narrative_id: artifact.id,
    label: { en: artifact.headline.en, id: artifact.headline.id ?? artifact.headline.en },
    pack: artifact.pack,
  }));
  const sourcesOf = new Map(published.map((a) => [a.id, referencedSources(a)] as const));
  const links: Array<{ a: string; b: string; via: { en: string; id: string } }> = [];
  for (let i = 0; i < published.length; i += 1) {
    for (let j = i + 1; j < published.length; j += 1) {
      const left = published[i] as Published;
      const right = published[j] as Published;
      const shared = [...(sourcesOf.get(left.id) ?? [])]
        .filter((id) => sourcesOf.get(right.id)?.has(id) === true)
        .sort((a, b) => a.localeCompare(b));
      const first = shared[0];
      if (first === undefined) continue;
      const publisher = publishers.get(first) ?? first;
      links.push({
        a: `node-${left.id}`,
        b: `node-${right.id}`,
        via: { en: `shared source: ${publisher}`, id: `sumber bersama: ${publisher}` },
      });
    }
  }
  writeJson(join(out, 'constellation.json'), { nodes, links });

  // --- pack feeds: one hero per pack; the fresh demo joins through the dissect flow (check 10)
  const packs = [...new Set(published.map((a) => a.pack))].sort((a, b) => a.localeCompare(b));
  for (const pack of packs) {
    const inPack = published.filter((a) => a.pack === pack);
    const viaDissect = inPack.filter((a) => a.id === demo?.narrative_id).map((a) => a.id);
    const heroPool = inPack.filter((a) => !viaDissect.includes(a.id));
    const hero = (heroPool[0] ?? inPack[0]) as Published;
    const items = inPack.map((artifact) => ({
      narrative_id: artifact.id,
      slot: artifact.id === hero.id ? 'hero' : 'compact',
      ...(viaDissect.includes(artifact.id) ? { via_dissect: true } : {}),
    }));
    writeJson(join(out, 'packs', pack, 'feed.json'), {
      pack,
      updated_at: manifest.generated_at,
      items,
    });
  }

  // --- methodology: symmetry from the leans actually published, metrics measured from the run
  const symmetry = { gov: 0, neutral: 0, opp: 0, computed_at: manifest.generated_at };
  for (const artifact of published) symmetry[artifact.lean] += 1;

  // Metrics are measured from each published narrative's OWN run ledger: the archive now spans
  // more than one recorded run, and a page aggregating only the latest run would silently drop
  // the earlier fleet's judging, blocks and latency, hardest on exactly the narratives a gate
  // sent back. provenance.run_id names the ledger each artifact came from.
  const runsRoot = dirname(resolve(args.run));
  const runDirOf = (artifact: Published): string => join(runsRoot, artifact.provenance.run_id);
  const runIds = [...new Set(published.map((artifact) => artifact.provenance.run_id))].sort();
  const runsLabel = runIds.join(' + ');

  const judged = published.filter((artifact) =>
    existsSync(slotPath(runDirOf(artifact), artifact.id, 'A10.json')),
  );
  const passed = judged.filter(
    (artifact) =>
      asStr(at(readJson(slotPath(runDirOf(artifact), artifact.id, 'A10.json')), 'verdict')) === 'pass',
  );
  const blockFiles = [...new Set(published.map((artifact) => runDirOf(artifact)))].flatMap((dir) => {
    const blockDir = join(dir, 'blocked');
    return existsSync(blockDir)
      ? readdirSync(blockDir)
          .filter((f) => f.endsWith('.json'))
          .map((f) => join(blockDir, f))
      : [];
  });
  const blocks = {
    total: blockFiles.length,
    narratives: new Set(blockFiles.map((f) => asStr(at(readJson(f), 'narrative_id')))).size,
  };
  // Timed from the RUN LOG, not from the published manifest. The manifest is stamped at A9 and
  // signed by the gate tokens, so it structurally cannot contain A10 and A11; timing off it
  // would silently drop the judging, and drop it hardest on exactly the narratives a gate sent
  // back, which is the flattering direction. The label says the span includes re-judging, so the
  // number has to.
  const walls = published
    .map((artifact) => wallSeconds(readSteps(runDirOf(artifact), artifact.id)))
    .filter((s): s is number => s !== undefined)
    .sort((a, b) => a - b);
  const median =
    walls.length === 0
      ? undefined
      : walls.length % 2 === 1
        ? (walls[(walls.length - 1) / 2] as number)
        : Math.round(((walls[walls.length / 2 - 1] as number) + (walls[walls.length / 2] as number)) / 2);
  const orphans = published.filter((artifact) => hasUnsourcedValue(artifact)).length;

  const metrics = [
    {
      key: 'published',
      label: { en: 'Dissections published from the recorded runs', id: 'Diseksi yang diterbitkan dari proses terekam' },
      kind: 'measured',
      value: String(published.length),
      run_id: runsLabel,
    },
    {
      key: 'audit_pass',
      // The parenthetical is load bearing. A12 refuses to publish a narrative without both gate
      // tokens, so this ratio can only ever read n of n, and stating it as a "pass rate" would
      // read as an auditor that approves everything. It is a structural fact, not a score.
      label: {
        en: 'Published dissections whose symmetry and fidelity verdicts both passed (none publishes otherwise)',
        id: 'Diseksi terbit yang kedua putusan gerbangnya lolos, simetri dan fidelitas (tidak ada yang terbit tanpa itu)',
      },
      kind: 'measured',
      value: judged.length === 0 ? 'not run' : `${passed.length} of ${judged.length}`,
      run_id: runsLabel,
    },
    {
      // The falsifiable companion to audit_pass: this one can read zero, and did not.
      key: 'gate_blocks',
      label: {
        en: 'Dissections a gate sent back for a fix before publication',
        id: 'Diseksi yang dikembalikan gerbang untuk diperbaiki sebelum terbit',
      },
      kind: 'measured',
      value: `${String(blocks.narratives)} of ${String(published.length)}, across ${String(blocks.total)} block(s)`,
      run_id: runsLabel,
    },
    {
      key: 'orphan_numbers',
      label: {
        en: 'Numbers rendered without a source identifier',
        id: 'Angka yang ditampilkan tanpa identitas sumber',
      },
      kind: 'measured',
      value: String(orphans),
      run_id: runsLabel,
    },
    // AC-PIPE-8 and D-3: the sub-3-minute figure ships as measured only if this run actually
    // hit it, otherwise it ships as the design target it is. The companion measurement is
    // labelled for what it really is, because these slots ran as a concurrent fleet and the
    // span includes queueing and any re-judging after a gate block. Read as serial per-dissection
    // cost it would be wrong by an order of magnitude, and overstating it is the same fault the
    // product exists to point at.
    ...(median !== undefined && median <= LATENCY_TARGET_SECONDS
      ? [
          {
            key: 'latency_median',
            label: {
              en: 'Median time to produce one dissection, first slot to last',
              id: 'Waktu median untuk menghasilkan satu diseksi, slot pertama hingga terakhir',
            },
            kind: 'measured',
            value: humanDuration(median),
            run_id: runsLabel,
          },
        ]
      : [
          {
            key: 'latency_target',
            label: {
              en: 'Time to produce one dissection',
              id: 'Waktu untuk menghasilkan satu diseksi',
            },
            kind: 'design_target',
            value: `under ${String(Math.round(LATENCY_TARGET_SECONDS / 60))} minutes, not met in the recorded runs`,
            run_id: runsLabel,
          },
          ...(median === undefined
            ? []
            : [
                {
                  key: 'latency_median',
                  label: {
                    en: 'Median wall clock per dissection across the recorded runs, fleets run concurrently, including any re-judging after a gate block',
                    id: 'Median waktu jam dinding per diseksi sepanjang proses terekam, armada berjalan serentak, termasuk penilaian ulang setelah gerbang memblokir',
                  },
                  kind: 'measured',
                  value: humanDuration(median),
                  run_id: runsLabel,
                },
              ]),
        ]),
  ];

  writeJson(join(out, 'methodology.json'), {
    symmetry,
    metrics,
    policy_65: POLICY_65,
    disclosure: {
      en: `Every dissection here was produced by an automated agent fleet and is labelled as such. Each artifact names the models that generated it and the run it came from, and the analysis is computed once, before anyone asks for it. This page aggregates ${runIds.length === 1 ? 'run' : 'runs'} ${runsLabel}.`,
      id: `Setiap diseksi di sini diproduksi oleh armada agen otomatis dan diberi label demikian. Tiap artefak menyebut model yang menghasilkannya dan proses asalnya, dan analisisnya dihitung sekali, sebelum ada yang memintanya. Halaman ini merangkum proses ${runsLabel}.`,
    },
  });

  console.log(
    `A13 librarian: ${published.length} narrative(s), ${entries.length} url index entr(ies), ` +
      `${links.length} constellation link(s), ${packs.length} pack feed(s), symmetry ` +
      `${symmetry.gov} gov / ${symmetry.neutral} neutral / ${symmetry.opp} opp`,
  );
}

/** A Value object that reached publication without a source id. C3 says there are none. */
function hasUnsourcedValue(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasUnsourcedValue);
  if (!isObj(node)) return false;
  if (node.amount !== undefined && node.unit !== undefined && asStr(node.source_id) === '') return true;
  return Object.values(node).some(hasUnsourcedValue);
}

/** PRD 6.5, published verbatim on the methodology page. Frozen copy, not generated. */
const POLICY_65 = {
  en: 'Matterhorn takes no position on whether any protest, boycott, or campaign should happen. Echo surfaces the documented costs of acting on broken causal models; it never frames collective action itself as the harm. Protest can be legitimate on imperfect information; the product’s contribution is that participants and observers see the structure of what they are being told.',
  id: 'Matterhorn tidak mengambil posisi tentang apakah suatu protes, boikot, atau kampanye sebaiknya terjadi. Echo memunculkan biaya terdokumentasi dari bertindak di atas model sebab akibat yang rusak; ia tidak pernah membingkai tindakan kolektif itu sendiri sebagai kerugiannya. Protes dapat sah dilakukan di atas informasi yang tidak sempurna; sumbangan produk ini adalah agar peserta dan pengamat melihat struktur dari apa yang sedang disampaikan kepada mereka.',
};

// --- dispatch ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertWired(executor);
  if (!existsSync(args.run) && args.stage !== 'A1') refuse(`${args.stage}: no run directory at ${args.run}`);
  switch (args.stage) {
    case 'A1': return stageA1(args);
    case 'A2': return stageA2(args);
    case 'A3': return stageA3(args);
    case 'A4': return stageA4(args);
    case 'A5':
    case 'A6':
    case 'A7':
    case 'A8':
    case 'A9': return stageAuthoringSlot(args, args.stage);
    case 'A10':
    case 'A11': return stageGate(args, args.stage);
    case 'A12': return stageA12(args);
    case 'A13': return stageA13(args);
  }
}

await main();
