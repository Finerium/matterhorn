/**
 * PROVES: AC-LAND-1, and the hardcoded-slot half of AC-LAND-3.
 *
 *   pnpm check:landing-copy [--blueprint <path>] [--module <path>]
 *
 * `tests/e2e/landing-copy.spec.ts` asserts that what renders equals what `app/src/landing/copy.ts`
 * holds. That proves the wiring and nothing about the words, because there the module is both the
 * source and the expectation: a mistyped frozen string passes green. This script is the other
 * half. It parses Section 4.4 out of the blueprint, extracts every frozen string, and diffs those
 * against the values the module exports. One direction only, blueprint to module: the blueprint is
 * the authority and the module is the thing under test. No frozen string is ever typed in here.
 *
 * Three failure classes, all exit 1:
 *   mismatch  a module value carries a near-copy of a frozen string. Both versions are printed,
 *             with the character the two stop agreeing at.
 *   missing   nothing in the module covers a frozen string. This is the one a value-by-value
 *             comparison cannot see, because there is no value to compare against.
 *   slot      the blueprint writes `{gov}` and the module wrote a number there. AC-LAND-3.
 *
 * Matching is loose about structure and strict about characters. The module is free to cut a
 * blueprint line into fields (a case card into era, title, body, sources), so a frozen string may
 * be covered by several module values in sequence and the separators between them (whitespace and
 * `· . , ; : / ( ) &`) may be dropped. Every other character is mandatory and exact, case
 * included, so a typo, a substituted comma, or a curly apostrophe fails. A `{slot}` matches any
 * brace-shaped placeholder, whatever it is named, and nothing else.
 *
 * ponytail: the search is unanchored, so a module value that carries the frozen string plus
 * trailing words still passes. Anchoring it would flag every legitimate field split instead.
 * Ceiling: additions at the two ends of a string are invisible here, the e2e screenshots see those.
 * Second ceiling: this asks whether the module carries a frozen string, not how many times. 4.4
 * writes the tagline twice and the module holds it twice, so a typo in one of the two copies reads
 * as carried. That count is AC-LAND-2's job, and it greps for it.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '..');

// --- the blueprint side -----------------------------------------------------------------

/**
 * `Label: value`, with an optional parenthetical aside on the label. A label carries no `.` and
 * no `;`, which is what keeps the direction paragraphs of 4.4 (and its closing rule about video
 * links and C3) out of the copy set without naming them.
 */
const LABEL = /^([A-Z][A-Za-z0-9, -]{0,30}?)(?:\s*\([^)]*\))?:\s+(\S.*)$/;

/** Line-start labels whose value is direction to the builder, never rendered copy. */
const SKIP_LABELS = new Set(['register', 'set piece']);

/**
 * Mid-line labels that name a field inside one line. The label word itself is structure, so it is
 * dropped with the split: `Sources: Komnas HAM` is checked as `Komnas HAM`, because a module is
 * free to hold the list and let the renderer write the word. Any other `Word: ` in a value is
 * copy and stays (`Launch packs: Indonesia, in depth`, `Figures: Kemenkeu realisasi May 2026`).
 */
const FIELD = /(?<=\. )(CTA secondary|Microlines|Microline|Links|Button|Mobile|Body|Sources): (?=\S)/;

/** Field values that are direction rather than copy, keyed by the field label. */
const SKIP_FIELDS = new Set(['Mobile']);

/** A parenthetical holding a code span is a route note, not copy: `Button: Open Matterhorn (to /app)`. */
const ROUTE_NOTE = /\s*\([^)]*`[^)]*\)/g;

const norm = (s: string): string => s.normalize('NFC').replace(/\s+/g, ' ').trim();

interface Frozen {
  where: string;
  text: string;
}

/** Every frozen string in Section 4.4, in document order, deduped by text. */
function frozenStrings(md: string): Frozen[] {
  const lines = md.split(/\r?\n/);
  const start = lines.findIndex((l) => /^### 4\.4 /.test(l));
  if (start < 0) fatal('the blueprint has no `### 4.4` heading, so there is nothing to check against');
  let end = start + 1;
  while (end < lines.length && !/^#{1,3} /.test(lines[end] ?? '')) end += 1;

  const found = new Map<string, Frozen>();
  let heading = '4.4';
  for (const line of lines.slice(start + 1, end)) {
    const sub = /^#### (.*)$/.exec(line);
    if (sub !== null) {
      heading = (sub[1] ?? '').replace(/\s*\(anchor:[^)]*\)/, '');
      continue;
    }
    const m = LABEL.exec(line);
    if (m === null) continue;
    const label = m[1] ?? '';
    if (SKIP_LABELS.has(label.toLowerCase())) continue;
    for (const piece of pieces(m[2] ?? '')) {
      for (const text of piece.texts) {
        const where = `${heading} · ${piece.label === '' ? label : piece.label}`;
        if (text.length > 1 && !found.has(text)) found.set(text, { where, text });
      }
    }
  }
  return [...found.values()];
}

