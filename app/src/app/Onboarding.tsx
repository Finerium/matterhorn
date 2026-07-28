/**
 * The five onboarding screens, ported from the zip (Matterhorn.dc.html lines 59-144).
 *
 * Two places where the zip's copy is corrected rather than transcribed, both catalogued:
 *   CF-3  the five language rows stay for visual fidelity, but only en and id are selectable;
 *         es, fr and ja adopt the regions screen's own "rolls out gradually" pattern.
 *   CF-4  the notification primer's preview card renders the Appendix C template shape, which
 *         carries the top technique tag the zip's mock omitted (C2 binds notifications too).
 *   D-10  the hello tagline is the blueprint's, not the zip's.
 *
 * The auth screen is D-7: Apple and Google open the honest-auth sheet. No signed-in state
 * exists anywhere in this build, so none is ever drawn.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '../../../contracts/types';
import { useT, type Key } from '../i18n';
import type { AppState, Screen, SheetName } from './state';

export interface Nav {
  go: (screen: Screen) => void;
  openSheet: (name: SheetName) => void;
  toast: (message: string) => void;
  patch: (next: Partial<AppState>) => void;
}

const Check = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" aria-hidden="true">
    <path
      d="M3 8.5 6.5 12 13 4.5"
      fill="none"
      stroke="var(--accInk)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Row({
  label,
  sub,
  selected,
  dimmed,
  onTap,
}: {
  label: string;
  sub?: string;
  selected: boolean;
  dimmed?: boolean;
  onTap: () => void;
}) {
  return (
    <button type="button" className="m-row" data-dim={dimmed === true ? '1' : '0'} aria-pressed={selected} onClick={onTap}>
      <span className="m-row-main">
        <span className="m-row-label">{label}</span>
        {sub === undefined ? null : <span className="m-row-sub">{sub}</span>}
      </span>
      <span className={selected ? 'm-radio m-radio-on' : 'm-radio'}>{selected ? <Check /> : null}</span>
    </button>
  );
}

/** The shared onboarding frame: step line, title, body, scrolling rows, one primary action. */
function Step({
  screen,
  step,
  title,
  body,
  children,
  onContinue,
}: {
  screen: string;
  step: Key;
  title: Key;
  body: Key;
  children: ReactNode;
  onContinue: () => void;
}) {
  const t = useT();
  return (
    <div className="m-screen m-onb" data-screen={screen}>
      <div className="m-onb-step">{t(step)}</div>
      <div className="m-onb-title">{t(title)}</div>
      <div className="m-onb-body">{t(body)}</div>
      <div className="m-onb-list">{children}</div>
      <div className="m-onb-foot">
        <button type="button" className="m-cta" data-press="1" onClick={onContinue}>
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

/** The zip's rotation: a new greeting every 2.1s, blurring in over 240ms of blank. */
export function Hello({ nav }: { nav: Nav }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const greetings: Key[] = [
    'hello.greet.0',
    'hello.greet.1',
    'hello.greet.2',
    'hello.greet.3',
    'hello.greet.4',
    'hello.greet.5',
  ];

  useEffect(() => {
    let swap: ReturnType<typeof setTimeout> | undefined;
    const tick = setInterval(() => {
      setVisible(false);
      swap = setTimeout(() => {
        setIndex((i) => (i + 1) % greetings.length);
        setVisible(true);
      }, 240);
    }, 2100);
    return () => {
      clearInterval(tick);
      clearTimeout(swap);
    };
  }, [greetings.length]);

  return (
    <div className="m-screen m-hello" data-screen="onb-hello" data-anim="fade">
      <div className="m-brand">{t('common.wordmark')}</div>
      <div className="m-hello-mid">
        <div className="m-hello-slot">
          {visible ? (
            <div className="m-greet" data-testid="greeting">
              {t(greetings[index] ?? 'hello.greet.0')}
            </div>
          ) : null}
        </div>
        <div className="m-hello-tag">{t('hello.tagline')}</div>
      </div>
      <div className="m-hello-foot">
        <div className="m-hello-sub">{t('hello.sub')}</div>
        <button
          type="button"
          className="m-cta"
          data-press="1"
          onClick={() => {
            nav.go('onb-lang');
          }}
        >
          {t('common.continue')}
        </button>
      </div>
    </div>
  );
}

/** CF-3: five rows, two selectable. The three that are not adopt the regions "soon" pattern. */
export function LangScreen({ nav, lang }: { nav: Nav; lang: Lang }) {
  const t = useT();
  const rows: Array<{ id: Lang | 'es' | 'fr' | 'ja'; label: Key; sub?: Key; soon: boolean }> = [
    { id: 'en', label: 'lang.en', sub: 'lang.en.sub', soon: false },
    { id: 'id', label: 'lang.id', soon: false },
    { id: 'es', label: 'lang.es', sub: 'lang.soon', soon: true },
    { id: 'fr', label: 'lang.fr', sub: 'lang.soon', soon: true },
    { id: 'ja', label: 'lang.ja', sub: 'lang.soon', soon: true },
  ];
  return (
    <Step
      screen="onb-lang"
      step="lang.step"
      title="lang.title"
      body="lang.body"
      onContinue={() => {
        nav.go('onb-regions');
      }}
    >
      {rows.map((row) => (
        <Row
          key={row.id}
          label={t(row.label)}
          sub={row.sub === undefined ? undefined : t(row.sub)}
          selected={!row.soon && row.id === lang}
          dimmed={row.soon}
          onTap={() => {
            if (row.soon) nav.toast(t('toast.lang.soon'));
            else nav.patch({ lang: row.id as Lang });
          }}
        />
      ))}
    </Step>
  );
}

export function RegionsScreen({ nav, regions }: { nav: Nav; regions: string[] }) {
  const t = useT();
  const rows: Array<{ id: string; label: Key; sub: Key; soon: boolean }> = [
    { id: 'id', label: 'regions.id', sub: 'regions.id.sub', soon: false },
    { id: 'intl', label: 'regions.intl', sub: 'regions.intl.sub', soon: false },
    { id: 'us', label: 'regions.us', sub: 'regions.us.sub', soon: true },
    { id: 'more', label: 'regions.more', sub: 'regions.more.sub', soon: true },
  ];
  return (
    <Step
      screen="onb-regions"
      step="regions.step"
      title="regions.title"
      body="regions.body"
      onContinue={() => {
        nav.go('onb-notif');
      }}
    >
      {rows.map((row) => (
        <Row
          key={row.id}
          label={t(row.label)}
          sub={t(row.sub)}
          selected={!row.soon && regions.includes(row.id)}
          dimmed={row.soon}
          onTap={() => {
            if (row.soon) {
              nav.toast(t('toast.region.soon'));
              return;
            }
            nav.patch({
              regions: regions.includes(row.id) ? regions.filter((r) => r !== row.id) : [...regions, row.id],
            });
          }}
        />
      ))}
    </Step>
  );
}

/**
 * CF-4: the preview card is the Appendix C notification template, top tag included.
 * ponytail: its values are the frozen demo strings in the bundle, not a live narrative. Binding
 * it to the real hero has to go through the card contract (AC-INV-2 allows exactly one module
 * to render a headline), which is the notification surface's job, not the shell's.
 */
export function NotifScreen({ nav }: { nav: Nav }) {
  const t = useT();
  return (
    <div className="m-screen m-notif" data-screen="onb-notif">
      <div className="m-onb-step">{t('notif.kicker')}</div>
      <div className="m-onb-title">{t('notif.title')}</div>
      <div className="m-onb-body">{t('notif.body')}</div>
      <div className="m-notif-card">
        <div className="m-notif-head">
          <div className="m-notif-icon">M</div>
          <span className="m-notif-app">{t('notif.preview.app')}</span>
          <span className="m-notif-now">{t('notif.preview.now')}</span>
        </div>
        <div className="m-notif-title">{t('notif.preview.title')}</div>
        <div className="m-notif-body">{t('notif.preview.body')}</div>
      </div>
      <div className="m-spacer" />
      <button
        type="button"
        className="m-cta"
        data-press="1"
        onClick={() => {
          nav.openSheet('ios-notif');
        }}
      >
        {t('notif.enable')}
      </button>
      <button
        type="button"
        className="m-ghost"
        onClick={() => {
          nav.go('onb-auth');
        }}
      >
        {t('notif.skip')}
      </button>
    </div>
  );
}

export function AuthScreen({ nav }: { nav: Nav }) {
  const t = useT();
  return (
    <div className="m-screen m-auth" data-screen="onb-auth">
      <div className="m-brand">{t('common.wordmark')}</div>
      <div className="m-auth-title">{t('auth.title')}</div>
      <div className="m-auth-body">{t('auth.body')}</div>
      <div className="m-spacer" />
      <div className="m-auth-btns">
        <button
          type="button"
          className="m-btn-apple"
          data-press="1"
          onClick={() => {
            nav.openSheet('honest-auth');
          }}
        >
          {t('auth.apple')}
        </button>
        <button
          type="button"
          className="m-btn-plain"
          data-press="1"
          onClick={() => {
            nav.openSheet('honest-auth');
          }}
        >
          {t('auth.google')}
        </button>
        <button
          type="button"
          className="m-ghost"
          onClick={() => {
            nav.patch({ screen: 'main', tab: 'radar', sheet: null });
            nav.toast(t('toast.no.account'));
          }}
        >
          {t('auth.skip')}
        </button>
      </div>
      <div className="m-auth-foot">
        {t('auth.footer.a')}
        <br />
        {t('auth.footer.b')}
      </div>
    </div>
  );
}
