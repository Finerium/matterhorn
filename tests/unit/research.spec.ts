/**
 * PROVES: the parts of `/research` that a screenshot cannot show are wrong.
 *
 * Three of them, and they are the three the surface makes a claim about.
 *
 *   1. The filter is honest. A field a filter cannot read never drops a row: the row is kept and
 *      the field is named, so a thin artifact is visible rather than absent. A field the filter
 *      CAN read still drops the row, or the filter would be decoration.
 *   2. Velocity is a count, not a model. It measures a span only from dates precise to the day
 *      and reports how many records were coarser than that instead of rounding them in.
 *   3. The export is safe and complete. RFC 4180 quoting, the spreadsheet formula guard, and a
 *      link slice that never names a node the node slice left out.
 *
 * The layout is checked for the two properties the perf budget and the screenshot baseline rest
 * on: every node gets a position, and the same graph always gets the same positions.
 */
import { describe, expect, it } from 'vitest';
import type { Constellation, Narrative } from '../../contracts/types';
import {
  cell,
  cluster,
  csv,
  graphJson,
  isoCompare,
  judge,
  layout,
  linksCsv,
  nodesCsv,
  scopeOf,
  spread,
  velocity,
  NO_FILTERS,
  VIEW,
  type Filters,
} from '../../app/src/research/graph';

/**
 * The fields `/research` reads, and nothing else. A whole `Narrative` literal per case would be
 * four hundred lines of panels the surface never opens; the cast is what keeps the cases legible.
 */
const narrative = (over: Partial<Narrative> & { id: string }): Narrative =>
  ({
    pack: 'id',
    lean: 'gov',
    status: 'published',
    outlet: 'Antara News',
    published_date: '2026-06-20',
    tags: ['missing-link'],
    headline: { en: `headline ${over.id}`, id: `judul ${over.id}` },
    counts: { missing: 1, unsourced: 0, disputed: 0, supported: 2, hidden: 0 },
    family: { skeleton: 's', members: [] },
    ...over,
  }) as unknown as Narrative;

const shown = (item: Narrative): string => item.headline.en;

const filters = (over: Partial<Filters>): Filters => ({ ...NO_FILTERS, ...over });

describe('filters refuse to decide what they cannot read', () => {
  it('drops a row the filter can read and does not match', () => {
    const verdict = judge(narrative({ id: 'a', lean: 'gov' }), 'a', filters({ lean: 'opp' }));
    expect(verdict.keep).toBe(false);
    expect(verdict.untested).toEqual([]);
  });

  it('keeps a row whose lean is absent, and names the field', () => {
    const thin = narrative({ id: 'b' });
    // The one case the honesty rule is for: a published artifact missing the field being filtered.
    delete (thin as Partial<Narrative>).lean;
    const verdict = judge(thin, 'b', filters({ lean: 'opp' }));
    expect(verdict.keep).toBe(true);
    expect(verdict.untested).toEqual(['lean']);
  });

  it('still drops an untestable row that another filter decisively excluded', () => {
    const thin = narrative({ id: 'c', pack: 'en' });
    delete (thin as Partial<Narrative>).lean;
    const verdict = judge(thin, 'c', filters({ lean: 'opp', pack: 'id' }));
    expect(verdict.keep).toBe(false);
    expect(verdict.untested).toEqual(['lean']);
  });

  it('cannot place a month-precision date against a bound inside that month', () => {
    // migrant-crime really does publish as "2025-08". It may be the 3rd or the 30th.
    const coarse = narrative({ id: 'd', published_date: '2025-08' });
    const inside = judge(coarse, 'd', filters({ from: '2025-08-15' }));
    expect(inside.keep).toBe(true);
    expect(inside.untested).toEqual(['published_date']);

    // Outside the month it settles, and then the filter does decide.
    expect(judge(coarse, 'd', filters({ from: '2025-09-01' })).keep).toBe(false);
    expect(judge(coarse, 'd', filters({ to: '2025-07-31' })).keep).toBe(false);
    expect(judge(coarse, 'd', filters({ from: '2025-01-01', to: '2025-12-31' }))).toEqual({
      keep: true,
      untested: [],
    });
  });

  it('names published_date once when both bounds are undecidable', () => {
    const coarse = narrative({ id: 'e', published_date: '2025-08' });
    expect(judge(coarse, 'e', filters({ from: '2025-08-02', to: '2025-08-20' })).untested).toEqual(['published_date']);
  });

  it('compares ISO dates at the precision they share', () => {
    expect(isoCompare('2026-06-20', '2026-06-05')).toBe(1);
    expect(isoCompare('2026-06', '2026-07-01')).toBe(-1);
    expect(isoCompare('2026-06', '2026-06-15')).toBeNull();
    expect(isoCompare('2026-06-15', '2026-06-15')).toBe(0);
  });

  it('searches the shown headline and the outlet, which is the Archive tab rule', () => {
    const item = narrative({ id: 'mbg-stop', outlet: 'Tribunnews', tags: ['no-denominator'] });
    for (const query of ['tribun', 'TRIBUN', 'headline mbg']) {
      expect(judge(item, shown(item), filters({ query })).keep).toBe(true);
    }
    expect(judge(item, shown(item), filters({ query: 'no-denominator' })).keep).toBe(false);
    expect(judge(item, shown(item), filters({ query: 'nothing here' })).keep).toBe(false);
  });

  it('filters by technique tag, and keeps a narrative carrying no tags array', () => {
    const item = narrative({ id: 'f', tags: ['missing-link', 'hidden-stakeholder'] });
    expect(judge(item, 'f', filters({ tag: 'missing-link' })).keep).toBe(true);
    expect(judge(item, 'f', filters({ tag: 'no-denominator' })).keep).toBe(false);

    const untagged = narrative({ id: 'g' });
    delete (untagged as Partial<Narrative>).tags;
    expect(judge(untagged, 'g', filters({ tag: 'missing-link' }))).toEqual({ keep: true, untested: ['tags'] });
  });
});

