/**
 * PROVES: AC-DEP-4. Emits `robots.txt` and `sitemap.xml` into the built app.
 *
 *   tsx scripts/build-seo.ts [--dir <content root>] [--out <dist dir>]
 *
 * The sitemap lists `/`, `/methodology`, and every `/n/{id}` that actually published, read from
 * the content root rather than from a list someone maintains by hand. A sitemap that names a
 * permalink with no artifact behind it is a 404 advertised to crawlers, and one that omits a
 * published narrative is a page nobody finds; deriving both from the same directory the
 * permalink shells are emitted from is what keeps the two in step.
 *
 * `/app`, `/share` and `/offline` are deliberately absent. `/app` is a client-state shell whose
 * content is the feed rather than a document, `/share` is an action endpoint that means nothing
 * without params, and `/offline` exists only for the service worker to serve. Listing any of
 * them would be padding the sitemap with URLs that answer nothing a searcher asked.
 *
 * Strict argv, same contract as the other scripts here: an unknown flag exits 2.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { SITE_URL } from '../app/src/site';

function usage(message: string): never {
  console.error(`build-seo: ${message}`);
  console.error('usage: tsx scripts/build-seo.ts [--dir <content root>] [--out <dist dir>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { dir: string; out: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--dir' && flag !== '--out') usage(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usage(`${flag} needs a value`);
    if (flags.has(flag)) usage(`${flag} was given twice`);
    flags.set(flag, value);
  }
  return { dir: resolve(flags.get('--dir') ?? 'content'), out: resolve(flags.get('--out') ?? 'app/dist') };
}

/** Published narrative ids, in the order the archive lists them. */
function narrativeIds(dir: string): string[] {
  const narratives = join(dir, 'narratives');
  if (!existsSync(narratives)) usage(`${narratives} does not exist, so there are no permalinks to list`);
  return readdirSync(narratives)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .sort((a, b) => a.localeCompare(b));
}

/** Latest `computed_at` across the archive: the date the sitemap's content actually last moved. */
function lastModified(dir: string, ids: string[]): string {
  const dates = ids
    .map((id) => {
      const artifact = JSON.parse(readFileSync(join(dir, 'narratives', `${id}.json`), 'utf8')) as {
        provenance?: { computed_at?: string };
      };
      return artifact.provenance?.computed_at ?? '';
    })
    .filter((d) => d !== '')
    .sort();
  return dates[dates.length - 1] ?? '';
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const ids = narrativeIds(args.dir);
  const lastmod = lastModified(args.dir, ids);
  const stamp = lastmod === '' ? '' : `\n    <lastmod>${lastmod}</lastmod>`;

  const urls = ['', 'methodology', 'research', ...ids.map((id) => `n/${id}`)].map(
    (path) => `  <url>\n    <loc>${SITE_URL}/${path}</loc>${stamp}\n  </url>`,
  );

  writeFileSync(
    join(args.out, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
  );

  // Indexing is allowed, which AC-DEP-4 requires. The service worker and the share action are
  // disallowed because neither is a page: a crawler fetching /share with no params gets the
  // queue state, which is a real answer to a question nobody asked.
  writeFileSync(
    join(args.out, 'robots.txt'),
    ['User-agent: *', 'Allow: /', 'Disallow: /share', 'Disallow: /offline', '', `Sitemap: ${SITE_URL}/sitemap.xml`, ''].join('\n'),
  );

  console.log(
    `build-seo: sitemap.xml lists ${String(urls.length)} url(s) (${String(ids.length)} permalink(s)), robots.txt allows indexing, origin ${SITE_URL}`,
  );
}

main();
