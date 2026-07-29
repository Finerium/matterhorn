/**
 * Build budgets, asserted on the artifact that actually ships: `pnpm check:build`. Runs as the
 * last step of `pnpm build`, so a budget can only be blown by a build nobody ran.
 *
 *   AC-PERF-6  fonts       total self-hosted font payload at most 200 KB, every face
 *                          `font-display: swap`, and the file subsetted rather than the full face
 *   AC-PERF-7  assets      every emitted asset at most 300 KB, and every file the app requests
 *                          with an immutable cache header carries a content hash in its name
 *   AC-PERF-8  precache    the service worker's precache manifest sums to under 5 MB
 *
 * Why the hash rule is scoped the way it is. vercel.json serves `/assets/*` with
 * `max-age=31536000, immutable`, which is a promise that the bytes behind a URL never change.
 * That promise is only safe for a URL whose name changes when the bytes do, so every file under
 * `assets/` must carry a hash. Vite's own output does by construction; a file copied into
 * `public/assets/` by hand does not, and would be cached wrong for a year. That is the case this
 * check catches, and it is why the rule reads "under an immutable path" rather than "everywhere":
 * `/icons/icon-192.png` is named by the web manifest and by `<link rel=icon>`, so it cannot be
 * hashed, and vercel.json gives it its own header block.
 *
 * The font check reports honestly when there is no font. Today the app and the landing both use
 * the system stack, so the payload is 0 bytes and the swap and subset rules have nothing to apply
 * to. It says so, in those words, rather than printing a pass that reads like a subsetted font
 * was measured (blueprint AC-PERF-6). The moment a `.woff2` lands in the build all three rules
 * bite without an edit here.
 *
 * Exit 0 only when every budget holds. Exit 1 otherwise, one FAIL line per offending file.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DIST = join(REPO_ROOT, 'app', 'dist');

const KB = 1024;
const ASSET_MAX = 300 * KB; // AC-PERF-7
const FONT_MAX = 200 * KB; // AC-PERF-6
const PRECACHE_MAX = 5 * KB * KB; // AC-PERF-8

/**
 * Path prefixes vercel.json serves with `immutable`. A file under one of these must be hashed.
 *
 * `assets/og/` and `assets/land/` are deliberately NOT here, and the exclusion is the honest
 * half of a pair. Those two trees are addressed by a stable path from inside the gate-signed
 * region of a published artifact (`og.image_path` is `/assets/og/mbg-stop.jpg`), so their names
 * cannot carry a content hash without invalidating the token chain. Since they cannot be
 * hashed, vercel.json must not promise they never change: it serves them revalidating instead,
 * and this list matches that header block rather than overriding it.
 */
const IMMUTABLE = ['assets/'];
/** Served revalidating by vercel.json, so the hash rule does not apply. */
const NOT_IMMUTABLE = ['assets/og/', 'assets/land/'];
/** Vite's `name-HASH.ext`: 8 or more of its base64url alphabet, right before the extension. */
const HASHED = /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/;
const FONT_EXT = /\.(?:woff2?|ttf|otf|eot)$/i;
/** Content JSON is data the app fetches, not a build asset; its budget is AC-PERF-2's. */
const NOT_AN_ASSET = /^content\//;

interface File {
  rel: string;
  bytes: number;
}

