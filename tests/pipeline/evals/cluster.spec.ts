/**
 * AC-PIPE-3: cluster purity at least 0.9 on the golden mini-set.
 *
 * EXPECTED RED until W2 wires A3. Two separate reasons it stays red, and the failure message
 * distinguishes them:
 *   1. pipeline/run.ts does not exist (every spec in this tree fails on that today);
 *   2. A3 needs the real embedding model. 5.4 fixes it as Xenova/multilingual-e5-small through
 *      transformers.js, with "query: " prefixing, mean pooling and L2 normalization. The
 *      weights are DOWNLOADED ON FIRST RUN and cached outside the repo (never committed), so
 *      the first green run of this spec needs network access and roughly 120 MB of cache. CI
 *      either warms that cache or skips this file by name; it is not a unit test.
 *
 * Purity is the standard external measure: for each predicted cluster, the size of its largest
 * true-label group, summed and divided by the number of records. It punishes exactly the
 * failure the golden set is built to catch, which is merging the near-variant split pair.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyTree, GC, readJson, runStage, T, writeJson } from '../lib/runner';

const GOLDEN = join(GC, 'evals', 'cluster-golden.json');
const THRESHOLD = 0.9;

interface Golden {
  records: Array<{
    id: string;
    lang: string;
    headline: string;
    outlet: string;
    date: string;
    url: string;
    expected_cluster: string;
  }>;
}

/** sum over predicted clusters of the largest true-label count inside it, over N. */
function purity(assignments: Array<{ id: string; cluster: string }>, truth: Map<string, string>): number {
  const byPredicted = new Map<string, string[]>();
  for (const { id, cluster } of assignments) {
    const label = truth.get(id);
    if (label === undefined) throw new Error(`A3 assigned an id the golden set does not carry: "${id}"`);
    byPredicted.set(cluster, [...(byPredicted.get(cluster) ?? []), label]);
  }
  let majority = 0;
  for (const labels of byPredicted.values()) {
    const tally = new Map<string, number>();
    for (const label of labels) tally.set(label, (tally.get(label) ?? 0) + 1);
    majority += Math.max(...tally.values());
  }
  return majority / truth.size;
}

describe('A3 clusterer quality (AC-PIPE-3)', () => {
  it('reaches purity 0.9 or better on the 12-headline golden set', () => {
    const golden = readJson<Golden>(GOLDEN);
    const run = copyTree(join(GC, 'fixtures', 'runs', 'gc-fixture-0'), 'run-cluster');
    mkdirSync(join(run, 'stages'), { recursive: true });
    // The labels never reach the clusterer: A1's records carry what a scout would have.
    writeJson(join(run, 'stages', 'A1.json'), {
      records: golden.records.map((record) => {
        const staged: Record<string, unknown> = { ...record };
        delete staged.expected_cluster;
        return staged;
      }),
    });

    for (const name of ['A2', 'A3']) {
      const stage = runStage(['stage', name, '--run', run]);
      expect(stage.code, `stage ${name}\n${stage.out}`).toBe(0);
    }

    const { assignments } = readJson<{ assignments: Array<{ id: string; cluster: string }> }>(
      join(run, 'stages', 'A3.json'),
    );
    expect(
      assignments.map((a) => a.id).sort(),
      'A3 must assign every golden record exactly once',
    ).toStrictEqual(golden.records.map((r) => r.id).sort());

    const truth = new Map(golden.records.map((r) => [r.id, r.expected_cluster]));
    const score = purity(assignments, truth);
    expect(
      score,
      `purity ${score.toFixed(3)} below ${THRESHOLD}. Grouping produced: ${JSON.stringify(assignments)}`,
    ).toBeGreaterThanOrEqual(THRESHOLD);
  }, T * 4);
});
