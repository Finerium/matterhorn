/**
 * The app shell: one screen machine, four tabs, the zip's frosted chrome, and the overlays.
 *
 * The whole of `/app` is client state. There is no route per screen (blueprint 6.7 says so
 * explicitly), so what the state matrix drives instead is `data-screen` on every screen root,
 * `data-sheet` on every overlay, and the dev-only `window.__mthGoto(name)` jump defined in
 * `state.ts`. Those three are the testability contract; nothing else about this file is one.
 *
 * Tab content is a placeholder this wave except the radar, which mounts the real Gate 2 Card
 * components off the loader. The screens beyond the tabs (autopsy, methodology, notification
 * settings, lock preview, chat sim, progress, queue) exist here as named, reachable roots so
 * the matrix can address them; each surface implementer replaces one body.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Feed } from '../../../contracts/types';
import { LangContext, translate, useT, type Key } from '../i18n';
import { PACKS, PATHS, loadJson, prefetchRadar } from '../content';
import { trapRef } from '../trap';
import Archive from './Archive';
import Autopsy from './Autopsy';
import Dissect, { ChatSim, Progress, RateSheet, ShareSim } from './Dissect';
import { AuthScreen, Hello, LangScreen, NotifScreen, RegionsScreen, type Nav } from './Onboarding';
import Radar from './Radar';
import Settings, { MethodologyScreen, NotifSettings } from './Settings';
import {
  clearUpdated,
  gotoPatch,
  initialState,
  joinFeed,
  LS,
  markUpdated,
  readUpdated,
  screenName,
  writeStore,
  type AppState,
  type Screen,
  type SheetName,
  type Tab,
} from './state';

/** Injected by vite: true when serving (dev and the e2e harness), false in any build. */
declare const __MTH_DEV__: boolean;

declare global {
  interface Window {
    /**
     * Dev and e2e only. Jumps the shell to an Appendix A state name; false means the shell
     * cannot reach that state yet, which is a matrix failure rather than a silent wrong shot.
     */
    __mthGoto?: (name: string) => boolean;
  }
}

const TAB_ICONS: Record<Tab, ReactNode> = {
  radar: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <path d="M10 10 14.6 5.7" />
    </>
  ),
  dissect: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.6v6.8M6.6 10h6.8" />
    </>
  ),
  archive: <path d="M3.5 5.5h13M5.5 10h9M7.5 14.5h5" />,
  settings: (
    <>
      <path d="M3.5 6.5h13M3.5 13.5h13" />
      <circle cx="12.5" cy="6.5" r="2" fill="var(--paper)" />
      <circle cx="7.5" cy="13.5" r="2" fill="var(--paper)" />
    </>
  ),
};

const TAB_LABEL: Record<Tab, Key> = {
  radar: 'tab.radar',
  dissect: 'tab.dissect',
  archive: 'tab.archive',
  settings: 'tab.settings',
};

/** Screens with no surface of their own yet. Named and reachable; the body is a stated gap. */
const STANDALONE: Partial<Record<Screen, Key>> = {
  'lock-preview': 'screen.lock-preview',
};

/** docs/replay-protocol.md. The desk posts `{type:'published', narrative_id, at}` on this. */
const CHANNEL = 'mth-updates';

/**
 * Whether a publish for `id` also opens the feed, read from the feeds rather than named here.
 * `via_dissect` is a property of the feed item, so a narrative id written into app source would
 * be a content string that stops being true the next time the pipeline publishes.
 *
 * It loads rather than peeks. The QR door lands on `/n/{id}?published=1` and receives during
 * mount, before the boot prefetch below has resolved anything, and a peek there answers "no join"
 * for the one narrative the protocol says must join. `loadJson` is the cache the prefetch fills,
 * so a shell that has been open a while answers without a second fetch.
 */
const joinsFeed = async (id: string): Promise<boolean> => {
  const feeds = await Promise.all(PACKS.map((pack) => loadJson<Feed>(PATHS.feed(pack))));
  return feeds.some((feed) => feed.items.some((item) => item.narrative_id === id && item.via_dissect === true));
};