/**
 * One blueprint line to the frozen strings it holds. Splitting a line into contiguous pieces only
 * ever makes the check finer, never wrong, because each piece is still matched as a run of the
 * original. Quoted spans win: in `count chips "{missing} missing link"` the words outside the
 * quotes name the element and the words inside it are the copy.
 *
 * ` · ` splits too. It is 4.4's list separator and no module can be held to it: nav links are an
 * array and the interpunct between them belongs to the layout, so the items are what there is to
 * check. Ceiling: the order of a `·` list, and the glyph itself, are not verified here.
 */
function pieces(value: string): Array<{ label: string; texts: string[] }> {
  const out: Array<{ label: string; texts: string[] }> = [];
  let label = ''; // held across ` / `, whose items belong to the field label that opened the list
  for (const part of value.replace(ROUTE_NOTE, '').split(' / ')) {
    // split() with one capture group alternates value, label, value, label, value.
    const split = part.split(FIELD);
    for (let i = 0; i < split.length; i += 2) {
      if (i > 0) label = split[i - 1] ?? '';
      const text = split[i] ?? '';
      if (SKIP_FIELDS.has(label)) continue;
      // Quotes are read before interpuncts, or a `·` inside a quoted label would break the pair.
      const quoted = [...text.matchAll(/"([^"]*)"/g)].map((q) => q[1] ?? '');
      out.push({ label, texts: (quoted.length > 0 ? quoted : [text]).flatMap((t) => t.split(' · ')).map(norm) });
    }
  }
  return out;
}

// --- the module side --------------------------------------------------------------------

/**
 * Every string the module exports, in export order, numbers included: a card index may be one.
 *
 * A slot descriptor is read back as the brace form the blueprint writes, so a module that holds
 * `{ slot: 'gov' }` compares equal to 4.4's `{gov}` and a module that typed `4` there does not.
 * That is the whole of the slot skeleton: the name is the module's business, the hole is not.
 */
async function moduleValues(file: string): Promise<string[]> {
  const ns: unknown = await import(pathToFileURL(file).href);
  const out: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(norm(v));
    else if (typeof v === 'number') out.push(String(v));
    else if (Array.isArray(v)) for (const item of v) walk(item);
    else if (typeof v === 'object' && v !== null) {
      const slot: unknown = (v as Record<string, unknown>)['slot'];
      if (typeof slot === 'string') out.push(`{${slot}}`);
      else for (const item of Object.values(v)) walk(item);
    }
  };
  walk(ns);
  return out;
}

// --- matching ---------------------------------------------------------------------------

/** Dropped when the module splits a line into fields, so optional. Everything else is exact. */
const SEPARATOR = /[\s·.,;:/()&]/;
const SLOT = /\{[A-Za-z_][A-Za-z0-9_]*\}/;
/** What a slot may have become and still be a slot: a hole with any name in it. */
const SLOT_SHAPE = /\{[^{}]{1,32}\}/;
const esc = (c: string): string => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The frozen string as a pattern over the module's concatenated values. Values are joined with
 * nothing, so a field boundary costs no characters and needs no special case here.
 */
function pattern(text: string): { re: RegExp; slots: string[] } {
  const slots: string[] = [];
  let src = '';
  for (const token of text.split(new RegExp(`(${SLOT.source})`))) {
    if (SLOT.test(token) && token.startsWith('{')) {
      slots.push(token);
      // Either a placeholder of any name, or the single bare token that replaced it.
      src += `(${SLOT_SHAPE.source}|[^\\s]{1,24})`;
      continue;
    }
    for (const c of token) src += SEPARATOR.test(c) ? `(?:${esc(c)})?` : esc(c);
  }
  return { re: new RegExp(src, 'g'), slots };
}

const words = (s: string): string[] => s.toLowerCase().split(/[^a-z0-9{}]+/).filter((w) => w !== '');

/** The module value that looks most like this frozen string, for the report. */
function nearest(text: string, values: string[]): { value: string; score: number } {
  const wanted = new Set(words(text));
  let best = { value: '', score: 0 };
  for (const value of values) {
    const has = words(value);
    if (has.length === 0) continue;
    const score = has.filter((w) => wanted.has(w)).length / Math.max(wanted.size, has.length);
    if (score > best.score) best = { value, score };
  }
  return best;
}

