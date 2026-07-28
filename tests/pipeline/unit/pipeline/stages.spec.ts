/**
 * The deterministic stages either side of the LLM slots: A2 Ingestor, A4 Prioritizer,
 * A13 Librarian. AC-PIPE-2 covers A2's determinism the way it covers A12's; A4 is the
 * "records scores" half of 5.4; A13 is where the published set turns into the aggregates the
 * methodology page and the router read.
 *
 * A13 is checked twice over, and neither check reimplements the validator: the symmetry
 * receipt is compared against the leans of the artifacts actually in the content root, and the
 * root itself is handed to the real `scripts/validate-content.ts`, whose check 8 is what says
 * a url index resolves and carries exactly one fresh_demo.
 *
 * Runner surface pinned here:
 *   tsx pipeline/run.ts stage A2|A3|A4 --run <run dir>
 *   tsx pipeline/run.ts stage A13 --run <run dir> --out <content root>
 *   <run>/stages/A1.json   scout records, staged by the fixture: { records: [{ id, lang, ... }] }
 *   <run>/stages/A2.json   normalized records, same ids
 *   <run>/stages/A3.json   { assignments: [{ id, cluster }] }
 *   <run>/stages/A4.json   { ranked: [{ cluster, score, rank }] }
 *   <run>/run.json         carries `fresh_demo`, the one url A13 marks as the demo entry
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gateToken } from '../../../../pipeline/lib/canonical';
import {
  copyTree,
  GC,
  readJson,
  runStage,
  T,
  validateContent,
  writeJson,
} from '../../lib/runner';

const FIXTURE_RUN = join(GC, 'fixtures', 'runs', 'gc-fixture-0');
const OUT_BASE = join(GC, 'fixtures', 'out-base');
const NARRATIVE = 'rambai-levy';
const MIRROR = 'rambai-levy-mirror';

const sha256 = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

interface ScoutRecord {
  id: string;
}

describe('A2 normalization is deterministic (AC-PIPE-2)', () => {
  it('produces byte-identical normalized records from two independent runs', () => {
    const first = copyTree(FIXTURE_RUN, 'run-a2-a');
    const second = copyTree(FIXTURE_RUN, 'run-a2-b');

    const a = runStage(['stage', 'A2', '--run', first]);
    const b = runStage(['stage', 'A2', '--run', second]);
    expect(a.code, a.out).toBe(0);
    expect(b.code, b.out).toBe(0);

    const path = (run: string): string => join(run, 'stages', 'A2.json');
    expect(existsSync(path(first)), `stages/A2.json was not written\n${a.out}`).toBe(true);
    expect(
      sha256(path(first)),
      'two A2 runs over the same scout records produced different bytes',
    ).toBe(sha256(path(second)));
  }, T * 2);

  it('keeps every scout record, by id', () => {
    const run = copyTree(FIXTURE_RUN, 'run-a2-ids');
    const stage = runStage(['stage', 'A2', '--run', run]);
    expect(stage.code, stage.out).toBe(0);

    const ids = (file: string): string[] =>
      readJson<{ records: ScoutRecord[] }>(join(run, 'stages', file))
        .records.map((r) => r.id)
        .sort();
    expect(ids('A2.json'), 'normalization dropped or invented a record').toStrictEqual(ids('A1.json'));
  }, T);
});

describe('A4 records its scores (5.4)', () => {
  it('ranks every cluster A3 produced, with a numeric score per rank', () => {
    const run = copyTree(FIXTURE_RUN, 'run-a4');
    for (const name of ['A2', 'A3', 'A4']) {
      const stage = runStage(['stage', name, '--run', run]);
      expect(stage.code, `stage ${name}\n${stage.out}`).toBe(0);
    }

    const assignments = readJson<{ assignments: Array<{ id: string; cluster: string }> }>(
      join(run, 'stages', 'A3.json'),
    ).assignments;
    const ranked = readJson<{ ranked: Array<{ cluster: string; score: number; rank: number }> }>(
      join(run, 'stages', 'A4.json'),
    ).ranked;

    expect(ranked.length, 'A4 ranked nothing').toBeGreaterThan(0);
    expect(
      ranked.map((r) => r.cluster).sort(),
      'every cluster is ranked exactly once',
    ).toStrictEqual([...new Set(assignments.map((a) => a.cluster))].sort());

    for (const entry of ranked) {
      expect(Number.isFinite(entry.score), `cluster "${entry.cluster}" has no numeric score`).toBe(true);
    }
    expect(ranked.map((r) => r.rank)).toStrictEqual(ranked.map((_, i) => i + 1));
    for (let i = 1; i < ranked.length; i += 1) {
      const [prev, cur] = [ranked[i - 1], ranked[i]];
      expect(prev!.score, 'ranking disagrees with the scores it recorded').toBeGreaterThanOrEqual(cur!.score);
    }
  }, T * 3);
});

describe('A13 aggregates the published set', () => {
  it('derives methodology.symmetry from the published leans and leaves the root validator-green', () => {
    const run = copyTree(FIXTURE_RUN, 'run-a13');
    const out = copyTree(OUT_BASE, 'out-a13');

    // A second narrative, so the symmetry receipt has more than one lean to count. It is the
    // first artifact re-keyed with the opposite lean: what is under test is the tally, not the
    // prose, and re-keying keeps one authored artifact instead of two that drift apart.
    const candidate = readJson<{
      id: string;
      lean: string;
      url: string;
      headline: { en: string; id: string };
    }>(join(run, 'slots', NARRATIVE, 'candidate.json'));
    candidate.id = MIRROR;
    candidate.lean = 'opp';
    candidate.url = 'https://kanaltimur-harian.example.invalid/2031/03/retribusi-kanal-tidak-menutup';
    candidate.headline = {
      en: 'The Canal Levy Covers a Fraction of the Flood Program',
      id: 'Retribusi Kanal Menutup Sebagian Kecil Program Banjir',
    };
    const mirrorDir = join(run, 'slots', MIRROR);
    mkdirSync(mirrorDir, { recursive: true });
    writeJson(join(mirrorDir, 'candidate.json'), candidate);
    const token = gateToken(candidate);
    for (const file of ['A10.json', 'A11.json']) {
      writeJson(join(mirrorDir, file), { verdict: 'pass', reasons: [], token });
    }
    const manifest = readJson<{ narratives: string[] }>(join(run, 'run.json'));
    manifest.narratives = [NARRATIVE, MIRROR];
    writeJson(join(run, 'run.json'), manifest);

    for (const id of [NARRATIVE, MIRROR]) {
      const publish = runStage(['stage', 'A12', '--narrative', id, '--run', run, '--out', out]);
      expect(publish.code, `A12 ${id}\n${publish.out}`).toBe(0);
    }
    const librarian = runStage(['stage', 'A13', '--run', run, '--out', out]);
    expect(librarian.code, librarian.out).toBe(0);

    const tally = { gov: 0, neutral: 0, opp: 0 };
    for (const file of readdirSync(join(out, 'narratives'))) {
      const lean = readJson<{ lean: 'gov' | 'neutral' | 'opp' }>(join(out, 'narratives', file)).lean;
      tally[lean] += 1;
    }
    const symmetry = readJson<{ symmetry: Record<string, number> }>(join(out, 'methodology.json')).symmetry;
    expect(tally, 'the fixture set is one gov and one opp artifact').toStrictEqual({
      gov: 1,
      neutral: 0,
      opp: 1,
    });
    for (const lean of ['gov', 'neutral', 'opp'] as const) {
      expect(symmetry[lean], `methodology.symmetry.${lean} is not the published count`).toBe(tally[lean]);
    }

    // Check 8 of 6.11 is the url index check: entries resolve, exactly one fresh_demo. Running
    // the real CLI is how that semantics gets reused rather than written twice.
    const validated = validateContent(out);
    expect(validated.code, `A13 left a content root the validator rejects\n${validated.out}`).toBe(0);
    expect(validated.stdout).toContain('url-index');

    const index = readJson<{ entries: Array<{ role: string }> }>(join(out, 'url_index.json'));
    expect(index.entries.filter((e) => e.role === 'fresh_demo')).toHaveLength(1);
  }, T * 5);
});
