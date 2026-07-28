/**
 * Settings, and the two screens that hang off it.
 *
 * The zip's row groups, in the zip's order: Account, Preferences, Literacy, Transparency. Three
 * deliberate departures, each one because a spec says so rather than because the zip is wrong:
 *
 *   account       the zip writes "Not signed in". This build has no sessions at all, so the row
 *                 says what is true of the device rather than what is false of a session, and
 *                 opens the honest-auth sheet (D-7, AC-APP-3).
 *   language      the zip navigates away to a language screen. Here the row carries the two
 *                 shipped locales inline, the way the appearance row carries the two themes:
 *                 the language change is what AC-APP-14 measures, and it is one tap.
 *   scaffolding   five options rather than the zip's four. S2 is new (D-8, blueprint 3.2 item 9).
 *
 * The transparency rows that are not screens open the Gate 2 evidence sheet rather than a fourth
 * sheet layout: a disclosure and an about note are exactly the sheet's shape, a claim with the
 * document behind it.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Lang, Narrative } from '../../../contracts/types';
import TECHNIQUE_TAGS from '../../../contracts/technique-tags.json';
import { useT, type Key } from '../i18n';
import { PATHS, peek, useCorrections, useMethodology } from '../content';
import { makeCtx, type RenderCtx } from '../renderers/ctx';
import { headlineOf } from '../renderers/Card';
import { EvidenceSheet, type SheetPayload } from '../renderers/EvidenceSheet';
import MethodologyBody from './Methodology';
import {
  LS,
  NOTIF_DEFAULT,
  readNotifConfig,
  readStore,
  writeStore,
  type AppState,
  type NotifConfig,
  type Scaffold,
} from './state';
import type { Nav } from './Onboarding';

const SCAFFOLDS: Scaffold[] = ['auto', 'S3', 'S2', 'S1', 'S0'];
const LANGS: Array<{ id: Lang; label: Key }> = [
  { id: 'en', label: 'lang.en' },
  { id: 'id', label: 'lang.id' },
];

const REGION_LABEL: Record<string, Key> = {
  id: 'regions.id',
  intl: 'regions.intl',
  us: 'regions.us',
  more: 'regions.more',
};

/** One settings row: label, a value on the right, and an optional chevron. */
function Row({
  label,
  value,
  testid,
  onTap,
  children,
}: {
  label: string;
  value?: string;
  testid?: string;
  onTap?: () => void;
  children?: ReactNode;
}) {
  const inner = (
    <>
      <span className="m-srow-l">{label}</span>
      {value === undefined ? null : <span className="m-srow-v">{value}</span>}
      {children}
      {onTap === undefined ? null : (
        <span className="m-chev" aria-hidden="true">
          ›
        </span>
      )}
    </>
  );
  if (onTap === undefined) {
    return (
      <div className="m-srow" data-testid={testid}>
        {inner}
      </div>
    );
  }
  return (
    <button type="button" className="m-srow" data-testid={testid} onClick={onTap}>
      {inner}
    </button>
  );
}

