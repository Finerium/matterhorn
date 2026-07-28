/**
 * Gate 1 fix loop: the five holes a reviewer found in scripts/validate-content.ts.
 *
 * Every case here is RED against today's validator. Four of them hand it a content root it
 * currently exits 0 on and demand exit 1; the fifth demands a CLI flag that does not exist
 * yet. One positive control is GREEN today and must stay green, because four of these five
 * fixes are easy to over-apply.
 *
 * Style follows tests/unit/validator-checks.spec.ts: the same runValidator and expectFailure
 * helpers, assertions on the check slug plus a distinctive filename fragment on ONE output
 * line, never on whole sentences. Wording and table layout stay the implementer's business.
 *
 * FIXTURES, AND THE ORDER TO MOVE THEM IN. The roots ship in
 * staging/fixtures-fix/validator-fix/, built and stamped by
 * staging/fixtures-fix/generate-fix-tokens.mjs. `F` below is written as their post-move home,
 * so the migration is two moves and no edit: the roots to tests/fixtures/validator-fix/, this
 * file to tests/unit/. Move the roots FIRST. vitest's default glob collects staging/ as well
 * as tests/, so this file runs the moment it lands, and until the roots are in place every
 * case here fails on a content root that does not exist rather than on the hole it pins, the
 * positive control included. That is noise, not signal. Regenerate after editing any fixture
 * datum, because every root carries real gate tokens stamped over its own bytes.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const F = 'tests/fixtures/validator-fix';
/** The shared good root of the existing suite, used as the passing --dir for the scan cases. */
const GOOD = 'tests/fixtures/validator/good';
/** One `pnpm exec tsx` spawn per run; generous so a cold start is never a flake. */
const T = 60_000;

interface Run {
  code: number;
  stdout: string;
  stderr: string;
  /** stdout and stderr concatenated, which is where assertions look. */
  out: string;
}

function runValidator(dir: string, ...extra: string[]): Run {
  try {
    const stdout = execFileSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/validate-content.ts', '--dir', dir, ...extra],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    return { code: 0, stdout, stderr: '', out: stdout };
  } catch (e) {
    const err = e as { status: number | null; stdout: string; stderr: string };
    const stdout = String(err.stdout ?? '');
    const stderr = String(err.stderr ?? '');
    return { code: err.status ?? -1, stdout, stderr, out: `${stdout}\n${stderr}` };
  }
}

/**
 * The run failed, and some single line of output names both the failing check slug and the
 * offending file. One line, because a slug in the table and a filename ten rows away is not
 * a report of anything.
 */
function expectFailure(run: Run, slug: string, fileFragment: string): void {
  expect(run.code, `expected exit 1\n${run.out}`).toBe(1);
  const line = run.out.split('\n').find((l) => l.includes(slug) && l.includes(fileFragment));
  expect(
    line,
    `expected one output line naming check "${slug}" and file "${fileFragment}"\n${run.out}`,
  ).toBeTruthy();
}

/** The root passed, and the per-check table shows this check ran rather than being skipped. */
function expectPass(run: Run, slug: string, why: string): void {
  expect(run.code, `${why}\n${run.out}`).toBe(0);
  expect(run.stdout).toContain(slug);
}

// ---------------------------------------------------------------------------------------
// Hole 1. Blueprint 6.3 puts EchoPanel in the Panel union, so an echo panel may sit inside
// panels[] with the artifact-root `echo` field null. Narration binds it by the same el_id
// either way, so the relocation is invisible to a reader and to the other nine checks.
//
// contracts/lexicon.json scopes future_harm to ["echo.historical.outcome",
// "cases.documented_outcome"], and the validator's string walker drops array indices, so the
// relocated panel's outcome text is reached at path "panels.historical.outcome.en". Neither
// scope entry matches it, and the harm phrase ships.
// ---------------------------------------------------------------------------------------
describe('check: lexicon, echo panel placed in panels[]', () => {
  it('still passes when the relocated echo panel keeps past-tense outcome text', () => {
    // The positive control. A fix that widens the scope to every string in the tree, or that
    // matches "will cause" anywhere, breaks this and is not the fix.
    expectPass(
      runValidator(`${F}/lexicon/good-echo-in-panels`),
      'lexicon',
      'a legal 6.3 echo placement with clean copy must not become a failure',
    );
  }, T);

  it('fails on a future-tense-harm phrase in panels[] echo outcome text', () => {
    expectFailure(
      runValidator(`${F}/lexicon/bad-future-harm-in-panels`),
      'lexicon',
      'ppn-panic.json',
    );
  }, T);
});

// ---------------------------------------------------------------------------------------
// Hole 2. contracts/schemas/narrative.schema.json omits additionalProperties:false at the
// artifact root, on the stated reasoning that "stray flags are caught by check 7 (seed)".
// Check 7 only catches the literal key `seed` set to true. Every other unknown root key, a
// typo'd field name, a leaked scratch object, an operator note, ships silently and reaches
// the renderer as data nothing reads.
//
// The implementer decides where the guard lives, closing the schema root or an explicit
// unknown-key check, but the failure is reported under slug `schema` either way, and the
// schema's own description needs updating to match whichever it is.
// ---------------------------------------------------------------------------------------
describe('check: schema, unknown property on a narrative root', () => {
  it('fails on a neutral extra root key that no schema property declares', () => {
    expectFailure(
      runValidator(`${F}/schema/bad-extra-root-key`),
      'schema',
      'tariffs-pay.json',
    );
  }, T);
});

