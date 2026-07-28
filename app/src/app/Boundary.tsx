/**
 * AC-APP-23. The app's error boundary: the one thing standing between a render-time throw and
 * a white screen.
 *
 * The renderer layer throws on purpose. `OrphanNumberError` (6.2) and `CardContractError` (6.5)
 * are refusals: an artifact that cannot be drawn honestly is not drawn at all. That is the right
 * behaviour and it needs a floor under it, because without one a single refusing panel unmounts
 * the whole tree and the reader gets nothing, which is a worse failure than the one being
 * refused.
 *
 * Two mount points, for that reason:
 *   routes.tsx     around the router, so nothing takes the page down.
 *   Autopsy.tsx    around every panel mount, so a refusing panel loses its own frame and the
 *                  rest of the autopsy keeps rendering around it.
 *
 * The fallback says nothing about the error. No message, no stack, no class name: a reader can
 * do nothing with `CardContractError: narrative "x" carries no derived counts`, and a product
 * whose whole claim is an inspectable read path does not leak internals into the reading
 * surface. React still logs the error to the console, which is where the developer looks.
 *
 * ponytail: no retry button and no per-mount copy. Reloading is the action, the copy says so,
 * and one string pair reads the same in a panel slot as it does on a page. Add a retry when
 * there is state worth preserving across it.
 */
import { Component, type ReactNode } from 'react';
import { useT } from '../i18n';

/**
 * A function component so the copy comes through the bundle the way every other string does.
 * Class components take no hooks; this is the whole reason the fallback is split out.
 */
function Fallback() {
  const t = useT();
  return (
    <div className="m-boundary" data-testid="error-fallback" role="status">
      <div className="m-panel">
        <div className="m-panel-title">{t('boundary.title')}</div>
        <div className="m-hint">{t('boundary.body')}</div>
      </div>
    </div>
  );
}

export default class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render(): ReactNode {
    return this.state.failed ? <Fallback /> : this.props.children;
  }
}
