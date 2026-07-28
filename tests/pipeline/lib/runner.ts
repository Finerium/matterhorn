/**
 * The one place these specs touch the outside world: spawning the pipeline runner CLI,
 * copying a fixture run dir somewhere writable, and reading JSON back.
 *
 * Written before pipeline/run.ts exists. `runStage` therefore refuses to hand back a result
 * when the runner module is missing: a spawn that dies on module resolution also exits
 * nonzero, and a refusal spec asserting "exit code is not 0" would go green against an absent
 * runner. Every caller routes through this guard, so no spec can make that mistake.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/** tests/pipeline/lib -> repo root. Specs never depend on the working directory. */
export const REPO = resolve(import.meta.dirname, '..', '..', '..');
export const GC = join(REPO, 'tests', 'pipeline');
export const RUNNER = 'pipeline/run.ts';
/** One `pnpm exec tsx` spawn per call; generous so a cold start is never a flake. */
export const T = 60_000;

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
  /** stdout and stderr concatenated, which is where assertions look. */
  out: string;
}

const MODULE_MISSING = /Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/i;

function spawn(argv: string[]): Run {
  try {
    const stdout = execFileSync('pnpm', ['exec', 'tsx', ...argv], {
      cwd: REPO,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return { code: 0, stdout, stderr: '', out: stdout };
  } catch (e) {
    const err = e as { status: number | null; stdout: string; stderr: string };
    const stdout = String(err.stdout ?? '');
    const stderr = String(err.stderr ?? '');
    return { code: err.status ?? -1, stdout, stderr, out: `${stdout}\n${stderr}` };
  }
}

/**
 * `tsx pipeline/run.ts <args>` from the repo root. Throws, rather than returning a nonzero
 * Run, when the runner itself is absent or unloadable, so the failure names the missing CLI.
 */
export function runStage(args: string[]): Run {
  if (!existsSync(join(REPO, RUNNER))) {
    throw new Error(`the pipeline runner ${RUNNER} does not exist yet: cannot drive stage ${args.join(' ')}`);
  }
  const run = spawn([RUNNER, ...args]);
  if (run.code !== 0 && MODULE_MISSING.test(run.out)) {
    throw new Error(`${RUNNER} failed to load, so this run proves nothing:\n${run.out}`);
  }
  return run;
}

/** The real content validator over a content root. Reused, never reimplemented. */
export function validateContent(dir: string): Run {
  return spawn(['scripts/validate-content.ts', '--dir', dir]);
}

/** A writable copy of a committed fixture tree. Fixtures stay pristine across runs. */
export function copyTree(from: string, label: string): string {
  const dir = join(mkdtempSync(join(tmpdir(), `gc-${label}-`)), label);
  cpSync(from, dir, { recursive: true });
  return dir;
}

export const readJson = <T = Record<string, unknown>,>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T;

export const writeJson = (path: string, value: unknown): void =>
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
