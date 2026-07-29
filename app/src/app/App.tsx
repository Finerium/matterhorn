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
import { LangContext, useT, type Key } from '../i18n';
import { PACKS, prefetchRadar } from '../content';
import { trapRef } from '../trap';
import Archive from './Archive';
import Autopsy from './Autopsy';
import Dissect, { ChatSim, Progress, RateSheet, ShareSim } from './Dissect';
import { AuthScreen, Hello, LangScreen, NotifScreen, RegionsScreen, type Nav } from './Onboarding';
import Radar from './Radar';
import Settings, { MethodologyScreen, NotifSettings } from './Settings';
import {
  gotoPatch,
  initialState,
  LS,
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

/**
 * `start` is the state a route hands the shell before first paint. `/n/{id}` uses it to open on
 * the autopsy for that narrative, which is how AC-APP-18 hydrates a permalink into the real
 * screen rather than into a second, thinner copy of it.
 *
 * `banner` is chrome a route pins over the shell. `/share` uses it to state the resolution it
 * took on the way in, so the decision is visible on top of the screen that decision produced.
 */
export default function App({ start, banner }: { start?: Partial<AppState>; banner?: ReactNode }) {
  const [state, setState] = useState<AppState>(() => ({ ...initialState(), ...start }));

  const patch = useCallback((next: Partial<AppState>) => {
    setState((current) => ({ ...current, ...next }));
  }, []);

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
