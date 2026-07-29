/**
 * PROVES: AC-DOC-4. Emits `content-review.md`, the operator's editorial approval sheet.
 *
 *   tsx scripts/build-content-review.ts --dir content --run pipeline/runs/<run_id> [--out <file>]
 *
 * Everything here is READ from published artifacts and the run log. The reviewer is approving
 * what shipped, so a hand-maintained sheet would be reviewing a copy rather than the thing.
 *
 * What the operator has to sign off, per AC-DOC-4: every sparring question with its correct
 * answer and its note, every lean assignment, every status. The judgment calls behind those
 * choices live in each A9 slot's `editorial_notes`, and the gate reasons carry the observations
 * the auditors raised without blocking, so both are carried through: an approval sheet that
 * hides the close calls is not an approval sheet.
 *
 * Strict argv, same contract as scripts/validate-content.ts: an unknown flag exits 2 rather
 * than being ignored, because a silently dropped flag is how an unimplemented option ships
 * green.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

interface L10n {
  en: string;
  id: string;
}
interface Sparring {
  move: string;
  q: L10n;
  options: L10n[];
  correct: number;
  note: L10n;
}
interface Narrative {
  id: string;
  pack: string;
  lean: string;
  status: string;
  headline: { en: string; id?: string };
  original: { text: string; lang: string };
  outlet: string;
  url: string;
  tags: string[];
  counts: Record<string, number>;
  provenance: { analyzed_by: string; narrated_by: string; source_count: number; run_id: string };
  sparring: { questions: Sparring[] };
  prediction_tap: { prompt: L10n; options: L10n[] };
  panels: Array<{ type: string }>;
  echo: { historical?: { case_id?: string } } | null;
  manifest: { gates?: Record<string, { verdict: string; token: string }> };
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

function usage(message: string): never {
  console.error(`build-content-review: ${message}`);
  console.error('usage: tsx scripts/build-content-review.ts --dir <content root> --run <run dir> [--out <file>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { dir: string; run: string; out: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--dir' && flag !== '--run' && flag !== '--out') usage(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usage(`${flag} needs a value`);
    if (flags.has(flag)) usage(`${flag} was given twice`);
    flags.set(flag, value);
  }
  const dir = flags.get('--dir');
  const run = flags.get('--run');
  if (dir === undefined) usage('--dir <content root> is required');
  if (run === undefined) usage('--run <run dir> is required');
  return { dir: resolve(dir), run: resolve(run), out: resolve(flags.get('--out') ?? 'content-review.md') };
}

/** Published artifacts in registry order, so the sheet reads in the work order the fleet ran. */
function readPublished(dir: string, run: string): Narrative[] {
  const narrativeDir = join(dir, 'narratives');
  if (!existsSync(narrativeDir)) usage(`${narrativeDir} does not exist, so there is nothing to review`);
  const order = readJson<{ narratives: Array<{ id: string }> }>(
    join(resolve(run, '..', '..'), 'snapshot', 'registry.json'),
  ).narratives.map((n) => n.id);
  return readdirSync(narrativeDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<Narrative>(join(narrativeDir, f)))
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
}

const slot = <T>(run: string, id: string, file: string): T | undefined => {
  const path = join(run, 'slots', id, file);
  return existsSync(path) ? readJson<T>(path) : undefined;
};

const bullets = (lines: string[]): string => lines.map((l) => `- ${l}`).join('\n');

