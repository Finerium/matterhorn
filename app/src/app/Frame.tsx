/**
 * The wide-viewport shell for `/app`: blueprint 4.3, surface 20, and the desktop stage of
 * docs/design-direction.md.
 *
 * At 768px and above the app renders inside the iPhone frame ported from the zip's
 * ios-frame.jsx, centred on the paper, with the caption row beneath it. Below 768px the frame is
 * not hidden, it is not rendered: a phone mounts exactly the tree `/app` has always mounted,
 * which is the installable PWA, with nothing of this between it and the reader.
 *
 * The frame is chrome, and it is built so that it cannot behave as anything else. The island and
 * the home indicator are pseudo-elements (app/src/app/wide.css): not focusable, not in the
 * accessibility tree, not hit-testable, so a keyboard or screen-reader reader ignores them by
 * construction. The soft depth the direction puts behind the phone is a pseudo-element for the
 * same reason. The only controls this component adds are the two in the caption, and they come
 * after the app in source order, so tab order through the app is exactly what it was and reaching
 * them means leaving it. Nothing here traps focus, listens for a key, or scrolls on the app's
 * behalf, and the cursor listener below is passive and writes custom properties only.
 */
import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';
import { Link } from 'react-router';
import { useT } from '../i18n';
import App from './App';

/** Blueprint 4.3's breakpoint. Kept in step by hand with the `@media` rule in wide.css. */
const WIDE = '(min-width: 768px)';

/** The direction's inertness rule: no cursor affordance exists without all three of these. */
const CURSOR = '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)';

/** The direction's cap on the stage parallax, in px. The shadow counters it at 30%, in CSS. */
const PULL = 6;

const subscribeWide = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

/**
 * The theme, mirrored onto the stage.
 *
 * The app writes `data-mth` on the body and surface.css keys its dark tokens off `data-theme`.
 * One attribute on the stage bridges the two, which is cheaper than a second copy of the token
 * values and, unlike an effect, is already right on the first paint: main.tsx sets `data-mth`
 * before React mounts, so the stage reads a dark reader's choice during its first render.
 */
const subscribeTheme = (onChange: () => void): (() => void) => {
  const watch = new MutationObserver(onChange);
  watch.observe(document.body, { attributes: true, attributeFilter: ['data-mth'] });
  return () => {
    watch.disconnect();
  };
};

const themeNow = (): 'light' | 'dark' => (document.body.dataset.mth === 'dark' ? 'dark' : 'light');

/** -1..1, the cursor's offset from the centre of a span of `size` starting at 0. */
const axis = (offset: number, size: number): number =>
  size === 0 ? 0 : Math.max(-1, Math.min(1, (offset * 2) / size - 1));

/**
 * The cursor system of docs/design-direction.md, this route's copy of it: one rAF-throttled
 * pointermove writes custom properties, and CSS does all of the styling. The direction asks each
 * route module to carry its own twenty lines rather than share a runtime module across three lazy
 * chunks, so this being a near-twin of the landing's listener is the instruction, not an accident.
 *
 * It writes `--mx`/`--my`, the viewport-relative cursor; `--fx`/`--fy`, the stage parallax, which
 * points AGAINST the cursor and is capped at the direction's 6px; and `--px`/`--py`, the
 * panel-relative 0..1 pair the caption's glass sheen is drawn at.
 */
function useStageCursor(
  stage: RefObject<HTMLDivElement | null>,
  caption: RefObject<HTMLDivElement | null>,
  wide: boolean,
): void {
  useEffect(() => {
    const root = stage.current;
    const panel = caption.current;
    // Narrow, neither element exists. Touch and reduced motion get the rest state, which the
    // direction requires to look finished: no listener, no variables, nothing to spring back.
    if (root === null || panel === null || !window.matchMedia(CURSOR).matches) return;

    let frame = 0;
    let at: { x: number; y: number } | null = null;

    const apply = () => {
      frame = 0;
      if (at === null) return;
      const box = root.getBoundingClientRect();
      root.style.setProperty('--mx', `${String(at.x)}px`);
      root.style.setProperty('--my', `${String(at.y)}px`);
      root.style.setProperty('--fx', `${(-PULL * axis(at.x - box.left, box.width)).toFixed(2)}px`);
      root.style.setProperty('--fy', `${(-PULL * axis(at.y - box.top, box.height)).toFixed(2)}px`);
      const glass = panel.getBoundingClientRect();
      panel.style.setProperty('--px', ((at.x - glass.left) / glass.width).toFixed(3));
      panel.style.setProperty('--py', ((at.y - glass.top) / glass.height).toFixed(3));
    };

    const onMove = (event: PointerEvent) => {
      at = { x: event.clientX, y: event.clientY };
      if (frame === 0) frame = requestAnimationFrame(apply);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
    // `wide` rather than nothing: below the breakpoint there is no stage to write onto, and a
    // resize across it is what mounts one.
  }, [stage, caption, wide]);
}

export default function FramedApp() {
  const t = useT();
  // ponytail: crossing the breakpoint by resizing remounts the app, because the frame is a
  // different tree position. Preferences survive (they are read back from storage) and the screen
  // does not. Ceiling accepted: the alternative is keeping the wrappers mounted at every width,
  // which is a frame element on a phone. Portal the app if that resize ever needs to be seamless.
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);
  const theme = useSyncExternalStore(subscribeTheme, themeNow);
  const stage = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLDivElement>(null);
  useStageCursor(stage, caption, wide);

  if (!wide) return <App />;

  return (
    <div className="m-stage" data-theme={theme} ref={stage}>
      <div className="m-stage-in">
        <div className="m-frame" data-testid="app-frame">
          <App />
        </div>
        {/* Glass, per the direction: the caption floats over the paper the phone sits on. */}
        <div className="m-caption g-glass" data-testid="frame-caption" ref={caption}>
          <span className="m-caption-text">{t('frame.caption')}</span>
          <Link className="m-caption-link" to="/research">
            {t('frame.research')}
          </Link>
          {/* A native disclosure: keyboard-operable, screen-reader-announced and closed by
              Escape without a line of script, which is the whole reason it is not a sheet. */}
          <details className="m-caption-note">
            <summary className="m-caption-sum">{t('frame.install')}</summary>
            <span className="m-caption-text">{t('frame.install.body')}</span>
          </details>
        </div>
      </div>
    </div>
  );
}
