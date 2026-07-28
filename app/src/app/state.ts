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
export type SheetName =
  | 'ios-notif'
  | 'honest-auth'
  | 'region'
  | 'original'
  | 'provenance'
  | 'explore'
  | 'evidence'
  | 'flag-form'
  | 'flag-received'
  | 'nuance-story'
  | 'nuance-chat';

/** The Settings demo override, blueprint 3.2 item 9. `auto` uses each narrative's own default. */
export type Scaffold = 'auto' | 'S3' | 'S2' | 'S1' | 'S0';

/** Where the reader is in the sparring gate for the narrative on screen. */
export type SparPhase = 'gate' | 'answered' | 'skipped';

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

  // --- the autopsy ---
  /** The narrative the autopsy is on. */
  narrative: string;
  scaffold: Scaffold;
  spar: SparPhase;
  /** Which S3 question is on screen, and the option index picked per question. */
  sparIdx: number;
  sparPicked: number[];
  /** S0 only: the reader asked for the gate through the spar-on-demand chip. */
  sparDemand: boolean;
  predPick: number | null;
  moneyStopped: boolean;
  /** The narration sentence selected, or the count-chip status selected. One at a time. */
  sent: string | null;
  hlStatus: string | null;
  flagReason: number | null;
  /** Narrative ids this device has flagged. Drives the local under-review chip (ADR-12). */
  flags: string[];
  /** True when this session was entered through /n/{id} rather than through the shell. */
  permalink: boolean;
  /**
   * A selector inside the autopsy body to bring into view. The state matrix drives it, so a
   * panel state screenshots the panel it names rather than the top of the same screen; a deep
   * link to a panel is the same field.
   */
  focus: string | null;

  // --- radar demo state ---
  /** The crisis-hold notice, which is chrome behind the zip's own demo toggle. */
  crisis: boolean;
  /** The open-corrections strip under the feed header. */
  corrections: boolean;
  /** The via-Dissect feed items, which only the fresh-dissect flow lets in. */
  viaDissect: boolean;
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
  scaffold: 'mth:scaffold',
  flags: 'mth:flags',
  /** How many S2 gates this device has answered. The rotation counter, and nothing else. */
  s2: 'mth:s2',
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

/** A stored JSON array of strings, or the fallback. Shared by `regions` and `flags`. */
function readList(key: string, fallback: string[]): string[] {
  try {
    const stored: unknown = JSON.parse(readStore(key) ?? 'null');
    return Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string') : fallback;
  } catch {
    return fallback;
  }
}

export function initialState(): AppState {
  const onboarded = readStore(LS.onboarded) === '1';
  return {
    screen: onboarded ? 'main' : 'onb-hello',
    tab: 'radar',
    sheet: null,
    lang: one(readStore(LS.lang), ['en', 'id'] as const, 'en'),
    pack: one(readStore(LS.pack), ['id', 'en'] as const, 'id'),
    theme: one(readStore(LS.theme), ['light', 'dark'] as const, 'light'),
    regions: readList(LS.regions, ['id', 'intl']),
    toast: null,

    narrative: 'mbg-stop',
    scaffold: one(readStore(LS.scaffold), ['auto', 'S3', 'S2', 'S1', 'S0'] as const, 'auto'),
    spar: 'gate',
    sparIdx: 0,
    sparPicked: [],
    sparDemand: false,
    predPick: null,
    moneyStopped: false,
    sent: null,
    hlStatus: null,
    flagReason: null,
    flags: readList(LS.flags, []),
    permalink: false,
    focus: null,

    crisis: false,
    corrections: false,
    viaDissect: false,
  };
}

// --- the dev-only state-jump table ------------------------------------------------------

/**
 * Appendix A state name to state patch. `window.__mthGoto(name)` applies one of these and
 * returns true; an unlisted name returns false, so a matrix entry for a state the shell cannot
 * reach yet fails loudly instead of screenshotting the wrong screen.
 *
 * The table covers what is built: the shell, the radar and the autopsy. Each remaining surface
 * implementer adds its own rows in the same shape as it lands (`dissect.*`, `archive.*`,
 * `settings.scaffold.*`). Names that are URLs rather than app state (`system.offline`, `system.notfound`,
 * `system.permalink`, `system.share.*`, `land.*`, `research.*`, `desktop.*`) are deliberately
 * absent: the driver navigates to those.
 *
 * `dark.` is a prefix rather than a row: `dark.radar` is `radar.default` with the dark theme.
 */
/** The radar tab, plus whatever demo chrome the state is about. */
const radar = (extra: Partial<AppState> = {}): Partial<AppState> => ({
  screen: 'main',
  tab: 'radar',
  sheet: null,
  crisis: false,
  corrections: false,
  ...extra,
});

/**
 * One narrative's autopsy. `spar` defaults to `skipped`, which is the assembled state every
 * `autopsy.panel.*` row is a variant of; the gate rows pass `spar: 'gate'` back in.
 */
const autopsy = (narrative: string, extra: Partial<AppState> = {}): Partial<AppState> => ({
  screen: 'autopsy',
  sheet: null,
  narrative,
  spar: 'skipped',
  scaffold: 'auto',
  sparIdx: 0,
  sparPicked: [],
  sparDemand: false,
  predPick: null,
  moneyStopped: false,
  sent: null,
  hlStatus: null,
  focus: null,
  ...extra,
});

