/**
 * The Dissect tab and everything the paste box can lead to.
 *
 * One entry point, four endings, and the ending is decided by `url_index` rather than by which
 * control was tapped (`resolve.ts`, shared with the `/share` GET target):
 *
 *   cached          a canonical or legacy pattern. The autopsy opens with no staged progress at
 *                   all, and the toast says where the answer came from and when it was computed.
 *   fresh           the `fresh_demo` pattern, the one link in the archive that has no artifact
 *                   yet. Four stages run, then the artifact joins the shared cache and the feed.
 *   rate limited    a third fresh attempt in a day. The sheet says so in words; nothing fails
 *                   silently and nothing is invented to fill the gap.
 *   queued          no pattern at all. The queue state, and no progress animation, because there
 *                   is nothing in progress.
 *
 * The from-another-app card and the chat simulation are the same flow arriving through the share
 * sheet instead of the paste box, which is what the share-target registration buys.
 */
import { useEffect, useMemo } from 'react';
import type { Narrative, Source, UrlIndex } from '../../../contracts/types';
import { useT, type Key } from '../i18n';
import { loadJson, PATHS, peek, useJson, useUrlIndex } from '../content';
import { makeCtx } from '../renderers/ctx';
import { CountChips, headlineOf } from '../renderers/Card';
import { resolveUrl, roleUrl } from './resolve';
import { FRESH_CAP, freshUsed, LS, markFresh, writeStore, type AppState } from './state';
import type { Nav } from './Onboarding';

/**
 * The four stages, blueprint 3.4.2 plus the publish step the Gate 0 ruling made explicit: the
 * fleet really does publish into the shared cache, and a progress screen that stopped at the
 * audit would be describing three quarters of what happens.
 */
const STAGES: Array<{ label: Key; sub: Key }> = [
  { label: 'prog.s0', sub: 'prog.s0.sub' },
  { label: 'prog.s1', sub: 'prog.s1.sub' },
  { label: 'prog.s2', sub: 'prog.s2.sub' },
  { label: 'prog.s3', sub: 'prog.s3.sub' },
];

/** Milliseconds a stage holds. The honest line on screen says this is a compressed wait. */
const STAGE_MS = 550;

/** The recents list, most recent first, without duplicates. */
const remember = (recents: string[], id: string): string[] => [id, ...recents.filter((old) => old !== id)];

/**
 * Opens a cached dissection. `peek` rather than a fetch, because the toast has to name the
 * computation time in the same frame the autopsy paints: a cached read that waited on the
 * network would be neither cached nor instant.
 */
function openCached(state: AppState, nav: Nav, id: string, at: string): void {
  nav.patch({
    screen: 'autopsy',
    narrative: id,
    spar: 'gate',
    sheet: null,
    recents: remember(state.recents, id),
  });
  nav.toast(at);
}

