/**
 * The routes of blueprint 6.7. Everything outside `/app` is a real page rather than a stub in
 * the "returns nothing" sense: each one does the smallest true version of its job, so the shape
 * of the surface that replaces it is already fixed.
 *
 *   /            plain placeholder that links `/app`. The landing is Gate 4.
 *   /app         the shell. All internal navigation is client state, per 6.7.
 *   /n/:id       permalink: the narrative through the card contract, nothing else yet.
 *   /methodology the published policy 6.5 text, read from methodology.json.
 *   /share       the GET share target: parses title/text/url and states the decision it takes.
 *   /offline     the SW fallback for an uncached navigation.
 *   *            404.
 */
import { useMemo, type ReactNode } from 'react';
import { Link, Route, Routes, useParams, useSearchParams } from 'react-router';
import type { Lang, Narrative, Source, UrlIndex } from '../../contracts/types';
import { LangContext, useT } from './i18n';
import { PATHS, useJson, useMethodology, useUrlIndex } from './content';
import { makeCtx } from './renderers/ctx';
import Card from './renderers/Card';
import { LS, readStore } from './app/state';
import App from './app/App';

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

function Home() {
  const t = useT();
  return (
    <Page title="Matterhorn">
      <div className="m-page-body">{t('hello.sub')}</div>
      <Link className="m-page-link" to="/app">
        {t('route.home.link')}
      </Link>
    </Page>
  );
}

function Permalink() {
  const { id = '' } = useParams();
  const narrative = useJson<Narrative>(PATHS.narrative(id));
  const sources = useJson<Source[]>(PATHS.sources);
  const ctx = useMemo(() => makeCtx(sources.data ?? [], storedLang(), 'light'), [sources.data]);
  const ready = narrative.data !== null && sources.data !== null;
  return (
    <Page>
      <Status loading={!ready} error={narrative.error ?? sources.error} />
      {narrative.data !== null && sources.data !== null ? (
        <div className="mth" data-testid="permalink-card">
          <Card narrative={narrative.data} variant="hero" ctx={ctx} />
        </div>
      ) : null}
    </Page>
  );
}

function MethodologyPage() {
  const t = useT();
  const { data, error } = useMethodology();
  return (
    <Page title={t('screen.methodology')}>
      <Status loading={data === null} error={error} />
      {data === null ? null : (
        <div className="m-page-body" data-testid="policy-65">
          {data.policy_65[storedLang()]}
        </div>
      )}
    </Page>
  );
}

/**
 * The resolution the share target takes, in the order 6.11 check 8 fixes: exact, then prefix,
 * then regex. A pattern that does not compile is skipped rather than thrown: the validator
 * refuses to publish one, and a share arriving at a broken index still has to answer.
 */
function resolve(index: UrlIndex, url: string): { id: string; match: string } | null {
  for (const kind of ['exact', 'prefix', 'regex'] as const) {
    for (const entry of index.entries) {
      if (entry.match !== kind) continue;
      let hit = false;
      if (kind === 'exact') hit = entry.pattern === url;
      else if (kind === 'prefix') hit = url.startsWith(entry.pattern);
      else {
        try {
          hit = new RegExp(entry.pattern).test(url);
        } catch {
          hit = false;
        }
      }
      if (hit) return { id: entry.narrative_id, match: kind };
    }
  }
  return null;
}

function Share() {
  const t = useT();
  const [params] = useSearchParams();
  const { data, error } = useUrlIndex();
  // Android share sheets put the link in `text` as often as in `url`; both are read.
  const title = params.get('title') ?? '';
  const text = params.get('text') ?? '';
  const url = params.get('url') ?? '';
  const candidate = url === '' ? text.trim() : url;
  const hit = data === null || candidate === '' ? null : resolve(data, candidate);

  return (
    <Page title={t('route.share.title')}>
      <div className="m-page-meta" data-testid="share-params">
        title: {title}
        <br />
        text: {text}
        <br />
        url: {url}
      </div>
      <Status loading={data === null} error={error} />
      {data === null ? null : (
        <div className="m-page-body" data-testid="share-decision">
          {hit === null ? t('share.miss') : t('share.resolved', { id: hit.id, match: hit.match })}
        </div>
      )}
      {hit === null ? null : (
        <Link className="m-page-link" to={`/n/${hit.id}`}>
          {hit.id}
        </Link>
      )}
    </Page>
  );
}

function Offline() {
  const t = useT();
  return (
    <Page title={t('route.offline.title')}>
      <div className="m-page-body">{t('route.offline.body')}</div>
    </Page>
  );
}

function NotFound() {
  const t = useT();
  return (
    <Page title={t('route.notfound.title')}>
      <div className="m-page-body">{t('route.notfound.body')}</div>
      <Link className="m-page-link" to="/app">
        {t('route.home.link')}
      </Link>
    </Page>
  );
}

export default function AppRoutes() {
  return (
    <LangContext.Provider value={storedLang()}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/app" element={<App />} />
        <Route path="/n/:id" element={<Permalink />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/share" element={<Share />} />
        <Route path="/offline" element={<Offline />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </LangContext.Provider>
  );
}
