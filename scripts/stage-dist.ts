/**
 * Stages the two trees Vite does not own into the built app: `content/` and `public/assets/`.
 *
 *   tsx scripts/stage-dist.ts [--content <dir>] [--assets <dir>] [--out <dist dir>]
 *
 * Vite's publicDir is `app/public`, which holds the icons and the manifest. The published
 * artifacts and the licensed imagery live at the repo root instead, because neither is the
 * app's: `content/` is written by the pipeline and read by every surface, and `public/assets/`
 * is fetched once at Phase 0 and carries a LICENSES row per file. Pointing Vite's publicDir at
 * the repo root to pick them up would sweep the whole repo into the bundle.
 *
 * Until this existed the copy lived in three Playwright configs, each with a comment saying it
 * could go once the deploy gate landed it, and a production build therefore served an app whose
 * every content fetch 404s. That is the failure this closes: the app builds clean, deploys
 * clean, and is empty.
 *
 * Strict argv, same contract as the other scripts here: an unknown flag exits 2.
 */
import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

function usage(message: string): never {
  console.error(`stage-dist: ${message}`);
  console.error('usage: tsx scripts/stage-dist.ts [--content <dir>] [--assets <dir>] [--out <dist dir>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { content: string; assets: string; out: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--content' && flag !== '--assets' && flag !== '--out') usage(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usage(`${flag} needs a value`);
    if (flags.has(flag)) usage(`${flag} was given twice`);
    flags.set(flag, value);
  }
  return {
    content: resolve(flags.get('--content') ?? 'content'),
    assets: resolve(flags.get('--assets') ?? 'public/assets'),
    out: resolve(flags.get('--out') ?? 'app/dist'),
  };
}

/** Bytes under a directory, recursively. Reported so a silent partial copy is visible. */
function treeSize(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = treeSize(path);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

function stage(from: string, to: string, label: string): { files: number; bytes: number } {
  if (!existsSync(from)) usage(`${label} directory ${from} does not exist`);
  // Replace rather than merge: a stale artifact left from an earlier build is a file the
  // validator never saw and nobody meant to publish.
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  return treeSize(to);
}

/**
 * `public/assets/` and Vite's output directory are BOTH called `assets`, and the artifacts
 * address the imagery absolutely (`/assets/og/mbg-stop.jpg`), so the two have to share the
 * path. Replacing `dist/assets` wholesale therefore deletes every hashed chunk Vite just
 * emitted, which is exactly what happened the first time this ran: the build check caught it
 * by finding the precache manifest listing files no longer on disk. So each SUBTREE of
 * `public/assets` is replaced individually and Vite's siblings are left alone.
 */
function stageAssetSubtrees(from: string, outAssets: string): { files: number; bytes: number } {
  if (!existsSync(from)) usage(`assets directory ${from} does not exist`);
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sub = stage(join(from, entry.name), join(outAssets, entry.name), `assets/${entry.name}`);
    files += sub.files;
    bytes += sub.bytes;
  }
  return { files, bytes };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.out)) usage(`${args.out} does not exist: run the app build first`);

  const content = stage(args.content, join(args.out, 'content'), 'content');
  const assets = stageAssetSubtrees(args.assets, join(args.out, 'assets'));

  console.log(
    `stage-dist: content ${String(content.files)} file(s) ${mb(content.bytes)}, ` +
      `assets ${String(assets.files)} file(s) ${mb(assets.bytes)} -> ${args.out}`,
  );
}

main();
