/**
 * Distills the committed run log into `content/replay.json`, the data behind the research
 * desk's "Run the fleet" replay.
 *
 *   tsx scripts/build-replay.ts [--run <run dir>] [--out <content root>]
 *
 * The replay is a LABELLED REPLAY of the editorial run (blueprint 3.4 honesty rules), so
 * everything here is read from the run directory and nothing is invented: model identities come
 * from steps.json as the executors reported them, verdicts and their reasons come from the
 * gate verdict files, the block rounds come from blocked/*.json, and the token prefix comes
 * from the published artifact. Per-step screen time is deliberately NOT carried: most recorded
 * step timestamps bracket the runner's ingest rather than the agent's wall clock, and a number
 * that looks like a measurement but is not one is the exact class of dishonesty this product
 * exists to point at. The UI paces the replay theatrically under an honest "compressed, not to
 * scale" label instead.
 *
 * Strict argv, same contract as the sibling scripts: an unknown flag exits 2.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Dict = Record<string, unknown>;
const readJson = <T = Dict>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function usage(message: string): never {
  console.error(`build-replay: ${message}`);
  console.error('usage: tsx scripts/build-replay.ts [--run <run dir>] [--out <content root>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { run: string; out: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--run' && flag !== '--out') usage(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usage(`${flag} needs a value`);
    if (flags.has(flag)) usage(`${flag} was given twice`);
    flags.set(flag, value);
  }
  return {
    run: resolve(flags.get('--run') ?? 'pipeline/runs/run-2026-07-29'),
    out: resolve(flags.get('--out') ?? 'content'),
  };
}

/** The fleet's own names for its slots, the label a console line leads with. */
const ROLE_LABEL: Record<string, { en: string; id: string }> = {
  A1: { en: 'Scout · sweeping the feeds for candidate headlines', id: 'Scout · menyapu kanal berita mencari kandidat' },
  A2: { en: 'Ingestor · archiving and normalising the articles', id: 'Ingestor · mengarsipkan dan menormalkan artikel' },
  A3: { en: 'Clusterer · grouping members of the same story', id: 'Clusterer · mengelompokkan artikel satu cerita' },
  A4: { en: 'Prioritizer · deciding what deserves a fleet run', id: 'Prioritizer · menentukan yang layak diteliti armada' },
  A5: { en: 'Causal Extractor · mapping the asserted spine', id: 'Causal Extractor · memetakan rangka klaim' },
  A6: { en: 'Hidden-Node Hunter · hunting what the story prices at zero', id: 'Hidden-Node Hunter · memburu yang dihargai nol oleh berita' },
  A7: { en: 'Evidence Grounder · attaching sources, refusing orphan numbers', id: 'Evidence Grounder · menambatkan sumber, menolak angka tanpa sumber' },
  A8: { en: 'Cascade Historian · searching the case library for echoes', id: 'Cascade Historian · mencari gema di pustaka kasus' },
  A9: { en: 'Narrator · writing both languages from the locked graph', id: 'Narrator · menulis dua bahasa dari graf terkunci' },
  A10: { en: 'Symmetry Auditor · dissecting the mirror framing', id: 'Symmetry Auditor · membedah bingkai cermin' },
  A11: { en: 'Fidelity Guard · tracing every sentence to the graph', id: 'Fidelity Guard · menelusuri tiap kalimat ke graf' },
  A12: { en: 'Publisher · verifying the gate seals before release', id: 'Publisher · memverifikasi segel gerbang sebelum terbit' },
  A13: { en: 'Librarian · filing the dissection into the library', id: 'Librarian · mengarsipkan hasil bedah ke pustaka' },
};

/** The curation stages run as deterministic code, and their console line says so. */
const NO_MODEL = 'deterministic';

/**
 * `voices.json` in the run directory: an editorial distillation of each agent's recorded output,
 * written after the run from the slot and stage files, per narrative per role, both locales. It
 * is display prose, not a pipeline artifact, and the disclosure names it as a distillation; the
 * facts inside it trace to the same directory this script reads. Absent file means no notes.
 */
