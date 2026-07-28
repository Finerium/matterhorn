/**
 * The i18n key scan: `pnpm i18n:scan`. Exit 0 only when the bundles and the code agree.
 *
 * Three failures, all of them silent otherwise:
 *   drift     a key in one locale bundle and not the other. `en.json` is typed through
 *             `keyof typeof en`, so TypeScript catches a bad lookup; nothing catches an ID
 *             rendition that was never written.
 *   missing   a `t('...')` call naming a key no bundle declares.
 *   unused    a declared key no module ever names. Dead copy rots: it stops being reviewed and
 *             then ships when someone wires it back up.
 *
 * ponytail: a text scan, not a parse. A key counts as used if its exact string appears as a
 * literal anywhere under app/src, because keys travel as bare literals through typed tables
 * (`Record<Tab, Key>`) and JSX attributes as often as through a `t()` call. Ceiling: a key
 * mentioned only inside a comment reads as used. Swap in a real AST walk if that ever bites.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const APP_SRC = resolve(process.cwd(), 'app', 'src');
const I18N = join(APP_SRC, 'i18n');

const bundle = (locale: string): Record<string, string> =>
  JSON.parse(readFileSync(join(I18N, `${locale}.json`), 'utf8')) as Record<string, string>;

const sources = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((rel) => /\.tsx?$/.test(rel) && statSync(join(dir, rel)).isFile())
    .sort((a, b) => a.localeCompare(b));

/** `t('key')`, in either quote style. The only call shape that names a key dynamically. */
const T_CALL = /\bt\(\s*['"]([^'"]+)['"]/g;

const en = bundle('en');
const id = bundle('id');
const declared = new Set([...Object.keys(en), ...Object.keys(id)]);

const failures: string[] = [];

for (const key of declared) {
  if (!(key in en)) failures.push(`drift    "${key}" is in id.json and not in en.json`);
  if (!(key in id)) failures.push(`drift    "${key}" is in en.json and not in id.json`);
}

const used = new Set<string>();
for (const rel of sources(APP_SRC)) {
  const text = readFileSync(join(APP_SRC, rel), 'utf8');
  for (const key of declared) {
    if (text.includes(`'${key}'`) || text.includes(`"${key}"`)) used.add(key);
  }
  for (const match of text.matchAll(T_CALL)) {
    const key = match[1] ?? '';
    if (!declared.has(key)) failures.push(`missing  ${rel} calls t("${key}"), which no bundle declares`);
  }
}

for (const key of [...declared].sort()) {
  if (!used.has(key)) failures.push(`unused   "${key}" is declared and never named under app/src`);
}

const total = declared.size;
if (failures.length === 0) {
  console.log(`i18n  pass  ${String(total)} key(s), en and id in step, all used`);
  process.exit(0);
}
console.error(`i18n  fail  ${String(total)} key(s), ${String(failures.length)} problem(s)`);
for (const line of failures.sort()) console.error(`  ${line}`);
process.exit(1);
