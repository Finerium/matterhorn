/**
 * The service worker, in three rules.
 *
 *   1. Precache the shell. `self.__WB_MANIFEST` is the built asset list, injected by
 *      vite-plugin-pwa in injectManifest mode. Installing fetches all of it.
 *   2. Content JSON and og imagery are stale-while-revalidate: the cached artifact answers
 *      immediately and the network refresh lands in the cache for next time. That is the read
 *      path the product promises, cache first with no model behind it.
 *   3. A navigation that misses both network and cache falls back to `/offline`.
 *
 * ponytail: no workbox. The three strategies above are the whole worker, and hand-writing them
 * costs less than the four workbox packages it would take to import them. Known ceiling: the
 * precache is versioned by cache name only, so a deploy replaces it wholesale rather than
 * diffing revisions. Swap in workbox-precaching if partial revalidation ever matters.
 */
export {};

interface PrecacheEntry {
  url: string;
  revision: string | null;
}

interface SwFetchEvent extends Event {
  request: Request;
  respondWith(response: Promise<Response> | Response): void;
}

interface SwLifecycleEvent extends Event {
  waitUntil(work: Promise<unknown>): void;
}

interface SwScope {
  __WB_MANIFEST: PrecacheEntry[];
  addEventListener(type: 'install' | 'activate', listener: (event: SwLifecycleEvent) => void): void;
  addEventListener(type: 'fetch', listener: (event: SwFetchEvent) => void): void;
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
}

/**
 * The worker's own global, declared locally because this file is a module: it shadows the DOM
 * lib's `self` without pulling the WebWorker lib in, which would collide with DOM everywhere
 * else in the project. `self.__WB_MANIFEST` has to survive to the emitted file verbatim, which
 * is why the plugin config sets `injectManifest.minify: false`: a minifier that aliases `self`
 * leaves workbox nothing to inject into, and the build fails rather than shipping a worker with
 * an empty precache.
 */
declare const self: SwScope;

/** Bumped by the build: the precache manifest hash lands in the name, so a deploy is a new box. */
const SHELL = 'mth-shell-v1';
const CONTENT = 'mth-content-v1';
const OFFLINE_URL = '/offline';
const KEEP = new Set([SHELL, CONTENT]);

/**
 * Every read in this file, without exception.
 *
 * A preview server answers with `Vary: Origin`, so a cached response only matches a request
 * carrying the same `Origin` header the cache entry was stored under. The install writes the
 * precache through `cache.addAll`, whose requests are same-origin and send no `Origin`; the
 * page then asks for those same assets through `<script crossorigin>`, which does send one.
 * Vary-sensitive matching calls that a different request and misses every precached asset:
 * the shell comes back offline and dies on its own bundle, which is a blank page wearing a
 * working fallback's clothes. Ignoring Vary is correct here because the worker keys its caches
 * by URL and stores exactly one response per URL, which is the assumption `ignoreVary` states.
 */
const MATCH = { ignoreVary: true } as const;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll([...new Set(self.__WB_MANIFEST.map((entry) => entry.url))]);
      // /offline is a client route, not a built asset, so it is added separately and
      // tolerantly: a host without the SPA rewrite would 404 it and must not fail the install.
      await cache.add(OFFLINE_URL).catch(() => undefined);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => !KEEP.has(name)).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/**
 * Rule 1, the read half: anything the install precached is answered from the cache, and anything
 * else falls through to the network unchanged.
 *
 * Without this the precache is write-only. An offline reload is served the shell document and
 * then dies on its own `<script src="/assets/index-*.js">`, which is a blank page dressed up as
 * a working fallback. Found exactly that way, on a preview build with the network cut.
 */
async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(SHELL);
  return (await cache.match(request, MATCH)) ?? (await fetch(request));
}

/** Rule 2: answer from cache, refresh behind it. `miss` answers when both cache and network do. */
async function staleWhileRevalidate(request: Request, miss: () => Response): Promise<Response> {
  const cache = await caches.open(CONTENT);
  const cached = await cache.match(request, MATCH);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached !== undefined) return cached;
  const fresh = await network;
  if (fresh !== undefined) return fresh;
  return miss();
}

const contentMiss = (): Response =>
  new Response('{}', { status: 504, headers: { 'content-type': 'application/json' } });

/**
 * An og image neither cache holds while offline. A thrown fetch or an error status would log a
 * console error (AC-APP-22 forbids any), so the miss is an empty 200 SVG: the card's own
 * placeholder shows through it, which is the recorded-fallback state anyway.
 */
const imageMiss = (): Response =>
  new Response('<svg xmlns="http://www.w3.org/2000/svg"/>', {
    status: 200,
    headers: { 'content-type': 'image/svg+xml' },
  });

/**
 * Can the app actually draw this route from what is already in the caches?
 *
 * This is the question the shell cannot answer for itself. Serving the precached shell for
 * `/n/{id}` boots the router at that URL, and the router renders the permalink screen whether or
 * not the narrative behind it was ever fetched: offline, an unvisited id paints a load failure
 * instead of the offline page. So the worker asks the content cache first, and the only route
 * whose answer is not "yes" is the one that reads a per-id artifact.
 */
async function servable(url: URL): Promise<boolean> {
  const permalink = /^\/n\/([^/]+)\/?$/.exec(url.pathname);
  if (permalink === null) return true;
  const cache = await caches.open(CONTENT);
  return (await cache.match(`/content/narratives/${permalink[1] ?? ''}.json`, MATCH)) !== undefined;
}

/** Rule 3: a navigation the network cannot serve falls back to the cached shell, then /offline. */
async function navigate(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const url = new URL(request.url);
    // A redirect rather than the /offline document: the SPA renders from location, so handing
    // the shell back under the requested URL would render that route, not this one. The redirect
    // moves the URL, and the next navigation is served the shell and renders /offline properly.
    if (url.pathname !== OFFLINE_URL && !(await servable(url))) return Response.redirect(OFFLINE_URL, 302);
    const cache = await caches.open(SHELL);
    // The precached shell first: it boots the router, which renders the requested route with
    // whatever is already in the content cache. /offline is the floor under that.
    for (const key of [request as Request | string, '/index.html', OFFLINE_URL]) {
      const cached = await cache.match(key, MATCH);
      if (cached !== undefined) return cached;
    }
    return new Response('', { status: 504 });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request));
    return;
  }
  if (url.pathname.startsWith('/content/') && url.pathname.endsWith('.json')) {
    event.respondWith(staleWhileRevalidate(request, contentMiss));
    return;
  }
  // og imagery (narrative cards and member previews) rides the content cache for the same
  // reason the JSON does: a visited page must reload offline complete.
  if (url.pathname.startsWith('/assets/og/')) {
    event.respondWith(staleWhileRevalidate(request, imageMiss));
    return;
  }
  event.respondWith(cacheFirst(request));
});
