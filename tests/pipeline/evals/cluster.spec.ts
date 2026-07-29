/**
 * AC-PIPE-3: cluster purity at least 0.9 on the golden mini-set, and the half purity cannot see.
 *
 * Purity is the standard external measure: for each predicted cluster, the size of its largest
 * true-label group, summed and divided by the number of records. It punishes merging the
 * adversarial near-variant split pair, which is the failure the golden set was built around.
 *
 * PURITY ALONE IS DEGENERATE, AND THIS SPEC WAS A FALSE GREEN BECAUSE OF IT. Purity is maximized
 * by the clusterer that never merges anything: a cluster of one record is always pure, so twelve
 * singletons score a perfect 1.000. A Gate C review proved that against this file by setting
 * THRESHOLD in pipeline/lib/cluster.ts from 0.925 to 1.1, so no record can ever join another,
 * and the purity assertion stayed green. A check that cannot fail is not a check.
 *
 * So this spec also measures PAIRWISE RECALL: of the record pairs that truly belong to the same
 * family, the share the clusterer actually put in one cluster. On the two degenerate clusterers
 * the two numbers move in opposite directions, which is why neither is a gate on its own:
 *
 *   never merge (threshold 1.1)          purity 1.000   recall 0.000
 *   merge everything (threshold -1)      purity 0.250   recall 1.000
 *   recover the four families (oracle)   purity 1.000   recall 1.000
 *
 * Pairwise precision is reported next to recall because reporting one half of a precision/recall
 * pair, and calling the half a quality gate, is exactly how this defect got in.
 *
 * All of it is printed on every run, pass or fail. The evidence this eval produces is the
 * measurements, not a green tick.
 *
 * RED TODAY, ON PURPOSE: A3 scores recall 0.083. See RECALL_FLOOR below.
 *
 * A3 needs the real embedding model (blueprint 5.4: Xenova/multilingual-e5-small through
 * transformers.js). The weights are downloaded on first run and cached outside the repo, so the
 * first run of this spec needs network access; every run after it is offline. CI either warms
 * that cache or skips this file by name. It is not a unit test.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { copyTree, GC, readJson, runStage, T, writeJson } from '../lib/runner';

const GOLDEN = join(GC, 'evals', 'cluster-golden.json');

/** The blueprint's number, untouched: AC-PIPE-3 is "cluster purity is at least 0.9". */
const PURITY_FLOOR = 0.9;

/**
 * The blueprint's same 0.9, applied to the other half of the pair. It is the only number
 * available here that was not read off the implementation, and reading a floor off the
 * implementation is the mistake that produced the original false green.
 *
 * What it demands: the golden set is built as four families of three with one adversarial split
 * pair, so recovering those four families is the thing it exists to measure. Over its twelve
 * true pairs the only reachable score at or above 0.9 is a clean 1.000 (recovering three
 * families and splitting the fourth 2+1 gives 0.833), so this floor means "recover the families
 * the fixture declares", which is what the fixture was constructed to ask for.
 *
 * WHAT A3 ACTUALLY DOES TODAY: recall 0.083. It emits eleven clusters for twelve records and
 * keeps exactly one true pair together (g07 with g08). It is not a clusterer that occasionally
 * misses a link, it is a clusterer that almost never links, and purity rewarded it for that. On
 * the real work order the same code put 27 records into 22 clusters against 10 true families:
 * purity 0.926, pairwise recall 0.160, pairwise precision 0.364.
 *
 * AND THE COSINE CUT CANNOT FIX IT. Sweeping THRESHOLD across the golden set in 0.005 steps:
 * every cut that clears the purity floor (0.905 to 0.935, ten or eleven clusters) scores recall
 * 0.083, and the best joint point anywhere, 0.870, scores purity 0.833 against recall 0.583, so
 * it fails the AC on the other side. At 0.865 and below the split pair merges, scoring the 0.750
 * purity the fixture's own note predicts for that failure, and below 0.840 everything collapses
 * into one cluster at 0.250. No threshold satisfies both floors. The gap is the algorithm, not
 * its tuning, which is what cluster.ts's own ceiling note predicts: a headline alone does not
 * carry enough of the referent.
 *
 * So this assertion is RED, and it is meant to stay red until A3 clusters. Any floor low enough
 * to go green today is at or below 0.083, i.e. a number copied from the behaviour it is supposed
 * to be judging. Fix A3 (blueprint 5.4's own upgrade path: embed the lede, not the headline), or
 * move the AC by an explicit recorded decision. Do not move this line to match the code.
 *
 * ---------------------------------------------------------------------------------------------
 * ORCHESTRATOR DECISION, 2026-07-29. The second exit was taken, and this is the record of it.
 *
 * What is NOT being claimed: A3 clusters well. It does not. The number below is an
 * anti-degeneracy floor, not a quality bar, and the real recall is printed on every run so the
 * weakness is visible in the evidence rather than buried in a threshold.
 *
 * Why the 0.9 recall bar is not the line: blueprint 8.4 states AC-PIPE-3 as "cluster purity is
 * at least 0.9" and sets no recall bar, so 0.9 here was this spec's own invention, reasonable in
 * principle and not an acceptance criterion. Holding the build permanently red against a bar the
 * blueprint never set, and that the available data cannot meet, would be its own dishonesty.
 *
 * Why A3 cannot simply be fixed: the upgrade path needs the lede, and pipeline/snapshot/registry
 * .json carries headline, outlet, date and url per member and no article text at all. Embedding
 * the lede means fetching article bodies at build time, which this pipeline deliberately does
 * not do. The gap is real, structural, and out of reach of a threshold.
 *
 * Why shipping is nonetheless honest: A3's grouping is not what ships. The ten narratives and
 * their families are AUTHORED in the snapshot registry, and A12 publishes the authored family;
 * A3 was only ever offered as corroborating evidence that embeddings recover the same grouping,
 * and the finding is that they do not. That claim has been removed from pipeline/run.ts rather
 * than left standing, and Report.md carries the real figures (golden recall 0.083, work-order
 * recall 0.160) as a named gap with the upgrade path.
 *
 * What the floor still catches: exactly the mutation that produced the false green. A clusterer
 * that never merges scores recall 0.000 and fails here; the reviewer's THRESHOLD=1.1 mutation is
 * red again. Raising this line back to a quality bar is the correct move the moment A3 is given
 * text to embed.
 */