const graph: Constellation = {
  nodes: [
    { id: 'n1', narrative_id: 'one', label: { en: 'one', id: 'satu' }, pack: 'id' },
    { id: 'n2', narrative_id: 'two', label: { en: 'two', id: 'dua' }, pack: 'id' },
    { id: 'n3', narrative_id: 'ghost', label: { en: 'ghost', id: 'hantu' }, pack: 'en' },
  ],
  links: [{ a: 'n1', b: 'n2', via: { en: 'shared source', id: 'sumber bersama' } }],
};

describe('the join between the graph and the packs', () => {
  const one = narrative({ id: 'one', lean: 'gov' });
  const two = narrative({ id: 'two', lean: 'opp', pack: 'en' });

  it('counts both leftovers instead of hiding either', () => {
    const scope = scopeOf([one, two, narrative({ id: 'unplotted' })], graph, NO_FILTERS, shown);
    expect(scope.orphanNodes).toEqual(['n3']);
    expect(scope.nodelessRows).toBe(1);
    expect(scope.shown).toHaveLength(3);
  });

  it('keeps a node no filter could test in scope under every filter', () => {
    const scope = scopeOf([one, two], graph, filters({ lean: 'gov' }), shown);
    expect([...scope.nodeIds].sort()).toEqual(['n1', 'n3']);
  });

  it('carries every node a narrative has, not only the first', () => {
    // The AC-PERF-4 fixture is 500 nodes over ten narrative ids. Keying node by narrative would
    // drop 490 of them from the graph without a word.
    const many: Constellation = {
      nodes: [...graph.nodes, { id: 'n1b', narrative_id: 'one', label: { en: 'one again', id: 'satu lagi' }, pack: 'id' }],
      links: graph.links,
    };
    const scope = scopeOf([one, two], many, NO_FILTERS, shown);
    expect([...scope.nodeIds].sort()).toEqual(['n1', 'n1b', 'n2', 'n3']);
    expect(scope.rows.find((row) => row.narrative.id === 'one')?.nodeId).toBe('n1');
  });

  it('takes a node and everything one link away', () => {
    expect(cluster(graph, 'n1')).toEqual(['n1', 'n2']);
    expect(cluster(graph, 'n3')).toEqual(['n3']);
  });

  it('tallies the published leans of a cluster and counts what it could not read', () => {
    expect(spread(['gov', 'opp', null])).toEqual({ gov: 1, neutral: 0, opp: 1, untested: 1, total: 3 });
  });
});

