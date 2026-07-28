/**
 * Gate mechanics at the runner level: the unit halves of AC-PIPE-5 and AC-PIPE-6, plus the
 * AC-PIPE-4 construction proof that A5 and A6 never share a context.
 *
 * The LLM halves live in tests/pipeline/evals: a real A10 must block the stance-leak
 * fixture and a real A11 must block the mutated narration. Here the verdicts are SCRIPTED, so
 * what is under test is the plumbing: a block verdict staged in the slot file has to stop the
 * narrative, and a pass verdict has to produce a token minted over the exact artifact bytes.
 *
 * Runner surface these specs pin (see tests/pipeline/README.md):
 *   tsx pipeline/run.ts stage A5|A6|A10|A11|A12 --narrative <id> --run <run dir> [--out <root>]
 *   <run>/slots/<narrative>/A10.json, A11.json   verdict files: { verdict, reasons, token }
 *   <run>/slots/<narrative>/A5.input.json, ...   the input the runner handed each LLM slot
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gateToken } from '../../../../pipeline/lib/canonical';
import { copyTree, GC, readJson, runStage, T, writeJson, type Run } from '../../lib/runner';

const FIXTURE_RUN = join(GC, 'fixtures', 'runs', 'gc-fixture-0');
const OUT_BASE = join(GC, 'fixtures', 'out-base');
const NARRATIVE = 'rambai-levy';
/** Planted in the staged A5 output. It must reach no A6 input file, ever. */
const A5_NONCE = 'A5-SCRATCH-NONCE-7f3c1a';

const slot = (run: string, file: string): string => join(run, 'slots', NARRATIVE, file);

const stage = (name: string, run: string, extra: string[] = []): Run =>
  runStage(['stage', name, '--narrative', NARRATIVE, '--run', run, ...extra]);

/** Every file under `dir`, relative, sorted. */
function tree(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .filter((rel) => statSync(join(dir, rel)).isFile())
    .sort();
}

describe('a scripted block verdict stops the narrative (AC-PIPE-5, AC-PIPE-6 unit half)', () => {
  it('marks the narrative blocked, and A12 then refuses to publish it', () => {
    const run = copyTree(FIXTURE_RUN, 'run-block');
    const out = copyTree(OUT_BASE, 'out-block');
    writeJson(slot(run, 'A10.json'), {
      verdict: 'block',
      reasons: [
        'the gov-lean framing carries three hidden branches and the mirror framing carries none',
        'narration applies a loaded adjective to one side only',
      ],
    });

    const before = new Set(tree(run));
    const gate = stage('A10', run);

    // The mark has to be durable, not just a line on stdout: a resumable run reads it back.
    // Which file carries it is the implementer's business, so this asks the run dir, not a path.
    const marks = tree(run)
      .filter((rel) => !before.has(rel))
      .map((rel) => readFileSync(join(run, rel), 'utf8'))
      .filter((text) => text.includes(NARRATIVE) && /block/i.test(text));
    expect(
      marks.length,
      `A10 returned a block verdict and the run dir gained no file recording it\n${gate.out}`,
    ).toBeGreaterThan(0);

    const publish = runStage(['stage', 'A12', '--narrative', NARRATIVE, '--run', run, '--out', out]);
    expect(publish.code, `A12 must refuse a blocked narrative\n${publish.out}`).not.toBe(0);
    expect(publish.out).toContain(NARRATIVE);
    expect(publish.out).toMatch(/block|gate|symmetry/i);
    expect(existsSync(join(out, 'narratives', `${NARRATIVE}.json`))).toBe(false);
  }, T * 2);
});

describe('pass verdicts mint tokens over the exact artifact bytes (AC-INV-8)', () => {
  it('stamps both gate tokens with the sha256 canonical.ts computes over the candidate', () => {
    const run = copyTree(FIXTURE_RUN, 'run-mint');
    // The slot output is a judgment. The token is a hash of the artifact, which no language
    // model can compute, so the runner is what has to put it there. Strip both and watch.
    for (const file of ['A10.json', 'A11.json']) {
      const verdict = readJson<Record<string, unknown>>(slot(run, file));
      delete verdict.token;
      writeJson(slot(run, file), verdict);
    }

    const symmetry = stage('A10', run);
    const fidelity = stage('A11', run);
    expect(symmetry.code, symmetry.out).toBe(0);
    expect(fidelity.code, fidelity.out).toBe(0);

    const expected = gateToken(readJson(slot(run, 'candidate.json')));
    expect(readJson<{ token: string }>(slot(run, 'A10.json')).token).toBe(expected);
    expect(readJson<{ token: string }>(slot(run, 'A11.json')).token).toBe(expected);
  }, T * 2);

  it('carries the committed fixture tokens, so a change to the recipe turns this red', () => {
    const expected = gateToken(readJson(join(FIXTURE_RUN, 'slots', NARRATIVE, 'candidate.json')));
    for (const file of ['A10.json', 'A11.json']) {
      expect(
        readJson<{ token: string }>(join(FIXTURE_RUN, 'slots', NARRATIVE, file)).token,
        `${file} is stale: rerun tests/pipeline/fixtures/stamp.mjs`,
      ).toBe(expected);
    }
  });
});

describe('A5 and A6 share no conversation state (AC-PIPE-4 construction proof)', () => {
  /**
   * PRD D5: A6's input is the cluster plus the asserted graph. Not A5's transcript, not A5's
   * scratch notes, not A5's panel skeleton. The runner writes the input it handed each slot,
   * and this reads those two files back and asks what crossed over.
   */
  it('builds the A5 and A6 inputs independently, with only the asserted graph crossing over', () => {
    const run = copyTree(FIXTURE_RUN, 'run-disjoint');
    const extractor = stage('A5', run);
    const hunter = stage('A6', run);
    expect(extractor.code, extractor.out).toBe(0);
    expect(hunter.code, hunter.out).toBe(0);

    const a5Input = slot(run, 'A5.input.json');
    const a6Input = slot(run, 'A6.input.json');
    expect(existsSync(a5Input), `${a5Input} was not written\n${extractor.out}`).toBe(true);
    expect(existsSync(a6Input), `${a6Input} was not written\n${hunter.out}`).toBe(true);

    const handed = readJson(a6Input);
    const keys = Object.keys(handed).sort();
    expect(keys).toContain('asserted_graph');
    expect(keys).toContain('cluster');
    expect(
      keys.filter((k) => !['asserted_graph', 'cluster', 'narrative_id'].includes(k)),
      'A6 may be handed the cluster and the asserted graph, and nothing else',
    ).toStrictEqual([]);

    const a5Output = readJson<{ asserted_graph: unknown }>(slot(run, 'A5.json'));
    expect(handed.asserted_graph).toStrictEqual(a5Output.asserted_graph);

    const serialized = readFileSync(a6Input, 'utf8');
    expect(serialized, 'A5 scratch reasoning reached A6').not.toContain(A5_NONCE);
    for (const leak of ['drafting_notes', 'panel_skeleton', 'transcript', 'messages', 'conversation']) {
      expect(serialized, `A6's input carries "${leak}"`).not.toContain(leak);
    }
  }, T * 2);
});