// ---------------------------------------------------------------------------------------
// Hole 3. url_index entries carry match "exact" | "prefix" | "regex". Check 8 resolves
// narrative ids and counts fresh_demo entries and never once compiles a regex pattern, so an
// uncompilable pattern passes Gate 1 and throws in the router at request time instead. The
// fixture puts it on the single fresh_demo entry, which is the one URL the demo depends on.
//
// The good-echo-in-panels root above carries the untouched url_index, including a valid
// regex entry, so it doubles as the positive control here: the fix must compile patterns,
// not reject the "regex" match kind.
// ---------------------------------------------------------------------------------------
describe('check: url-index, regex patterns that do not compile', () => {
  it('fails on a match "regex" entry whose pattern is not a valid regular expression', () => {
    expectFailure(
      runValidator(`${F}/url-index/bad-invalid-regex`),
      'url-index',
      'url_index.json',
    );
  }, T);
});

// ---------------------------------------------------------------------------------------
// Hole 4. source.schema.json allows liveness "unverified". Check 9 branches on
// "dead_replaced", then scans notes for a recorded status of 400 or worse. A source marked
// "unverified" with no notes at all matches neither branch, so the one liveness state that
// means "nobody could confirm this" is the one state that needs no explanation.
// ---------------------------------------------------------------------------------------
describe('check: liveness, unverified sources with no note', () => {
  it('fails on a source recorded as unverified that carries no notes field', () => {
    expectFailure(
      runValidator(`${F}/liveness/bad-unverified-no-note`),
      'liveness',
      'sources.json',
    );
  }, T);
});

// ---------------------------------------------------------------------------------------
// Hole 5. Check 7 is "zero fixtures", and it reads content artifacts only. Nothing stops a
// shipped module from importing a fixture: the seed data then reaches production through the
// bundle rather than through the content root, which is the failure mode check 7 exists to
// prevent. No fixture root for this one; the spec builds a throwaway app tree.
//
// CLI CONTRACT PINNED HERE. Build to this:
//
//   pnpm exec tsx scripts/validate-content.ts --dir <contentRoot> --scan-app <appDir>
//
//   * `--scan-app` takes exactly one directory path, resolved like `--dir`. One occurrence
//     is the contract; repeating it is undefined here.
//   * Given the flag, check 7 (slug `seed`) additionally walks <appDir> recursively and
//     reads every .ts, .tsx, .js, .jsx and .mjs file, looking at module specifiers: static
//     `import x from "S"`, side-effect `import "S"`, `export ... from "S"`, dynamic
//     `import("S")` and `require("S")`.
//   * A specifier is an offence when it reaches test fixtures or seed data, which means it
//     contains a `tests/fixtures` segment, or a path segment named `fixtures` or `seed`.
//     Shipped code imports neither. That is check 7 widened from "no artifact carries
//     seed: true" to "and no shipped module imports one".
//   * Every offence is reported the way every other failure is: one stderr line carrying the
//     slug `seed` and the offending file together. Print the path relative to <appDir> or
//     absolute, either satisfies the assertion below, which matches on the basename.
//   * Any offence exits 1. A clean tree leaves check 7's verdict to the content root alone.
//   * The scan folds into the existing `seed` row rather than adding an eleventh. The table
//     still names exactly the ten checks of 6.11, so validator-checks.spec.ts stays green.
//   * Without `--scan-app` nothing is scanned and nothing changes. The flag's absence is not
//     itself a failure.
// ---------------------------------------------------------------------------------------
// ponytail: os tmpdir, not a path in the repo. The tree is throwaway, so it needs no home in
// the fixture set, and this case then survives the move out of staging/ without an edit.
const SCAN_TMP = mkdtempSync(join(tmpdir(), 'mh-scan-app-'));
const cleanTree = join(SCAN_TMP, 'clean');
const dirtyTree = join(SCAN_TMP, 'dirty');

describe('check: seed, app source importing fixtures', () => {
  beforeAll(() => {
    mkdirSync(cleanTree, { recursive: true });
    mkdirSync(dirtyTree, { recursive: true });

    const clean = [
      "import { useState } from 'react';",
      '',
      'export function Panel(): string {',
      '  const [n] = useState(0);',
      '  return String(n);',
      '}',
      '',
    ].join('\n');
    writeFileSync(join(cleanTree, 'panel.tsx'), clean);
    writeFileSync(join(dirtyTree, 'panel.tsx'), clean);
    writeFileSync(
      join(dirtyTree, 'bad-import.tsx'),
      [
        'import fx from "../../tests/fixtures/validator/good/sources.json";',
        '',
        'export const sourceCount = fx.length;',
        '',
      ].join('\n'),
    );
  });

  afterAll(() => rmSync(SCAN_TMP, { recursive: true, force: true }));

  it('fails when a module in the scanned tree imports a test fixture', () => {
    // --dir is the good root, so the scan is the only thing that can fail this run.
    expectFailure(runValidator(GOOD, '--scan-app', dirtyTree), 'seed', 'bad-import.tsx');
  }, T);

  it('passes on a scanned tree whose modules import nothing from fixtures or seed', () => {
    expectPass(
      runValidator(GOOD, '--scan-app', cleanTree),
      'seed',
      'a clean app tree must not fail the scan',
    );
  }, T);
});
