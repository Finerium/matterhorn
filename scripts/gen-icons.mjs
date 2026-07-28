/**
 * Generates the PWA icon set from the M wordmark. `node scripts/gen-icons.mjs`.
 *
 * The motif is the product's: two strokes and a peak, ink on paper, the same two hex values the
 * design tokens carry. Four files, which is exactly what blueprint 6.7 freezes into the
 * manifest: 192 and 512, each in an `any` and a `maskable` cut. The maskable cut draws the
 * glyph smaller so the whole of it survives a circular or squircle mask (the safe zone is the
 * central 80 percent).
 *
 * Output is committed under app/public/icons, so a build never depends on this having run.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'public', 'icons');
const PAPER = '#F2F1EC';
const INK = '#1C1B17';

/** `scale` is how much of the 512 canvas the glyph takes; 1 spans about half of it. */
const wordmark = (size, scale) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" fill="${PAPER}"/>
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
<path d="M148 358V154l108 134 108-134v204" fill="none" stroke="${INK}" stroke-width="44" stroke-linecap="round" stroke-linejoin="round"/>
</g>
</svg>`;

const FILES = [
  ['icon-192.png', 192, 1.35],
  ['icon-512.png', 512, 1.35],
  ['maskable-192.png', 192, 1.0],
  ['maskable-512.png', 512, 1.0],
];

await mkdir(OUT, { recursive: true });
for (const [name, size, scale] of FILES) {
  const png = await sharp(Buffer.from(wordmark(size, scale))).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(join(OUT, name), png);
  console.log(`${name}  ${size}x${size}  ${png.length} bytes`);
}
