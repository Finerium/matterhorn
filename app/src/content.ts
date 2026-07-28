/**
 * The content loader: every artifact the app reads, read over the network, never imported.
 *
 * One base path decides where content comes from, and it is a build-time define:
 *
 *   production build   `/content`, the shipped artifact root
 *   dev and e2e        SEED MODE, `/@fs<repo>/tests/fixtures/seed`, exactly the way the Gate 2
 *                      harness reaches the same root
 *
 * That is the whole switch. When Gate C publishes real content into `content/`, nothing here
 * changes: the production define already points at it. And because the seed root is reached by
 * URL rather than by module specifier, no fixture can enter the app import graph, which is what
 * blueprint 6.11 check 7 asserts (`validate:content --scan-app app/src`).
 *
 * Caching is a module-level map of resolved artifacts. It exists for one behaviour: switching
 * packs re-renders from cache with no fetch and no spinner (AC-APP-14), because `peek` is a
 * synchronous read and the components build their view from it during render.
 */
import { useEffect, useState } from 'react';
import type {
  CaseLibrary,
  Constellation,
  Corrections,
  Feed,
  Methodology,
  Narrative,
  Source,
  UrlIndex,
} from '../../contracts/types';

/** Injected by vite. Absent only if someone bundles this module outside the app config. */
declare const __CONTENT_BASE__: string;

export const CONTENT_BASE: string = typeof __CONTENT_BASE__ === 'string' ? __CONTENT_BASE__ : '/content';

export type Pack = Feed['pack'];

export const PATHS = {
  sources: 'sources.json',
  feed: (pack: Pack) => `packs/${pack}/feed.json`,
  narrative: (id: string) => `narratives/${id}.json`,
  urlIndex: 'url_index.json',
  methodology: 'methodology.json',
  corrections: 'corrections.json',
  caseLibrary: 'case_library.json',
  constellation: 'constellation.json',
} as const;

/** Every pack this build carries a feed for. The Archive reads all of them at once. */
export const PACKS = ['id', 'en'] as const;

const resolved = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/** What is already in hand for `path`, or undefined. Synchronous, so it can run during render. */
export const peek = <T,>(path: string): T | undefined => resolved.get(path) as T | undefined;

/** Fetch once, remember forever. A failed read is forgotten so the next attempt is a real one. */
export function loadJson<T>(path: string): Promise<T> {
  const hit = inflight.get(path);
  if (hit !== undefined) return hit as Promise<T>;
  const url = `${CONTENT_BASE}/${path}`;
  const run = fetch(url)
    .then(async (response) => {
      if (!response.ok) throw new Error(`${path} responded ${String(response.status)}`);
      // A dev server and a rewriting host both answer a missing artifact with the SPA shell
      // rather than a 404, so the status alone is not proof. The parse is what settles it, and
      // its failure is reported as the artifact's, not as the parser's.
      const body = await response.text();
      let data: unknown;
      try {
        data = JSON.parse(body);
      } catch {
        throw new Error(`${path} is not JSON`);
      }
      resolved.set(path, data);
      return data;
    })
    .catch((error: unknown) => {
      inflight.delete(path);
      throw error instanceof Error ? error : new Error(String(error));
    });
  inflight.set(path, run);
  return run as Promise<T>;
}

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** One artifact, by path. `null` means "nothing wanted yet", which routes use before a param resolves. */
export function useJson<T>(path: string | null): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(() => (path === null ? null : (peek<T>(path) ?? null)));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (path === null || data !== null) return;
    let live = true;
    loadJson<T>(path).then(
      (loaded) => {
        if (live) setData(loaded);
      },
      (failure: unknown) => {
        if (live) setError(message(failure));
      },
    );
    return () => {
      live = false;
    };
  }, [path, data]);

  return { data, error };
}

export interface RadarItem {
  narrative: Narrative;
  slot: 'hero' | 'compact';
  viaDissect: boolean;
}

export interface RadarData {
  sources: Source[];
  items: RadarItem[];
  updatedAt: string;
}

/**
 * Everything the radar draws, assembled from cache. Returns null until every piece is in hand,
 * so the feed never paints half a pack.
 */
function assemble(pack: Pack): RadarData | null {
  const sources = peek<Source[]>(PATHS.sources);
  const feed = peek<Feed>(PATHS.feed(pack));
  if (sources === undefined || feed === undefined) return null;
  const items: RadarItem[] = [];
  for (const item of feed.items) {
    const narrative = peek<Narrative>(PATHS.narrative(item.narrative_id));
    if (narrative === undefined) return null;
    items.push({ narrative, slot: item.slot, viaDissect: item.via_dissect === true });
  }
  return { sources, items, updatedAt: feed.updated_at };
}

/** Warms the cache for a pack. Called at app boot so onboarding pays the fetch, not the feed. */
export async function prefetchRadar(pack: Pack): Promise<void> {
  const [, feed] = await Promise.all([loadJson<Source[]>(PATHS.sources), loadJson<Feed>(PATHS.feed(pack))]);
  await Promise.all(feed.items.map((item) => loadJson<Narrative>(PATHS.narrative(item.narrative_id))));
}

/**
 * The radar's data. Mount the consumer with `key={pack}` so a pack switch is a fresh mount:
 * the initial state is the synchronous cache read, which is what makes a warm switch instant.
 */
export function useRadar(pack: Pack): { data: RadarData | null; error: string | null } {
  const [data, setData] = useState<RadarData | null>(() => assemble(pack));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data !== null) return;
    let live = true;
    prefetchRadar(pack).then(
      () => {
        if (live) setData(assemble(pack));
      },
      (failure: unknown) => {
        if (live) setError(message(failure));
      },
    );
    return () => {
      live = false;
    };
  }, [pack, data]);

  return { data, error };
}

/**
 * Every narrative in every pack, for the Archive. It rides `useRadar` once per pack rather than
 * inventing a second loader: the assembly, the cache and the prefetch are already there, and the
 * Archive wants exactly what the two feeds already carry.
 */
export function useArchive(): { data: RadarData[] | null; error: string | null } {
  const id = useRadar('id');
  const en = useRadar('en');
  const error = id.error ?? en.error;
  if (id.data === null || en.data === null) return { data: null, error };
  return { data: [id.data, en.data], error };
}

/** Named readers for the artifacts the route stubs want. Thin on purpose: they are paths. */
export const useMethodology = () => useJson<Methodology>(PATHS.methodology);
export const useUrlIndex = () => useJson<UrlIndex>(PATHS.urlIndex);
export const useCorrections = () => useJson<Corrections>(PATHS.corrections);
export const useCaseLibrary = () => useJson<CaseLibrary>(PATHS.caseLibrary);
export const useConstellation = () => useJson<Constellation>(PATHS.constellation);