export default function Settings({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  const [info, setInfo] = useState<SheetPayload | null>(null);
  const methodology = useMethodology().data;
  const corrections = useCorrections().data;
  const ctx = useMemo(() => makeCtx([], state.lang, state.theme), [state.lang, state.theme]);
  const notif = readStore(LS.notif);
  const open = (corrections?.entries ?? []).filter((entry) => entry.status === 'under_review').length;
  const sym =
    methodology === null
      ? '-'
      : `${String(methodology.symmetry.gov)}·${String(methodology.symmetry.neutral)}·${String(methodology.symmetry.opp)}`;

  return (
    <div className="m-tabpane" data-stagger="1">
      <div className="m-pane-title">{t('settings.title')}</div>

      <div className="m-sechead">{t('settings.account')}</div>
      <div className="m-scard" data-sr="1">
        <Row
          label={t('settings.account')}
          value={t('settings.account.none')}
          testid="account-row"
          onTap={() => {
            nav.openSheet('honest-auth');
          }}
        />
      </div>

      <div className="m-sechead">{t('settings.prefs')}</div>
      <div className="m-scard" data-sr="1">
        <Row label={t('settings.lang')}>
          <span className="m-pick">
            {LANGS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="m-pick-opt"
                data-lang-option={option.id}
                aria-pressed={state.lang === option.id}
                onClick={() => {
                  nav.patch({ lang: option.id });
                }}
              >
                {t(option.label)}
              </button>
            ))}
          </span>
        </Row>
        <Row
          label={t('settings.regions')}
          value={state.regions.map((region) => t(REGION_LABEL[region] ?? 'regions.more')).join(' · ')}
          onTap={() => {
            nav.patch({ tab: 'radar', sheet: 'region' });
          }}
        />
        <Row
          label={t('settings.notif')}
          value={notif === 'on' ? t('settings.notif.on') : t('settings.notif.off')}
          onTap={() => {
            nav.go('notif-settings');
          }}
        />
        <Row label={t('settings.appearance')}>
          <span className="m-pick">
            <button
              type="button"
              className="m-pick-opt"
              data-testid="appearance-light"
              aria-pressed={state.theme === 'light'}
              onClick={() => {
                nav.patch({ theme: 'light' });
              }}
            >
              {t('settings.light')}
            </button>
            <button
              type="button"
              className="m-pick-opt"
              data-testid="appearance-dark"
              aria-pressed={state.theme === 'dark'}
              onClick={() => {
                nav.patch({ theme: 'dark' });
              }}
            >
              {t('settings.dark')}
            </button>
          </span>
        </Row>
      </div>

      <div className="m-sechead">{t('settings.literacy')}</div>
      <div className="m-scard m-scard-pad" data-sr="1" data-testid="scaffold-card">
        <div className="m-scaffold-label">{t('settings.scaffold')}</div>
        <div className="m-scaffold-sub">
          {state.scaffold === 'auto'
            ? t('settings.scaffold.auto.body')
            : t('settings.scaffold.override', { level: state.scaffold })}
        </div>
        <div className="m-scaffold-opts">
          {SCAFFOLDS.map((level) => (
            <button
              key={level}
              type="button"
              className="m-scaffold-opt"
              data-scaffold-option={level}
              aria-pressed={state.scaffold === level}
              onClick={() => {
                nav.patch({ scaffold: level });
              }}
            >
              {level === 'auto' ? t('settings.scaffold.auto') : level}
            </button>
          ))}
        </div>
        <div className="m-scaffold-foot">{t('settings.scaffold.foot')}</div>
      </div>

      <div className="m-sechead">{t('settings.transparency')}</div>
      <div className="m-scard" data-sr="1">
        <Row
          label={t('screen.methodology')}
          value={t('radar.symmetry', { sym })}
          onTap={() => {
            nav.go('methodology');
          }}
        />
        <Row
          label={t('settings.corrections')}
          value={t('settings.corrections.open', { n: open })}
          onTap={() => {
            nav.go('methodology');
          }}
        />
        <Row
          label={t('settings.disclosure')}
          value={t('settings.disclosure.value')}
          onTap={() => {
            setInfo({
              label: t('settings.disclosure'),
              title: t('settings.disclosure'),
              body: methodology === null ? [] : [methodology.disclosure[state.lang]],
              why: t('settings.disclosure.why'),
            });
          }}
        />
        <Row
          label={t('settings.about')}
          value={t('settings.about.value')}
          onTap={() => {
            setInfo({
              label: t('settings.about'),
              title: t('settings.about'),
              body: [t('hello.sub')],
              why: t('settings.about.why'),
            });
          }}
        />
        <Row
          label={t('settings.replay')}
          onTap={() => {
            writeStore(LS.onboarded, '0');
            nav.patch({ screen: 'onb-hello', sheet: null, spar: 'gate' });
          }}
        />
      </div>

      <div className="m-feedfoot">{t('settings.body')}</div>

      {info === null ? null : (
        <EvidenceSheet
          payload={info}
          ctx={ctx}
          onClose={() => {
            setInfo(null);
          }}
        />
      )}
    </div>
  );
}

// --- notification settings, AC-APP-20 -----------------------------------------------------

/**
 * The Appendix C autopsy-first template. The dissection leads; the headline it is about is
 * carried behind the counts, never as the first line, which is the whole point of the rule.
 */
function previewText(
  t: (key: Key, vars?: Record<string, string | number>) => string,
  ctx: RenderCtx,
  pack: 'id' | 'en',
) {
  const feed = peek<{ items: Array<{ narrative_id: string }> }>(PATHS.feed(pack));
  const first = feed?.items[0]?.narrative_id;
  const narrative = first === undefined ? undefined : peek<Narrative>(PATHS.narrative(first));
  const title = t('notif.tpl.title', { pack: t(pack === 'id' ? 'pack.id' : 'pack.en') });
  if (narrative === undefined) return { title, body: t('notif.tpl.empty') };
  const top = narrative.tags[0];
  const tag = TECHNIQUE_TAGS.tags.find((entry) => entry.key === top);
  return {
    title,
    body: t('notif.tpl.body', {
      headline: headlineOf(narrative, ctx),
      tag: tag === undefined ? (top ?? '') : tag[ctx.lang],
      missing: narrative.counts.missing,
      hidden: narrative.counts.hidden,
    }),
  };
}

