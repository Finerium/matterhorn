/**
 * Content validator CLI. Blueprint 6.11, all ten checks.
 *
 *   pnpm validate:content [--dir <path>] [--scan-app <dir>]
 *
 * `--scan-app <dir>` widens check 7 from "no artifact carries seed: true" to "and no shipped
 * module imports a fixture": the directory is walked for .ts/.tsx/.js/.jsx/.mjs and every
 * module specifier that reaches tests/fixtures or a fixtures/seed path segment is a failure.
 * Without the flag nothing is scanned. Unknown arguments are a usage error, exit 2.
 *
 * Exit 0 only when every check passes. Exit 1 otherwise, with a FAIL line per offending
 * artifact on stderr naming the check slug and the file on one line, and the per-check table
 * on stdout either way. Every check runs on every invocation: a short-circuited run cannot
 * tell you what else is broken.
 *
 * Vacuous-when-absent semantics: each check quantifies over the artifacts that exist. With no
 * narratives in the root, the narrative-shaped checks pass with a detail note saying so, and
 * url_index / feed are only demanded once there are narratives to point at. `sources.json` is
 * the one artifact always required: a content root without a source registry is a hard
 * failure (this repeals the Gate 0 leniency, which passed an empty root).
 *
 * The validator never touches the network. Check 9 reads recorded liveness fields only.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import type { AnySchema, ValidateFunction } from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js'; // the schemas declare draft 2020-12
// The 6.11 check-6 token recipe lives in one place, shared with the seed stamper and A12.
import { gateToken } from '../pipeline/lib/canonical';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const CONTRACTS = join(REPO_ROOT, 'contracts');
const SCHEMA_DIR = join(CONTRACTS, 'schemas');

/** Loaded into ajv by filename so `$ref: "value.schema.json"` resolves. */
const SCHEMA_FILES = [
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
];

/** Artifact kind to the schema its whole file must satisfy. */
const KIND_SCHEMAS: Record<string, AnySchema> = {
  narrative: { $ref: 'narrative.schema.json' },
  feed: { $ref: 'feed.schema.json' },
  sources: { type: 'array', items: { $ref: 'source.schema.json' } },
  url_index: { $ref: 'url_index.schema.json' },
  case_library: { $ref: 'case_library.schema.json' },
  constellation: { $ref: 'constellation.schema.json' },
  methodology: { $ref: 'methodology.schema.json' },
  corrections: { $ref: 'corrections.schema.json' },
  og_attribution: { $ref: 'og_attribution.schema.json' },
};

// --- tiny unknown-shaped-data helpers -------------------------------------------------

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

/** DerivedCounts is a flat record of numbers, so key order and extra keys are the whole question. */
function sameCounts(stored: unknown, expected: Record<string, number>): boolean {
  if (!isObj(stored)) return false;
  return [...new Set([...Object.keys(stored), ...Object.keys(expected)])].every(
    (k) => stored[k] === expected[k],
  );
}

/**
 * Walks every string leaf. `path` drops array indices, so a leaf reads
 * `cases.documented_outcome.en` no matter which case it sits in; `key` is its own key and
 * `parent` the object holding it (which is how the Indonesian locale key `id` is told apart
 * from an identifier `id`: the locale one has an `en` sibling).
 */
function walkStrings(
  node: unknown,
  visit: (key: string, path: string, value: string, parent: Dict | undefined) => void,
  key = '',
  path = '',
  parent: Dict | undefined = undefined,
): void {
  if (Array.isArray(node)) {
    for (const item of node) walkStrings(item, visit, key, path, parent);
    return;
  }
  if (isObj(node)) {
    for (const [k, v] of Object.entries(node)) walkStrings(v, visit, k, path === '' ? k : `${path}.${k}`, node);
    return;
  }
  if (typeof node === 'string') visit(key, path, node, parent);
}

/** Every source id a subtree references: `source_id` keys and `citations` arrays. */
function collectRefs(node: unknown, out: Array<{ id: string; via: string }> = []): Array<{ id: string; via: string }> {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, out);
    return out;
  }
  if (!isObj(node)) return out;
  for (const [k, v] of Object.entries(node)) {
    if (k === 'source_id' && typeof v === 'string') out.push({ id: v, via: 'source_id' });
    else if (k === 'citations' && Array.isArray(v)) {
      for (const c of v) if (typeof c === 'string') out.push({ id: c, via: 'citations' });
    } else collectRefs(v, out);
  }
  return out;
}

