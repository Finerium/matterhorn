/**
 * PROVES: the Gate 2 seed quarantine, pinned as a test.
 * Supports AC-INV-1, AC-INV-2, AC-INV-7 and AC-INV-10 by keeping the fixtures those specs
 * feed the renderers out of the shipped content root and out of the app import graph.
 *
 * Two invocations of the blueprint 6.11 validator, run as the CLI, not as a library:
 *
 *   --dir tests/fixtures/seed
 *     Exactly one check fails, and it is `seed`. This is the quarantine proof in both
 *     directions at once: the seed root is a real content root that satisfies every other
 *     check (schema, orphans, counts, narration, lexicon, manifest, url-index, liveness,
 *     feed), which is what makes it a fair renderer fixture, and its "seed": true flag is
 *     detected, which is what stops it ever being mistaken for content.
 *
 *   --dir content --scan-app app/src
 *     Exit 0. This is the import-graph half wired against the real app tree: it stays green
 *     as the renderer implementer adds modules only while none of them imports a fixture.
 *     The third case points --scan-app at a directory that does not exist and asserts the
 *     run fails, so a silently dropped flag cannot make the second case pass vacuously.
 *
 * No jsdom here: this file drives a process, not a DOM.
 * Post-install home of this file: tests/unit/renderers/.
 */
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/** One `pnpm exec tsx` spawn per case; generous so a cold start is never a flake. */
const T = 60_000;

interface Run {
  code: number;
  /** stdout and stderr concatenated, which is where assertions look. */
  out: string;
  stdout: string;
}

function runValidator(...args: string[]): Run {
  try {
    const stdout = execFileSync('pnpm', ['exec', 'tsx', 'scripts/validate-content.ts', ...args], {
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, out: stdout, stdout };
  } catch (e) {
    const err = e as { status: number | null; stdout: string; stderr: string };
    const stdout = String(err.stdout ?? '');
    return { code: err.status ?? -1, out: `${stdout}\n${String(err.stderr ?? '')}`, stdout };
  }
}

/** The per-check table on stdout, as { slug: status }. */
function checkTable(stdout: string): Record<string, string> {
  const table: Record<string, string> = {};
  for (const line of stdout.split('\n')) {
    const match = /^([a-z][a-z-]*)\s+(pass|fail)\s/.exec(line);
    if (match?.[1] !== undefined && match[2] !== undefined) table[match[1]] = match[2];
  }
  return table;
}

const failing = (stdout: string): string[] =>
  Object.entries(checkTable(stdout))
    .filter(([, status]) => status === 'fail')
    .map(([slug]) => slug)
    .sort();

describe('seed quarantine', () => {
  it(
    'fails the seed root on the seed check and on nothing else',
    () => {
      const run = runValidator('--dir', 'tests/fixtures/seed');

      expect(run.code, `expected exit 1\n${run.out}`).toBe(1);
      expect(failing(run.stdout), `only the seed check may fail on the seed root\n${run.out}`).toEqual([
        'seed',
      ]);
      // The table has to have been read at all, or the assertion above is vacuous.
      expect(Object.keys(checkTable(run.stdout)).length).toBe(10);

      for (const file of [
        'narratives/mbg-stop.json',
        'narratives/mbg-poisoning.json',
        'narratives/ppn-panic.json',
      ]) {
        const line = run.out.split('\n').find((l) => l.includes('seed') && l.includes(file));
        expect(line, `expected one output line naming check "seed" and file "${file}"\n${run.out}`).toBeTruthy();
      }
    },
    T,
  );

  it(
    'passes the real content root with the app import scan wired in',
    () => {
      const run = runValidator('--dir', 'content', '--scan-app', 'app/src');
      expect(run.code, `expected exit 0\n${run.out}`).toBe(0);
      expect(failing(run.stdout)).toEqual([]);
    },
    T,
  );

  it(
    'honours --scan-app rather than dropping it',
    () => {
      const run = runValidator('--dir', 'content', '--scan-app', 'app/src/does-not-exist');
      expect(run.code, `a --scan-app path that does not exist must fail\n${run.out}`).not.toBe(0);
      expect(failing(run.stdout)).toEqual(['seed']);
    },
    T,
  );
});
