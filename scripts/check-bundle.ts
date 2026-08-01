/**
 * PROVES: AC-PERF-1. Per-route initial JS, gzipped, against hard thresholds: `pnpm check:bundle`.
 * Runs as a step of `pnpm build`, so the budget is enforced on every build including Vercel's and
 * CI's, not only when someone remembers to look at a report.
 *
 *   landing route `/`     initial JS at most 250 KB gzip
 *   app route `/app`      initial JS at most 350 KB gzip
 *
 * "Initial JS" is defined here the way a browser defines it: every module the route must download
 * before it can render. That is the entry chunk plus the route's own chunk plus the transitive
 * closure of their STATIC imports. A dynamic import is by construction not initial, so it is not
 * counted; it is printed under the total anyway, named and sized, so nobody reads the number as
 * "everything this route can ever load". Two of them exist today and both are conditional:
 * `gsap` behind the Firefox motion fallback, `html-to-image` behind the Nuance export button.
 *
 * The graph comes from vite's own build manifest (`app/dist/.vite/manifest.json`, switched on in
 * app/vite.config.ts) rather than from parsing chunk filenames or grepping import statements out
 * of the emitted JS. The manifest is what the bundler says it built; the other two are guesses
 * that stop being true the first time chunking changes, and a budget measured off a stale guess
 * is worse than no budget.
 *
 * gzip at zlib's default level, which is what a CDN serves and is a byte or two LARGER than
 * level 9. When two settings are both defensible the stricter one is the honest one to budget
 * against; picking level 9 here would buy roughly 1 percent of headroom for nothing.
 *
 * CSS is not in the budget. AC-PERF-1 says JS, and the render-blocking stylesheet is already
 * inside AC-LAND-8's LCP and AC-LAND-9's performance score, measured by Lighthouse on the real
 * page rather than estimated from a file size.
 *
 * Exit 0 only when every route holds. Exit 1 otherwise, naming the route, the number and the gap.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const DIST = join(REPO_ROOT, 'app', 'dist');
const MANIFEST = join(DIST, '.vite', 'manifest.json');

const KB = 1024;

/** Blueprint AC-PERF-1, verbatim. The manifest key is the route's lazy import in routes.tsx. */
const ROUTES = [
  { route: '/', entry: 'src/landing/Landing.tsx', budget: 250 * KB },
  // `/app` mounts Frame, which statically imports App, so the closure below is both of them.
  { route: '/app', entry: 'src/app/Frame.tsx', budget: 350 * KB },
] as const;

interface Chunk {
  file: string;
  imports?: string[];
  dynamicImports?: string[];
}

type Manifest = Record<string, Chunk>;

/**
 * Every chunk key reachable from `start` by static imports, `start` included.
 *
 * Vite lists the entry chunk (`index.html`) in each lazy route's `imports`, so walking from the
 * route reaches the shared entry without naming it here. `seen` is what makes the walk terminate:
 * the graph has cycles in it by design, since the entry dynamically imports the routes back.
 */
function closure(manifest: Manifest, start: string): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || seen.has(key)) continue;
    const chunk = manifest[key];
    if (chunk === undefined) {
      console.error(`check:bundle  fail  ${key} is not in the build manifest`);
      process.exit(1);
    }
    seen.add(key);
    queue.push(...(chunk.imports ?? []));
  }
  return seen;
}

/** Dynamic imports reachable from a static closure, minus anything already inside it. */
function deferred(manifest: Manifest, keys: Set<string>): string[] {
  const out = new Set<string>();
  for (const key of keys) for (const dep of manifest[key]?.dynamicImports ?? []) if (!keys.has(dep)) out.add(dep);
  return [...out].sort((a, b) => a.localeCompare(b));
}

const gzipOf = (file: string): number => gzipSync(readFileSync(join(DIST, file))).byteLength;
const kb = (bytes: number): string => `${(bytes / KB).toFixed(1)} KB`;

function main(): void {
  if (!existsSync(MANIFEST)) {
    console.error(`check:bundle  fail  ${MANIFEST} does not exist: run \`pnpm build\` first`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;

  const failed: string[] = [];
  console.log('');
  console.log('ROUTE   INITIAL JS (gzip)  BUDGET     CHUNKS  STATUS');
  for (const { route, entry, budget } of ROUTES) {
    const keys = closure(manifest, entry);
    const files = [...new Set([...keys].map((key) => manifest[key]?.file ?? ''))].filter((f) => f.endsWith('.js'));
    const bytes = files.reduce((sum, file) => sum + gzipOf(file), 0);
    const ok = bytes <= budget;
    if (!ok) failed.push(`${route} initial JS ${kb(bytes)} exceeds the ${kb(budget)} budget by ${kb(bytes - budget)}`);
    console.log(
      `${route.padEnd(7)} ${kb(bytes).padEnd(17)} ${kb(budget).padEnd(10)} ${String(files.length).padEnd(6)}  ${ok ? 'pass' : 'FAIL'}`,
    );
    for (const file of files.sort((a, b) => a.localeCompare(b))) console.log(`          ${file}  ${kb(gzipOf(file))}`);
    for (const key of deferred(manifest, keys)) {
      const file = manifest[key]?.file ?? '';
      console.log(`          deferred, not counted: ${file}  ${kb(gzipOf(file))}`);
    }
  }

  console.log('');
  if (failed.length > 0) {
    for (const line of failed) console.error(`FAIL ${line}`);
    process.exit(1);
  }
  console.log('OK: every route holds its initial-JS budget (AC-PERF-1).');
}

main();
