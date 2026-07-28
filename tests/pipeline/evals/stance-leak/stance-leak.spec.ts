/**
 * AC-PIPE-5, LLM half: a deliberately stance-leaking fixture run through the real A10 returns
 * block, and the clean control returns pass.
 *
 * A harness, like planted-omission.spec.ts. A10 is a Fable 5 effort max slot, so the evidence
 * comes from the Gate C pre-flight pass, which dissects each fixture against its mirror-framing
 * brief and stages the verdict at
 *
 *   pipeline/runs/preflight-a10/slots/<narrative_id>/A10.json   { verdict, reasons: [...] }
 *
 * RED until that has happened, and loudly: a missing verdict fails naming the path, never skips.
 *
 * The control exists because "block everything" is not a symmetry auditor. Both fixtures carry
 * the same invented event, the same invented evidence and the same panel shapes; only the
 * evenness of the treatment differs. A run that blocks both has proven nothing about A10.
 *
 * The unit half, where a scripted block stops the narrative and A12 refuses, is in
 * tests/pipeline/unit/pipeline/gates.spec.ts.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GC, readJson, REPO } from '../../lib/runner';

const PREFLIGHT = join(REPO, 'pipeline', 'runs', 'preflight-a10', 'slots');
const HERE = join(GC, 'evals', 'stance-leak');

interface Expected {
  fixtures: Array<{
    id: string;
    narrative_id: string;
    expected_verdict: 'pass' | 'block';
    min_markers_named: number;
    planted_markers: Array<{ key: string; cues: string[] }>;
  }>;
}

const expected = readJson<Expected>(join(HERE, 'expected.json'));

describe('A10 symmetry auditor on authored fixtures (AC-PIPE-5)', () => {
  for (const fixture of expected.fixtures) {
    it(`returns ${fixture.expected_verdict} on the ${fixture.id} fixture`, () => {
      const path = join(PREFLIGHT, fixture.narrative_id, 'A10.json');
      expect(
        existsSync(path),
        `no A10 verdict at ${path}. Run the Gate C pre-flight pass over tests/pipeline/evals/stance-leak/${fixture.id}/ (narrative.json plus mirror-brief.json, A10, Fable 5 effort max) and commit its verdict there.`,
      ).toBe(true);

      const verdict = readJson<{ verdict: string; reasons?: unknown }>(path);
      expect(verdict.verdict).toBe(fixture.expected_verdict);

      if (fixture.expected_verdict === 'pass') return;

      expect(
        Array.isArray(verdict.reasons) && verdict.reasons.length > 0,
        'a block with no reasons is not a verdict anyone can act on',
      ).toBe(true);

      // ponytail: substring search over the serialized reasons. A10 writes prose, and pinning
      // an exact phrasing would score wording. Ceiling: a reason quoting the artifact could
      // match a cue by accident, so cues stay off the words the artifact itself uses, except
      // "reckless", which is the planted adjective and is meant to be quoted back.
      const haystack = JSON.stringify(verdict.reasons).toLowerCase();
      const named = fixture.planted_markers.filter((marker) =>
        marker.cues.some((cue) => haystack.includes(cue.toLowerCase())),
      );
      expect(
        named.length,
        `A10 blocked but named none of: ${fixture.planted_markers
          .filter((m) => !named.includes(m))
          .map((m) => m.key)
          .join(', ')}\nreasons: ${haystack}`,
      ).toBeGreaterThanOrEqual(fixture.min_markers_named);
    });
  }
});

describe('the stance-leak fixtures themselves', () => {
  it('differ only in the evenness of the treatment', () => {
    const read = (id: string): { panels: Array<{ type: string; hidden?: unknown[]; edges?: Array<{ status: string }> }> } =>
      readJson(join(HERE, id, 'narrative.json'));
    const claimMap = (id: string): { hidden?: unknown[]; edges?: Array<{ status: string }> } => {
      const panel = read(id).panels.find((p) => p.type === 'claim_map');
      if (panel === undefined) throw new Error(`${id} has no claim map`);
      return panel;
    };

    // The leak fixture treats its own framing gently: every edge supported, one hidden branch,
    // against a mirror brief carrying three. The control matches its mirror on both counts.
    expect(claimMap('leak').edges?.map((e) => e.status)).toStrictEqual(['supported', 'supported']);
    expect(claimMap('leak').hidden).toHaveLength(1);
    expect(claimMap('control').edges?.map((e) => e.status)).toStrictEqual(['supported', 'missing']);
    expect(claimMap('control').hidden).toHaveLength(2);

    const mirrorHidden = (id: string): number =>
      readJson<{ mirror_treatment: { hidden: unknown[] } }>(join(HERE, id, 'mirror-brief.json'))
        .mirror_treatment.hidden.length;
    expect(mirrorHidden('leak'), 'the leak mirror is treated harder than the artifact').toBe(3);
    expect(mirrorHidden('control'), 'the control mirror matches its artifact').toBe(2);
  });
});
