import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Gate 0 proof (blueprint 9.2): the validator fails loudly on a broken artifact.
// A check that cannot fail is not a check.
describe('validate-content can fail', () => {
  it('exits 1 on the broken fixture and names the file and failing check', () => {
    let code = 0;
    let out = '';
    try {
      out = execFileSync(
        'pnpm',
        ['exec', 'tsx', 'scripts/validate-content.ts', '--dir', 'tests/fixtures/broken'],
        { encoding: 'utf8', stdio: 'pipe' },
      );
    } catch (e) {
      const err = e as { status: number | null; stdout: string; stderr: string };
      code = err.status ?? -1;
      out = String(err.stdout) + String(err.stderr);
    }
    expect(code).toBe(1);
    expect(out).toContain('FAIL');
    expect(out).toContain('sources.json');
    expect(out).toContain('publisher');
  });

  it('exits 0 when every artifact conforms', () => {
    const out = execFileSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/validate-content.ts', '--dir', 'tests/fixtures/valid'],
      { encoding: 'utf8', stdio: 'pipe' },
    );
    expect(out).toContain('OK');
  });
});
