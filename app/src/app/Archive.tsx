/**
 * The Archive tab: search, the five filter chips, the constellation teaser, the dissection list
 * and the case library, in the zip's order.
 *
 * Everything on this screen is read from published artifacts. The list is the two pack feeds;
 * the teaser is `constellation.json`; the case library is `case_library.json` with its citations
 * resolved through the same source registry the renderers use, so a case whose citation does not
 * resolve is visible as a missing source rather than as an unattributed claim.
 *
 * One thing the artifact does not carry is where a node sits. `Constellation` is a graph, not a
 * drawing, so the teaser lays the nodes out itself: evenly around a circle, in file order. That
 * keeps the layout deterministic (the screenshot is stable) and keeps position out of the
 * content contract, where it would be a design decision pretending to be data.
 */
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import type { Lang, Narrative, Source } from '../../../contracts/types';
import { useT, type Key } from '../i18n';
import { useArchive, useCaseLibrary, useConstellation, useJson, PATHS } from '../content';
import { makeCtx } from '../renderers/ctx';
import { CountChips, headlineOf } from '../renderers/Card';
import { dateLabel } from '../renderers/copy';
import type { AppState, ArchiveFilter } from './state';
import type { Nav } from './Onboarding';

const FILTERS: Array<{ id: ArchiveFilter; label: Key }> = [
  { id: 'all', label: 'archive.filter.all' },
  { id: 'id', label: 'pack.id' },
  { id: 'en', label: 'pack.en' },
  { id: 'gov', label: 'archive.lean.gov' },
  { id: 'opp', label: 'archive.lean.opp' },
];

const LEAN_LABEL: Record<Narrative['lean'], Key> = {
  gov: 'archive.lean.gov',
  opp: 'archive.lean.opp',
  neutral: 'archive.lean.neutral',
};

const keeps = (narrative: Narrative, filter: ArchiveFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'id' || filter === 'en') return narrative.pack === filter;
  return narrative.lean === filter;
};

/** Search runs over what the reader can see: the rendered headline and the outlet. */
const matches = (narrative: Narrative, shown: string, query: string): boolean =>
  query === '' || `${shown} ${narrative.outlet}`.toLowerCase().includes(query.toLowerCase());

/** The teaser's ring. viewBox is the zip's 100 x 62, so the SVG keeps the zip's proportions. */
const RING = { cx: 50, cy: 29, r: 21 };

const place = (index: number, total: number): { x: number; y: number } => {
  const angle = (index / Math.max(total, 1)) * Math.PI * 2 - Math.PI / 2;
  return { x: RING.cx + Math.cos(angle) * RING.r, y: RING.cy + Math.sin(angle) * RING.r * 0.78 };
};

/**
 * A label runs away from the ring rather than under it: the side nodes anchor outward, the top
 * and bottom ones stay centred. Long labels on opposite sides would otherwise collide over the
 * middle of a 100-unit viewBox.
 */
const labelAt = (at: { x: number; y: number }): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } => {
  if (at.x < RING.cx - 8) return { x: at.x - 4, y: at.y + 1.2, anchor: 'end' };
  if (at.x > RING.cx + 8) return { x: at.x + 4, y: at.y + 1.2, anchor: 'start' };
  return { x: at.x, y: at.y + 6.5, anchor: 'middle' };
};

/** A tappable SVG node: the same click-or-Enter contract the Gate 2 elements carry. */
const tapProps = (label: string, onTap: () => void) => ({
  role: 'button',
  tabIndex: 0,
  'aria-label': label,
  onClick: onTap,
  onKeyDown: (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onTap();
  },
});

const copy = (pair: { en: string; id: string }, lang: Lang): string => (lang === 'id' ? pair.id : pair.en);

