/**
 * PROVES: the static half of AC-APP-15. `pnpm token-audit`.
 *
 * "Zero elements keep light-theme colors" is a statement about two different things, and this
 * script is honest about which one it holds:
 *
 *   static, here      no painted colour is written as a literal outside app/src/tokens.css, so
 *                     there is no value that can only ever be light. Plus: every colour token
 *                     declared in the light block is declared in the dark block too, since a
 *                     token that exists in one and not the other silently paints the light value
 *                     on a dark page and no stylesheet reads as wrong.
 *   rendered, elsewhere  the dark screenshots of `dark.radar`, `dark.autopsy`, `dark.settings`,
 *                     `dark.methodology` and `dark.autopsy.evidence-sheet` in tests/e2e/matrix.spec.ts,
 *                     and the dark half of tests/e2e/a11y.spec.ts, which runs axe over nineteen
 *                     dark surfaces and would fail on any element that kept a light background
 *                     under dark text long before a human looked at the picture.
 *
 * Neither half is sufficient alone and this file does not pretend otherwise: a literal can be
 * correct (a phone notch is black on every theme) and a fully tokenised page can still be wrong
 * (a token pair whose dark value is unreadable). The pair is what covers the criterion.
 *
 * THE ALLOWLIST IS THE INTERESTING PART, so it is small, it is by rule rather than by file, and
 * every entry states why the surface must NOT follow the theme. A fixed-appearance surface is one
 * that reproduces something outside the product (an OS control, an OS dialog, phone hardware) or
 * leaves the product entirely (an exported image). Those are the only four reasons here. Anything
 * else that wants in has to argue for itself in this list, in public, in one line.
 *
 * Exit 0 when both checks hold. Exit 1 otherwise, one FAIL line per offending declaration.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const SRC = join(REPO_ROOT, 'app', 'src');
const TOKENS = join(SRC, 'tokens.css');

/** The light block and the dark block of tokens.css, matched on their exact selectors. */
const LIGHT_BLOCK = /^\.mth\s*\{([^}]*)\}/m;
const DARK_BLOCK = /^\.mth\[data-mth="dark"\]\s*\{([^}]*)\}/m;

/**
 * Properties that put a SURFACE colour on the screen: the class of value that has a light version
 * and a dark version and can therefore keep the wrong one. Three exclusions, each for a reason:
 *
 *   mask-image, -webkit-mask-image   a mask gradient's colour is an alpha ramp, never a paint.
 *     `linear-gradient(#000 84%, transparent)` means "fade out", not "draw black".
 *   box-shadow, text-shadow          a shadow is a depth cue composited at low alpha over whatever
 *     is beneath it. Black at 0.2 alpha is correct on a white card and on a near-black one; there
 *     is no light value for it to keep. The one shadow that does differ per theme is already the
 *     `--shadow` token, declared in both blocks.
 */
const PAINTS =
  /^(?:color|background|background-color|background-image|border|border-[a-z-]*color|border-[a-z]+|outline|outline-color|fill|stroke|text-decoration-color|caret-color|accent-color|-webkit-text-fill-color)$/;

/** A literal colour: hex, the functional notations, or one of the two absolute keywords. */
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\)|\b(?:white|black)\b/g;

/**
 * Rules whose colours must not follow the theme, each with the reason it must not.
 *
 * These are matched as substrings of the selector, so `.m-ios` covers `.m-ios-btn` and friends.
 */
const FIXED_APPEARANCE: Array<{ match: string; why: string }> = [
  { match: '.m-btn-apple', why: "Apple's sign-in button is an OS-branded control: black on white in both themes, by their guidelines" },
  { match: '.m-ios', why: 'the simulated iOS permission dialog reproduces an OS surface, and an OS surface does not read the app theme' },
  { match: '.m-nf-', why: 'the Nuance Card is an exported image that leaves the device, so it looks the same whichever theme it was exported from' },
  { match: '.m-l-phone::before', why: 'the phone notch is hardware: black on any theme' },
  { match: '.m-frame::before', why: 'the phone notch is hardware: black on any theme' },
  { match: '.m-scrim', why: 'a modal scrim dims what is behind it, so it is low-alpha black on both themes; that is what makes the sheet above it readable in either' },
  { match: '.m-frame::after', why: 'the wide-viewport frame scrim, same alpha-dim as .m-scrim and the same reason' },
];

interface Decl {
  file: string;
  selector: string;
  property: string;
  value: string;
}

function cssFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...cssFiles(path));
    else if (name.endsWith('.css') && path !== TOKENS) out.push(path);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Every declaration in a stylesheet, with the selector it belongs to.
 *
 * A hand-rolled scan rather than a CSS parser dependency: the whole grammar this needs is
 * "text before `{` is a selector, `a: b;` inside is a declaration", and at-rule blocks nest one
 * level here at most. Comments are stripped first so a colour inside one is not a finding.
 */
function declarations(file: string): Decl[] {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Decl[] = [];
  const stack: string[] = [];
  let buffer = '';
  for (const char of css) {
    if (char === '{') {
      stack.push(buffer.trim().replace(/\s+/g, ' '));
      buffer = '';
    } else if (char === '}') {
      flush(buffer, stack, file, out);
      buffer = '';
      stack.pop();
    } else if (char === ';') {
      flush(buffer, stack, file, out);
      buffer = '';
    } else {
      buffer += char;
    }
  }
  return out;
}

function flush(buffer: string, stack: string[], file: string, out: Decl[]): void {
  const colon = buffer.indexOf(':');
  if (stack.length === 0 || colon === -1) return;
  const property = buffer.slice(0, colon).trim();
  const value = buffer.slice(colon + 1).trim();
  if (property === '' || value === '') return;
  // The innermost non-at-rule frame is the selector; an @media or @supports wrapper is not one.
  const selector = [...stack].reverse().find((frame) => !frame.startsWith('@')) ?? '';
  out.push({ file, selector, property, value });
}

const themed = (selector: string): boolean => selector.includes('[data-mth=');
const fixed = (selector: string): { match: string; why: string } | undefined =>
  FIXED_APPEARANCE.find((entry) => selector.includes(entry.match));

function main(): void {
  const failures: string[] = [];

  // --- check 1: no painted literal outside tokens.css, outside a theme scope --------------
  const exempt = new Map<string, number>();
  for (const file of cssFiles(SRC)) {
    for (const decl of declarations(file)) {
      if (!PAINTS.test(decl.property)) continue;
      const literals = decl.value.match(LITERAL) ?? [];
      if (literals.length === 0) continue;
      if (themed(decl.selector)) continue;
      const allow = fixed(decl.selector);
      if (allow !== undefined) {
        exempt.set(allow.match, (exempt.get(allow.match) ?? 0) + literals.length);
        continue;
      }
      failures.push(
        `${relative(REPO_ROOT, file)}  ${decl.selector} { ${decl.property}: ${decl.value} }  ` +
          `literal ${literals.join(', ')} is outside tokens.css and outside a [data-mth] scope, so dark theme cannot change it`,
      );
    }
  }

  // --- check 2: every colour token exists in both blocks -----------------------------------
  const tokensCss = readFileSync(TOKENS, 'utf8');
  const names = (block: RegExp): Set<string> => {
    const body = block.exec(tokensCss)?.[1] ?? '';
    if (body === '') {
      console.error(`token-audit  fail  ${relative(REPO_ROOT, TOKENS)} has no ${String(block)} block`);
      process.exit(1);
    }
    return new Set([...body.matchAll(/(--[A-Za-z][A-Za-z0-9-]*)\s*:/g)].map((m) => m[1] ?? ''));
  };
  const light = names(LIGHT_BLOCK);
  const dark = names(DARK_BLOCK);
  for (const token of light) {
    if (!dark.has(token)) failures.push(`app/src/tokens.css  ${token} is declared light-only, so dark theme inherits the light value`);
  }
  for (const token of dark) {
    if (!light.has(token)) failures.push(`app/src/tokens.css  ${token} is declared dark-only, so light theme inherits nothing`);
  }

  console.log('');
  console.log(`token-audit  ${String(light.size)} token(s), light and dark blocks in step`);
  for (const entry of FIXED_APPEARANCE) {
    const used = exempt.get(entry.match) ?? 0;
    console.log(`  fixed appearance  ${entry.match.padEnd(18)} ${String(used).padStart(2)} literal(s): ${entry.why}`);
  }

  console.log('');
  if (failures.length > 0) {
    for (const line of failures) console.error(`FAIL ${line}`);
    console.error(`FAIL ${String(failures.length)} dark-parity finding(s) (AC-APP-15).`);
    process.exit(1);
  }
  console.log('OK: no light-theme literal paints outside a theme scope, and every token has a dark value (AC-APP-15).');
}

main();
