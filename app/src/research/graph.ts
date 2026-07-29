/**
 * The research surface's arithmetic, with no DOM in it: the join between the constellation and
 * the published packs, the filter, the two derived rail statistics, the layout, and the export
 * serializers. Kept apart from the components because this is the part that can be wrong in a
 * way a screenshot does not show, and `tests/unit/research.spec.ts` drives it directly.
 *
 * Two rules run through the whole file.
 *
 * Honest filters. A filter that cannot read the field it tests does not get to decide. `judge`
 * separates a decisive exclusion (the field is there and does not match) from an untestable one
 * (the field is absent, malformed, or coarser than the bound), and only the first drops a row.
 * The second keeps the row and names the field, so the surface can say so. Silently dropping a
 * narrative because an artifact was thin is the one failure mode a public archive cannot have.
 *
 * Derived numbers only. Nothing here invents a figure. Velocity is a count of the outlets in
 * `family.members` and the span between the dates they carry; the lean spread is a tally of the
 * published `lean` field over a cluster of nodes. Both are counts of published records, the same
 * class of number as `DerivedCounts`, and both carry their own gaps in the return value rather
 * than rounding them away.
 */
import type { Constellation, Narrative } from '../../../contracts/types';

export type Pack = Narrative['pack'];
export type Lean = Narrative['lean'];

export interface Filters {
  pack: Pack | 'all';
  lean: Lean | 'all';
  /** Topic search. The Archive tab's rule, unchanged: the shown headline and the outlet. */
  query: string;
  /** One technique tag, from `?tag=`. Empty means unfiltered. */
  tag: string;
  /** Inclusive ISO bounds from `<input type="date">`. Empty means unbounded. */
  from: string;
  to: string;
}

export const NO_FILTERS: Filters = { pack: 'all', lean: 'all', query: '', tag: '', from: '', to: '' };

export const filtersActive = (filters: Filters): boolean =>
  filters.pack !== 'all' ||
  filters.lean !== 'all' ||
  filters.query.trim() !== '' ||
  filters.tag !== '' ||
  filters.from !== '' ||
  filters.to !== '';

/** `YYYY`, `YYYY-MM` or `YYYY-MM-DD`. The archive carries all three; `2025-08` is real content. */
const ISO_DATE = /^\d{4}(-\d{2}){0,2}$/;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Two ISO dates compared at the precision they share: -1, 0, 1, or `null` for "these two do not
 * settle it". A month-precision date and a day-precision bound inside that month is exactly the
 * `null` case: `2025-08` may be the 3rd or the 30th, and a filter bounded at `2025-08-15` cannot
 * know which. Lexicographic comparison is safe here because a fixed-width ISO prefix orders the
 * same way the date does.
 */
export function isoCompare(a: string, b: string): number | null {
  const width = Math.min(a.length, b.length);
  const left = a.slice(0, width);
  const right = b.slice(0, width);
  if (left < right) return -1;
  if (left > right) return 1;
  return a.length === b.length ? 0 : null;
}

export interface Verdict {
  /** False only when a filter read its field and the field did not match. */
  keep: boolean;
  /** Fields an active filter could not test on this narrative. Non-empty rows render flagged. */
  untested: string[];
}

/**
 * One narrative against the filters. `shown` is the headline as the surface renders it, passed
 * in rather than read here so that the single headline path (`renderers/Card.headlineOf`) stays
 * the only one in the app.
 */
export function judge(narrative: Narrative, shown: string, filters: Filters): Verdict {
  const untested: string[] = [];
  let keep = true;

  if (filters.pack !== 'all') {
    if (narrative.pack !== 'id' && narrative.pack !== 'en') untested.push('pack');
    else if (narrative.pack !== filters.pack) keep = false;
  }

  if (filters.lean !== 'all') {
    if (narrative.lean !== 'gov' && narrative.lean !== 'opp' && narrative.lean !== 'neutral') untested.push('lean');
    else if (narrative.lean !== filters.lean) keep = false;
  }

  const query = filters.query.trim().toLowerCase();
  if (query !== '') {
    // The Archive tab's rule verbatim: the rendered headline plus the outlet. One search rule in
    // the product rather than two that drift, and neither field can be absent without the
    // validator failing first, so search has no untestable case.
    if (!`${shown} ${narrative.outlet}`.toLowerCase().includes(query)) keep = false;
  }

  if (filters.tag !== '') {
    if (!Array.isArray(narrative.tags)) untested.push('tags');
    else if (!narrative.tags.includes(filters.tag)) keep = false;
  }

  if (filters.from !== '' || filters.to !== '') {
    const date = narrative.published_date;
    if (typeof date !== 'string' || !ISO_DATE.test(date)) {
      untested.push('published_date');
    } else {
      const after = filters.from === '' ? 1 : isoCompare(date, filters.from);
      const before = filters.to === '' ? -1 : isoCompare(date, filters.to);
      if (after === null || before === null) untested.push('published_date');
      if (after !== null && after < 0) keep = false;
      if (before !== null && before > 0) keep = false;
    }
  }

  return { keep, untested };
}