/** Two update maps with the same ids in them. Used to bail out of a pointless re-render. */
const sameIds = (a: Record<string, string>, b: Record<string, string>): boolean => {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => b[key] !== undefined);
};

/**
 * `start` is the state a route hands the shell before first paint. `/n/{id}` uses it to open on
 * the autopsy for that narrative, which is how AC-APP-18 hydrates a permalink into the real
 * screen rather than into a second, thinner copy of it.
 *
 * `banner` is chrome a route pins over the shell. `/share` uses it to state the resolution it
 * took on the way in, so the decision is visible on top of the screen that decision produced.
 *
 * `published` is docs/replay-protocol.md's second door: `/n/{id}?published=1` is a broadcast that
 * arrived by camera instead of by channel, and the shell treats it as exactly that.
 */
export default function App({
  start,
  banner,
  published,
}: {
  start?: Partial<AppState>;
  banner?: ReactNode;
  published?: string;
}) {
  const [state, setState] = useState<AppState>(() => ({ ...initialState(), ...start }));

  const patch = useCallback((next: Partial<AppState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

  /**
   * A publish arrived, from either door: badge, toast, persist, and for the `via_dissect`
   * narrative the feed join, through the same `joinFeed` the fresh-dissect demo lands on.
   *
   * The join lands as its own patch because it has to read the feed first. Every storage write
   * happens here rather than inside an updater, which StrictMode invokes twice.
   */
  const receive = useCallback((id: string) => {
    const updated = markUpdated(id, new Date().toISOString());
    setState((current) => ({ ...current, updated, toast: translate(current.lang, 'toast.updated') }));
    void joinsFeed(id).then(
      (joins) => {
        if (!joins) return;
        const join = joinFeed();
        setState((current) => ({ ...current, ...join }));
      },
      () => {
        /* a feed that cannot be read is a badge without a join, not a publish that failed */
      },
    );
  }, []);

  // The same-machine channel. A browser without BroadcastChannel loses nothing it had: the QR is
  // the cross-device door and does not go through here.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (event: MessageEvent<unknown>) => {
      const message = event.data as { type?: unknown; narrative_id?: unknown } | null;
      if (message === null || typeof message !== 'object') return;
      if (message.type !== 'published' || typeof message.narrative_id !== 'string') return;
      receive(message.narrative_id);
    };
    return () => {
      channel.close();
    };
  }, [receive]);

  useEffect(() => {
    if (published !== undefined) receive(published);
  }, [published, receive]);

  /**
   * Opening that autopsy is what consumes the badge. The store forgets the id on the way in, so
   * a reload cannot bring the notice back; the state keeps it until the reader leaves the
   * screen, because a notice that clears itself before it can be read is not a notice.
   *
   * The map IS a dependency, because a publish can arrive for the narrative already on screen:
   * the QR door opens `/n/{id}?published=1` straight onto that autopsy, and the same-machine
   * channel can land while the reader is sitting on it. Neither has a screen change to ride, and
   * without this the id survives a read and badges its own feed card afterwards. The clear
   * touches storage only, so the notice stays visible until the reader leaves.
   */
  useEffect(() => {
    if (state.screen === 'autopsy' && state.updated[state.narrative] !== undefined) {
      clearUpdated(state.narrative);
      return;
    }
    const stored = readUpdated();
    setState((current) => (sameIds(current.updated, stored) ? current : { ...current, updated: stored }));
  }, [state.screen, state.narrative, state.updated]);

  // Preferences and the theme attribute, written wherever they land from.
  useEffect(() => {
    writeStore(LS.lang, state.lang);
    writeStore(LS.pack, state.pack);
    writeStore(LS.theme, state.theme);
    writeStore(LS.regions, JSON.stringify(state.regions));
    writeStore(LS.scaffold, state.scaffold);
    writeStore(LS.flags, JSON.stringify(state.flags));
    writeStore(LS.recents, JSON.stringify(state.recents));
    document.body.dataset.mth = state.theme;
  }, [state.lang, state.pack, state.theme, state.regions, state.scaffold, state.flags, state.recents]);

  useEffect(() => {
    if (state.screen === 'main') writeStore(LS.onboarded, '1');
  }, [state.screen]);

  // Both feeds are fetched while onboarding is on screen, so the radar paints from cache and a
  // pack switch, from the pill or from the region sheet, is a synchronous cache read (AC-APP-14).
  useEffect(() => {
    for (const pack of PACKS) {
      void prefetchRadar(pack).catch(() => {
        /* the radar reports its own failure; a warm-up that misses is not an error */
      });
    }
  }, []);

  useEffect(() => {
    if (state.toast === null) return;
    const timer = setTimeout(() => {
      setState((current) => ({ ...current, toast: null }));
    }, 2800);
    return () => {
      clearTimeout(timer);
    };
  }, [state.toast]);

  useEffect(() => {
    if (state.sheet === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setState((current) => ({ ...current, sheet: null }));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [state.sheet]);

  // The state-jump hook. `__MTH_DEV__` is a define, so this whole block is folded out of a
  // production build exactly the way the harness entry is: same gating, one mechanism.
  useEffect(() => {
    if (!__MTH_DEV__) return;
    window.__mthGoto = (name: string) => {
      const next = gotoPatch(name);
      if (next === null) return false;
      setState((current) => ({ ...current, ...next }));
      return true;
    };
    return () => {
      delete window.__mthGoto;
    };
  }, []);

  const nav: Nav = {
    go: (screen) => {
      patch({ screen, sheet: null });
    },
    openSheet: (sheet) => {
      patch({ sheet });
    },
    toast: (toast) => {
      patch({ toast });
    },
    patch,
  };

  return (
    <LangContext.Provider value={state.lang}>
      {/* main, not div: every app screen lives in here, and without a landmark around them axe
          reports the whole shell as content outside any region on every state. The routes
          outside /app already answer that with `<main class="m-page">` in routes.tsx. */}
      <main className="m-app">
        <Body state={state} nav={nav} setSheet={(sheet: SheetName | null) => { patch({ sheet }); }} />
        {banner}
      </main>
    </LangContext.Provider>
  );
}

function Body({ state, nav, setSheet }: { state: AppState; nav: Nav; setSheet: (sheet: SheetName | null) => void }) {
  const t = useT();

  const standalone = STANDALONE[state.screen];

  return (
    <>
      {state.screen === 'onb-hello' ? <Hello nav={nav} /> : null}
      {state.screen === 'onb-lang' ? <LangScreen nav={nav} lang={state.lang} /> : null}
      {state.screen === 'onb-regions' ? <RegionsScreen nav={nav} regions={state.regions} /> : null}
      {state.screen === 'onb-notif' ? <NotifScreen nav={nav} /> : null}
      {state.screen === 'onb-auth' ? <AuthScreen nav={nav} /> : null}

      {state.screen === 'main' ? (
        <div className="m-screen m-main" data-screen={screenName(state)} data-anim="fade">
          {state.tab === 'radar' ? <Radar key={state.pack} state={state} nav={nav} /> : null}
          {state.tab === 'dissect' ? <Dissect state={state} nav={nav} /> : null}
          {state.tab === 'archive' ? <Archive state={state} nav={nav} /> : null}
          {state.tab === 'settings' ? <Settings state={state} nav={nav} /> : null}
          <nav className="m-tabbar">
            {(['radar', 'dissect', 'archive', 'settings'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className="m-tab"
                data-on={state.tab === tab ? '1' : '0'}
                data-tab={tab}
                aria-current={state.tab === tab ? 'page' : undefined}
                onClick={() => {
                  nav.patch({ tab, sheet: null });
                }}
              >
                <svg width="21" height="21" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                  {TAB_ICONS[tab]}
                </svg>
                <span className="m-tab-label">{t(TAB_LABEL[tab])}</span>
              </button>
            ))}
          </nav>
        </div>
      ) : null}

      {state.screen === 'autopsy' ? <Autopsy state={state} nav={nav} /> : null}
      {state.screen === 'progress' ? <Progress state={state} nav={nav} /> : null}
      {state.screen === 'chat-sim' ? <ChatSim nav={nav} /> : null}
      {state.screen === 'notif-settings' ? <NotifSettings state={state} nav={nav} /> : null}
      {state.screen === 'methodology' ? <MethodologyScreen state={state} nav={nav} /> : null}

      {state.screen === 'queue' ? (
        <div className="m-screen m-onb" data-screen="queue">
          <div className="m-onb-title">{t('queue.title')}</div>
          <div className="m-onb-body">{t('queue.body')}</div>
          <div className="m-spacer" />
          <div className="m-onb-foot">
            <button
              type="button"
              className="m-cta"
              data-press="1"
              onClick={() => {
                nav.go('main');
              }}
            >
              {t('queue.back')}
            </button>
          </div>
        </div>
      ) : null}

      {standalone === undefined ? null : (
        <div className="m-screen m-onb" data-screen={state.screen}>
          <div className="m-onb-title">{t(standalone)}</div>
          <div className="m-onb-body">{t('common.soon')}</div>
          <div className="m-spacer" />
          <div className="m-onb-foot">
            <button
              type="button"
              className="m-cta"
              data-press="1"
              onClick={() => {
                nav.go('main');
              }}
            >
              {t('common.back')}
            </button>
          </div>
        </div>
      )}

      {state.sheet === 'rate-limit' ? <RateSheet nav={nav} /> : null}
      {state.sheet === 'share-sim' ? <ShareSim nav={nav} /> : null}

      {state.sheet === 'ios-notif' ? (
        <div className="m-ios-wrap" data-sheet="ios-notif">
          <div className="m-ios" role="dialog" aria-modal="true" aria-label={t('sheet.ios.title')} ref={trapRef}>
            <div className="m-ios-body">
              <div className="m-ios-title">{t('sheet.ios.title')}</div>
              <div className="m-ios-sub">{t('sheet.ios.body')}</div>
            </div>
            <div className="m-ios-actions">
              <button
                type="button"
                className="m-ios-btn m-ios-btn-deny"
                onClick={() => {
                  writeStore(LS.notif, 'off');
                  nav.go('onb-auth');
                }}
              >
                {t('sheet.ios.deny')}
              </button>
              <button
                type="button"
                className="m-ios-btn m-ios-btn-allow"
                onClick={() => {
                  writeStore(LS.notif, 'on');
                  nav.go('onb-auth');
                  nav.toast(t('toast.notif.on'));
                }}
              >
                {t('sheet.ios.allow')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {state.sheet === 'honest-auth' ? (
        <>
          <div
            className="m-scrim"
            onClick={() => {
              setSheet(null);
            }}
          />
          {/* The Gate 2 ruling, settled: the trap (app/src/trap.ts) and aria-modal land together. */}
          <div
            className="m-sheet"
            data-sheet="honest-auth"
            role="dialog"
            aria-modal="true"
            aria-label={t('sheet.auth.title')}
            ref={trapRef}
          >
            <div className="m-grab" />
            <div className="m-sheet-h">{t('sheet.auth.title')}</div>
            <div className="m-sheet-p">{t('sheet.auth.body')}</div>
            <div className="m-sheet-cta">
              <button
                type="button"
                className="m-cta"
                data-press="1"
                onClick={() => {
                  nav.patch({ screen: 'main', tab: 'radar', sheet: null });
                }}
              >
                {t('sheet.auth.primary')}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {state.toast === null ? null : (
        <div className="m-toast" data-toast="1" role="status">
          {state.toast}
        </div>
      )}
    </>
  );
}