function collectKeyed(node: unknown, key: string, into = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) collectKeyed(item, key, into);
    return into;
  }
  if (!isObj(node)) return into;
  for (const [k, v] of Object.entries(node)) {
    if (k === key && typeof v === 'string') into.add(v);
    else collectKeyed(v, key, into);
  }
  return into;
}

function carriesSeedFlag(node: unknown): boolean {
  if (Array.isArray(node)) return node.some((item) => carriesSeedFlag(item));
  if (!isObj(node)) return false;
  return Object.entries(node).some(([k, v]) => (k === 'seed' && v === true) || carriesSeedFlag(v));
}

// --- artifacts ------------------------------------------------------------------------

interface Artifact {
  /** Path relative to the content root, POSIX-ish, as printed. */
  rel: string;
  abs: string;
  kind: string;
  data: unknown;
  parseError?: string;
}

/** 6.11 file map: narratives/*.json to narrative, packs/{pack}/feed.json to feed, else basename. */
function kindOf(rel: string): string {
  const parts = rel.split(sep);
  if (parts.length >= 2 && parts[parts.length - 2] === 'narratives') return 'narrative';
  if (parts.length >= 3 && parts[0] === 'packs' && basename(rel) === 'feed.json') return 'feed';
  return basename(rel, '.json');
}

function readArtifacts(dir: string): Artifact[] {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.json'))
    .map((rel) => ({ rel, abs: join(dir, rel) }))
    .filter(({ abs }) => statSync(abs).isFile())
    .sort((a, b) => a.rel.localeCompare(b.rel))
    .map(({ rel, abs }) => {
      try {
        return { rel, abs, kind: kindOf(rel), data: JSON.parse(readFileSync(abs, 'utf8')) as unknown };
      } catch (err) {
        return {
          rel,
          abs,
          kind: kindOf(rel),
          data: undefined,
          parseError: err instanceof Error ? err.message : String(err),
        };
      }
    });
}

// --- lexicon (6.9, as data) -------------------------------------------------------------