export interface Row {
  narrative: Narrative;
  /** The first constellation node for this narrative, or null when the graph carries none. */
  nodeId: string | null;
  verdict: Verdict;
}

export interface Scope {
  rows: Row[];
  /** Rows the filters kept, in feed order. Includes the rows no active filter could test. */
  shown: Row[];
  /** Node ids in scope: the shown rows' nodes, plus every node no row could speak for. */
  nodeIds: Set<string>;
  /** Nodes whose `narrative_id` resolves in no loaded pack. Drawn, counted, never hidden. */
  orphanNodes: string[];
  /** Narratives the constellation carries no node for. */
  nodelessRows: number;
}

/**
 * The join. Narratives arrive from the two pack feeds and nodes from `constellation.json`, and
 * neither file promises the other is complete, so both leftovers are counted and reported rather
 * than quietly dropped. A node with no narrative cannot be tested by any filter, so it stays in
 * scope under every filter: refusing to decide is not the same as deciding to exclude.
 *
 * The relation is many to one on purpose. Today it happens to be one to one, but nothing in the
 * contract says a narrative gets at most one point, and assuming it would make every node past
 * the first vanish from the graph rather than fail loudly.
 */
export function scopeOf(
  narratives: Narrative[],
  graph: Constellation | null,
  filters: Filters,
  headline: (narrative: Narrative) => string,
): Scope {
  const nodesFor = new Map<string, string[]>();
  for (const node of graph?.nodes ?? []) {
    const carried = nodesFor.get(node.narrative_id);
    if (carried === undefined) nodesFor.set(node.narrative_id, [node.id]);
    else carried.push(node.id);
  }
  const rows: Row[] = narratives.map((narrative) => ({
    narrative,
    nodeId: nodesFor.get(narrative.id)?.[0] ?? null,
    verdict: judge(narrative, headline(narrative), filters),
  }));
  const shown = rows.filter((row) => row.verdict.keep);
  const published = new Set(narratives.map((narrative) => narrative.id));
  const keptIds = new Set(shown.map((row) => row.narrative.id));
  const orphanNodes = (graph?.nodes ?? []).filter((node) => !published.has(node.narrative_id)).map((node) => node.id);
  const nodeIds = new Set(
    (graph?.nodes ?? [])
      .filter((node) => !published.has(node.narrative_id) || keptIds.has(node.narrative_id))
      .map((node) => node.id),
  );
  return {
    rows,
    shown,
    nodeIds,
    orphanNodes,
    nodelessRows: rows.filter((row) => row.nodeId === null).length,
  };
}

export interface Velocity {
  /** Outlets that carried the skeleton, from `family.members`. */
  outlets: number;
  /** How many of them carry a date precise to the day. */
  dated: number;
  /** How many carry a coarser date, which no span can be measured from. */
  coarse: number;
  /** Days between the first and last day-precise record, or null when fewer than two carry one. */
  days: number | null;
  first: string | null;
  last: string | null;
}

const DAY_MS = 86_400_000;

/**
 * How fast the skeleton travelled, said as the two counts it is made of rather than as a rate.
 * The zip drew a sparkline from an authored `velocity` array; Section 6.4 carries no such field,
 * and inventing the curve would be drawing a number nothing published. What is published is a
 * dated list of outlets, so that is what this reports.
 */