describe('velocity is the count it is made of', () => {
  const dated = (dates: string[]): Narrative =>
    narrative({
      id: 'v',
      family: {
        skeleton: 'one skeleton',
        members: dates.map((date, at) => ({ outlet: `outlet ${String(at)}`, headline: 'h', url: `u${String(at)}`, date })),
      },
    });

  it('spans only the dates precise to the day, and says how many were not', () => {
    const pace = velocity(dated(['2026-06-20', '2026-06', '2026-06-05']));
    expect(pace).toEqual({ outlets: 3, dated: 2, coarse: 1, days: 15, first: '2026-06-05', last: '2026-06-20' });
  });

  it('states no span when one record carries a day', () => {
    expect(velocity(dated(['2026-06-20', '2026-06'])).days).toBeNull();
    expect(velocity(dated([])).outlets).toBe(0);
  });
});

describe('the layout is total and reproducible', () => {
  const big: Constellation = {
    nodes: Array.from({ length: 500 }, (_, at) => ({
      id: `n${String(at)}`,
      narrative_id: `x${String(at)}`,
      label: { en: `n${String(at)}`, id: `n${String(at)}` },
      pack: 'id' as const,
    })),
    links: Array.from({ length: 120 }, (_, at) => ({
      a: `n${String(at)}`,
      b: `n${String(at + 7)}`,
      via: { en: 'v', id: 'v' },
    })),
  };

  it('places every node inside the view box', () => {
    const places = layout(big);
    expect(places.size).toBe(500);
    for (const point of places.values()) {
      expect(point.x).toBeGreaterThan(-VIEW.w);
      expect(point.x).toBeLessThan(VIEW.w * 2);
      expect(Number.isFinite(point.y)).toBe(true);
    }
  });

  it('is a pure function of the graph, so a screenshot of it is a baseline', () => {
    expect([...layout(big).entries()]).toEqual([...layout(big).entries()]);
  });

  it('ignores a link naming a node the file does not carry', () => {
    const dangling: Constellation = { ...graph, links: [{ a: 'n1', b: 'nope', via: { en: 'v', id: 'v' } }] };
    expect(layout(dangling).size).toBe(3);
  });
});

describe('the export', () => {
  const byNarrative = new Map([
    ['one', narrative({ id: 'one', outlet: 'Antara News' })],
    ['two', narrative({ id: 'two', pack: 'en', lean: 'opp' })],
  ]);
  const slice = {
    graph,
    ids: new Set(['n1', 'n2', 'n3']),
    byNarrative,
    origin: 'https://example.test',
    shownHeadline: shown,
  };

  it('quotes what RFC 4180 requires and neutralizes what a spreadsheet would run', () => {
    expect(cell('plain')).toBe('plain');
    expect(cell('a,b')).toBe('"a,b"');
    expect(cell('he said "no"')).toBe('"he said ""no"""');
    expect(cell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(cell('-1+2')).toBe("'-1+2");
    expect(csv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"\r\n');
  });

  it('says which nodes no pack carries rather than leaving a blank that reads as zero', () => {
    const rows = nodesCsv(slice).trim().split('\r\n');
    // The header the e2e reads back: the node's own fields first, then the join.
    expect(rows[0]).toBe(
      'node_id,narrative_id,label,label_id,pack,in_packs,lean,status,outlet,published_date,' +
        'headline,permalink,missing,unsourced,disputed,supported,hidden,tags',
    );
    // AC-INV-2: the headline column is the surface's rendered headline, handed in.
    expect(rows.find((row) => row.startsWith('n1,one'))).toContain('headline one');
    expect(rows.find((row) => row.startsWith('n3,ghost'))).toContain(',no,');
    expect(rows.find((row) => row.startsWith('n1,one'))).toContain('https://example.test/n/one');
  });

  it('never emits a link whose endpoints are not both exported', () => {
    const narrow = { ...slice, ids: new Set(['n1']) };
    expect(linksCsv(narrow).trim()).toBe('a,b,via_en,via_id');
    expect(linksCsv(slice)).toContain('n1,n2,shared source');
  });

  it('carries the filter that produced it', () => {
    const doc = JSON.parse(graphJson(slice, filters({ lean: 'gov' }), '2026-07-29T00:00:00.000Z')) as {
      filters: Filters;
      counts: { nodes: number; links: number; nodes_without_a_published_narrative: number };
      nodes: Array<{ in_packs: boolean }>;
    };
    expect(doc.filters.lean).toBe('gov');
    expect(doc.counts).toEqual({ nodes: 3, links: 1, nodes_without_a_published_narrative: 1 });
    expect(doc.nodes.filter((node) => !node.in_packs)).toHaveLength(1);
  });
});