/** The sparring card, wherever the gate is in it. */
const GATE = '.m-spar';

const GOTO: Record<string, Partial<AppState>> = {
  'onb.hello': { screen: 'onb-hello', sheet: null },
  'onb.lang': { screen: 'onb-lang', sheet: null },
  'onb.regions': { screen: 'onb-regions', sheet: null },
  'onb.notif': { screen: 'onb-notif', sheet: null },
  'onb.notif.ios-dialog': { screen: 'onb-notif', sheet: 'ios-notif' },
  'onb.auth': { screen: 'onb-auth', sheet: null },
  'onb.auth.honest-sheet': { screen: 'onb-auth', sheet: 'honest-auth' },
  'radar.default': radar(),
  'radar.hero': radar(),
  'radar.crisis-hold': radar({ crisis: true }),
  'radar.under-review': radar({ corrections: true }),
  'radar.region-sheet': radar({ sheet: 'region' }),
  'radar.via-dissect': radar({ viaDissect: true }),
  'radar.pack-en': radar({ pack: 'en' }),

  'dissect.default': { screen: 'main', tab: 'dissect', sheet: null },
  'dissect.progress': { screen: 'progress', sheet: null },
  'dissect.queue': { screen: 'queue', sheet: null },
  'archive.default': { screen: 'main', tab: 'archive', sheet: null },
  'settings.default': { screen: 'main', tab: 'settings', sheet: null },

  // mbg-stop is scaffold_default S3, mbg-poisoning S1, ppn-panic S0. The sparring rows carry
  // the picks that reach them, so the state is the one the walk would have produced.
  'autopsy.default': autopsy('mbg-stop'),
  'autopsy.s3.q1': autopsy('mbg-stop', { spar: 'gate', focus: GATE }),
  'autopsy.s3.q2': autopsy('mbg-stop', { spar: 'gate', sparIdx: 1, sparPicked: [2], focus: GATE }),
  'autopsy.s3.q3': autopsy('mbg-stop', { spar: 'gate', sparIdx: 2, sparPicked: [2, 0], focus: GATE }),
  'autopsy.s3.wrong-path': autopsy('mbg-stop', { spar: 'gate', sparPicked: [0], focus: GATE }),
  'autopsy.s3.skip': autopsy('mbg-stop', { spar: 'gate', sparIdx: 1, sparPicked: [2], focus: GATE }),
  'autopsy.s3.diff-card': autopsy('mbg-stop', { spar: 'answered', sparIdx: 2, sparPicked: [2, 0, 1] }),
  'autopsy.s2': autopsy('mbg-stop', { spar: 'gate', scaffold: 'S2', focus: GATE }),
  'autopsy.s1.prediction': autopsy('mbg-poisoning', { spar: 'gate', focus: GATE }),
  'autopsy.s0.spar-chip': autopsy('ppn-panic', { spar: 'gate' }),
  'autopsy.panel.claim-map': autopsy('mbg-stop', { focus: '[data-el="p-claim"]' }),
  'autopsy.panel.scale': autopsy('mbg-stop', { focus: '[data-el="p-scale"]' }),
  'autopsy.panel.money.off': autopsy('mbg-stop', { focus: '[data-el="p-flow"]' }),
  'autopsy.panel.money.on': autopsy('mbg-stop', { moneyStopped: true, focus: '[data-el="p-flow"]' }),
  'autopsy.panel.incidence': autopsy('mbg-stop', { focus: '[data-el="p-inc"]' }),
  'autopsy.panel.dueling': autopsy('mbg-poisoning', { focus: '[data-el="p-duel"]' }),
  'autopsy.panel.echo': autopsy('ppn-panic', { focus: '[data-echo="cited"]' }),
  'autopsy.panel.echo-silence': autopsy('mbg-stop', { focus: '[data-echo="silence"]' }),
  'autopsy.panel.options': autopsy('mbg-stop', { focus: '[data-el="p-options"]' }),
  'autopsy.panel.family': autopsy('mbg-stop', { focus: '[data-el="p-family"]' }),
  'autopsy.evidence-sheet': autopsy('mbg-stop', { sheet: 'evidence' }),
  'autopsy.narration-highlight': autopsy('mbg-stop', { sent: 'v-1', focus: '[data-el="p-claim"]' }),
  'autopsy.explore-drawer': autopsy('mbg-stop', { sheet: 'explore' }),
  'autopsy.flag.form': autopsy('mbg-stop', { sheet: 'flag-form' }),
  'autopsy.flag.received': autopsy('mbg-stop', { sheet: 'flag-received', flagReason: 0 }),
  'autopsy.original-sheet': autopsy('mbg-stop', { sheet: 'original' }),
  'autopsy.provenance-sheet': autopsy('mbg-stop', { sheet: 'provenance' }),
  'autopsy.nuance.story': autopsy('mbg-stop', { sheet: 'nuance-story' }),
  'autopsy.nuance.chat': autopsy('mbg-stop', { sheet: 'nuance-chat' }),

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
