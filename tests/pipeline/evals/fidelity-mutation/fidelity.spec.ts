/**
 * AC-PIPE-6: narration mutated to cite a nonexistent element returns block from A11, and so
 * does narration whose claim traces to no graph element. The clean artifact they were both cut
 * from returns pass.
 *
 * A harness, like the other two evals. A11 is an Opus 5 effort max slot, so the evidence comes
 * from the Gate C pre-flight pass, which stages each verdict at
 *
 *   pipeline/runs/preflight-a11/slots/<fixture id>/A11.json   { verdict, reasons: [...] }
 *
 * RED until that has happened, and loudly: a missing verdict fails naming the path, never skips.
 *
 * The two mutants fail for different reasons on purpose. mutant-el breaks a binding, which the
 * deterministic pre-pass of A11 can catch on its own. mutant-trace breaks nothing mechanical:
 * the binding resolves, the cited body resolves in the registry, and no Value object is added,
 * so the orphan check stays quiet and only the traceability judgment can see the fault. A guard
 * that blocks the first and passes the second is a lint, not a fidelity guard.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GC, readJson, REPO } from '../../lib/runner';

const PREFLIGHT = join(REPO, 'pipeline', 'runs', 'preflight-a11', 'slots');
const HERE = join(GC, 'evals', 'fidelity-mutation');

interface Expected {
  fixtures: Array<{
    id: string;
    file: string;
    expected_verdict: 'pass' | 'block';
    sentence?: { id: string; lang: string; fragments: string[] };
    fault_cues?: string[];
    min_fault_cues?: number;
  }>;
}

const expected = readJson<Expected>(join(HERE, 'expected.json'));

describe('A11 fidelity guard on authored mutations (AC-PIPE-6)', () => {
  for (const fixture of expected.fixtures) {
    it(`returns ${fixture.expected_verdict} on ${fixture.file}`, () => {
      const path = join(PREFLIGHT, fixture.id, 'A11.json');
      expect(
        existsSync(path),
        `no A11 verdict at ${path}. Run the Gate C pre-flight pass over tests/pipeline/evals/fidelity-mutation/${fixture.file} (A11, Opus 5 effort max) and commit its verdict there.`,
      ).toBe(true);

      const verdict = readJson<{ verdict: string; reasons?: unknown }>(path);
      expect(verdict.verdict).toBe(fixture.expected_verdict);

      const { sentence, fault_cues: cues = [], min_fault_cues: minCues = 1 } = fixture;
      if (fixture.expected_verdict === 'pass' || sentence === undefined) return;

      expect(
        Array.isArray(verdict.reasons) && verdict.reasons.length > 0,
        'a block with no reasons is not a sentence-level verdict',
      ).toBe(true);

      const haystack = JSON.stringify(verdict.reasons).toLowerCase();
      const namesSentence =
        haystack.includes(sentence.id.toLowerCase()) ||
        sentence.fragments.some((f) => haystack.includes(f.toLowerCase()));
      expect(
        namesSentence,
        `A11 blocked without naming ${sentence.lang} sentence ${sentence.id}, by id or by quotation\nreasons: ${haystack}`,
      ).toBe(true);

      const hits = cues.filter((cue) => haystack.includes(cue.toLowerCase()));
      expect(
        hits.length,
        `A11 named the sentence but not the fault. Expected one of: ${cues.join(', ')}\nreasons: ${haystack}`,
      ).toBeGreaterThanOrEqual(minCues);
    });
  }
});

describe('the fidelity fixtures themselves', () => {
  it('are the same artifact apart from one narration sentence each', () => {
    const sentences = (file: string): Array<{ id: string; text: string; els: string[] }> =>
      readJson<{ narration: { en: { sentences: Array<{ id: string; text: string; els: string[] }> } } }>(
        join(HERE, file),
      ).narration.en.sentences;

    const clean = sentences('clean.json');
    for (const file of ['mutant-el.json', 'mutant-trace.json']) {
      const mutated = sentences(file);
      expect(mutated).toHaveLength(clean.length);
      const differing = mutated.filter((s, i) => JSON.stringify(s) !== JSON.stringify(clean[i]));
      expect(differing.map((s) => s.id), `${file} mutates exactly one sentence`).toStrictEqual(['v-3']);
    }

    // The el the broken binding points at is genuinely absent, or the mutation is not a mutation.
    const declared = JSON.stringify(readJson(join(HERE, 'clean.json'))).includes('"h7"');
    expect(declared, 'clean.json already declares h7, so mutant-el breaks nothing').toBe(false);
  });
});