export default function Dissect({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  const index = useUrlIndex().data;
  const sources = useJson<Source[]>(PATHS.sources).data;
  const ctx = useMemo(() => makeCtx(sources ?? [], state.lang, state.theme), [sources, state.lang, state.theme]);
  const used = freshUsed();

  /**
   * ponytail: the index is loaded rather than read off the hook, so a tap in the first frames
   * after mount resolves the same way as one a second later. `loadJson` is cached, so this is a
   * resolved promise every time but the first.
   */
  const go = (raw: string): void => {
    const url = raw.trim();
    if (url === '') return;
    void loadJson<UrlIndex>(PATHS.urlIndex).then(
      (data) => {
        const hit = resolveUrl(data, url);
        if (hit === null) {
          nav.patch({ screen: 'queue', sheet: null });
          return;
        }
        if (hit.role === 'fresh_demo') {
          if (freshUsed() >= FRESH_CAP) {
            nav.patch({ sheet: 'rate-limit' });
            return;
          }
          nav.patch({ screen: 'progress', sheet: null, progUrl: url, progTo: hit.narrative_id, progStage: 0 });
          return;
        }
        const cached = peek<Narrative>(PATHS.narrative(hit.narrative_id));
        openCached(
          state,
          nav,
          hit.narrative_id,
          t('toast.dissect.cached', { at: cached?.provenance.computed_at ?? '' }),
        );
      },
      () => {
        // An index that cannot be read cannot resolve a link, and a link that does not resolve
        // waits in the queue. Nothing is invented in the meantime, which is the same answer.
        nav.patch({ screen: 'queue', sheet: null });
      },
    );
  };

  const chip = (role: 'canonical' | 'fresh_demo'): void => {
    const url = index === null ? '' : roleUrl(index, role);
    nav.patch({ paste: url });
    go(url);
  };

  return (
    <div className="m-tabpane" data-stagger="1">
      <div className="m-pane-title">{t('dissect.title')}</div>
      <div className="m-pane-body">{t('dissect.body')}</div>

      <div className="m-paste" data-sr="1">
        <input
          className="m-paste-in"
          data-testid="paste-box"
          aria-label={t('dissect.paste.hint')}
          placeholder={t('dissect.paste.hint')}
          value={state.paste}
          onChange={(event) => {
            nav.patch({ paste: event.target.value });
          }}
        />
        <div className="m-paste-chips">
          <button
            type="button"
            className="m-pchip"
            data-testid="chip-cached"
            onClick={() => {
              chip('canonical');
            }}
          >
            {t('dissect.chip.cached')}
          </button>
          <button
            type="button"
            className="m-pchip"
            data-testid="chip-fresh"
            onClick={() => {
              chip('fresh_demo');
            }}
          >
            {t('dissect.chip.fresh')}
          </button>
        </div>
        <button
          type="button"
          className="m-cta"
          data-press="1"
          data-testid="paste-go"
          onClick={() => {
            go(state.paste);
          }}
        >
          {t('dissect.go')}
        </button>
      </div>

      <div className="m-quota">
        <span className="m-quota-used">{t('dissect.quota', { used, cap: FRESH_CAP })}</span>
        <button
          type="button"
          className="m-quota-link"
          onClick={() => {
            nav.patch({ sheet: 'rate-limit' });
          }}
        >
          {t('dissect.limit')}
        </button>
      </div>

      <div className="m-fromapp" data-sr="1" data-testid="from-another-app">
        <div className="m-fromapp-title">{t('dissect.another.title')}</div>
        <div className="m-fromapp-body">{t('dissect.another.body')}</div>
        <button
          type="button"
          className="m-ghost"
          data-press="1"
          onClick={() => {
            nav.patch({ screen: 'chat-sim', sheet: null });
          }}
        >
          {t('dissect.another.cta')}
        </button>
      </div>

      <div className="m-sechead">{t('dissect.recent')}</div>
      <div data-testid="recents">
        {state.recents.length === 0 ? <div className="m-pane-note">{t('dissect.recent.none')}</div> : null}
        {state.recents.map((id) => {
          const narrative = peek<Narrative>(PATHS.narrative(id));
          return (
            <button
              key={id}
              type="button"
              className="m-recent"
              data-sr="1"
              onClick={() => {
                nav.patch({ screen: 'autopsy', narrative: id, spar: 'gate', sheet: null });
              }}
            >
              <span className="m-recent-main">
                <span className="m-recent-head">{narrative === undefined ? id : headlineOf(narrative, ctx)}</span>
                {/* C2: a headline in a list carries its counts, the same as one on a card. */}
                {narrative === undefined ? null : <CountChips counts={narrative.counts} ctx={ctx} />}
                <span className="m-recent-meta">
                  {narrative === undefined
                    ? t('common.loading')
                    : t('dissect.recent.meta', {
                        at: narrative.provenance.computed_at,
                        sources: narrative.provenance.source_count,
                      })}
                </span>
              </span>
              <span className="m-chev" aria-hidden="true">
                ›
              </span>
            </button>
          );
        })}
      </div>

      <div className="m-feedfoot">{t('dissect.foot')}</div>
    </div>
  );
}

// --- the staged progress screen ----------------------------------------------------------

/**
 * The four stages, with the honest line under them verbatim.
 *
 * The run is the effect below, and it only runs when there is somewhere to land. `progTo` null
 * is a progress screen with no destination: the state after Cancel, and the one the matrix
 * screenshots, which is why the stages hold still there instead of racing the camera.
 */
export function Progress({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  const index = useUrlIndex().data;
  const to = state.progTo;

  useEffect(() => {
    if (to === null) return;
    const timers = STAGES.map((_, i) =>
      setTimeout(() => {
        nav.patch({ progStage: i + 1 });
      }, (i + 1) * STAGE_MS),
    );
    const land = setTimeout(() => {
      // The fresh dissection is spent, the artifact is in the shared cache, and the feed item
      // it was filtered out of is now a real one. All three are the same event.
      markFresh();
      writeStore(LS.via, '1');
      nav.patch({
        screen: 'autopsy',
        narrative: to,
        spar: 'gate',
        viaDissect: true,
        recents: remember(state.recents, to),
        progTo: null,
        progStage: STAGES.length,
      });
      nav.toast(t('toast.dissect.joined', { pack: t(state.pack === 'id' ? 'pack.id' : 'pack.en') }));
    }, STAGES.length * STAGE_MS + 350);
    return () => {
      for (const timer of timers) clearTimeout(timer);
      clearTimeout(land);
    };
    // The run is keyed on its destination alone: it starts when one is set and stops when it is
    // not. Everything else it closes over is fixed for the life of a run by construction, and
    // re-running on any of it would restart the stages under the reader.
  }, [to]);

  const shown = state.progUrl === '' && index !== null ? roleUrl(index, 'fresh_demo') : state.progUrl;
  const done = Math.min(state.progStage, STAGES.length);

  return (
    <section className="m-screen m-prog" data-screen="progress" aria-label={t('screen.progress')}>
      <div className="m-brand">{t('common.wordmark')}</div>
      <div className="m-prog-url">{shown}</div>
      <div className="m-prog-list">
        {STAGES.map((stage, index2) => {
          const st = done > index2 ? 'done' : done === index2 ? 'active' : 'pending';
          return (
            <div key={stage.label} className="m-prog-row" data-stage={st}>
              <span className="m-prog-mark" data-stage-mark={st} aria-hidden="true">
                {st === 'done' ? (
                  <svg width="11" height="11" viewBox="0 0 16 16">
                    <path
                      d="M3 8.5 6.5 12 13 4.5"
                      fill="none"
                      stroke="var(--accInk)"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </span>
              <span className="m-prog-main" data-on={done >= index2 ? '1' : '0'}>
                <span className="m-prog-label">{t(stage.label)}</span>
                <span className="m-prog-sub">{t(stage.sub)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="m-prog-bar">
        <span className="m-prog-fill" style={{ width: `${String((done / STAGES.length) * 100)}%` }} />
      </div>
      <div className="m-prog-honest">{t('prog.honest')}</div>
      <div className="m-spacer" />
      <button
        type="button"
        className="m-btn-plain"
        onClick={() => {
          nav.patch({ screen: 'main', tab: 'dissect', progTo: null, progStage: 0 });
        }}
      >
        {t('prog.cancel')}
      </button>
    </section>
  );
}

// --- the chat simulation and the share sheet it opens --------------------------------------

/** The forwarded-link message, and the two around it. Times are data, not copy. */
const CHAT: Array<{ id: string; text: Key | null; who: Key; at: string }> = [
  { id: 'panic', text: 'chat.m0', who: 'chat.who.0', at: '19:02' },
  { id: 'link', text: null, who: 'chat.who.0', at: '19:02' },
  { id: 'doubt', text: 'chat.m1', who: 'chat.who.1', at: '19:04' },
];

export function ChatSim({ nav }: { nav: Nav }) {
  const t = useT();
  return (
    <div className="m-screen m-chat" data-screen="chat-sim">
      <div className="m-chat-bar">
        <button
          type="button"
          className="m-round"
          aria-label={t('common.back')}
          onClick={() => {
            nav.patch({ screen: 'main', tab: 'dissect', sheet: null });
          }}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="m-chat-who">
          <div className="m-chat-name">{t('screen.chat-sim')}</div>
          <div className="m-chat-sub">{t('chat.sub')}</div>
        </div>
        <div className="m-round m-round-ghost" aria-hidden="true" />
      </div>

      <div className="m-chat-scroll">
        {CHAT.map((message) => (
          <div key={message.id} className={message.text === null ? 'm-msg m-msg-link' : 'm-msg'}>
            <div className="m-msg-meta">
              {t(message.who)} · {message.at}
            </div>
            {message.text === null ? (
              <div className="m-msg-card">
                <div className="m-msg-og">{t('chat.link.preview')}</div>
                <div className="m-msg-foot">
                  <span className="m-msg-titles">
                    <span className="m-msg-title">{t('share.sim.title')}</span>
                    <span className="m-msg-host">{t('share.sim.host')}</span>
                  </span>
                  <button
                    type="button"
                    className="m-msg-share"
                    aria-label={t('chat.hint')}
                    onClick={() => {
                      nav.patch({ sheet: 'share-sim' });
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10 12.5V3.5M6.5 6.5 10 3l3.5 3.5M4.5 10.5v6h11v-6" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="m-msg-bubble">{t(message.text)}</div>
            )}
          </div>
        ))}
        <div className="m-chat-hint">{t('chat.hint')}</div>
      </div>

      <div className="m-chat-compose">
        <div className="m-chat-field">{t('chat.compose')}</div>
      </div>
    </div>
  );
}

/**
 * The simulated OS share sheet. Tapping Matterhorn is the two-tap path the product is built
 * around: it runs the same resolution the paste box runs, on the link the message carries.
 */
export function ShareSim({ nav }: { nav: Nav }) {
  const t = useT();
  const index = useUrlIndex().data;
  const close = () => {
    nav.patch({ sheet: null });
  };
  return (
    <>
      <div className="m-scrim" onClick={close} />
      <div className="m-sheet" data-sheet="share-sim" role="dialog" aria-label={t('share.sim.foot')}>
        <div className="m-grab" />
        <div className="m-ss-link">
          <span className="m-ss-og" aria-hidden="true">
            og
          </span>
          <span className="m-ss-meta">
            <span className="m-ss-title">{t('share.sim.title')}</span>
            <span className="m-ss-host">{t('share.sim.host')}</span>
          </span>
        </div>
        <div className="m-ss-apps">
          <button
            type="button"
            className="m-ss-app"
            onClick={() => {
              const url = index === null ? '' : roleUrl(index, 'fresh_demo');
              const hit = index === null || url === '' ? null : resolveUrl(index, url);
              if (hit === null || freshUsed() >= FRESH_CAP) {
                nav.patch({ sheet: 'rate-limit' });
                return;
              }
              nav.patch({
                screen: 'progress',
                sheet: null,
                progUrl: url,
                progTo: hit.narrative_id,
                progStage: 0,
              });
            }}
          >
            <span className="m-ss-icon m-ss-icon-m">M</span>
            <span className="m-ss-label">{t('share.sim.app')}</span>
          </button>
          {(['share.sim.copy', 'share.sim.more'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className="m-ss-app"
              onClick={() => {
                nav.toast(t('toast.share.sim'));
              }}
            >
              <span className="m-ss-icon" />
              <span className="m-ss-label">{t(key)}</span>
            </button>
          ))}
        </div>
        <div className="m-ss-foot">{t('share.sim.foot')}</div>
        <button type="button" className="m-cta-soft" onClick={close}>
          {t('share.sim.cancel')}
        </button>
      </div>
    </>
  );
}

/**
 * The rate-limit sheet. Two fresh dissections a day is the demo's own budget, and the sheet
 * says so in words rather than greying a control out and leaving the reader to guess.
 */
export function RateSheet({ nav }: { nav: Nav }) {
  const t = useT();
  const close = () => {
    nav.patch({ sheet: null });
  };
  return (
    <>
      <div className="m-scrim" onClick={close} />
      <div className="m-sheet" data-sheet="rate-limit" role="dialog" aria-label={t('rate.title')}>
        <div className="m-grab" />
        <div className="m-sheet-h">{t('rate.title')}</div>
        <div className="m-sheet-p">{t('rate.body')}</div>
        <div className="m-sheet-meta">{t('rate.reset')}</div>
        <div className="m-sheet-cta">
          <button type="button" className="m-cta-soft" onClick={close}>
            {t('rate.cta')}
          </button>
        </div>
      </div>
    </>
  );
}