export function velocity(narrative: Narrative): Velocity {
  const members = narrative.family.members;
  const dated = members
    .map((member) => member.date)
    .filter((date) => FULL_DATE.test(date))
    .sort((a, b) => a.localeCompare(b));
  const first = dated[0] ?? null;
  const last = dated[dated.length - 1] ?? null;
  let days: number | null = null;
  if (first !== null && last !== null && dated.length >= 2) {
    const span = (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / DAY_MS;
    days = Number.isFinite(span) ? Math.round(span) : null;
  }
  return { outlets: members.length, dated: dated.length, coarse: members.length - dated.length, days, first, last };
}

export interface Spread {
  gov: number;
  neutral: number;
  opp: number;
  /** Cluster members with no published lean to read, because no loaded pack carries them. */
  untested: number;
  total: number;
}

export const spread = (leans: Array<Lean | null>): Spread => ({
  gov: leans.filter((lean) => lean === 'gov').length,
  neutral: leans.filter((lean) => lean === 'neutral').length,
  opp: leans.filter((lean) => lean === 'opp').length,
  untested: leans.filter((lean) => lean === null).length,
  total: leans.length,
});

/** A node and every node one link away from it, the node itself first. */
export function cluster(graph: Constellation, nodeId: string): string[] {
  const out = [nodeId];
  for (const link of graph.links) {
    if (link.a === nodeId && !out.includes(link.b)) out.push(link.b);
    if (link.b === nodeId && !out.includes(link.a)) out.push(link.a);
  }
  return out;
}

// --- layout -----------------------------------------------------------------------------------

/** The graph's user space. The container is held to this aspect in CSS, so one unit is one unit. */
export const VIEW = { w: 160, h: 100 } as const;

export interface Point {
  x: number;
  y: number;
  /**
   * Which way this node's label runs: away from the middle of its own cluster, so the labels of a
   * four-node cluster do not pile on top of each other, and inward near a canvas edge, so a long
   * headline is not clipped by the frame. Decided here because this is where the cluster centre
   * is known; the component only reads it.
   */
  side: 'start' | 'middle' | 'end';
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** How close to the frame a node has to be before its label must turn back inward. */
const EDGE = 30;

const sideOf = (x: number, cx: number): Point['side'] => {
  if (x < EDGE) return 'start';
  if (x > VIEW.w - EDGE) return 'end';
  if (x < cx - 0.5) return 'end';
  if (x > cx + 0.5) return 'start';
  return 'middle';
};

/**
 * Where each node sits. Position is not in the content contract and must not be: it is a design
 * decision, and an author should never have to place a dot to publish a narrative. So the surface
 * derives it, deterministically and from file order, the way the Archive teaser does.
 *
 * Connected components are laid out as groups: a component's members share a small ring and the
 * components themselves spread over a phyllotaxis disc. That is what makes the picture mean
 * something at a glance (the four MBG narratives read as one cluster, the USAID pair as a pair)
 * without a force simulation, which would be a frame budget and a dependency to buy a prettier
 * arrangement of the same information.
 *
 * ponytail: O(n * links) union-find without path compression, plus a linear-scan component pass.
 * At the 500-node ceiling of AC-PERF-4 that is a fraction of a millisecond and it runs once per
 * graph. Compress the finds if a graph ever arrives with hundreds of links per node.
 */
export function layout(graph: Constellation): Map<string, Point> {
  const nodes = graph.nodes;
  const index = new Map(nodes.map((node, at) => [node.id, at]));
  const parent = nodes.map((_, at) => at);
  const find = (start: number): number => {
    let at = start;
    for (;;) {
      const up = parent[at];
      if (up === undefined || up === at) return at;
      at = up;
    }
  };
  for (const link of graph.links) {
    const a = index.get(link.a);
    const b = index.get(link.b);
    // A link naming a node the file does not carry joins nothing. It is drawn nowhere either.
    if (a === undefined || b === undefined) continue;
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  }

  const groups = new Map<number, number[]>();
  for (let at = 0; at < nodes.length; at += 1) {
    const root = find(at);
    const group = groups.get(root);
    if (group === undefined) groups.set(root, [at]);
    else group.push(at);
  }
  // Biggest clusters nearest the middle, ties broken by file order: the picture is reproducible,
  // which is what lets a screenshot of it be a baseline.
  const comps = [...groups.values()].sort((a, b) => b.length - a.length || (a[0] ?? 0) - (b[0] ?? 0));

  const out = new Map<string, Point>();
  const rx = VIEW.w / 2 - 24;
  const ry = VIEW.h / 2 - 14;
  // A cluster's ring is sized from the room between clusters, not from a fixed number, so ten
  // nodes fill the frame and five hundred still fit inside it. Bigger clusters open wider, which
  // is what keeps four slugs off each other in the middle of the graph.
  const ring = 0.46 * Math.min(rx, ry) * Math.sqrt(1 / comps.length);
  comps.forEach((members, at) => {
    const reach = Math.sqrt(at / comps.length);
    const angle = at * GOLDEN;
    const cx = VIEW.w / 2 + Math.cos(angle) * rx * reach;
    const cy = VIEW.h / 2 + Math.sin(angle) * ry * reach;
    if (members.length === 1) {
      const only = nodes[members[0] ?? 0];
      if (only !== undefined) out.set(only.id, { x: cx, y: cy, side: sideOf(cx, cx) });
      return;
    }
    const spread = ring * Math.sqrt(members.length / 2);
    members.forEach((member, spoke) => {
      const node = nodes[member];
      if (node === undefined) return;
      const theta = (spoke / members.length) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(theta) * spread;
      out.set(node.id, { x, y: cy + Math.sin(theta) * spread * 0.8, side: sideOf(x, cx) });
    });
  });
  return out;
}

// --- exports ----------------------------------------------------------------------------------

/**
 * One CSV field, RFC 4180, plus the formula guard: a cell a spreadsheet would evaluate instead of
 * read gets a leading apostrophe. A headline is untrusted text as far as Excel is concerned, and
 * an export nobody can open safely is not an export.
 */
export function cell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /["\r\n,]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export const csv = (columns: string[], rows: Array<Array<string | number>>): string =>
  [columns.map(cell).join(','), ...rows.map((row) => row.map(cell).join(','))].join('\r\n') + '\r\n';

/** `label` and `pack` are the node's own fields; everything after `in_packs` is the narrative's. */
const NODE_COLUMNS = [
  'node_id',
  'narrative_id',
  'label',
  'label_id',
  'pack',
  'in_packs',
  'lean',
  'status',
  'outlet',
  'published_date',
  'headline',
  'permalink',
  'missing',
  'unsourced',
  'disputed',
  'supported',
  'hidden',
  'tags',
];

const LINK_COLUMNS = ['a', 'b', 'via_en', 'via_id'];

export interface GraphSlice {
  graph: Constellation;
  /** Node ids in the export. Links survive only when both ends are in it. */
  ids: Set<string>;
  byNarrative: Map<string, Narrative>;
  origin: string;
  /**
   * The headline as the surface renders it, passed in rather than read off the artifact here.
   * AC-INV-2: `renderers/Card.headlineOf` is the only module in the app that reads that field,
   * and an export writing its own would be a second headline path with a file extension.
   */
  shownHeadline: (narrative: Narrative) => string;
}

const sliceLinks = (slice: GraphSlice) =>
  slice.graph.links.filter((link) => slice.ids.has(link.a) && slice.ids.has(link.b));

const sliceNodes = (slice: GraphSlice) => slice.graph.nodes.filter((node) => slice.ids.has(node.id));

export function nodesCsv(slice: GraphSlice): string {
  return csv(
    NODE_COLUMNS,
    sliceNodes(slice).map((node) => {
      const narrative = slice.byNarrative.get(node.narrative_id);
      const head = [node.id, node.narrative_id, node.label.en, node.label.id, node.pack];
      // Every column that comes from the narrative is empty when no loaded pack carries it, and
      // `in_packs` is the column that says which case a reader is looking at. An empty cell that
      // could mean either "zero" or "unknown" is the export version of a silently dropped row.
      if (narrative === undefined) {
        return [...head, 'no', '', '', '', '', '', '', '', '', '', '', '', ''];
      }
      return [
        ...head,
        'yes',
        narrative.lean,
        narrative.status,
        narrative.outlet,
        narrative.published_date,
        slice.shownHeadline(narrative),
        `${slice.origin}/n/${narrative.id}`,
        narrative.counts.missing,
        narrative.counts.unsourced,
        narrative.counts.disputed,
        narrative.counts.supported,
        narrative.counts.hidden,
        narrative.tags.join(' '),
      ];
    }),
  );
}

export const linksCsv = (slice: GraphSlice): string =>
  csv(
    LINK_COLUMNS,
    sliceLinks(slice).map((link) => [link.a, link.b, link.via.en, link.via.id]),
  );

/**
 * The same slice as one document. The filter that produced it travels with it, because a graph
 * export with no record of what was filtered out is a number nobody can reproduce.
 */
export const graphJson = (slice: GraphSlice, filters: Filters, at: string): string =>
  JSON.stringify(
    {
      generated_by: 'Matterhorn research mode',
      generated_at: at,
      source: 'content/constellation.json joined to the published pack feeds',
      filters,
      counts: {
        nodes: sliceNodes(slice).length,
        links: sliceLinks(slice).length,
        nodes_without_a_published_narrative: sliceNodes(slice).filter(
          (node) => !slice.byNarrative.has(node.narrative_id),
        ).length,
      },
      nodes: sliceNodes(slice).map((node) => {
        const narrative = slice.byNarrative.get(node.narrative_id);
        return {
          id: node.id,
          narrative_id: node.narrative_id,
          label: node.label,
          pack: node.pack,
          in_packs: narrative !== undefined,
          ...(narrative === undefined
            ? {}
            : {
                lean: narrative.lean,
                status: narrative.status,
                outlet: narrative.outlet,
                published_date: narrative.published_date,
                counts: narrative.counts,
                tags: narrative.tags,
                permalink: `${slice.origin}/n/${narrative.id}`,
              }),
        };
      }),
      links: sliceLinks(slice).map((link) => ({ a: link.a, b: link.b, via: link.via })),
    },
    null,
    2,
  );

/**
 * Hand a generated file to the browser. Object URL, `download`, revoke on the next task: no
 * server, no third party, nothing that leaves the origin (AC-SEC-6). Revoking inside the click
 * task races the download in some builds, so it waits one turn.
 */
export function download(name: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
