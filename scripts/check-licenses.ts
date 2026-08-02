/**
 * The LICENSES completeness gate: `pnpm check:licenses`. AC-SEC-5, and the second half of
 * AC-LAND-11.
 *
 *   pnpm check:licenses            checks every asset dir
 *   pnpm check:licenses --list     prints the coverage table and exits 0 regardless
 *
 * Three questions, asked over every asset directory in the repo rather than over a hardcoded
 * list of the ones we happened to have on the day this was written:
 *
 *   1. Is the directory itself named in LICENSES.md? A new directory nobody documented is the
 *      failure this gate exists for, and a per-file check alone would miss it: an undocumented
 *      directory has no rows to be missing.
 *   2. Does every file in it have a row? A row is any line of LICENSES.md that names the file.
 *      `content/og_attribution.json` counts as rows too: the outlet og:images are recorded there
 *      per narrative, by design (7.3, C7), and LICENSES.md points at it rather than duplicating
 *      eleven columns of provenance. One file, one record, either register.
 *   3. Does every row point at a file that still exists? Without this the table rots the other
 *      way: an asset is renamed, the old row lingers, and the gate keeps passing on a document
 *      that describes files nobody ships.
 *
 * Exit 0 only when all three hold for every directory. Exit 1 otherwise, one FAIL line per
 * offending file or row on stderr, and the coverage table on stdout either way.
 *
 * ponytail: no license-text parsing and no SPDX validation. This gate answers "is every shipped
 * byte accounted for", which is the question AC-SEC-5 asks. Whether CC BY-SA 4.0 is the right
 * license for a given file is an editorial judgement a script cannot make, and LICENSES.md
 * records the reasoning per row for a human to check.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, posix, relative, resolve, sep } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const LICENSES = join(REPO_ROOT, 'LICENSES.md');
const OG_REGISTRY = join(REPO_ROOT, 'content', 'og_attribution.json');

/**
 * Where shipped, non-code bytes live. `public/assets` is the repo-root asset store; `app/public`
 * is vite's publicDir, copied verbatim into the dist. Anything else under these roots is found by
 * walking, so a new subdirectory is covered the moment it exists.
 */
const ASSET_ROOTS = ['public/assets', 'app/public'];

/** Files a licence question can be asked about. Source and data files are not assets. */
const ASSET_EXT = /\.(?:png|jpg|jpeg|webp|avif|gif|svg|ico|mp4|webm|woff2?|ttf|otf)$/i;

interface Found {
  /** Repo-relative, POSIX, e.g. `public/assets/land/hero-ridgeline.jpg`. */
  rel: string;
  dir: string;
  name: string;
  bytes: number;
}

function walk(root: string, into: Found[] = []): Found[] {
  const abs = join(REPO_ROOT, root);
  if (!existsSync(abs)) return into;
  for (const entry of readdirSync(abs, { recursive: true }).map(String)) {
    const file = join(abs, entry);
    if (!statSync(file).isFile() || !ASSET_EXT.test(entry)) continue;
    const rel = relative(REPO_ROOT, file).split(sep).join(posix.sep);
    into.push({ rel, dir: posix.dirname(rel), name: basename(rel), bytes: statSync(file).size });
  }
  return into;
}

/**
 * Every filename LICENSES.md carries as a ROW: a markdown table line whose first cell is a
 * filename. Deliberately not "every filename in the document": the Source-page column holds URLs
 * that end in the ORIGINAL upstream filename (Matterhorn_south_and_east_face.jpg), and counting
 * those as rows would make check 3 report six phantom gaps on a table that is in fact correct.
 * A row is the first cell, which is the only cell that names a file we ship.
 */
function namesIn(text: string): Set<string> {
  const names = new Set<string>();
  for (const line of text.split('\n')) {
    const first = /^\s*\|([^|]+)\|/.exec(line)?.[1]?.trim() ?? '';
    if (ASSET_EXT.test(first)) names.add(first);
  }
  return names;
}