interface Lexicon {
  /** `phrases` are regex sources: constructions a word list cannot express, like `fact-check:`. */
  verdict: { en: string[]; id: string[]; phrases: Array<{ label: string; pattern: string }> };
  future_harm: { scope: string[]; patterns: string[]; hedge: string; harm_nouns: string[] };
  style: { banned_chars: Array<{ char: string; name: string }>; emoji_pattern: string };
  not_copy_keys: { keys: string[] };
  exemptions: Array<{ file: string; key: string; rules: string[]; condition?: string; why: string }>;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (word: string): RegExp => new RegExp(`\\b${escapeRe(word)}\\b`, 'i');

// --- the run --------------------------------------------------------------------------

type Status = 'pass' | 'fail';
interface Failure {
  file: string;
  message: string;
}
interface Row {
  slug: string;
  status: Status;
  detail: string;
  failures: Failure[];
}

const ok = (slug: string, detail: string): Row => ({ slug, status: 'pass', detail, failures: [] });
const row = (slug: string, detail: string, failures: Failure[]): Row => ({
  slug,
  status: failures.length === 0 ? 'pass' : 'fail',
  detail: failures.length === 0 ? detail : `${failures.length} failure(s)`,
  failures,
});

interface Ctx {
  dir: string;
  /** --scan-app, resolved. Undefined means check 7 asks the content root only. */
  scanApp: string | undefined;
  label: string;
  artifacts: Artifact[];
  narratives: Artifact[];
  narrativeIds: Set<string>;
  sources: Artifact | undefined;
  sourceIds: Set<string>;
  lexicon: Lexicon;
  tagKeys: Set<string>;
  ajv: InstanceType<typeof Ajv2020>;
}

// 1. every artifact validates against its JSON Schema
function checkSchema(ctx: Ctx): Row {
  const failures: Failure[] = [];
  if (ctx.sources === undefined) {
    failures.push({
      file: join(ctx.label, 'sources.json'),
      message: existsSync(ctx.dir)
        ? 'the content root carries no source registry, and sources.json is required'
        : `content root ${ctx.dir} does not exist`,
    });
  }
  let validated = 0;
  const unmapped: string[] = [];
  for (const a of ctx.artifacts) {
    if (a.parseError !== undefined) {
      failures.push({ file: a.rel, message: `unparseable JSON: ${a.parseError}` });
      continue;
    }
    const schema = KIND_SCHEMAS[a.kind];
    if (schema === undefined) {
      unmapped.push(a.rel);
      continue;
    }
    const validate = ctx.ajv.compile(schema);
    if (validate(a.data)) validated += 1;
    else failures.push({ file: a.rel, message: formatErrors(validate) });

    // Appendix B: the validator enforces technique-tag membership, keys locked. 6.3: panels
    // are ordered with claim_map always first.
    if (a.kind === 'narrative') {
      for (const tag of asArr(at(a.data, 'tags'))) {
        if (typeof tag !== 'string' || !ctx.tagKeys.has(tag)) {
          failures.push({ file: a.rel, message: `tag ${JSON.stringify(tag)} is not in contracts/technique-tags.json` });
        }
      }
      const first = asArr(at(a.data, 'panels'))[0];
      if (first !== undefined && at(first, 'type') !== 'claim_map') {
        failures.push({ file: a.rel, message: `panels[0] is "${asStr(at(first, 'type'))}", and claim_map is always first` });
      }
    }
  }
  const note = unmapped.length > 0 ? `; no schema mapped for ${unmapped.join(', ')}` : '';
  return row('schema', `${validated} artifact(s) conform${note}`, failures);
}

// 2. zero orphan numbers: every Value.source_id and every citations[] id resolves
function checkOrphans(ctx: Ctx): Row {
  const failures: Failure[] = [];
  let resolved = 0;
  for (const a of ctx.artifacts) {
    if (a.kind === 'sources') continue;
    for (const ref of collectRefs(a.data)) {
      if (ctx.sourceIds.has(ref.id)) resolved += 1;
      else failures.push({ file: a.rel, message: `${ref.via} "${ref.id}" does not resolve in sources.json` });
    }
  }
  return row('orphans', resolved === 0 ? 'no source references in this root' : `${resolved} source reference(s) resolve`, failures);
}

/** 6.5 derivation plus the CF-1 additive optional `conflicts`. Never authored. */
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

// 3. counts recomputation matches stored counts exactly
function checkCounts(ctx: Ctx): Row {
  const failures: Failure[] = [];
  for (const a of ctx.narratives) {
    const stored = at(a.data, 'counts');
    const expected = deriveCounts(asArr(at(a.data, 'panels')));
    if (!sameCounts(stored, expected)) {
      failures.push({
        file: a.rel,
        message: `stored counts ${JSON.stringify(stored)} do not match the recomputation ${JSON.stringify(expected)}`,
      });
    }
  }
  return row('counts', vacuous(ctx, `${ctx.narratives.length} narrative(s) match their recomputation`), failures);
}

// 4. 100 percent narration binding, both languages
function checkNarration(ctx: Ctx): Row {
  const failures: Failure[] = [];
  for (const a of ctx.narratives) {
    const declared = collectKeyed(a.data, 'el_id');
    const panelEls = asArr(at(a.data, 'panels')).map((p) => asStr(at(p, 'el_id')));
    const echoEl = asStr(at(a.data, 'echo', 'el_id'));
    if (echoEl !== '') panelEls.push(echoEl);

    for (const lang of ['en', 'id'] as const) {
      const covered = new Set<string>();
      for (const sentence of asArr(at(a.data, 'narration', lang, 'sentences'))) {
        for (const el of asArr(at(sentence, 'els'))) {
          if (typeof el === 'string' && declared.has(el)) covered.add(el);
          else {
            failures.push({
              file: a.rel,
              message: `narration.${lang} sentence "${asStr(at(sentence, 'id'))}" points at el_id ${JSON.stringify(el)}, which no element declares`,
            });
          }
        }
      }
      for (const el of panelEls) {
        if (!covered.has(el)) {
          failures.push({ file: a.rel, message: `panel "${el}" has no ${lang} narration sentence` });
        }
      }
    }
  }
  return row('narration', vacuous(ctx, `${ctx.narratives.length} narrative(s) bind every panel in both languages`), failures);
}

// 5. lexicon, future-tense-harm, and style lint across the content artifacts
function checkLexicon(ctx: Ctx): Row {
  const lex = ctx.lexicon;
  const failures: Failure[] = [];
  const notCopy = new Set(lex.not_copy_keys.keys);
  const verdicts = [
    ...[...lex.verdict.en, ...lex.verdict.id].map((w) => ({ word: w, re: wholeWord(w) })),
    ...lex.verdict.phrases.map((p) => ({ word: p.label, re: new RegExp(p.pattern, 'i') })),
  ];
  const emoji = new RegExp(lex.style.emoji_pattern, 'u');
  const harmNouns = lex.future_harm.harm_nouns.map(escapeRe).join('|');
  const futurePatterns = lex.future_harm.patterns.map((p) => ({ label: p, re: wholeWord(p) }));
  const hedge = {
    label: `${lex.future_harm.hedge} plus a harm noun`,
    re: new RegExp(`\\b${escapeRe(lex.future_harm.hedge)}\\b[^.]{0,40}?\\b(?:${harmNouns})\\b`, 'i'),
  };
  const exemptionsUsed = new Map<string, number>();
  let linted = 0;

  /** `id` is the Indonesian locale key as well as an identifier key; the `en` sibling tells them apart. */
  const inScope = (key: string, path: string, parent: Dict | undefined): boolean =>
    path !== '' && (!notCopy.has(key) || (key === 'id' && typeof parent?.en === 'string'));
  const exemptionFor = (a: Artifact, path: string, rule: string) =>
    lex.exemptions.find(
      (e) =>
        basename(a.rel) === e.file &&
        e.rules.includes(rule) &&
        (path === e.key || path.startsWith(`${e.key}.`)),
    );

  for (const a of ctx.artifacts) {
    walkStrings(a.data, (key, path, text, parent) => {
      if (!inScope(key, path, parent)) return;
      linted += 1;

      for (const { word, re } of verdicts) {
        if (!re.test(text)) continue;
        const exemption = exemptionFor(a, path, 'verdict');
        if (exemption === undefined) {
          failures.push({ file: a.rel, message: `verdict "${word}" at ${path}: ${clip(text)}` });
          continue;
        }
        if (exemption.condition === 'quoted_with_citation' && !quotedWithCitation(a.data, text)) {
          failures.push({
            file: a.rel,
            message: `verdict "${word}" at ${path} is only exempt when quoted with a citation: ${clip(text)}`,
          });
          continue;
        }
        exemptionsUsed.set(`${exemption.file} ${exemption.key}`, (exemptionsUsed.get(`${exemption.file} ${exemption.key}`) ?? 0) + 1);
      }

      for (const { char, name } of lex.style.banned_chars) {
        if (text.includes(char)) failures.push({ file: a.rel, message: `banned character ${name} at ${path}: ${clip(text)}` });
      }
      if (emoji.test(text)) failures.push({ file: a.rel, message: `emoji at ${path}: ${clip(text)}` });

      // A scope entry is a run of consecutive keys, matched wherever it sits in the path, so
      // the same Echo outcome text is in scope at echo.historical.outcome and, when 6.3 puts
      // the panel in panels[], at panels.historical.outcome. Boundaries are dotted on both
      // sides: "historical.outcome" never matches a key merely ending in "outcome".
      if (!lex.future_harm.scope.some((s) => `.${path}.`.includes(`.${s}.`))) return;
      for (const { label, re } of [...futurePatterns, hedge]) {
        if (re.test(text)) {
          failures.push({ file: a.rel, message: `future-tense harm "${label}" at ${path}, which must read as past tense: ${clip(text)}` });
        }
      }
    });
  }

  const applied = [...exemptionsUsed].map(([k, n]) => `${k} x${n}`).join(', ');
  const detail = `${linted} copy string(s) lint clean${applied === '' ? '' : `; 6.9 exemption applied: ${applied}`}`;
  return row('lexicon', detail, failures);
}

/** 6.9: the case-library exemption holds only for an institution's words in quotes with a citation. */
function quotedWithCitation(data: unknown, text: string): boolean {
  if (!/"[^"]{2,}"|“[^”]{2,}”/.test(text)) return false;
  return asArr(at(data, 'cases')).some(
    (c) =>
      Object.values(isObj(at(c, 'documented_outcome')) ? (at(c, 'documented_outcome') as Dict) : {}).includes(text) &&
      asArr(at(c, 'citations')).length > 0,
  );
}

// 6. a complete GenerationManifest whose gate tokens verify against the artifact bytes
function checkManifest(ctx: Ctx): Row {
  const failures: Failure[] = [];
  for (const a of ctx.narratives) {
    const manifest = at(a.data, 'manifest');
    if (!isObj(manifest)) {
      failures.push({ file: a.rel, message: 'no generation manifest' });
      continue;
    }
    const missing = ['run_id', 'generated_at'].filter((k) => asStr(manifest[k]) === '');
    if (asArr(manifest.steps).length === 0) missing.push('steps');
    for (const step of asArr(manifest.steps)) {
      for (const k of ['role', 'model', 'started_at', 'finished_at', 'input_hash']) {
        if (asStr(at(step, k)) === '') missing.push(`steps[].${k}`);
      }
    }
    if (missing.length > 0) {
      failures.push({ file: a.rel, message: `incomplete generation manifest, missing ${[...new Set(missing)].join(', ')}` });
    }

    const expected = gateToken(a.data);
    for (const gate of ['symmetry', 'fidelity'] as const) {
      const token = at(manifest, 'gates', gate, 'token');
      if (typeof token !== 'string' || token === '') {
        failures.push({ file: a.rel, message: `gate "${gate}" carries no token` });
      } else if (token !== expected) {
        failures.push({
          file: a.rel,
          message: `gate "${gate}" token does not verify against the artifact bytes (stored ${token.slice(0, 12)}..., computed ${expected.slice(0, 12)}...)`,
        });
      }
    }
  }
  return row('manifest', vacuous(ctx, `${ctx.narratives.length} manifest(s) complete, both gate tokens verify`), failures);
}

/** Module specifiers: `import x from "S"`, bare `import "S"`, `export ... from "S"`, `import("S")`, `require("S")`. */
const SPECIFIER = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;
const SCANNED_SOURCE = /\.(?:ts|tsx|js|jsx|mjs)$/;
/** A specifier that reaches test fixtures or seed data. Shipped code imports neither. */
const reachesFixtures = (spec: string): boolean =>
  spec.includes('tests/fixtures') || /(?:^|\/)(?:fixtures|seed)(?:\/|$)/.test(spec);

/**
 * Check 7's second conjunct: no shipped module imports a fixture. Static text scan, because
 * the question is what the bundler would pull in, which the specifier string already answers.
 * ponytail: no node_modules or dist filter, --scan-app is pointed at an app source tree by
 * hand. Ceiling: aim it at a repo root and it reads every dependency on disk.
 */
function scanAppImports(dir: string): { scanned: number; failures: Failure[] } {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { scanned: 0, failures: [{ file: dir, message: '--scan-app directory does not exist' }] };
  }
  const failures: Failure[] = [];
  const files = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((rel) => SCANNED_SOURCE.test(rel) && statSync(join(dir, rel)).isFile())
    .sort((a, b) => a.localeCompare(b));
  for (const rel of files) {
    for (const match of readFileSync(join(dir, rel), 'utf8').matchAll(SPECIFIER)) {
      const spec = match[1] ?? '';
      if (reachesFixtures(spec)) {
        failures.push({ file: rel, message: `imports "${spec}", and shipped modules never import test fixtures or seed data` });
      }
    }
  }
  return { scanned: files.length, failures };
}