/** The 26x14 pill switch the zip draws for a boolean row. */
function Toggle({ on, label, onTap }: { on: boolean; label: string; onTap: () => void }) {
  return (
    <button type="button" className="m-switch" role="switch" aria-checked={on} aria-label={label} onClick={onTap}>
      <span className="m-switch-knob" />
    </button>
  );
}

export function NotifSettings({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  const ctx = useMemo(() => makeCtx([], state.lang, state.theme), [state.lang, state.theme]);
  const [config, setConfig] = useState<NotifConfig>(() => readNotifConfig());

  // Written on every change rather than behind a Save: there is no server to confirm to, so a
  // preference that is not remembered the moment it is set was never really set.
  useEffect(() => {
    writeStore(LS.notifcfg, JSON.stringify(config));
  }, [config]);

  const set = (next: Partial<NotifConfig>) => {
    setConfig((current) => ({ ...current, ...next }));
  };

  const fire = () => {
    const { title, body } = previewText(t, ctx, state.pack);
    void (async () => {
      try {
        if (typeof Notification === 'undefined') {
          nav.toast(t('toast.notif.blocked'));
          return;
        }
        const permission =
          Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
        if (permission !== 'granted') {
          nav.toast(t('toast.notif.blocked'));
          return;
        }
        // The worker owns the notification wherever one exists, because that is the path a real
        // Radar alert takes. Without a worker the page constructor is the same notification.
        const registration = await navigator.serviceWorker?.getRegistration();
        if (registration === undefined) new Notification(title, { body });
        else await registration.showNotification(title, { body });
      } catch {
        nav.toast(t('toast.notif.blocked'));
      }
    })();
  };

  return (
    <div className="m-screen m-sub" data-screen="notif-settings">
      <div className="m-subbar">
        <button
          type="button"
          className="m-round"
          aria-label={t('common.back')}
          onClick={() => {
            nav.patch({ screen: 'main', tab: 'settings', sheet: null });
          }}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="m-subbar-title">{t('screen.notif-settings')}</div>
        <div className="m-round m-round-ghost" aria-hidden="true" />
      </div>

      <div className="m-subscroll">
        <div className="m-scard" data-sr="1">
          <Row label={t('notif.settings.digest')}>
            <Toggle
              on={config.digest}
              label={t('notif.settings.digest')}
              onTap={() => {
                set({ digest: !config.digest });
              }}
            />
          </Row>
          <Row label={t('notif.settings.cap')}>
            <select
              className="m-select"
              data-testid="notif-cap"
              aria-label={t('notif.settings.cap')}
              value={config.cap}
              onChange={(event) => {
                set({ cap: event.target.value });
              }}
            >
              {['0', '1'].map((n) => (
                <option key={n} value={n}>
                  {t('notif.settings.cap.n', { n })}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('notif.settings.quiet')}>
            <span className="m-times">
              <input
                type="time"
                className="m-time"
                data-testid="notif-quiet-start"
                aria-label={t('notif.settings.quiet.start')}
                value={config.quietStart}
                onChange={(event) => {
                  set({ quietStart: event.target.value === '' ? NOTIF_DEFAULT.quietStart : event.target.value });
                }}
              />
              <input
                type="time"
                className="m-time"
                data-testid="notif-quiet-end"
                aria-label={t('notif.settings.quiet.end')}
                value={config.quietEnd}
                onChange={(event) => {
                  set({ quietEnd: event.target.value === '' ? NOTIF_DEFAULT.quietEnd : event.target.value });
                }}
              />
            </span>
          </Row>
          <Row
            label={t('notif.settings.lock')}
            onTap={() => {
              nav.go('lock-preview');
            }}
          />
          <Row label={t('notif.settings.preview')} testid="notif-preview" onTap={fire} />
        </div>
        <div className="m-subfoot">{t('notif.settings.foot')}</div>
      </div>
    </div>
  );
}

// --- the in-app methodology screen ---------------------------------------------------------

export function MethodologyScreen({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  return (
    <div className="m-screen m-sub" data-screen="methodology">
      <div className="m-subbar">
        <button
          type="button"
          className="m-round"
          aria-label={t('common.back')}
          onClick={() => {
            nav.patch({ screen: 'main', sheet: null });
          }}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="m-subbar-title">{t('screen.methodology')}</div>
        <div className="m-round m-round-ghost" aria-hidden="true" />
      </div>
      <div className="m-subscroll">
        <MethodologyBody lang={state.lang} />
      </div>
    </div>
  );
}