export default function Archive({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  const packs = useArchive();
  const graph = useConstellation().data;
  const cases = useCaseLibrary().data;
  const sources = useJson<Source[]>(PATHS.sources).data;
  const root = useRef<HTMLDivElement>(null);

  const ctx = useMemo(() => makeCtx(sources ?? [], state.lang, state.theme), [sources, state.lang, state.theme]);
  const all = (packs.data ?? []).flatMap((pack) => pack.items.map((item) => item.narrative));
  const rows = all
    .filter((narrative) => keeps(narrative, state.filter))
    .map((narrative) => ({ narrative, shown: headlineOf(narrative, ctx) }))
    .filter((row) => matches(row.narrative, row.shown, state.query));

  /** A state that names a section scrolls to it, the way the autopsy scrolls to a panel. */
  useEffect(() => {
    if (state.focus === null) return;
    root.current?.querySelector(state.focus)?.scrollIntoView({ block: 'start' });
  }, [state.focus, rows.length, cases, graph]);

  const nodes = graph?.nodes ?? [];
  const selected = nodes.find((node) => node.id === state.node) ?? null;
  const via =
    selected === null
      ? []
      : [
          ...new Set(
            (graph?.links ?? [])
              .filter((link) => link.a === selected.id || link.b === selected.id)
              .map((link) => copy(link.via, state.lang)),
          ),
        ];
  const byId = new Map(sources?.map((source) => [source.id, source]) ?? []);

  return (
    <div className="m-tabpane" data-stagger="1" ref={root}>
      <div className="m-pane-title">{t('archive.title')}</div>
      <div className="m-pane-body">{t('archive.body')}</div>

      <div className="m-search" data-sr="1">
        <input
          className="m-search-in"
          data-testid="archive-search"
          aria-label={t('archive.search')}
          placeholder={t('archive.search')}
          value={state.query}
          onChange={(event) => {
            nav.patch({ query: event.target.value });
          }}
        />
      </div>

      <div className="m-fchips">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className="m-fchip"
            data-testid="archive-filter"
            data-filter={filter.id}
            aria-pressed={state.filter === filter.id}
            onClick={() => {
              nav.patch({ filter: filter.id });
            }}
          >
            {t(filter.label)}
          </button>
        ))}
      </div>

      <div className="m-const" data-sr="1" data-testid="constellation-teaser">
        <div className="m-const-title">{t('archive.const.title')}</div>
        {/* role="group", not "img": the nodes inside are real buttons, and an img whose
            subtree is focusable is what axe reports as nested-interactive. A group with the
            same label announces the teaser and still lets a reader tab into its nodes. */}
        <svg className="m-const-svg" viewBox="0 0 100 62" role="group" aria-label={t('archive.const.title')}>
          {(graph?.links ?? []).map((link) => {
            const a = nodes.findIndex((node) => node.id === link.a);
            const b = nodes.findIndex((node) => node.id === link.b);
            if (a < 0 || b < 0) return null;
            const from = place(a, nodes.length);
            const to = place(b, nodes.length);
            const on = state.node === link.a || state.node === link.b;
            return (
              <line
                key={`${link.a}-${link.b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={on ? 'var(--uns)' : 'var(--hair2)'}
                strokeWidth={on ? 0.8 : 0.5}
              />
            );
          })}
          {nodes.map((node, index) => {
            const at = place(index, nodes.length);
            const text = labelAt(at);
            const label = copy(node.label, state.lang);
            return (
              <g key={node.id} className="m-const-node">
                {state.node === node.id ? (
                  <circle cx={at.x} cy={at.y} r={4.6} fill="none" stroke="var(--uns)" strokeWidth={0.9} />
                ) : null}
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={2.6}
                  fill="var(--ink)"
                  {...tapProps(label, () => {
                    nav.patch({ node: state.node === node.id ? null : node.id });
                  })}
                />
                {/* The dot wears its slug, the desktop constellation's ruling: a full headline is
                    forty to sixty characters and this viewBox is a hundred units wide, so drawn
                    headlines clip at the card and pile up over the ring. The headline stays the
                    node's accessible name above, and the selection panel below says it in full. */}
                <text x={text.x} y={text.y} textAnchor={text.anchor} className="m-const-label">
                  {node.narrative_id}
                </text>
              </g>
            );
          })}
        </svg>
        {selected === null ? null : (
          <div className="m-const-sel">
            <span className="m-const-selmain">
              <span className="m-const-sellabel">{copy(selected.label, state.lang)}</span>
              <span className="m-const-selvia">{via.length === 0 ? t('archive.const.none') : via.join(' · ')}</span>
            </span>
            <button
              type="button"
              className="m-fchip"
              onClick={() => {
                nav.patch({ screen: 'autopsy', narrative: selected.narrative_id, spar: 'gate', sheet: null });
              }}
            >
              {t('archive.const.open')}
            </button>
          </div>
        )}
        <div className="m-const-foot">{t('archive.const.foot')}</div>
      </div>

      <div className="m-sechead">{t('archive.count', { n: rows.length })}</div>
      <div data-testid="archive-list">
        {packs.error !== null ? <div className="m-pane-note">{t('common.failed', { detail: packs.error })}</div> : null}
        {packs.data === null && packs.error === null ? <div className="m-pane-note">{t('common.loading')}</div> : null}
        {packs.data !== null && rows.length === 0 ? <div className="m-pane-note">{t('archive.empty')}</div> : null}
        {rows.map((row) => (
          <button
            key={row.narrative.id}
            type="button"
            className="m-arow"
            data-sr="1"
            onClick={() => {
              nav.patch({ screen: 'autopsy', narrative: row.narrative.id, spar: 'gate', sheet: null });
            }}
          >
            <span className="m-arow-head">{row.shown}</span>
            {/* C2: the counts travel with the headline here exactly as they do on a card. */}
            <CountChips counts={row.narrative.counts} ctx={ctx} />
            <span className="m-arow-meta">
              <span className="m-arow-sub">
                {row.narrative.outlet} · {dateLabel(row.narrative.published_date, state.lang)} ·{' '}
                {t(row.narrative.pack === 'id' ? 'pack.id' : 'pack.en')} · /n/{row.narrative.id}
              </span>
              <span className="m-arow-lean">{t(LEAN_LABEL[row.narrative.lean])}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="m-sechead">{t('archive.cases')}</div>
      <div data-testid="case-library">
        {cases === null ? <div className="m-pane-note">{t('common.loading')}</div> : null}
        {(cases?.cases ?? []).map((entry) => (
          <div key={entry.id} className="m-case" data-sr="1">
            <span className="m-case-id">{entry.id}</span>
            <span className="m-case-main">
              <span className="m-case-head">
                <span className="m-case-label">{copy(entry.title, state.lang)}</span>
                <span className="m-case-date">{entry.period}</span>
              </span>
              <span className="m-case-outcome">{copy(entry.documented_outcome, state.lang)}</span>
              <span className="m-case-meta">
                {copy(entry.motif, state.lang)} ·{' '}
                {t('archive.case.src', {
                  src: entry.citations
                    .map((id) => byId.get(id)?.publisher ?? id)
                    .join(', '),
                })}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="m-feedfoot">{t('archive.foot')}</div>
    </div>
  );
}