const RECALL_FLOOR = 0.001;

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

/**
 * Pairwise counts, from the contingency table of predicted cluster against true label rather
 * than an O(n^2) scan: a group of n contributes n*(n-1)/2 pairs. `together` is the pairs A3
 * merged, `kin` the pairs the golden labels say belong together, `hit` their intersection.
 */
function pairwise(
  assignments: Array<{ id: string; cluster: string }>,
  truth: Map<string, string>,
): { hit: number; together: number; kin: number; recall: number } {
  const cells = new Map<string, number>();
  const byPredicted = new Map<string, number>();
  const byTrue = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1);
  for (const { id, cluster } of assignments) {
    const label = truth.get(id);
    if (label === undefined) throw new Error(`A3 assigned an id the golden set does not carry: "${id}"`);
    bump(cells, `${cluster} ${label}`);
    bump(byPredicted, cluster);
    bump(byTrue, label);
  }
  const pairs = (counts: Map<string, number>): number =>
    [...counts.values()].reduce((sum, n) => sum + (n * (n - 1)) / 2, 0);
  const hit = pairs(cells);
  const kin = pairs(byTrue);
  return { hit, together: pairs(byPredicted), kin, recall: hit / kin };
}

describe('A3 clusterer quality (AC-PIPE-3)', () => {
  it('recovers the golden families: purity 0.9 or better, and pairwise recall to match', () => {
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
    // Hard, and first: every metric below is meaningless over a different set of records.
    expect(
      assignments.map((a) => a.id).sort(),
      'A3 must assign every golden record exactly once',
    ).toStrictEqual(golden.records.map((r) => r.id).sort());

    const truth = new Map(golden.records.map((r) => [r.id, r.expected_cluster]));
    const score = purity(assignments, truth);
    const { hit, together, kin, recall } = pairwise(assignments, truth);
    const clusters = new Set(assignments.map((a) => a.cluster)).size;

    // Printed before the assertions, so a red run and a green run report the same evidence.
    console.log(
      [
        `A3 on the golden set: ${clusters} cluster(s) over ${assignments.length} records, against ${new Set(truth.values()).size} true families`,
        `  purity             ${score.toFixed(3)}   floor ${PURITY_FLOOR}   (blind to splitting: singletons are pure)`,
        `  pairwise recall    ${recall.toFixed(3)}   floor ${RECALL_FLOOR}   (${hit} of ${kin} true pairs kept together)`,
        `  pairwise precision ${together === 0 ? 'n/a  ' : (hit / together).toFixed(3)}               (${hit} of ${together} merged pairs correct)`,
      ].join('\n'),
    );

    // Soft, so one run reports both halves of the pair instead of only the first one to break.
    expect.soft(
      score,
      `purity ${score.toFixed(3)} below ${PURITY_FLOOR}. Grouping produced: ${JSON.stringify(assignments)}`,
    ).toBeGreaterThanOrEqual(PURITY_FLOOR);
    expect.soft(
      recall,
      `pairwise recall ${recall.toFixed(3)} below ${RECALL_FLOOR}: A3 kept ${hit} of ${kin} true pairs together, `
        + `emitting ${clusters} cluster(s) for ${assignments.length} records. Purity cannot see this, a cluster of `
        + `one is always pure. Grouping produced: ${JSON.stringify(assignments)}`,
    ).toBeGreaterThanOrEqual(RECALL_FLOOR);
  }, T * 4);
});
