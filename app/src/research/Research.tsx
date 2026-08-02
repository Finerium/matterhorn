/**
 * `/research`, blueprint 3.2 item 18: the analyst's surface. An archive table with filters, the
 * full interactive constellation, and a detail rail carrying velocity, lean spread, echoes, the
 * permalink, member link previews, and CSV plus JSON export of the graph data. The "Run the
 * fleet" action on a row or in the rail opens the replay console (replay.tsx), which replays
 * that narrative's recorded editorial run from content/replay.json.
 *
 * It is not a second app. It reads exactly what `/app` reads, through the same loader, and it
 * renders numbers through the same renderer layer: the count chips come from `renderers/Card`,
 * the echo from `renderers/Echo`, the headline from the one `headlineOf` the app has. Nothing
 * here opens a second path to a figure, so the orphan-number refusal of blueprint 6.2 covers this
 * surface the way it covers the autopsy, and it fires here for the same reason it fires there.
 *
 * What is new is the shape of the reading: the app shows one narrative at a time, this shows the
 * corpus. The rail's two derived statistics are counts of published records, said as the counts
 * they are (`{n} outlets over {d} days`, a tally of published `lean` fields) rather than as rates
 * or scores, which would be figures nothing published.
 *
 * The whole view is in the URL: filters, the selected narrative, the selected point, the open
 * replay. An analyst's finding is a link they can paste, `?tag=missing-link` is a filtered
 * archive, and the Appendix A desktop states are addressable without a state-jump hook.
 * `useSearchParams` is the only view state this surface has; there is no second copy to drift.
 *
 * Responsive, blueprint 4.3: at 1024 and up the table and the constellation sit side by side with
 * the rail under the graph; between 768 and 1024 it is one column with the constellation above
 * the table; below 768 it is a redirect card to `/app` with a way past it. The two desktop
 * breakpoints are CSS; the redirect card is the one width decision made in JS (the Frame.tsx
 * idiom), because 4.3 gives 768-and-up no redirect surface at all, and a card that is merely
 * `display: none` is still a card in the DOM.
 *
 * Surfaces, per docs/design-direction.md: the fog background (licensed, duotone-graded in CSS)
 * lies under a neumorphic paper ground, and everything the analyst works on floats over it as
 * glass. The cursor system below is the direction's shared listener, copied per route on
 * purpose: three copies of twenty lines beat one eager chunk shared across lazy routes.
 */
