/**
 * The landing's numbers, resolved from published content.
 *
 * Blueprint 4.4 leaves ten slots in otherwise frozen copy, and every one of them is a figure that
 * already exists in an artifact this app serves. The failure this module exists to prevent is a
 * section resolving `{gov}` by typing 6: right on the day it is typed, wrong the next time A13
 * recomputes the symmetry receipt, and invisible until somebody reads both files side by side.
 *
 * So nothing here is a finished string. `useLanding` returns resolved numbers, `fill` is the only
 * way one of them reaches copy, and an unrecognized slot throws instead of rendering a literal
 * brace, which is the AC-LAND-3 failure it would otherwise become.
 *
 * Reading is `content.ts`, unchanged: same `CONTENT_BASE`, same fetch-once cache, same synchronous
 * `peek` assembly `useRadar` uses. Four artifacts answer everything. That the read happens at run
 * time rather than at build is what keeps one content root under the whole product: importing
 * `content/*.json` here would put artifacts in the app import graph, bypass the seed-mode switch
 * that points dev and e2e at the fixture root, and bake numbers into a bundle that would then
 * disagree with the files a republish just changed.
 */
import { useEffect, useState } from 'react';
import type { Feed, Methodology, Narrative } from '../../../contracts/types';
import { PACKS, PATHS, loadJson, peek } from '../content';

/**
 * The hero set piece is the claim map the frozen copy names ("A Demo This Big, and the Media Won't
 * Show It?"), which is this artifact. Its count chips and its graph have to be one narrative or the
 * chips describe a map nobody is looking at, so the id lives here once and the hero section draws
 * from `PATHS.narrative(HERO_ID)`, a cache hit off the read below.
 */
export const HERO_ID = 'demo-agustus';

/**
 * The two slots no artifact carries. Deriving these from content would not drift, it would answer
 * a different question:
 *
 * COMPONENTS is the grammar. Blueprint 6.4 fixes the panel schemas at eight, AC-GRAM checks all
 * eight, and 4.4.6 ships exactly eight frozen cards. Counting panel types across the published set
 * would report whatever this archive happens to use, and a narrative carries only the panels its
 * story needs (demo-agustus has five) while constellation is a global file rather than a panel at
 * all.
 *
 * AGENTS is the fleet. Blueprint 5.4 defines A1 to A13, and the frozen H2 three sections above the
 * stats band already says thirteen, so a figure derived to disagree with it would contradict the
 * copy it stands beside. The generation manifest is not that number either: it logs the LLM slots
 * that touched one artifact (A5 to A9 here) plus the two gate verdicts, not the fleet.
 *
 * Both move only when the contracts move, which is a code change and not a publish.
 */
const COMPONENTS = 8;
const AGENTS = 13;

/** Every data-bound slot in Section 4.4, resolved. Numbers only, so `fill` is total over them. */
export interface LandingData {
  // methodology.json, the standing symmetry receipt (4.4.8 card 3)
  gov: number;
  neutral: number;
  opp: number;
  // the hero narrative's own derived counts (4.4.2 count chips)
  missing: number;
  unsourced: number;
  hidden: number;
  // the stats band and its caption (4.4.9)
  narratives: number;
  packs: number;
  components: number;
  agents: number;
}

type Slot = keyof LandingData;

/** Every slot, or null while any artifact is still out. Synchronous, so it can run during render. */
function assemble(): LandingData | null {
  const methodology = peek<Methodology>(PATHS.methodology);
  const hero = peek<Narrative>(PATHS.narrative(HERO_ID));
  if (methodology === undefined || hero === undefined) return null;

  // The archive is what the feeds serve, so the narrative count is their union: a narrative is
  // published when a pack carries it, and ppn-panic counts like any other even though Radar holds
  // it back until the dissect demo runs.
  const ids = new Set<string>();
  for (const pack of PACKS) {
    const feed = peek<Feed>(PATHS.feed(pack));
    if (feed === undefined) return null;
    for (const item of feed.items) ids.add(item.narrative_id);
  }

  const { gov, neutral, opp } = methodology.symmetry;
  const { missing, unsourced, hidden } = hero.counts;
  return {
    gov,
    neutral,
    opp,
    missing,
    unsourced,
    hidden,
    narratives: ids.size,
    // Reached only after the loop found a published feed for every pack in the registry.
    packs: PACKS.length,
    components: COMPONENTS,
    agents: AGENTS,
  };
}

/** The four reads. `loadJson` de-dupes, so the hero and the grammar grid pay nothing for theirs. */
const load = async (): Promise<void> => {
  await Promise.all([
    loadJson<Methodology>(PATHS.methodology),
    loadJson<Narrative>(PATHS.narrative(HERO_ID)),
    ...PACKS.map((pack) => loadJson<Feed>(PATHS.feed(pack))),
  ]);
};

/**
 * The landing's data. Shaped like `useRadar` on purpose: the initial state is the synchronous
 * cache read, so a reader arriving from `/app` gets the numbers in the first paint.
 */
export function useLanding(): { data: LandingData | null; error: string | null } {
  const [data, setData] = useState<LandingData | null>(() => assemble());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data !== null) return;
    let live = true;
    load().then(
      () => {
        if (live) setData(assemble());
      },
      (failure: unknown) => {
        if (live) setError(failure instanceof Error ? failure.message : String(failure));
      },
    );
    return () => {
      live = false;
    };
  }, [data]);

  return { data, error };
}

/**
 * The only way a slot reaches the page: frozen copy keeps its braces verbatim and hands them here.
 *
 * i18n's `translate` leaves an unknown placeholder standing, because a missing chrome string
 * should not take a screen down. This one throws, because landing copy is a module constant: the
 * only way to reach the throw is a typo in it, and a typo that renders is AC-LAND-3 failing in
 * production rather than in the first render of the section that introduced it.
 */
export function fill(text: string, data: LandingData): string {
  return text.replace(/\{(\w+)\}/g, (whole, slot: string) => {
    const value: number | undefined = data[slot as Slot];
    if (value === undefined) throw new Error(`landing copy has no data for ${whole}`);
    return String(value);
  });
}
