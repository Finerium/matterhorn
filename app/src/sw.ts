/**
 * The service worker, in three rules.
 *
 *   1. Precache the shell. `self.__WB_MANIFEST` is the built asset list, injected by
 *      vite-plugin-pwa in injectManifest mode. Installing fetches all of it.
 *   2. Content JSON is stale-while-revalidate: the cached artifact answers immediately and the
 *      network refresh lands in the cache for next time. That is the read path the product
 *      promises, cache first with no model behind it.
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

/** Rule 2: answer from cache, refresh behind it. */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(CONTENT);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  if (cached !== undefined) return cached;
  const fresh = await network;
  if (fresh !== undefined) return fresh;
  return new Response('{}', { status: 504, headers: { 'content-type': 'application/json' } });
}

/** Rule 3: a navigation the network cannot serve falls back to the cached shell, then /offline. */
async function navigate(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(SHELL);
    // The precached shell first: it boots the router, which renders the requested route with
    // whatever is already in the content cache. /offline is the floor under that.
    for (const key of [request as Request | string, '/index.html', OFFLINE_URL]) {
      const cached = await cache.match(key);
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
    event.respondWith(staleWhileRevalidate(request));
  }
});
