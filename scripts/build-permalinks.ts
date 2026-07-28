/**
 * The permalink shell emitter: `pnpm build:permalinks`. AC-APP-18, blueprint 6.7 and ADR-3.
 *
 * The app is a static SPA, so `/n/{id}` has no server to render og tags into it. A crawler never
 * runs the bundle: it reads the first response and stops. So the build writes one real HTML file
 * per narrative at `/n/{id}/index.html`, carrying the FROZEN 6.7 head and the same SPA bootstrap
 * the built `index.html` carries. A reader gets the app; a crawler gets the tags. One document.
 *
 *   pnpm build:permalinks                                  content/ into app/dist
 *   pnpm build:permalinks --content tests/fixtures/seed     the seed root, for a preview build
 *   pnpm build:permalinks --out somewhere --index some.html
 *
 * The content root is the ACTIVE one, and today that is two different roots for two situations:
 * a production build reads `content/` (which is what `--content` defaults to, and what Gate C
 * fills), while dev and the e2e suite run in SEED MODE against `tests/fixtures/seed`. Nothing
 * runs this script in dev: app/vite.config.ts imports `permalinkShell` into a serve-only
 * middleware, off the same seed root the app itself reads, so the dev server and the built site
 * answer `/n/{id}` with the same document.
 *
 * A content root with no narratives emits nothing and exits 0. That is the validator's own
 * vacuous-when-absent rule: before Gate C there is nothing to emit and that is not a failure.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Narrative } from '../contracts/types';
import { SITE_URL } from '../app/src/site';

const REPO_ROOT = resolve(import.meta.dirname, '..');

/** Blueprint 6.7: "the narrative's static og render or the default site og". */
const DEFAULT_OG = '/icons/icon-512.png';

/**
 * The headline a link preview shows. A permalink carries no locale, so the shell speaks the
 * language of the pack the narrative was published into, and falls back to EN, which every
 * narrative has (`headline.id` is optional in the contract).
 */
const headlineFor = (narrative: Narrative): string =>
  (narrative.pack === 'id' ? narrative.headline.id : undefined) ?? narrative.headline.en;

const esc = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * The head of blueprint 6.7, FROZEN. The description template is verdict-free by construction:
 * it states three counts and points at the structure, and there is no branch in it that could
 * ever say anything else.
 */
export function permalinkHead(narrative: Narrative): string {
  const title = `${headlineFor(narrative)} · Matterhorn`;
  const { missing, unsourced, hidden } = narrative.counts;
  const description =
    `${String(missing)} missing links · ${String(unsourced)} unsourced assumptions · ` +
    `${String(hidden)} hidden stakeholders. No verdicts. See the structure.`;
  const image = `${SITE_URL}${narrative.og.image_path ?? DEFAULT_OG}`;
  const tags: Array<[string, string]> = [
    ['og:title', title],
    ['og:description', description],
    ['og:image', image],
    ['og:url', `${SITE_URL}/n/${narrative.id}`],
  ];
  return tags.map(([property, content]) => `    <meta property="${property}" content="${esc(content)}" />\n`).join('');
}

/**
 * One shell: the SPA document with the permalink head folded into it. Taking the whole built
 * `index.html` rather than templating a new one is what keeps the bootstrap correct for free,
 * hashed filenames and all, on every build and in dev.
 */
export function permalinkShell(indexHtml: string, narrative: Narrative): string {
  return indexHtml
    .replace(/<title>[^<]*<\/title>/i, `<title>${esc(`${headlineFor(narrative)} · Matterhorn`)}</title>`)
    .replace('</head>', `\n${permalinkHead(narrative)}  </head>`);
}

/** Every narrative in a content root, in id order. Absent root, absent directory: no narratives. */
export function narrativesIn(contentRoot: string): Narrative[] {
  const dir = join(contentRoot, 'narratives');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => JSON.parse(readFileSync(join(dir, name), 'utf8')) as Narrative);
}

function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  const value = at === -1 ? undefined : process.argv[at + 1];
  if (at !== -1 && (value === undefined || value.startsWith('--'))) {
    console.error(`permalinks  fail  --${name} needs a value`);
    process.exit(2);
  }
  return resolve(REPO_ROOT, value ?? fallback);
}

function main(): void {
  const contentRoot = flag('content', 'content');
  const out = flag('out', join('app', 'dist'));
  const index = flag('index', join(out, 'index.html'));

  if (!existsSync(index)) {
    console.error(`permalinks  fail  ${index} does not exist: run \`vite build app\` first`);
    process.exit(1);
  }
  const indexHtml = readFileSync(index, 'utf8');
  const narratives = narrativesIn(contentRoot);

  for (const narrative of narratives) {
    const file = join(out, 'n', narrative.id, 'index.html');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, permalinkShell(indexHtml, narrative));
  }
  const where = narratives.length === 0 ? `${contentRoot} carries no narratives yet` : `${out}/n/{id}/index.html`;
  console.log(`permalinks  pass  ${String(narratives.length)} shell(s), ${where}`);
}

// Imported by app/vite.config.ts for the dev middleware, so the CLI half only runs when this
// file is the entry point.
if (process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url) main();
