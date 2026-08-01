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
  A5: { en: 'Causal Extractor · mapping the asserted spine', id: 'Causal Extractor · memetakan rangka klaim' },
  A6: { en: 'Hidden-Node Hunter · hunting what the story prices at zero', id: 'Hidden-Node Hunter · memburu yang dihargai nol oleh berita' },
  A7: { en: 'Evidence Grounder · attaching sources, refusing orphan numbers', id: 'Evidence Grounder · menambatkan sumber, menolak angka tanpa sumber' },
  A8: { en: 'Cascade Historian · searching the case library for echoes', id: 'Cascade Historian · mencari gema di pustaka kasus' },
  A9: { en: 'Narrator · writing both languages from the locked graph', id: 'Narrator · menulis dua bahasa dari graf terkunci' },
  A10: { en: 'Symmetry Auditor · dissecting the mirror framing', id: 'Symmetry Auditor · membedah bingkai cermin' },
  A11: { en: 'Fidelity Guard · tracing every sentence to the graph', id: 'Fidelity Guard · menelusuri tiap kalimat ke graf' },
};

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

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const runManifest = readJson<{ run_id: string; generated_at: string; narratives: string[] }>(
    join(args.run, 'run.json'),
  );

  const blockedDir = join(args.run, 'blocked');
  const blocks = (existsSync(blockedDir) ? readdirSync(blockedDir) : [])
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<BlockRecord>(join(blockedDir, f)));

  const modelsSeen = new Set<string>();
  const narratives = runManifest.narratives.map((id) => {
    const slotDir = join(args.run, 'slots', id);
    const steps = readJson<{ steps: Step[] }>(join(slotDir, 'steps.json')).steps;

    const events: Dict[] = steps
      .filter((s) => s.finished_at !== '' && ROLE_LABEL[s.role] !== undefined)
      .map((s) => {
        modelsSeen.add(s.model);
        return {
          kind: 'slot',
          role: s.role,
          label: ROLE_LABEL[s.role],
          model: s.model,
          at: s.started_at,
        };
      });

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
    events.push({ kind: 'published', token });

    return { narrative_id: id, blocked_rounds: blocks.filter((x) => x.narrative_id === id).length, events };
  });

  const replay = {
    run_id: runManifest.run_id,
    generated_at: runManifest.generated_at,
    // The honest frame the UI must keep visible, both locales, no em dash, no emoji.
    disclosure: {
      en: `Replay of editorial run ${runManifest.run_id}. Every step, model, verdict and block below is the recorded run; on-screen pacing is compressed and not to scale.`,
      id: `Pemutaran ulang proses editorial ${runManifest.run_id}. Setiap langkah, model, putusan dan blokir di bawah ini adalah rekaman proses aslinya; tempo di layar dipadatkan dan tidak berskala.`,
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
