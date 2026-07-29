/**
 * The AC-PERF-4 load fixture: a synthetic 500-node constellation.
 *
 * Post-install home: tests/fixtures/constellation-500.ts. Imported by
 * tests/e2e/constellation-perf.spec.ts only, which serves it to the app by intercepting the
 * `constellation.json` request. Nothing under app/src can reach it (AC-INV-9).
 *
 * It is grown from the PUBLISHED graph rather than invented from nothing, and that is the whole
 * design decision here. The budget in AC-PERF-4 is about the constellation carrying fifty times
 * the nodes it ships with, not about it carrying nodes of a shape it never sees: every synthetic
 * node names a real `narrative_id` and a real `pack`, so the surface under load still resolves
 * every row to a real narrative and still draws real labels. A fixture of invented narrative ids
 * would measure the render of a broken graph, which is a cheaper thing to draw and therefore a
 * flattering number.
 *
 * The topology is a ring plus a fixed chord, which is deterministic (no PRNG, no seed to record)
 * and gives every node degree 2 to 4, so the edge count scales with the node count the way a
 * cross-narrative graph does. 500 nodes produce 750 links.
 *
 * ponytail: a function over the published file rather than a committed 500-node JSON blob. A
 * blob would be 100 KB of generated text that no reviewer reads and that silently rots the day
 * a narrative id changes; this cannot drift, because it is derived from the same artifact the
 * app loads.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { Constellation } from '../../contracts/types';

/** The published graph, which is what the fixture multiplies. */
export const PUBLISHED_GRAPH = fileURLToPath(new URL('../../content/constellation.json', import.meta.url));

/** Blueprint 8.6, AC-PERF-4: "a synthetic 500-node fixture". */
export const NODE_COUNT = 500;

const synId = (index: number): string => `syn-${String(index).padStart(3, '0')}`;

/** Every link states why it exists, the same as a published one. These say what they are. */
const RING = { en: 'synthetic load edge, ring', id: 'sisi beban sintetis, cincin' };
const CHORD = { en: 'synthetic load edge, chord', id: 'sisi beban sintetis, tali busur' };

/**
 * `base` grown to `count` nodes. Node i inherits everything real from `base.nodes[i % n]` and
 * carries its own id and a label that says out loud that it is synthetic, so a screenshot of a
 * perf run can never be mistaken for a screenshot of the archive.
 */
export function synthesize(base: Constellation, count: number = NODE_COUNT): Constellation {
  const [first] = base.nodes;
  if (first === undefined) throw new Error('constellation-500: the published graph has no nodes to grow from');

  const nodes: Constellation['nodes'] = [];
  for (let index = 0; index < count; index += 1) {
    const seed = base.nodes[index % base.nodes.length] ?? first;
    nodes.push({
      id: synId(index),
      narrative_id: seed.narrative_id,
      label: {
        en: `Synthetic ${String(index)} · ${seed.label.en}`,
        id: `Sintetis ${String(index)} · ${seed.label.id}`,
      },
      pack: seed.pack,
    });
  }

  const links: Constellation['links'] = [];
  const seen = new Set<string>();
  const join = (a: number, b: number, via: { en: string; id: string }): void => {
    if (a === b) return;
    const key = a < b ? `${String(a)}:${String(b)}` : `${String(b)}:${String(a)}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({ a: synId(a), b: synId(b), via });
  };
  for (let index = 0; index < count; index += 1) {
    join(index, (index + 1) % count, RING);
    // Every other node also reaches across the ring, so the layout cannot degenerate into a
    // cheap circle of neighbours. 7 and 13 are coprime with 500, so the chords spread evenly.
    if (index % 2 === 0) join(index, (index * 7 + 13) % count, CHORD);
  }

  return { nodes, links };
}

/** The fixture itself: the published graph grown to 500 nodes. */
export function constellation500(count: number = NODE_COUNT): Constellation {
  const base = JSON.parse(readFileSync(PUBLISHED_GRAPH, 'utf8')) as Constellation;
  return synthesize(base, count);
}
