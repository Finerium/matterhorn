/**
 * AC-PIPE-4, recall half: on three synthetic clusters with known hidden stakeholders, the real
 * A6 Hidden-Node Hunter recalls at least 2 of 3.
 *
 * This is a HARNESS, not a runner spec. A6 is an LLM slot at Fable 5 effort max, so the pass
 * that produces the evidence is the pre-flight step of the Gate C plan, not this file: the
 * orchestrator dispatches A6 over each cluster fixture and stages the output at
 *
 *   pipeline/runs/preflight-a6/slots/<cluster_id>/A6.json
 *
 * RED until that has happened, and loudly: a missing verdict file fails naming the path, and
 * never skips. A skipped eval is an eval nobody notices is not running.
 *
 * The disjoint-context half of AC-PIPE-4 is proven by construction, not here:
 * tests/pipeline/unit/pipeline/gates.spec.ts.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GC, readJson, REPO } from '../../lib/runner';

const PREFLIGHT = join(REPO, 'pipeline', 'runs', 'preflight-a6', 'slots');
const HERE = join(GC, 'evals', 'planted-omission');

interface Expected {
  recall_threshold: number;
  clusters: Array<{
    cluster_id: string;
    hidden: Array<{ key: string; cues: string[] }>;
  }>;
}

const expected = readJson<Expected>(join(HERE, 'expected.json'));

describe('A6 recalls planted omissions (AC-PIPE-4)', () => {
  for (const cluster of expected.clusters) {
    it(`recovers at least ${expected.recall_threshold} of 3 in "${cluster.cluster_id}"`, () => {
      const verdict = join(PREFLIGHT, cluster.cluster_id, 'A6.json');
      expect(
        existsSync(verdict),
        `no A6 output at ${verdict}. Run the Gate C pre-flight pass over tests/pipeline/evals/planted-omission/clusters/${cluster.cluster_id}.json (A6, Fable 5 effort max) and commit its output there.`,
      ).toBe(true);

      // ponytail: the whole slot output is searched, not a pinned proposals[] path. A6 writes
      // its own labels and its own shape, and what recall asks is whether the party was named
      // at all. Ceiling: a cue appearing in a quoted article snippet inside the output would
      // count as a hit, so the cues avoid words the source articles lean on.
      const haystack = JSON.stringify(readJson(verdict)).toLowerCase();
      const missed = cluster.hidden
        .filter((planted) => !planted.cues.some((cue) => haystack.includes(cue.toLowerCase())))
        .map((planted) => planted.key);

      expect(
        cluster.hidden.length - missed.length,
        `A6 named none of the cues for: ${missed.join(', ')}`,
      ).toBeGreaterThanOrEqual(expected.recall_threshold);
    });
  }
});

describe('the planted-omission fixtures themselves', () => {
  it('carry three planted stakeholders and both locales per cluster', () => {
    expect(expected.clusters).toHaveLength(3);
    for (const cluster of expected.clusters) {
      expect(cluster.hidden, `${cluster.cluster_id} plants three`).toHaveLength(3);
      const articles = readJson<{ articles: Array<{ lang: string }> }>(
        join(HERE, 'clusters', `${cluster.cluster_id}.json`),
      ).articles;
      expect(articles.map((a) => a.lang).sort(), `${cluster.cluster_id} locales`).toStrictEqual(['en', 'id']);
    }
  });
});
