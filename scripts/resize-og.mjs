/**
 * 480w variants of the narrative og images, for the card's srcset (AC-LAND-11).
 *
 * Derivatives only: every source file here is already fetched, attributed in
 * content/og_attribution.json, and covered in LICENSES.md; a resize introduces no new work to
 * license. check-licenses covers `{id}-480.jpg` through the same record as `{id}.jpg`.
 * Idempotent: an existing variant newer than its source is left alone.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const DIR = new URL('../public/assets/og', import.meta.url).pathname;

for (const name of readdirSync(DIR)) {
  if (!name.endsWith('.jpg') || name.endsWith('-480.jpg')) continue;
  const source = join(DIR, name);
  if (!statSync(source).isFile()) continue;
  const target = join(DIR, name.replace(/\.jpg$/, '-480.jpg'));
  if (existsSync(target) && statSync(target).mtimeMs >= statSync(source).mtimeMs) continue;
  const { width } = await sharp(source).metadata();
  await sharp(source)
    .resize({ width: Math.min(480, width ?? 480) })
    .jpeg({ quality: 78 })
    .toFile(target);
  console.log(`${name} -> ${target.split('/').pop()}`);
}
