/**
 * The routes of blueprint 6.7. Everything outside `/app` is a real page rather than a stub in
 * the "returns nothing" sense: each one does the smallest true version of its job, so the shape
 * of the surface that replaces it is already fixed.
 *
 *   /            the landing, blueprint 4.4.
 *   /app         the shell. All internal navigation is client state, per 6.7.
 *   /n/:id       permalink: the shell, mounted straight onto the autopsy for that narrative.
 *   /methodology the published methodology, the same body the in-app screen draws.
 *   /share       the GET share target: resolves the link and opens the shell on the screen that
 *                resolution produced, with the decision pinned over it.
 *   /offline     the SW fallback for an uncached navigation.
 *   *            404.
 *
 * Three of these mount `App`, which is the point: `/n/:id` and `/share` are entry points into
 * the product, not thinner copies of it, and `/methodology` shares its body with the screen.
 *
 * The two big surfaces are the two lazy imports, and they are lazy in both directions: AC-PERF-1
 * budgets each route's initial JS on its own, so `/app` must not carry the landing's renderer
 * mounts and set pieces, and `/` must not carry seven app screens to show a page nobody has
 * navigated into yet. Everything else here is small and stays in the entry.
 */
import { Suspense, lazy, useState, type ReactNode } from 'react';
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router';
import type { Lang } from '../../contracts/types';
import { LangContext, useT } from './i18n';
import { useUrlIndex } from './content';
import { LS, readStore, type AppState } from './app/state';
import Boundary from './app/Boundary';
import MethodologyBody from './app/Methodology';
import { resolveUrl, shareCandidate } from './app/resolve';

const App = lazy(() => import('./app/App'));
const Landing = lazy(() => import('./landing/Landing'));
const Research = lazy(() => import('./research/Research'));
// 4.3: at 768px and up `/app` renders inside the ported iPhone frame. Only `/app`: a permalink
// and a share both mount `App` bare, because item 19 gives those the wide autopsy layout rather
// than the phone, and framing a shared link would put chrome around someone else's question.
const FramedApp = lazy(() => import('./app/Frame'));

/** Routes outside `/app` have no app state, so the language is read straight from storage. */
const storedLang = (): Lang => (readStore(LS.lang) === 'id' ? 'id' : 'en');

function Page({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <main className="m-page">
      <div className="m-page-in">
        {title === undefined ? null : <h1 className="m-page-title">{title}</h1>}
        {children}
      </div>
    </main>
  );
}

/** A route's data state, said once so five routes do not each invent their own wording. */
function Status({ loading, error }: { loading: boolean; error: string | null }) {
  const t = useT();
  if (error !== null) return <div className="m-page-body">{t('common.failed', { detail: error })}</div>;
  return loading ? <div className="m-page-body">{t('common.loading')}</div> : null;
}

/**
 * AC-APP-18: the permalink hydrates to the full autopsy, so it mounts the shell on the autopsy
 * screen rather than drawing a second, thinner copy of the card. `permalink` is what tells the
 * autopsy header it is the addressable card on this URL.
 */
function Permalink() {
  const { id = '' } = useParams();
  return <App start={{ screen: 'autopsy', narrative: id, spar: 'gate', permalink: true }} />;
}

function MethodologyPage() {
  const t = useT();
  return (
    <Page title={t('screen.methodology')}>
      <MethodologyBody lang={storedLang()} />
    </Page>
  );
}

/**
 * The share target, blueprint 6.7. It resolves the link with `resolve.ts`, the same module the
 * Dissect paste box uses, and then it opens the app on the screen that resolution produces:
 * the cached autopsy, the staged progress for the one link with no artifact yet, or the queue
 * state. Printing a decision and stopping there would be a fifth surface nobody asked for.
 *
 * The receipt stays pinned over whichever screen it produced, because a share is the one entry
 * point where the reader did not choose the destination and is owed the reason for it. The
 * params render as text, which is the whole of the XSS story: React escapes them, and the test
 * that asserts `querySelectorAll('script, img').length === 0` is asserting exactly that.
 */
function Share() {
  const t = useT();
  const [params] = useSearchParams();
  const { data, error } = useUrlIndex();
  const title = params.get('title') ?? '';
  const text = params.get('text') ?? '';
  const url = params.get('url') ?? '';
  const candidate = shareCandidate(url, text);
  const hit = data === null || candidate === '' ? null : resolveUrl(data, candidate);

  if (data === null) {
    return (
      <Page title={t('route.share.title')}>
        <Status loading={error === null} error={error} />
      </Page>
    );
  }

  const start: Partial<AppState> =
    hit === null
      ? { screen: 'queue' }
      : hit.role === 'fresh_demo'
        ? { screen: 'progress', progUrl: candidate, progTo: hit.narrative_id, progStage: 0 }
        : { screen: 'autopsy', narrative: hit.narrative_id, spar: 'gate' };

  return (
    <App
      start={start}
      banner={
        <Receipt
          decision={hit === null ? t('share.miss') : t('share.resolved', { id: hit.narrative_id, match: hit.matched })}
          title={title}
          text={text}
          url={url}
        />
      }
    />
  );
}

/** The receipt, which closes: it explains a destination the reader did not pick, then gets out. */
function Receipt({ decision, title, text, url }: { decision: string; title: string; text: string; url: string }) {
  const t = useT();
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="m-receipt">
      <div className="m-receipt-main">
        <div className="m-receipt-decision" data-testid="share-decision">
          {decision}
        </div>
        <div className="m-receipt-params" data-testid="share-params">
          title: {title}
          <br />
          text: {text}
          <br />
          url: {url}
        </div>
      </div>
      <button
        type="button"
        className="m-install-x"
        aria-label={t('share.close')}
        onClick={() => {
          setOpen(false);
        }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * AC-APP-17. The SW answers an uncached navigation by redirecting here, so this is the page a
 * reader lands on offline; the testid is what the driver reads to prove it landed.
 */
function Offline() {
  const t = useT();
  return (
    <Page title={t('route.offline.title')}>
      <div className="m-page-body" data-testid="route-offline">
        {t('route.offline.body')}
      </div>
    </Page>
  );
}

function NotFound() {
  const t = useT();
  return (
    <Page title={t('route.notfound.title')}>
      <div className="m-page-body" data-testid="route-notfound">
        {t('route.notfound.body')}
      </div>
      <Link className="m-page-link" to="/app">
        {t('route.home.link')}
      </Link>
    </Page>
  );
}

export default function AppRoutes() {
  return (
    <LangContext.Provider value={storedLang()}>
      {/* AC-APP-23. Outside the provider there would be no bundle to speak the fallback in. */}
      <Boundary>
        {/* Nothing, rather than a spinner: the two lazy routes are a same-origin chunk away and a
            flash of chrome that exists to be replaced is worse than one that never appeared. */}
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<FramedApp />} />
            <Route path="/n/:id" element={<Permalink />} />
            <Route path="/research" element={<Research />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/share" element={<Share />} />
            <Route path="/offline" element={<Offline />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Boundary>
    </LangContext.Provider>
  );
}
