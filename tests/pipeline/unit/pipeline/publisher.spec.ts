/**
 * A12 Publisher acceptance suite. AC-PIPE-2 (deterministic stages are deterministic) and the
 * publisher half of AC-INV-8 (no code path publishes without valid gate tokens).
 *
 * Written from the Gate C plan before pipeline/run.ts exists. Everything here drives the
 * runner CLI:
 *
 *   tsx pipeline/run.ts stage A12 --narrative <id> --run <run dir> --out <content root>
 *
 * The fixture run dir is tests/pipeline/fixtures/runs/gc-fixture-0, copied to a temp dir per
 * test so the committed fixture is never written to. Its candidate artifact is already
 * derivation-stable: `counts` and `provenance.source_count` equal what A12 recomputes, so the
 * token the gates minted over the candidate is the token A12 must verify against the bytes it
 * writes. Regenerate with tests/pipeline/fixtures/stamp.mjs after editing any fixture datum.
 *
 * The refusal tests assert two things every time: a nonzero exit naming the narrative and a
 * reason, AND that no artifact reached the content root. A publisher that reports a refusal
 * after writing the file has not refused.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gateToken } from '../../../../pipeline/lib/canonical';
import { copyTree, GC, readJson, runStage, T, writeJson, type Run } from '../../lib/runner';

const FIXTURE_RUN = join(GC, 'fixtures', 'runs', 'gc-fixture-0');
const OUT_BASE = join(GC, 'fixtures', 'out-base');
const NARRATIVE = 'rambai-levy';

interface Bench {
  run: string;
  out: string;
  candidate: string;
  published: string;
}

/** A writable run dir plus a content root holding only the authored source registry. */
function bench(label: string): Bench {
  const run = copyTree(FIXTURE_RUN, `run-${label}`);
  const out = copyTree(OUT_BASE, `out-${label}`);
  return {
    run,
    out,
    candidate: join(run, 'slots', NARRATIVE, 'candidate.json'),
    published: join(out, 'narratives', `${NARRATIVE}.json`),
  };
}

const publish = (b: Bench): Run =>
  runStage(['stage', 'A12', '--narrative', NARRATIVE, '--run', b.run, '--out', b.out]);

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

/** Nonzero exit, some output line naming the narrative, a reason word, and nothing published. */
function expectRefusal(b: Bench, run: Run, reason: RegExp): void {
  expect(run.code, `A12 must refuse, exit nonzero\n${run.out}`).not.toBe(0);
  expect(run.out).toContain(NARRATIVE);
  expect(run.out, `the refusal must name its reason\n${run.out}`).toMatch(reason);
  expect(
    existsSync(b.published),
    'A12 refused and still wrote the artifact, which is not a refusal',
  ).toBe(false);
}

describe('A12 determinism (AC-PIPE-2)', () => {
  it('publishes byte-identical artifacts from two independent runs over identical inputs', () => {
    const first = bench('det-a');
    const second = bench('det-b');

    const a = publish(first);
    const b = publish(second);

    expect(a.code, a.out).toBe(0);
    expect(b.code, b.out).toBe(0);
    expect(existsSync(first.published), `${first.published} was not written\n${a.out}`).toBe(true);
    expect(existsSync(second.published), `${second.published} was not written\n${b.out}`).toBe(true);
    expect(
      sha256(first.published),
      'two A12 runs over identical inputs produced different bytes, so something in the publisher reads a clock, a random source, or an unsorted iteration order',
    ).toBe(sha256(second.published));
  }, T * 2);

  it('publishes an artifact whose stored gate tokens verify against its own bytes', () => {
    const b = bench('det-token');
    const run = publish(b);
    expect(run.code, run.out).toBe(0);

    const artifact = readJson(b.published);
    const gates = (
      artifact.manifest as { gates: { symmetry: { token: string }; fidelity: { token: string } } }
    ).gates;
    expect(gates.symmetry.token).toBe(gateToken(artifact));
    expect(gates.fidelity.token).toBe(gateToken(artifact));
  }, T);
});

describe('A12 refuses without both gate tokens (AC-INV-8)', () => {
  it('refuses when the symmetry verdict carries no token', () => {
    const b = bench('no-sym-token');
    const verdict = join(b.run, 'slots', NARRATIVE, 'A10.json');
    const withoutToken = readJson<Record<string, unknown>>(verdict);
    delete withoutToken.token;
    writeJson(verdict, withoutToken);

    expectRefusal(b, publish(b), /token|symmetry|gate/i);
  }, T);

  it('refuses when the fidelity verdict file is absent altogether', () => {
    const b = bench('no-fid-file');
    rmSync(join(b.run, 'slots', NARRATIVE, 'A11.json'));

    expectRefusal(b, publish(b), /token|fidelity|gate/i);
  }, T);
});

describe('A12 refuses a token that does not verify against the bytes (AC-INV-8)', () => {
  it('refuses when the artifact was edited after the gates stamped it', () => {
    const b = bench('tampered');
    // The tamper an attacker or a careless hand-edit would make: change published copy after
    // the gates have judged the bytes. Counts and source ids are untouched, so A12's own
    // derivation is a no-op and the token mismatch is the only thing wrong here.
    const candidate = readJson<{ headline: { en: string; id: string } }>(b.candidate);
    candidate.headline.en = 'The Canal Levy Pays for Every Program in the City';
    writeJson(b.candidate, candidate);

    expectRefusal(b, publish(b), /token|verify|tamper|mismatch/i);
  }, T);

  it('refuses when only one of the two tokens verifies', () => {
    const b = bench('half-verified');
    const verdict = join(b.run, 'slots', NARRATIVE, 'A11.json');
    const fidelity = readJson<{ token: string }>(verdict);
    fidelity.token = gateToken({ decoy: 'a token over some other artifact entirely' });
    writeJson(verdict, fidelity);

    expectRefusal(b, publish(b), /token|verify|fidelity|mismatch/i);
  }, T);
});

describe('A12 refuses a narrative that fails its schema', () => {
  it('refuses when a field carries the wrong type, with the tokens restamped so schema is the only fault', () => {
    const b = bench('bad-schema');
    // 6.3 types provenance.source_count as an integer. Storing it as a string is the same
    // fault tests/fixtures/validator/schema/bad-field-type plants for check 1.
    const candidate = readJson<{ provenance: Record<string, unknown> }>(b.candidate);
    candidate.provenance.source_count = 'three';
    writeJson(b.candidate, candidate);

    // Restamp both gates over the broken bytes. Without this the run would refuse on the
    // token mismatch and prove nothing about schema validation.
    const token = gateToken(candidate);
    for (const file of ['A10.json', 'A11.json']) {
      const path = join(b.run, 'slots', NARRATIVE, file);
      writeJson(path, { ...readJson<Record<string, unknown>>(path), token });
    }

    expectRefusal(b, publish(b), /schema|source_count|invalid/i);
  }, T);
});