/** Where two versions of a string stop agreeing, with enough either side to see it. */
function divergence(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  const window = (s: string): string => `${i > 24 ? '...' : ''}${s.slice(Math.max(0, i - 24), i + 24)}${i + 24 < s.length ? '...' : ''}`;
  return `differ at char ${String(i + 1)}: blueprint "${window(a)}" module "${window(b)}"`;
}

// --- the run ----------------------------------------------------------------------------

type Kind = 'mismatch' | 'missing' | 'slot';
interface Problem {
  kind: Kind;
  where: string;
  lines: string[];
}

function check(frozen: Frozen, values: string[], haystack: string): Problem | undefined {
  const { re, slots } = pattern(frozen.text);
  // Every match, not the first: a short frozen string can land on an accidental earlier reading of
  // the concatenation, and only a match with its slots still slots proves the line was transcribed.
  let filled: { text: string; hardcoded: string[] } | undefined;
  for (let m = re.exec(haystack); m !== null; m = re.exec(haystack)) {
    if (m[0] === '') re.lastIndex += 1;
    const hardcoded = slots.filter((_, i) => !SLOT_SHAPE.test(m?.[i + 1] ?? ''));
    if (hardcoded.length === 0) return undefined;
    filled ??= { text: m[0], hardcoded };
  }
  if (filled !== undefined) {
    return {
      kind: 'slot',
      where: frozen.where,
      lines: [
        `blueprint: ${frozen.text}`,
        `module:    ${filled.text}`,
        `${filled.hardcoded.join(', ')} resolved to a literal in the module. AC-LAND-3 binds these to published content at build.`,
      ],
    };
  }
  const near = nearest(frozen.text, values);
  if (near.score >= 0.34) {
    return {
      kind: 'mismatch',
      where: frozen.where,
      lines: [`blueprint: ${frozen.text}`, `module:    ${near.value}`, divergence(frozen.text, near.value)],
    };
  }
  return {
    kind: 'missing',
    where: frozen.where,
    lines: [
      `blueprint: ${frozen.text}`,
      near.score >= 0.15 ? `module:    nothing carries it, closest is "${near.value}"` : 'module:    nothing carries it',
    ],
  };
}

function fatal(message: string): never {
  console.error(`check:landing-copy  fail  ${message}`);
  process.exit(1);
}

function usage(message: string): never {
  console.error(`check-landing-copy: ${message}`);
  console.error('usage: tsx scripts/check-landing-copy.ts [--blueprint <path>] [--module <path>]');
  process.exit(2);
}

function parseArgs(argv: string[]): { blueprint: string; module: string } {
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? '';
    const value = argv[i + 1];
    if (flag !== '--blueprint' && flag !== '--module') usage(`unknown argument "${flag}"`);
    if (value === undefined || value.startsWith('--')) usage(`${flag} needs a path`);
    if (flags.has(flag)) usage(`${flag} was given twice`);
    flags.set(flag, value);
  }
  return {
    blueprint: resolve(flags.get('--blueprint') ?? resolve(REPO_ROOT, '..', 'blueprint-matterhorn.md')),
    module: resolve(flags.get('--module') ?? resolve(REPO_ROOT, 'app', 'src', 'landing', 'copy.ts')),
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const label = (p: string): string => {
    const inRepo = relative(REPO_ROOT, p);
    return inRepo !== '' && !inRepo.startsWith('..') ? inRepo : p;
  };
  if (!existsSync(args.blueprint)) usage(`${args.blueprint} does not exist`);

  const frozen = frozenStrings(readFileSync(args.blueprint, 'utf8'));
  const total = String(frozen.length);
  if (!existsSync(args.module)) {
    fatal(`${label(args.module)} does not exist, and ${total} frozen string(s) in blueprint 4.4 have nowhere to land`);
  }

  const values = await moduleValues(args.module).catch((err: unknown) => {
    fatal(`${label(args.module)} would not import: ${err instanceof Error ? err.message : String(err)}`);
  });
  const haystack = values.join('');
  const problems = frozen.map((f) => check(f, values, haystack)).filter((p): p is Problem => p !== undefined);
  const slotted = frozen.filter((f) => SLOT.test(f.text)).length;

  if (problems.length === 0) {
    console.log(
      `check:landing-copy  pass  ${total} frozen string(s) of blueprint 4.4 (${String(slotted)} with slots) all carried by ${label(args.module)}, ${String(values.length)} value(s)`,
    );
    return;
  }
  console.error(
    `check:landing-copy  fail  ${total} frozen string(s) of blueprint 4.4, ${String(problems.length)} not transcribed faithfully into ${label(args.module)}`,
  );
  for (const p of problems) {
    console.error('');
    console.error(`FAIL ${p.kind.padEnd(8)} ${p.where}`);
    for (const line of p.lines) console.error(`  ${line}`);
  }
  process.exit(1);
}

await main();