function narrativeSection(artifact: Narrative, run: string): string {
  const notes = slot<{ editorial_notes?: string[] }>(run, artifact.id, 'A9.json')?.editorial_notes ?? [];
  const gates = (['A10', 'A11'] as const).map((role) => {
    const verdict = slot<{ verdict: string; reasons: string[]; model: string }>(run, artifact.id, `${role}.json`);
    const gate = role === 'A10' ? 'Symmetry (A10)' : 'Fidelity (A11)';
    if (verdict === undefined) return `${gate}: no verdict recorded`;
    return `${gate}: ${verdict.verdict} on ${verdict.model}, ${verdict.reasons.length} reason(s) recorded`;
  });
  const echoCase = artifact.echo?.historical?.case_id;

  const out: string[] = [];
  out.push(`## ${artifact.id}`);
  out.push('');
  out.push(
    bullets([
      `**Lean assignment**: \`${artifact.lean}\` (APPROVE / CHANGE)`,
      `**Status**: \`${artifact.status}\` (APPROVE / CHANGE)`,
      `**Pack**: ${artifact.pack} · **Outlet**: ${artifact.outlet}`,
      `**Display headline (en)**: ${artifact.headline.en}`,
      `**Display headline (id)**: ${artifact.headline.id ?? '(none; en is used)'}`,
      `**Original headline**: ${artifact.original.text} (${artifact.original.lang})`,
      `**Source article**: ${artifact.url}`,
      `**Technique tags**: ${artifact.tags.join(', ')}`,
      `**Panels**: ${artifact.panels.map((p) => p.type).join(', ')}${echoCase === undefined ? '' : ` · echo cites ${echoCase}`}`,
      `**Counts**: ${Object.entries(artifact.counts).map(([k, v]) => `${k} ${String(v)}`).join(', ')}`,
      `**Provenance**: analyzed by ${artifact.provenance.analyzed_by}, narrated by ${artifact.provenance.narrated_by}, ${String(artifact.provenance.source_count)} source(s)`,
      `**Gates**: ${gates.join(' · ')}`,
    ]),
  );
  out.push('');
  out.push('### Sparring questions (approve each correct answer)');
  for (const [i, q] of artifact.sparring.questions.entries()) {
    out.push('');
    out.push(`**Q${String(i + 1)} · ${q.move}**`);
    out.push('');
    out.push(`- en: ${q.q.en}`);
    out.push(`- id: ${q.q.id}`);
    out.push('');
    for (const [j, option] of q.options.entries()) {
      const mark = j === q.correct ? '**CORRECT**' : 'distractor';
      out.push(`  ${String(j)}. [${mark}] en: ${option.en}`);
      out.push(`     ${' '.repeat(String(j).length)} id: ${option.id}`);
    }
    out.push('');
    out.push(`- Note (en): ${q.note.en}`);
    out.push(`- Note (id): ${q.note.id}`);
  }
  out.push('');
  out.push('### Prediction tap');
  out.push('');
  out.push(`- Prompt (en): ${artifact.prediction_tap.prompt.en}`);
  out.push(`- Prompt (id): ${artifact.prediction_tap.prompt.id}`);
  for (const option of artifact.prediction_tap.options) {
    out.push(`  - ${option.en} / ${option.id}`);
  }
  if (notes.length > 0) {
    out.push('');
    out.push('### Author judgment calls (from the A9 slot)');
    out.push('');
    out.push(bullets(notes));
  }
  out.push('');
  return out.join('\n');
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const published = readPublished(args.dir, args.run);
  const corrections =
    existsSync(join(args.dir, 'corrections.json'))
      ? readJson<{ entries: Array<{ date: string; narrative_id: string; status: string; summary: L10n }> }>(
          join(args.dir, 'corrections.json'),
        ).entries
      : [];

  const doc: string[] = [];
  doc.push('# Content review');
  doc.push('');
  doc.push(
    'Editorial approval sheet for the generated archive. **Approval is pending until the operator signs off**, and Report.md says so.',
  );
  doc.push('');
  doc.push(
    `Generated from \`${basename(args.dir)}/\` and run \`${basename(args.run)}\` by \`pnpm build:content-review\`. Do not edit this file by hand: it is a view of what shipped, so an edit here changes nothing a reader sees. To change what a reader sees, fix the pipeline or the sources and re-run.`,
  );
  doc.push('');
  doc.push('What needs a decision on each narrative below:');
  doc.push('');
  doc.push(
    bullets([
      'the **lean** assignment, which is metadata about the claim being dissected and never a personalization signal',
      'the **status**, where `under_review` puts the correction banner on a published dissection',
      'every **sparring correct answer** and the note that explains it after the reveal',
      'the **prediction tap** options, which are asked before the reveal and must not give it away',
    ]),
  );
  doc.push('');
  doc.push(`${String(published.length)} narrative(s) published: ${published.map((n) => n.id).join(', ')}.`);
  doc.push('');
  if (corrections.length > 0) {
    doc.push('## Corrections registry');
    doc.push('');
    for (const entry of corrections) {
      doc.push(`- **${entry.narrative_id}** (${entry.date}, \`${entry.status}\`): ${entry.summary.en}`);
      doc.push(`  - id: ${entry.summary.id}`);
    }
    doc.push('');
  }
  for (const artifact of published) doc.push(narrativeSection(artifact, args.run));

  writeFileSync(args.out, `${doc.join('\n').trimEnd()}\n`);
  console.log(
    `content-review: wrote ${args.out} covering ${String(published.length)} narrative(s) and ${String(published.reduce((n, a) => n + a.sparring.questions.length, 0))} sparring question(s)`,
  );
}

main();