type Note = { en: string; id: string };
type Voices = { narratives: Record<string, Record<string, Note>> };

interface Step {
  role: string;
  model: string;
  started_at: string;
  finished_at: string;
}
interface Verdict {
  verdict: string;
  reasons?: string[];
  model?: string;
  token?: string;
}
interface BlockRecord {
  narrative_id: string;
  role: string;
  gate: string;
  reasons?: string[];
  judged_by?: string;
}

/**
 * First sentence of a gate reason, trimmed to a console line. The verdict files quote judges
 * who write for the run log, not for readers, so display typography is normalised here: an em
 * or en dash becomes the colon or comma the sentence means, because C8 bans the character in
 * user-facing copy and replay.json is user-facing. The record itself stays verbatim in
 * pipeline/runs/; this file is a display distillation and says so in its own description.
 */
function firstSentence(reason: string | undefined): string {
  if (reason === undefined) return '';
  const cut = reason.split(/(?<=[.!?])\s/)[0] ?? reason;
  const display = cut
    .replace(/\s+[\u2014\u2013]\s+/g, ': ')
    .replace(/[\u2014\u2013]/g, ', ');
  return display.length > 220 ? `${display.slice(0, 217)}...` : display;
}

/** Stage evidence test: the file carries a member id of the narrative, `<id>-m1` and siblings. */
const memberCheck = (rows: { id: string }[]) => (id: string) => rows.some((r) => r.id.startsWith(`${id}-m`));

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const runManifest = readJson<{ run_id: string; generated_at: string; narratives: string[] }>(
    join(args.run, 'run.json'),
  );

  const blockedDir = join(args.run, 'blocked');
  const blocks = (existsSync(blockedDir) ? readdirSync(blockedDir) : [])
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<BlockRecord>(join(blockedDir, f)));

  const voicesPath = join(args.run, 'voices.json');
  const voices: Voices = existsSync(voicesPath) ? readJson<Voices>(voicesPath) : { narratives: {} };

  // The curation stages' evidence, read once: a stage line for a narrative appears only when
  // that stage's recorded file actually carries the narrative's members or cluster.
  const stageHas: Record<'A1' | 'A2' | 'A3' | 'A4', (id: string) => boolean> = {
    A1: memberCheck(readJson<{ records: { id: string }[] }>(join(args.run, 'stages', 'A1.json')).records),
    A2: memberCheck(readJson<{ records: { id: string }[] }>(join(args.run, 'stages', 'A2.json')).records),
    A3: memberCheck(readJson<{ assignments: { id: string }[] }>(join(args.run, 'stages', 'A3.json')).assignments),
    A4: (() => {
      const ranked = readJson<{ ranked: { cluster: string }[] }>(join(args.run, 'stages', 'A4.json')).ranked;
      return (id: string) => ranked.some((r) => r.cluster.startsWith(`c-${id}-`));
    })(),
  };
  const constellation = readJson<{ nodes: { narrative_id: string }[] }>(join(args.out, 'constellation.json'));

  const modelsSeen = new Set<string>();
  const narratives = runManifest.narratives.map((id) => {
    const slotDir = join(args.run, 'slots', id);
    const steps = readJson<{ steps: Step[] }>(join(slotDir, 'steps.json')).steps;
    const noteOf = (role: string): { note?: Note } => {
      const note = voices.narratives[id]?.[role];
      return note === undefined ? {} : { note };
    };

    // A1 to A4 first: the curation acts recorded at run level, deterministic code, no model.
    const events: Dict[] = (['A1', 'A2', 'A3', 'A4'] as const)
      .filter((role) => stageHas[role](id))
      .map((role) => ({
        kind: 'slot',
        role,
        label: ROLE_LABEL[role],
        model: NO_MODEL,
        at: runManifest.generated_at,
        ...noteOf(role),
      }));

    // The judges' notes describe their verdicts, so they ride the verdict events below, not the
    // started-work slot lines: one note per role, said where it happened.
    events.push(
      ...steps
        .filter((s) => s.finished_at !== '' && ROLE_LABEL[s.role] !== undefined)
        .map((s) => {
          modelsSeen.add(s.model);
          return {
            kind: 'slot',
            role: s.role,
            label: ROLE_LABEL[s.role],
            model: s.model,
            at: s.started_at,
            ...(s.role === 'A10' || s.role === 'A11' ? {} : noteOf(s.role)),
          };
        }),
    );

    // The block rounds this narrative actually went through, in file order, which is round
    // order by construction of the ledger's -1/-2 suffixes.
    for (const b of blocks.filter((x) => x.narrative_id === id)) {
      events.push({
        kind: 'block',
        role: b.role,
        gate: b.gate,
        judged_by: b.judged_by ?? '',
        reason: firstSentence(b.reasons?.[0]),
      });
    }

    for (const role of ['A10', 'A11'] as const) {
      const path = join(slotDir, `${role}.json`);
      if (!existsSync(path)) continue;
      const v = readJson<Verdict>(path);
      if (v.model !== undefined) modelsSeen.add(v.model);
      events.push({
        kind: 'verdict',
        role,
        gate: role === 'A10' ? 'symmetry' : 'fidelity',
        verdict: v.verdict,
        model: v.model ?? '',
        summary: firstSentence(v.reasons?.[0]),
        ...noteOf(role),
      });
    }

    // The published artifact carries the tokens the run minted; absence means unpublished.
    const artifact = join(args.out, 'narratives', `${id}.json`);
    let token = '';
    if (existsSync(artifact)) {
      const gates = readJson<{ manifest?: { gates?: { symmetry?: { token?: string } } } }>(artifact)
        .manifest?.gates;
      token = gates?.symmetry?.token?.slice(0, 12) ?? '';
    }

    // A12 verified the seals it published with; A13's filing is the constellation node the
    // artifact set actually carries. Both deterministic code, both only when the evidence is.
    if (token !== '') {
      events.push({ kind: 'slot', role: 'A12', label: ROLE_LABEL.A12, model: NO_MODEL, at: runManifest.generated_at, ...noteOf('A12') });
    }
    if (constellation.nodes.some((n) => n.narrative_id === id)) {
      events.push({ kind: 'slot', role: 'A13', label: ROLE_LABEL.A13, model: NO_MODEL, at: runManifest.generated_at, ...noteOf('A13') });
    }
    events.push({ kind: 'published', token });

    return { narrative_id: id, blocked_rounds: blocks.filter((x) => x.narrative_id === id).length, events };
  });

  const replay = {
    run_id: runManifest.run_id,
    generated_at: runManifest.generated_at,
    // The honest frame the UI must keep visible, both locales, no em dash, no emoji.
    disclosure: {
      en: `Replay of editorial run ${runManifest.run_id}. Every step, model, verdict and block below is the recorded run; the indented output lines are an editorial distillation of each agent's recorded output files; on-screen pacing is compressed and not to scale.`,
      id: `Pemutaran ulang proses editorial ${runManifest.run_id}. Setiap langkah, model, putusan dan blokir di bawah ini adalah rekaman proses aslinya; baris keluaran yang menjorok adalah saripati editorial dari berkas keluaran tiap agen yang terekam; tempo di layar dipadatkan dan tidak berskala.`,
    },
    models: [...modelsSeen].sort((a, b) => a.localeCompare(b)),
    narratives_total: narratives.length,
    narratives_blocked: new Set(blocks.map((b) => b.narrative_id)).size,
    blocks_total: blocks.length,
    narratives,
  };

  const outPath = join(args.out, 'replay.json');
  writeFileSync(outPath, `${JSON.stringify(replay, null, 2)}\n`);
  const events = narratives.reduce((n, x) => n + x.events.length, 0);
  console.log(
    `build-replay: ${outPath} carries ${String(narratives.length)} narrative(s), ${String(events)} event(s), ` +
      `${String(replay.blocks_total)} real block record(s), ${String(replay.models.length)} model identit(ies)`,
  );
}

main();