interface Failure {
  where: string;
  message: string;
}

function main(): void {
  const listOnly = process.argv.includes('--list');
  if (!existsSync(LICENSES)) {
    console.error('check:licenses  fail  LICENSES.md does not exist');
    process.exit(1);
  }
  const doc = readFileSync(LICENSES, 'utf8');
  const documented = namesIn(doc);

  // The og:image register. Its records are keyed by narrative, and the files are named for the
  // narrative they belong to, which is the join.
  const ogIds = new Set<string>();
  if (existsSync(OG_REGISTRY)) {
    const registry = JSON.parse(readFileSync(OG_REGISTRY, 'utf8')) as {
      entries?: Array<{ narrative_id?: string; image_path?: string | null }>;
    };
    for (const entry of registry.entries ?? []) {
      if (entry.narrative_id !== undefined) ogIds.add(entry.narrative_id);
      // Member link previews are recorded with an explicit staged path; the file is covered by
      // the entry that names it, not by a filename convention.
      if (typeof entry.image_path === 'string') {
        ogIds.add(basename(entry.image_path).replace(/\.[^.]+$/, ''));
      }
    }
  }
  // A `-480` suffix marks a resized derivative (scripts/resize-og.mjs): same image, same
  // licence, covered by the original's record.
  const covered = (file: Found): boolean =>
    documented.has(file.name) || ogIds.has(file.name.replace(/\.[^.]+$/, '').replace(/-480$/, ''));

  const files = ASSET_ROOTS.flatMap((root) => walk(root)).sort((a, b) => a.rel.localeCompare(b.rel));
  const dirs = [...new Set(files.map((f) => f.dir))].sort((a, b) => a.localeCompare(b));
  const failures: Failure[] = [];

  // 1. every directory is named in LICENSES.md
  for (const dir of dirs) {
    if (!doc.includes(dir)) {
      failures.push({ where: `${dir}/`, message: 'asset directory is not named anywhere in LICENSES.md' });
    }
  }

  // 2. every file has a row
  for (const file of files) {
    if (!covered(file)) {
      failures.push({ where: file.rel, message: 'no LICENSES.md row and no og_attribution.json record' });
    }
  }

  // 3. every row points at a file that exists
  const onDisk = new Set(files.map((f) => f.name));
  for (const name of documented) {
    if (!onDisk.has(name)) {
      failures.push({ where: `LICENSES.md ${name}`, message: 'row names a file that is not in any asset directory' });
    }
  }

  const rows = dirs.map((dir) => {
    const own = files.filter((f) => f.dir === dir);
    const missing = own.filter((f) => !covered(f)).length;
    return {
      dir: `${dir}/`,
      status: missing === 0 && doc.includes(dir) ? 'pass' : 'fail',
      detail: `${String(own.length - missing)}/${String(own.length)} file(s) covered, ${String(
        Math.round(own.reduce((sum, f) => sum + f.bytes, 0) / 1024),
      )} KB total`,
    };
  });
  const width = Math.max(...rows.map((r) => r.dir.length), 'DIRECTORY'.length);
  console.log(`check:licenses  ${String(files.length)} asset file(s) in ${String(dirs.length)} directory/directories`);
  console.log('');
  console.log(`${'DIRECTORY'.padEnd(width)}  STATUS  DETAIL`);
  for (const r of rows) console.log(`${r.dir.padEnd(width)}  ${r.status.padEnd(6)}  ${r.detail}`);

  if (failures.length > 0 && !listOnly) {
    console.error('');
    for (const f of failures) console.error(`FAIL licenses ${f.where}: ${f.message}`);
    console.error(`FAIL ${String(failures.length)} licence gap(s); every asset file needs a row in LICENSES.md`);
    process.exit(1);
  }
  console.log('');
  console.log(`OK: every asset file under ${ASSET_ROOTS.map((r) => `${r}/`).join(' and ')} has a licence record.`);
}

main();