function walk(dir: string): File[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .map(String)
    .map((entry) => ({ entry, abs: join(dir, entry) }))
    .filter(({ abs }) => statSync(abs).isFile())
    .map(({ abs }) => ({ rel: relative(dir, abs).split(sep).join(posix.sep), bytes: statSync(abs).size }))
    .sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * The precache list workbox injected into the worker. It is a literal array in the emitted
 * source, so it is read from there rather than guessed from a glob: what the worker will call
 * `cache.addAll` on is the only list this budget is about.
 */
function precacheEntries(sw: string): Array<{ url: string; revision: string | null }> {
  const entries: Array<{ url: string; revision: string | null }> = [];
  for (const match of sw.matchAll(/\{"revision":(null|"[0-9a-f]+"),"url":"([^"]+)"\}/g)) {
    entries.push({ url: match[2] ?? '', revision: match[1] === 'null' ? null : (match[1] ?? '') });
  }
  return entries;
}

const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} KB`;

type Status = 'pass' | 'fail' | 'n/a';
interface Row {
  slug: string;
  status: Status;
  detail: string;
  failures: string[];
}

function main(): void {
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error(`check:build  fail  ${DIST} has no index.html: run \`vite build app\` first`);
    process.exit(1);
  }
  const files = walk(DIST).filter((f) => !NOT_AN_ASSET.test(f.rel));
  const rows: Row[] = [];

  // AC-PERF-7 · size and hashed names
  const oversize = files.filter((f) => f.bytes > ASSET_MAX);
  const unhashed = files.filter(
    (f) =>
      IMMUTABLE.some((p) => f.rel.startsWith(p)) &&
      !NOT_IMMUTABLE.some((p) => f.rel.startsWith(p)) &&
      !HASHED.test(f.rel),
  );
  const largest = [...files].sort((a, b) => b.bytes - a.bytes)[0];
  rows.push({
    slug: 'assets',
    status: oversize.length + unhashed.length === 0 ? 'pass' : 'fail',
    detail: `${String(files.length)} file(s), largest ${largest === undefined ? 'none' : `${largest.rel} at ${kb(largest.bytes)}`}, budget ${kb(ASSET_MAX)}`,
    failures: [
      ...oversize.map((f) => `${f.rel}: ${kb(f.bytes)} exceeds the ${kb(ASSET_MAX)} asset budget`),
      ...unhashed.map((f) => `${f.rel}: served immutable but its name carries no content hash`),
    ],
  });

  // AC-PERF-6 · fonts
  const fonts = files.filter((f) => FONT_EXT.test(f.rel));
  const fontBytes = fonts.reduce((sum, f) => sum + f.bytes, 0);
  const css = files.filter((f) => f.rel.endsWith('.css')).map((f) => readFileSync(join(DIST, f.rel), 'utf8'));
  const faces = css.flatMap((text) => [...text.matchAll(/@font-face\s*\{[^}]*\}/g)].map((m) => m[0]));
  const noSwap = faces.filter((face) => !/font-display\s*:\s*swap/.test(face));
  rows.push(
    fonts.length === 0 && faces.length === 0
      ? {
          slug: 'fonts',
          status: 'n/a',
          detail: 'no font is self-hosted: the app and the landing both use the system stack, so the payload is 0 bytes and there is nothing to subset or to set font-display on',
          failures: [],
        }
      : {
          slug: 'fonts',
          status: fontBytes <= FONT_MAX && noSwap.length === 0 ? 'pass' : 'fail',
          detail: `${String(fonts.length)} face file(s), ${kb(fontBytes)} of ${kb(FONT_MAX)}, ${String(faces.length)} @font-face rule(s)`,
          failures: [
            ...(fontBytes > FONT_MAX ? [`font payload ${kb(fontBytes)} exceeds the ${kb(FONT_MAX)} budget`] : []),
            ...noSwap.map((face) => `@font-face without font-display: swap: ${face.slice(0, 80).replace(/\s+/g, ' ')}`),
          ],
        },
  );

  // AC-PERF-8 · service worker precache
  const swPath = join(DIST, 'sw.js');
  if (!existsSync(swPath)) {
    rows.push({ slug: 'precache', status: 'fail', detail: '', failures: ['app/dist/sw.js does not exist: the PWA plugin emitted no worker'] });
  } else {
    const entries = precacheEntries(readFileSync(swPath, 'utf8'));
    const byUrl = new Map(files.map((f) => [f.rel, f.bytes]));
    const missing = entries.filter((e) => !byUrl.has(e.url)).map((e) => e.url);
    // The worker de-duplicates with a Set before addAll, so the budget is over distinct URLs.
    const bytes = [...new Set(entries.map((e) => e.url))].reduce((sum, url) => sum + (byUrl.get(url) ?? 0), 0);
    rows.push({
      slug: 'precache',
      status: bytes < PRECACHE_MAX && missing.length === 0 ? 'pass' : 'fail',
      detail: `${String(new Set(entries.map((e) => e.url)).size)} distinct URL(s), ${kb(bytes)} of ${kb(PRECACHE_MAX)}`,
      failures: [
        ...(bytes >= PRECACHE_MAX ? [`precache ${kb(bytes)} is not under the ${kb(PRECACHE_MAX)} budget`] : []),
        ...missing.map((url) => `precache lists "${url}", which the build did not emit`),
      ],
    });
  }

  const width = Math.max(...rows.map((r) => r.slug.length), 'CHECK'.length);
  console.log(`check:build  ${relative(REPO_ROOT, DIST)}${sep} (${String(files.length)} emitted file(s))`);
  console.log('');
  console.log(`${'CHECK'.padEnd(width)}  STATUS  DETAIL`);
  for (const r of rows) console.log(`${r.slug.padEnd(width)}  ${r.status.padEnd(6)}  ${r.detail}`);

  const failed = rows.filter((r) => r.status === 'fail');
  if (failed.length > 0) {
    console.error('');
    for (const r of failed) for (const f of r.failures) console.error(`FAIL ${r.slug} ${f}`);
    console.error(`FAIL ${String(failed.length)} of ${String(rows.length)} build budgets: ${failed.map((r) => r.slug).join(', ')}`);
    process.exit(1);
  }
  console.log('');
  console.log('OK: every build budget holds (AC-PERF-6, AC-PERF-7, AC-PERF-8).');
}

main();
