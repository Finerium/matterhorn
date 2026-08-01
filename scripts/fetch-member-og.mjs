/**
 * Fetches og:image link previews for every family-member article in the snapshot registry.
 * Blueprint 7.3: fetched once with a desktop UA, resized to max 1200px wide, rendered only as
 * attributed link previews, honest fallback on failure. Writes:
 *   public/assets/og/members/{narrative}-m{i}.jpg
 *   scripts/.member-og-report.json   (per-URL outcome, consumed to extend og_attribution.json)
 *
 * Node script, no CLI flags: the registry is the input and the outcome report says everything.
 * Members marked `reconstructed` are skipped: their URL is a best-effort reconstruction, and
 * fetching a preview for a URL we are not sure exists would launder uncertainty into imagery.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const REPO = new URL('..', import.meta.url).pathname;
const OUT = join(REPO, 'public', 'assets', 'og', 'members');
mkdirSync(OUT, { recursive: true });

const UA_DESKTOP =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_ALT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const registry = JSON.parse(readFileSync(join(REPO, 'pipeline', 'snapshot', 'registry.json'), 'utf8'));

function curl(url, ua, extra = []) {
  return execFileSync(
    'curl',
    ['-sL', '--max-time', '45', '--compressed', '-A', ua, '-H', 'Accept-Language: id,en;q=0.8', ...extra, url],
    { maxBuffer: 32 * 1024 * 1024 },
  );
}

function ogImageOf(html) {
  const m =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

const report = [];
for (const narrative of registry.narratives) {
  let index = 0;
  for (const member of narrative.members ?? []) {
    index += 1;
    const id = `${narrative.id}-m${index}`;
    const entry = { id, narrative_id: narrative.id, member_url: member.url, outlet: member.outlet };
    if (member.reconstructed === true) {
      report.push({ ...entry, fallback: true, why: 'member URL is reconstructed; not fetched' });
      console.log(`skip  ${id} (reconstructed)`);
      continue;
    }
    try {
      let html = curl(member.url, UA_DESKTOP).toString('utf8');
      let og = ogImageOf(html);
      if (og === null) {
        html = curl(member.url, UA_ALT).toString('utf8');
        og = ogImageOf(html);
      }
      if (og === null) throw new Error('no og:image tag');
      const imageUrl = new URL(og, member.url).toString();
      const raw = curl(imageUrl, UA_DESKTOP, ['-H', `Referer: ${member.url}`]);
      if (raw.length < 4096) throw new Error(`image body ${raw.length} bytes, likely a block page`);
      const file = join(OUT, `${id}.jpg`);
      await sharp(raw).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(file);
      const kb = statSync(file).size / 1024;
      if (kb > 300) {
        await sharp(raw).resize({ width: 900, withoutEnlargement: true }).jpeg({ quality: 68 }).toFile(file);
      }
      report.push({ ...entry, fallback: false, image_path: `/assets/og/members/${id}.jpg`, image_url_original: imageUrl });
      console.log(`ok    ${id} ${(statSync(file).size / 1024).toFixed(0)}KB`);
    } catch (error) {
      rmSync(join(OUT, `${id}.jpg`), { force: true });
      report.push({ ...entry, fallback: true, why: String(error.message ?? error).slice(0, 120) });
      console.log(`fail  ${id}: ${String(error.message ?? error).slice(0, 80)}`);
    }
  }
}

writeFileSync(join(REPO, 'scripts', '.member-og-report.json'), `${JSON.stringify(report, null, 2)}\n`);
const ok = report.filter((r) => r.fallback === false).length;
console.log(`done: ${ok} fetched, ${report.length - ok} honest fallback(s), report at scripts/.member-og-report.json`);
