/**
 * The app's state vocabulary, the persisted keys, and the dev-only state-jump table.
 *
 * Everything the shell can be in is named here, because two other things read these names:
 * the `data-screen` / `data-sheet` attributes the state matrix drives Playwright by, and
 * `window.__mthGoto`, which lets the matrix reach a state without walking the path to it.
 *
 * Screen names are the `data-screen` values verbatim. `main` is the one exception: its
 * `data-screen` is `main-{tab}`, because a tab is a screen as far as the matrix is concerned.
 */
import type { Lang } from '../../../contracts/types';
import type { Pack } from '../content';
import type { Theme } from '../renderers/ctx';

export type Screen =
  | 'onb-hello'
  | 'onb-lang'
  | 'onb-regions'
  | 'onb-notif'
  | 'onb-auth'
  | 'main'
  | 'autopsy'
  | 'methodology'
  | 'notif-settings'
  | 'lock-preview'
  | 'chat-sim'
  | 'progress'
  | 'queue';

export type Tab = 'radar' | 'dissect' | 'archive' | 'settings';

/** Overlay names. The value is the `data-sheet` attribute. */
export type SheetName = 'ios-notif' | 'honest-auth';

export interface AppState {
  screen: Screen;
  tab: Tab;
  sheet: SheetName | null;
  lang: Lang;
  pack: Pack;
  theme: Theme;
  /** Region ids the reader picked in onboarding. Zip vocabulary: id, intl, us, more. */
  regions: string[];
  toast: string | null;
}

/** The `data-screen` value for a state. The only place the main/tab collapse happens. */
export const screenName = (state: AppState): string =>
  state.screen === 'main' ? `main-${state.tab}` : state.screen;

// --- persistence ------------------------------------------------------------------------

/** Every key this app writes. All namespaced `mth:`; nothing else in localStorage is ours. */
export const LS = {
  lang: 'mth:lang',
  pack: 'mth:pack',
  regions: 'mth:regions',
  theme: 'mth:theme',
  onboarded: 'mth:onboarded',
  notif: 'mth:notif',
} as const;

/**
 * ponytail: try/catch rather than a feature probe. Storage throws on quota and in locked-down
 * privacy modes, and a shell that cannot remember a language preference still has to run.
 */
export function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* a preference that cannot be remembered is not a failure worth interrupting a read for */
  }
}

const one = <T extends string>(raw: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(raw as T) ? (raw as T) : fallback;

export function initialState(): AppState {
  const onboarded = readStore(LS.onboarded) === '1';
  let regions = ['id', 'intl'];
  try {
    const stored: unknown = JSON.parse(readStore(LS.regions) ?? 'null');
    if (Array.isArray(stored)) regions = stored.filter((r): r is string => typeof r === 'string');
  } catch {
    /* a corrupt preference falls back to the default selection */
  }
  return {
    screen: onboarded ? 'main' : 'onb-hello',
    tab: 'radar',
    sheet: null,
    lang: one(readStore(LS.lang), ['en', 'id'] as const, 'en'),
    pack: one(readStore(LS.pack), ['id', 'en'] as const, 'id'),
    theme: one(readStore(LS.theme), ['light', 'dark'] as const, 'light'),
    regions,
    toast: null,
  };
}

// --- the dev-only state-jump table ------------------------------------------------------

/**
 * Appendix A state name to state patch. `window.__mthGoto(name)` applies one of these and
 * returns true; an unlisted name returns false, so a matrix entry for a state the shell cannot
 * reach yet fails loudly instead of screenshotting the wrong screen.
 *
 * The table covers what Wave 0b actually builds. Each surface implementer adds its own rows in
 * the same shape as it lands (`radar.crisis-hold`, `settings.scaffold.s2`, `autopsy.panel.*`,
 * and so on). Names that are URLs rather than app state (`system.offline`, `system.notfound`,
 * `system.permalink`, `system.share.*`, `land.*`, `research.*`, `desktop.*`) are deliberately
 * absent: the driver navigates to those.
 *
 * `dark.` is a prefix rather than a row: `dark.radar` is `radar.default` with the dark theme.
 */
const GOTO: Record<string, Partial<AppState>> = {
  'onb.hello': { screen: 'onb-hello', sheet: null },
  'onb.lang': { screen: 'onb-lang', sheet: null },
  'onb.regions': { screen: 'onb-regions', sheet: null },
  'onb.notif': { screen: 'onb-notif', sheet: null },
  'onb.notif.ios-dialog': { screen: 'onb-notif', sheet: 'ios-notif' },
  'onb.auth': { screen: 'onb-auth', sheet: null },
  'onb.auth.honest-sheet': { screen: 'onb-auth', sheet: 'honest-auth' },
  'radar.default': { screen: 'main', tab: 'radar', sheet: null },
  'dissect.default': { screen: 'main', tab: 'dissect', sheet: null },
  'dissect.progress': { screen: 'progress', sheet: null },
  'dissect.queue': { screen: 'queue', sheet: null },
  'archive.default': { screen: 'main', tab: 'archive', sheet: null },
  'settings.default': { screen: 'main', tab: 'settings', sheet: null },
  'autopsy.default': { screen: 'autopsy', sheet: null },
  'system.methodology': { screen: 'methodology', sheet: null },
  'system.notif-settings': { screen: 'notif-settings', sheet: null },
  'system.notif.lock-preview': { screen: 'lock-preview', sheet: null },
  'system.chat-sim': { screen: 'chat-sim', sheet: null },
};

/** Appendix A writes the dark row as `dark.radar`, not `dark.radar.default`. Same states. */
const ALIAS: Record<string, string> = {
  radar: 'radar.default',
  dissect: 'dissect.default',
  archive: 'archive.default',
  settings: 'settings.default',
  autopsy: 'autopsy.default',
  methodology: 'system.methodology',
};

export function gotoPatch(name: string): Partial<AppState> | null {
  if (name.startsWith('dark.')) {
    const base = gotoPatch(name.slice('dark.'.length));
    return base === null ? null : { ...base, theme: 'dark' };
  }
  return GOTO[name] ?? GOTO[ALIAS[name] ?? ''] ?? null;
}
