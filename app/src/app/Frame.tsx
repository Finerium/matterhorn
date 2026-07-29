/**
 * The wide-viewport shell for `/app`: blueprint 4.3 and surface 20.
 *
 * At 768px and above the app renders inside the iPhone frame ported from the zip's
 * ios-frame.jsx, centred on the paper, with the caption row beneath it. Below 768px the frame is
 * not hidden, it is not rendered: a phone mounts exactly the tree `/app` has always mounted,
 * which is the installable PWA, with nothing of this between it and the reader.
 *
 * The frame is chrome, and it is built so that it cannot behave as anything else. The island and
 * the home indicator are pseudo-elements (app/src/app/wide.css): not focusable, not in the
 * accessibility tree, not hit-testable, so a keyboard or screen-reader reader ignores them by
 * construction. The only controls this component adds are the two in the caption, and they come
 * after the app in source order, so tab order through the app is exactly what it was and reaching
 * them means leaving it. Nothing here traps focus, listens for a key, or scrolls on the app's
 * behalf.
 */
import { useSyncExternalStore } from 'react';
import { Link } from 'react-router';
import { useT } from '../i18n';
import App from './App';

/** Blueprint 4.3's breakpoint. Kept in step by hand with the `@media` rule in wide.css. */
const WIDE = '(min-width: 768px)';

const subscribeWide = (onChange: () => void): (() => void) => {
  const query = window.matchMedia(WIDE);
  query.addEventListener('change', onChange);
  return () => {
    query.removeEventListener('change', onChange);
  };
};

export default function FramedApp() {
  const t = useT();
  // ponytail: crossing the breakpoint by resizing remounts the app, because the frame is a
  // different tree position. Preferences survive (they are read back from storage) and the screen
  // does not. Ceiling accepted: the alternative is keeping the wrappers mounted at every width,
  // which is a frame element on a phone. Portal the app if that resize ever needs to be seamless.
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches);
  if (!wide) return <App />;

  return (
    <div className="m-stage">
      <div className="m-stage-in">
        <div className="m-frame" data-testid="app-frame">
          <App />
        </div>
        <div className="m-caption" data-testid="frame-caption">
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