import { useEffect, useMemo, useRef, useSyncExternalStore, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { OgAttribution, Replay, Source } from '../../../contracts/types';
import { useLang, useT } from '../i18n';
import { PATHS, useArchive, useConstellation, useJson } from '../content';
import { LS, readStore } from '../app/state';
import { makeCtx, type Theme } from '../renderers/ctx';
import { CountChips, headlineOf } from '../renderers/Card';
import { dateLabel } from '../renderers/copy';
import Echo from '../renderers/Echo';
import { SITE_URL } from '../site';
import Constellation from './Constellation';
import ReplayConsole from './replay';
import {
  download,
  filtersActive,
  graphJson,
  linksCsv,
  nodesCsv,
  scopeOf,
  spread,
  velocity,
  type Filters,
  type GraphSlice,
} from './graph';
import './research.css';

const LEAN_KEY = {
  gov: 'research.lean.gov',
  neutral: 'research.lean.neutral',
  opp: 'research.lean.opp',
} as const;

const PACK_KEY = { id: 'pack.id', en: 'pack.en' } as const;

const asPack = (raw: string): Filters['pack'] => (raw === 'id' || raw === 'en' ? raw : 'all');
const asLean = (raw: string): Filters['lean'] => (raw === 'gov' || raw === 'opp' || raw === 'neutral' ? raw : 'all');

/** A select or a text field writes its own key; 'all' and '' both mean "drop the parameter". */
type Patch = Record<string, string>;

/** Blueprint 4.3's floor. Kept in step by hand with the belt `@media` rule in research.css. */
const NARROW = '(max-width: 767.98px)';

const subscribeNarrow = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(NARROW);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

export default function Research() {
  const t = useT();
  const lang = useLang();
  const [params, setParams] = useSearchParams();

  const packs = useArchive();
  const constellation = useConstellation();
  const graph = constellation.data;
  const sources = useJson<Source[]>(PATHS.sources).data;
  // Both are additive artifacts: the desk works without them, so neither gates `ready` and a
  // failure surfaces as the affordance simply not appearing rather than as a dead page.
  const replay = useJson<Replay>('replay.json').data;
  const attribution = useJson<OgAttribution>('og_attribution.json').data;
  const theme: Theme = readStore(LS.theme) === 'dark' ? 'dark' : 'light';
  const ctx = useMemo(() => makeCtx(sources ?? [], lang, theme), [sources, lang, theme]);

  const narrow = useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches);

  // Read as primitives, then memoize: an object rebuilt from `params` every render would make the
  // scope a new object every render, and through it the constellation's element memo, which is
  // the one memo the 500-node budget of AC-PERF-4 rests on.
  const pack = params.get('pack') ?? 'all';
  const lean = params.get('lean') ?? 'all';
  const query = params.get('q') ?? '';
  const tag = params.get('tag') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const filters: Filters = useMemo(
    () => ({ pack: asPack(pack), lean: asLean(lean), query, tag, from, to }),
    [pack, lean, query, tag, from, to],
  );

  // Both pack payloads are stable objects out of the loader's cache, so this survives a selection.
  const idPack = packs.data?.[0] ?? null;
  const enPack = packs.data?.[1] ?? null;
  const narratives = useMemo(
    () => [idPack, enPack].flatMap((entry) => entry?.items.map((item) => item.narrative) ?? []),
    [idPack, enPack],
  );

  const scope = useMemo(
    () => scopeOf(narratives, graph, filters, (narrative) => headlineOf(narrative, ctx)),
    [narratives, graph, filters, ctx],
  );
  const byId = useMemo(() => new Map(narratives.map((narrative) => [narrative.id, narrative])), [narratives]);

  const chosen = byId.get(params.get('id') ?? '');
  const rowOf = scope.rows.find((row) => row.narrative.id === chosen?.id);
  // `?id=` alone still lights a point: the narrative's own, when the graph carries one.
  const nodeId = params.get('node') ?? rowOf?.nodeId ?? null;
  const node = nodeId === null ? undefined : graph?.nodes.find((entry) => entry.id === nodeId);

  // The open replay, by URL like everything else. The record decides whether the affordance
  // exists at all: a narrative the run log does not carry gets no button and no console.
  const runOf = useMemo(
    () => new Map((replay?.narratives ?? []).map((run) => [run.narrative_id, run])),
    [replay],
  );
  const openRun = runOf.get(params.get('replay') ?? '');

  // Member link previews for the chosen narrative: the additive og_attribution entries that
  // carry `member_url`. `image_path` null is the recorded fallback and renders the styled
  // placeholder, never a broken img (blueprint 7.3 C7; the file's own `policy` string).
  const previews = useMemo(
    () =>
      (attribution?.entries ?? []).filter(
        (entry) => entry.narrative_id === chosen?.id && entry.member_url !== undefined,
      ),
    [attribution, chosen],
  );

  const slice: GraphSlice | null =
    graph === null
      ? null
      : {
          graph,
          ids: scope.nodeIds,
          byNarrative: byId,
          origin: SITE_URL,
          shownHeadline: (narrative) => headlineOf(narrative, ctx),
        };
  const exported = {
    nodes: scope.nodeIds.size,
    links:
      graph === null ? 0 : graph.links.filter((link) => scope.nodeIds.has(link.a) && scope.nodeIds.has(link.b)).length,
  };

  const untestedRows = scope.shown.filter((row) => row.verdict.untested.length > 0);
  const untestedFields = [...new Set(untestedRows.flatMap((row) => row.verdict.untested))].join(', ');

  // The lean spread is the receipt for the set on screen, computed from the published `lean` of
  // every row the filters kept. A row whose lean could not be read counts as untested, never as
  // neutral: a missing field is not a middle position.
  const bar = spread(scope.shown.map((row) => (row.verdict.untested.includes('lean') ? null : row.narrative.lean)));
  const pace = chosen === undefined ? null : velocity(chosen);

  const patch = (changes: Patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === 'all') next.delete(key);
      else next.set(key, value);
    }
    // Replace rather than push: a filtered archive is a view, and ten keystrokes in the search
    // field should not be ten presses of the back button to leave.
    setParams(next, { replace: true });
  };
  const select = (narrativeId: string, point: string | null) => {
    patch({ id: narrativeId, node: point ?? '' });
  };

  const root = useRef<HTMLDivElement>(null);

  // The cursor system, the direction's one shared listener copied into this route: a single
  // rAF-throttled pointermove writes --mx/--my on the surface root and panel-relative --px/--py
  // on every .g-glass panel it owns. CSS consumes the variables; this never styles. Inert for
  // touch, coarse pointers and reduced motion, whose rest state is the finished surface.
  useEffect(() => {
    const surface = root.current;
    const fine = window.matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)');
    if (surface === null || !fine.matches) return;
    let frame = 0;
    let x = 0;
    let y = 0;
    const clamp = (value: number): number => Math.min(Math.max(value, 0), 1);
    const paint = () => {
      frame = 0;
      surface.style.setProperty('--mx', `${String(x)}px`);
      surface.style.setProperty('--my', `${String(y)}px`);
      for (const panel of surface.querySelectorAll<HTMLElement>('.g-glass')) {
        const rect = panel.getBoundingClientRect();
        panel.style.setProperty('--px', clamp((x - rect.left) / Math.max(rect.width, 1)).toFixed(3));
        panel.style.setProperty('--py', clamp((y - rect.top) / Math.max(rect.height, 1)).toFixed(3));
      }
    };
    const onMove = (event: PointerEvent) => {
      x = event.clientX;
      y = event.clientY;
      if (frame === 0) frame = requestAnimationFrame(paint);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  const failure = packs.error ?? constellation.error;
  const ready = packs.data !== null && graph !== null;

  const runButton = (narrativeId: string, point: string | null, testid: string) =>
    runOf.has(narrativeId) ? (
      <button
        type="button"
        className="m-fchip m-rs-run"
        data-testid={testid}
        onClick={(event) => {
          event.stopPropagation();
          patch({ replay: narrativeId, id: narrativeId, node: point ?? '' });
        }}
        onKeyDown={(event) => {
          event.stopPropagation();
        }}
      >
        {t('research.replay.run')}
      </button>
    ) : null;

  return (
    <main className="m-rs" data-theme={theme} data-anyway={params.get('anyway') === '1' ? '1' : '0'} data-testid="research">
      {/* The licensed fog, graded into the paper system. Decorative, and behind everything: the
          working column sits on panels, so the image never carries text (design direction). */}
      <div className="m-rs-bg" aria-hidden="true" />

      {/* Below 768 this is the whole page until the reader asks for the rest. Not rendered at
          768 and up: blueprint 4.3 has no redirect surface there, and the spec counts nodes. */}
      {narrow && params.get('anyway') !== '1' ? (
        <section className="m-rs-narrow g-paper-raised" data-testid="research-redirect">
          <h1 className="m-rs-narrow-title">{t('research.narrow.title')}</h1>
          <p className="m-rs-narrow-body">{t('research.narrow.body')}</p>
          <Link className="m-cta m-rs-narrow-cta" to="/app" data-press="1">
            {t('research.narrow.open')}
          </Link>
          <button
            type="button"
            className="m-page-link m-rs-anyway"
            data-testid="research-continue"
            onClick={() => {
              patch({ anyway: '1' });
            }}
          >
            {t('research.narrow.anyway')}
          </button>
          <p className="m-rs-narrow-foot">{t('research.narrow.foot')}</p>
        </section>
      ) : null}

      <div className="m-rs-main" ref={root}>
        <header className="m-rs-head g-paper-raised g-enter">
          <div className="m-brand">{t('common.wordmark')}</div>
          <h1 className="m-rs-title">{t('research.title')}</h1>
          <p className="m-rs-body">{t('research.body')}</p>
          <Link className="m-page-link" to="/app">
            {t('route.home.link')}
          </Link>
        </header>

        {!ready ? (
          <p className="m-rs-note">{failure === null ? t('common.loading') : t('common.failed', { detail: failure })}</p>
        ) : (
          <div className="m-rs-grid">
            <section className="m-rs-filters g-glass g-enter" aria-label={t('research.filters')}>
              <div className="m-rf">
                <label className="m-rf-field m-rf-wide">
                  <span className="m-rf-label">{t('research.filter.search')}</span>
                  <input
                    className="m-rf-in g-well"
                    type="search"
                    data-testid="research-search"
                    placeholder={t('research.filter.search.ph')}
                    value={query}
                    onChange={(event) => {
                      patch({ q: event.target.value });
                    }}
                  />
                </label>
                <label className="m-rf-field">
                  <span className="m-rf-label">{t('research.filter.pack')}</span>
                  <select
                    className="m-rf-in g-well"
                    data-testid="research-filter-pack"
                    value={filters.pack}
                    onChange={(event) => {
                      patch({ pack: event.target.value });
                    }}
                  >
                    <option value="all">{t('archive.filter.all')}</option>
                    <option value="id">{t('pack.id')}</option>
                    <option value="en">{t('pack.en')}</option>
                  </select>
                </label>
                <label className="m-rf-field">
                  <span className="m-rf-label">{t('research.filter.lean')}</span>
                  <select
                    className="m-rf-in g-well"
                    data-testid="research-filter-lean"
                    value={filters.lean}
                    onChange={(event) => {
                      patch({ lean: event.target.value });
                    }}
                  >
                    <option value="all">{t('archive.filter.all')}</option>
                    <option value="gov">{t('research.lean.gov')}</option>
                    <option value="neutral">{t('research.lean.neutral')}</option>
                    <option value="opp">{t('research.lean.opp')}</option>
                  </select>
                </label>
                <label className="m-rf-field">
                  <span className="m-rf-label">{t('research.filter.from')}</span>
                  <input
                    className="m-rf-in g-well m-num"
                    type="date"
                    data-testid="research-date-from"
                    value={from}
                    onChange={(event) => {
                      patch({ from: event.target.value });
                    }}
                  />
                </label>
                <label className="m-rf-field">
                  <span className="m-rf-label">{t('research.filter.to')}</span>
                  <input
                    className="m-rf-in g-well m-num"
                    type="date"
                    data-testid="research-date-to"
                    value={to}
                    onChange={(event) => {
                      patch({ to: event.target.value });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="m-fchip m-rf-clear"
                  disabled={!filtersActive(filters)}
                  onClick={() => {
                    patch({ pack: '', lean: '', q: '', tag: '', from: '', to: '' });
                  }}
                >
                  {t('research.filter.clear')}
                </button>
              </div>

              {/* The tag filter arrives by URL, so it needs a face and a way out of it. */}
              {tag === '' ? null : (
                <button
                  type="button"
                  className="m-fchip m-rf-tag"
                  data-testid="research-tag"
                  onClick={() => {
                    patch({ tag: '' });
                  }}
                >
                  {t('research.filter.tag', { tag })}
                </button>
              )}

              <p className="m-rf-count m-num" data-testid="research-count">
                {t('research.count', { shown: scope.shown.length, total: scope.rows.length })}
              </p>
              {untestedRows.length === 0 ? null : (
                <p className="m-rf-note" data-testid="research-untested">
                  {t('research.untested', { n: untestedRows.length, fields: untestedFields })}
                </p>
              )}
            </section>

            <section className="m-rs-graph g-glass g-enter" aria-label={t('research.graph.label')}>
              <Constellation
                graph={graph}
                inScope={scope.nodeIds}
                selected={nodeId}
                byNarrative={byId}
                onSelect={(id) => {
                  const hit = graph.nodes.find((entry) => entry.id === id);
                  patch({ node: id, id: hit === undefined ? '' : (byId.get(hit.narrative_id)?.id ?? '') });
                }}
                label={t('research.graph.label')}
                zoomIn={t('research.graph.zoomin')}
                zoomOut={t('research.graph.zoomout')}
                reset={t('research.graph.reset')}
                lang={lang}
              />
              <p className="m-rs-cap m-num">
                {t('research.graph.caption', { nodes: graph.nodes.length, links: graph.links.length })}
              </p>
              {scope.orphanNodes.length === 0 ? null : (
                <p className="m-rs-cap m-rs-gap m-num">
                  {t('research.graph.orphans', { n: scope.orphanNodes.length })}
                </p>
              )}
              {scope.nodelessRows === 0 ? null : (
                <p className="m-rs-cap m-rs-gap m-num">{t('research.graph.nodeless', { n: scope.nodelessRows })}</p>
              )}
            </section>

            <aside className="m-rs-rail g-glass g-enter" aria-label={t('research.rail.title')} data-testid="research-rail">
              {chosen === undefined ? (
                node === undefined ? (
                  <p className="m-rs-note">{t('research.rail.empty')}</p>
                ) : (
                  <>
                    <div className="m-rr-kicker">{t('research.rail.node')}</div>
                    <h2 className="m-rr-head">{lang === 'id' ? node.label.id : node.label.en}</h2>
                    <p className="m-rs-note">{t('research.rail.orphan')}</p>
                  </>
                )
              ) : (
                <>
                  <div className="m-rr-kicker">{t(PACK_KEY[chosen.pack])}</div>
                  <h2 className="m-rr-head">{headlineOf(chosen, ctx)}</h2>
                  <p className="m-rr-meta m-num">
                    {chosen.outlet} · {dateLabel(chosen.published_date, lang)} · {t(LEAN_KEY[chosen.lean])}
                  </p>
                  <CountChips counts={chosen.counts} ctx={ctx} />
                  {runButton(chosen.id, rowOf?.nodeId ?? null, 'replay-run-rail')}

                  <div className="m-rr-block m-num" data-testid="rail-velocity">
                    <h3 className="m-rr-h">{t('research.rail.velocity')}</h3>
                    {pace === null || pace.days === null ? (
                      <p className="m-rr-line">
                        {t('research.rail.velocity.outlets', { outlets: pace?.outlets ?? 0 })}
                      </p>
                    ) : (
                      <p className="m-rr-figure">
                        {t('research.rail.velocity.line', { outlets: pace.outlets, days: pace.days })}
                      </p>
                    )}
                    {pace === null || pace.days === null ? (
                      <p className="m-rr-line">{t('research.rail.velocity.nospan')}</p>
                    ) : (
                      <p className="m-rr-line">
                        {t('research.rail.velocity.span', { first: pace.first ?? '', last: pace.last ?? '' })}
                      </p>
                    )}
                    {pace !== null && pace.coarse > 0 ? (
                      <p className="m-rr-line">
                        {t('research.rail.velocity.coarse', { n: pace.coarse, outlets: pace.outlets })}
                      </p>
                    ) : null}
                  </div>

                  {/* Member link previews, blueprint 7.3 C7: cached og images render only as
                      attributed previews, outlet named, linking out. A recorded fallback is a
                      styled placeholder; nothing here can render a broken image. */}
                  {previews.length === 0 ? null : (
                    <div className="m-rr-block" data-testid="rail-previews">
                      <h3 className="m-rr-h">{t('research.members.title')}</h3>
                      <div className="m-og-row">
                        {previews.map((entry) => (
                          <a
                            key={entry.member_url}
                            className="m-og-card"
                            href={entry.member_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {typeof entry.image_path === 'string' ? (
                              <img
                                className="m-og-img"
                                src={entry.image_path}
                                alt={t('research.members.alt', { outlet: entry.outlet })}
                                loading="lazy"
                              />
                            ) : (
                              <span className="m-og-ph">{t('research.members.none')}</span>
                            )}
                            <span className="m-og-outlet">{entry.outlet}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* The real Echo renderer, silence state and citation resolution included. */}
                  <div className="m-rr-block">
                    <Echo panel={chosen.echo} ctx={ctx} />
                  </div>

                  <div className="m-rr-block">
                    <h3 className="m-rr-h">{t('research.rail.permalink')}</h3>
                    {/* The address is shown in full so it can be copied, and it navigates in the
                        client so following it from here is not a reload. */}
                    <Link className="m-rr-perma" to={`/n/${chosen.id}`} data-testid="research-permalink">
                      {SITE_URL}/n/{chosen.id}
                    </Link>
                  </div>
                </>
              )}

              {/* h2, not h3: the spread block renders whether or not a narrative is chosen, so
                  with an empty rail it is the first heading under the page h1 and an h3 there
                  skips a level. The two h3s above it are inside the selection, which brings its
                  own h2 with it. */}
              <div className="m-rr-block m-num" data-testid="rail-lean">
                <h2 className="m-rr-h">{t('research.rail.spread')}</h2>
                <div className="m-symbar">
                  <div className="m-symbar-track" aria-hidden="true">
                    {(['gov', 'neutral', 'opp'] as const).map((tone) => (
                      <span
                        key={tone}
                        className="m-symbar-slice"
                        data-lean={tone}
                        style={{ width: `${String(bar.total === 0 ? 0 : (bar[tone] / bar.total) * 100)}%` }}
                      />
                    ))}
                  </div>
                  <div className="m-symbar-legend">
                    {(['gov', 'neutral', 'opp'] as const).map((tone) => (
                      <span key={tone} className="m-symbar-item">
                        <span className="m-dot" data-lean={tone} />
                        {t(LEAN_KEY[tone])} {bar[tone]}
                      </span>
                    ))}
                    {bar.untested === 0 ? null : (
                      <span className="m-symbar-item">{t('research.rail.spread.untested', { n: bar.untested })}</span>
                    )}
                  </div>
                </div>
                <p className="m-rr-line">{t('research.rail.spread.note', { n: bar.total })}</p>
              </div>

              {slice === null ? null : (
                <div className="m-rr-block m-rr-export" data-testid="research-export">
                  <h3 className="m-rr-h">{t('research.export')}</h3>
                  <div className="m-rr-buttons">
                    <button
                      type="button"
                      className="m-fchip"
                      data-testid="export-csv"
                      onClick={() => {
                        download('matterhorn-nodes.csv', 'text/csv;charset=utf-8', nodesCsv(slice));
                      }}
                    >
                      {t('research.export.nodes')}
                    </button>
                    <button
                      type="button"
                      className="m-fchip"
                      data-testid="export-links-csv"
                      onClick={() => {
                        download('matterhorn-links.csv', 'text/csv;charset=utf-8', linksCsv(slice));
                      }}
                    >
                      {t('research.export.links')}
                    </button>
                    <button
                      type="button"
                      className="m-fchip"
                      data-testid="export-json"
                      onClick={() => {
                        download(
                          'matterhorn-graph.json',
                          'application/json',
                          graphJson(slice, filters, new Date().toISOString()),
                        );
                      }}
                    >
                      {t('research.export.json')}
                    </button>
                  </div>
                  <p className="m-rr-line m-num">
                    {t('research.export.note', { nodes: exported.nodes, links: exported.links })}
                  </p>
                </div>
              )}
            </aside>

            <section className="m-rs-table g-enter">
              <div className="m-rt-scroll g-glass">
                <table className="m-rt" data-testid="research-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('research.col.head')}</th>
                      <th scope="col">{t('research.col.outlet')}</th>
                      <th scope="col">{t('research.col.date')}</th>
                      <th scope="col">{t('research.col.pack')}</th>
                      <th scope="col">{t('research.col.lean')}</th>
                      <th scope="col">{t('research.col.signals')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scope.shown.map((row) => {
                      const open = () => {
                        select(row.narrative.id, row.nodeId);
                      };
                      return (
                        // The row is the control, so it carries the tab stop rather than nesting a
                        // second one inside a cell. Blueprint 4.2.6: reachable and operable.
                        <tr
                          key={row.narrative.id}
                          tabIndex={0}
                          data-testid="research-row"
                          data-narrative={row.narrative.id}
                          data-sel={chosen?.id === row.narrative.id ? '1' : '0'}
                          onClick={open}
                          onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            open();
                          }}
                        >
                          <th scope="row">
                            <span className="m-rt-open">{headlineOf(row.narrative, ctx)}</span>
                            {row.verdict.untested.length === 0 ? null : (
                              <span className="m-rt-flag" data-testid="research-row-untested">
                                {t('research.row.untested', { fields: row.verdict.untested.join(', ') })}
                              </span>
                            )}
                            {runButton(row.narrative.id, row.nodeId, 'replay-run-row')}
                          </th>
                          <td>{row.narrative.outlet}</td>
                          <td className="m-num">{dateLabel(row.narrative.published_date, lang)}</td>
                          <td>{t(PACK_KEY[row.narrative.pack])}</td>
                          <td>{t(LEAN_KEY[row.narrative.lean])}</td>
                          <td>
                            <CountChips counts={row.narrative.counts} ctx={ctx} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {scope.shown.length === 0 ? <p className="m-rs-note">{t('archive.empty')}</p> : null}
            </section>
          </div>
        )}
      </div>

      {openRun === undefined || replay === null ? null : (
        <ReplayConsole
          run={openRun}
          runId={replay.run_id}
          disclosure={replay.disclosure[lang]}
          lang={lang}
          onClose={() => {
            patch({ replay: '' });
          }}
        />
      )}
    </main>
  );
}