// 7. zero fixtures: no artifact carries "seed": true, and with --scan-app, no module imports one
function checkSeed(ctx: Ctx): Row {
  const failures = ctx.artifacts
    .filter((a) => carriesSeedFlag(a.data))
    .map((a) => ({ file: a.rel, message: 'artifact carries "seed": true, which never ships in content' }));
  const scan = ctx.scanApp === undefined ? undefined : scanAppImports(ctx.scanApp);
  const scanned = scan === undefined ? '' : `; ${scan.scanned} module(s) under ${ctx.scanApp} import no fixture or seed data`;
  return row('seed', `${ctx.artifacts.length} artifact(s) carry no seed flag${scanned}`, [
    ...failures,
    ...(scan?.failures ?? []),
  ]);
}

// 8. url_index referential integrity and exactly one fresh_demo entry
function checkUrlIndex(ctx: Ctx): Row {
  const index = ctx.artifacts.find((a) => a.kind === 'url_index');
  if (index === undefined) {
    if (ctx.narratives.length === 0) return ok('url-index', 'no narratives in this root, no url index demanded');
    return row('url-index', '', [
      { file: join(ctx.label, 'url_index.json'), message: 'the root carries narratives but no url index' },
    ]);
  }
  const failures: Failure[] = [];
  const entries = asArr(at(index.data, 'entries'));
  for (const entry of entries) {
    const id = asStr(at(entry, 'narrative_id'));
    const pattern = asStr(at(entry, 'pattern'));
    if (!ctx.narrativeIds.has(id)) {
      failures.push({ file: index.rel, message: `pattern "${pattern}" points at narrative "${id}", which does not exist` });
    }
    // An entry the router will feed to the regex engine is compiled here, where a bad pattern
    // is a Gate 1 failure, rather than at request time where it is a 500. Called, not `new`ed:
    // RegExp() compiles and throws identically and leaves no unused binding behind.
    if (at(entry, 'match') === 'regex') {
      try {
        RegExp(pattern);
      } catch (err) {
        failures.push({
          file: index.rel,
          message: `match "regex" pattern "${pattern}" for narrative "${id}" does not compile: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }
  const fresh = entries.filter((e) => at(e, 'role') === 'fresh_demo').length;
  if (fresh !== 1) failures.push({ file: index.rel, message: `${fresh} entries carry role fresh_demo, and exactly 1 is required` });
  return row('url-index', `${entries.length} entries resolve, exactly 1 fresh_demo`, failures);
}

// 9. sources liveness, from the recorded fields only. This check never fetches anything.
function checkLiveness(ctx: Ctx): Row {
  const failures: Failure[] = [];
  const recordedStatus = /\b(?:status|HTTP)\s+(\d{3})\b/gi;
  const corroborated = /corroborat|verified live|manual (?:browser )?check/i;
  const sources = asArr(ctx.sources?.data);
  const file = ctx.sources?.rel ?? 'sources.json';
  for (const source of sources) {
    const id = asStr(at(source, 'id'));
    const notes = asStr(at(source, 'notes'));
    const liveness = asStr(at(source, 'liveness'));
    if (liveness === 'dead_replaced') {
      if (notes.trim() === '') {
        failures.push({ file, message: `source "${id}" is dead_replaced with no note recording the replacement` });
      }
      continue;
    }
    // "unverified" is the one liveness state that means nobody could confirm this, so it is
    // the one that may not ship unexplained. The status scan below still applies to it.
    if (liveness === 'unverified' && notes.trim() === '') {
      failures.push({ file, message: `source "${id}" is unverified with no note recording what could not be confirmed` });
    }
    const errors = [...notes.matchAll(recordedStatus)].map((m) => Number(m[1])).filter((code) => code >= 400);
    if (errors.length > 0 && !corroborated.test(notes)) {
      failures.push({
        file,
        message: `source "${id}" is ${liveness} and its notes record status ${errors.join(', ')} with no corroboration; record dead_replaced or the corroborating check`,
      });
    }
  }
  return row('liveness', `${sources.length} source(s) live at snapshot, replaced with a note, or corroborated`, failures);
}

// 10. feed integrity: items resolve, exactly one hero per pack, ppn-panic flagged via_dissect
function checkFeed(ctx: Ctx): Row {
  const feeds = ctx.artifacts.filter((a) => a.kind === 'feed');
  if (feeds.length === 0) {
    if (ctx.narratives.length === 0) return ok('feed', 'no narratives in this root, no feed demanded');
    return row('feed', '', [
      { file: join(ctx.label, 'packs', '*', 'feed.json'), message: 'the root carries narratives but no pack feed' },
    ]);
  }
  const failures: Failure[] = [];
  for (const feed of feeds) {
    const items = asArr(at(feed.data, 'items'));
    for (const item of items) {
      const id = asStr(at(item, 'narrative_id'));
      if (!ctx.narrativeIds.has(id)) failures.push({ file: feed.rel, message: `item "${id}" resolves to no narrative` });
      if (id === 'ppn-panic' && at(item, 'via_dissect') !== true) {
        failures.push({ file: feed.rel, message: 'ppn-panic enters through the fresh-dissect demo and must carry via_dissect true' });
      }
    }
    const heroes = items.filter((i) => at(i, 'slot') === 'hero').length;
    if (heroes !== 1) {
      failures.push({ file: feed.rel, message: `pack "${asStr(at(feed.data, 'pack'))}" carries ${heroes} hero items, and exactly 1 is required` });
    }
  }
  return row('feed', `${feeds.length} pack feed(s) resolve with one hero each`, failures);
}

// --- reporting ------------------------------------------------------------------------

const clip = (s: string): string => (s.length > 80 ? `${s.slice(0, 77)}...` : s);
const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();
const vacuous = (ctx: Ctx, detail: string): string =>
  ctx.narratives.length === 0 ? 'no narratives in this root, nothing to check' : detail;

function formatErrors(validate: ValidateFunction): string {
  const errors = validate.errors ?? [];
  const shown = errors
    .slice(0, 5)
    .map((e) => `${e.instancePath === '' ? '(root)' : e.instancePath} ${e.message ?? 'invalid'}`);
  if (errors.length > shown.length) shown.push(`plus ${errors.length - shown.length} more`);
  return shown.join('; ');
}

function printTable(rows: Row[]): void {
  const cells = [
    { slug: 'CHECK', status: 'STATUS', detail: 'DETAIL' },
    ...rows.map((r) => ({ slug: r.slug, status: r.status, detail: oneLine(r.detail) })),
  ];
  const width = (pick: (c: (typeof cells)[number]) => string): number => Math.max(...cells.map((c) => pick(c).length));
  const wSlug = width((c) => c.slug);
  const wStatus = width((c) => c.status);
  for (const c of cells) console.log(`${c.slug.padEnd(wSlug)}  ${c.status.padEnd(wStatus)}  ${c.detail}`);
}

function usageError(message: string): never {
  console.error(`validate:content: ${message}`);
  console.error('usage: validate:content [--dir <path>] [--scan-app <dir>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { dir: string; scanApp: string | undefined } {
  // Unknown arguments are rejected rather than ignored: a silently dropped flag is how the
  // unimplemented app scan went unnoticed. Every flag takes exactly one path, so step by two.
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--dir' && flag !== '--scan-app') usageError(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usageError(`${flag} needs a path`);
    flags.set(flag, value);
  }
  const dir = flags.get('--dir');
  const scanApp = flags.get('--scan-app');
  return {
    dir: dir === undefined ? join(REPO_ROOT, 'content') : resolve(dir),
    scanApp: scanApp === undefined ? undefined : resolve(scanApp),
  };
}

function main(): void {
  const { dir, scanApp } = parseArgs(process.argv.slice(2));
  const inRepo = relative(REPO_ROOT, dir);
  const label = inRepo !== '' && !inRepo.startsWith('..') ? inRepo : dir;

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  for (const name of SCHEMA_FILES) {
    ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, name), 'utf8')) as AnySchema, name);
  }
  const lexicon = JSON.parse(readFileSync(join(CONTRACTS, 'lexicon.json'), 'utf8')) as Lexicon;
  const tags = JSON.parse(readFileSync(join(CONTRACTS, 'technique-tags.json'), 'utf8')) as {
    tags: Array<{ key: string }>;
  };

  const artifacts = readArtifacts(dir);
  const narratives = artifacts.filter((a) => a.kind === 'narrative' && a.parseError === undefined);
  const sources = artifacts.find((a) => a.kind === 'sources' && a.parseError === undefined);
  const ctx: Ctx = {
    dir,
    scanApp,
    label,
    artifacts,
    narratives,
    narrativeIds: new Set(narratives.map((a) => asStr(at(a.data, 'id')))),
    sources,
    sourceIds: new Set(asArr(sources?.data).map((s) => asStr(at(s, 'id')))),
    lexicon,
    tagKeys: new Set(tags.tags.map((t) => t.key)),
    ajv,
  };

  // Order is 6.11's. Every check runs; none may short-circuit another.
  const rows = [
    checkSchema(ctx),
    checkOrphans(ctx),
    checkCounts(ctx),
    checkNarration(ctx),
    checkLexicon(ctx),
    checkManifest(ctx),
    checkSeed(ctx),
    checkUrlIndex(ctx),
    checkLiveness(ctx),
    checkFeed(ctx),
  ];

  console.log(`validate:content ${label}${sep} (${artifacts.length} artifact(s), ${narratives.length} narrative(s))`);
  console.log('');
  printTable(rows);

  const failed = rows.filter((r) => r.status === 'fail');
  if (failed.length > 0) {
    console.error('');
    for (const r of failed) {
      for (const f of r.failures) console.error(`FAIL ${r.slug} ${f.file}: ${oneLine(f.message)}`);
    }
    console.error(`FAIL ${failed.length} of ${rows.length} checks in ${label}${sep}: ${failed.map((r) => r.slug).join(', ')}`);
    process.exit(1);
  }
  console.log('');
  console.log(`OK: ${artifacts.length} artifact(s) in ${label}${sep} pass all ten checks of blueprint 6.11.`);
}

main();
