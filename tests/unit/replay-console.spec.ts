/**
 * PROVES: the replay console's line-builder is a faithful reading of content/replay.json.
 *
 * The console's honesty claim (docs/replay-protocol.md, blueprint 3.4) is that every fact on
 * screen is the record: roles, labels, models, block reasons, verdict summaries, the token.
 * The one line the builder adds is the refix connective between a block round and the pass
 * that follows it, so that is the one line these cases pin down: it appears exactly once per
 * contiguous block round and never anywhere else.
 *
 * The cases run against the REAL published record read off disk, the research e2e's idiom: a
 * regenerated replay.json changes both sides of every assertion at once, so the suite cannot
 * go stale and cannot pass against an invented run.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import type { Replay, ReplayRun } from '../../contracts/types';
import { consoleLines } from '../../app/src/research/replay';
import { translate } from '../../app/src/i18n';

const REPLAY = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../content/replay.json', import.meta.url)), 'utf8'),
) as Replay;

const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
  translate('en', key, vars);

const runOf = (id: string): ReplayRun => {
  const run = REPLAY.narratives.find((entry) => entry.narrative_id === id);
  if (run === undefined) throw new Error(`replay.json carries no run for ${id}`);
  return run;
};

describe('consoleLines is the record, in the record order', () => {
  it('a clean run is slots then pass verdicts, and nothing else', () => {
    const run = runOf('mbg-cut');
    expect(run.blocked_rounds, 'mbg-cut is the recorded clean run').toBe(0);
    const { lines, token } = consoleLines(run, 'en', t);

    expect(lines.map((line) => line.kind)).toEqual([
      ...Array<string>(7).fill('slot'),
      'verdict',
      'verdict',
    ]);
    expect(token).toBe('3fdc8c32d2bf');

    // A slot line carries the role, the recorded label and the real model id, verbatim.
    const first = run.events[0];
    if (first?.kind !== 'slot') throw new Error('the record starts with a slot');
    expect(lines[0]?.text).toBe(`${first.role} · ${first.label.en} · ${first.model}`);
  });

  it('a blocked run keeps the reason, then says the refix once, then the passes', () => {
    const run = runOf('mbg-stop');
    const { lines, token } = consoleLines(run, 'en', t);

    expect(lines.map((line) => line.kind)).toEqual([
      ...Array<string>(7).fill('slot'),
      'block',
      'refix',
      'verdict',
      'verdict',
    ]);
    expect(token).toBe('f2468186c3b5');

    const block = run.events.find((event) => event.kind === 'block');
    if (block?.kind !== 'block') throw new Error('mbg-stop records a block');
    const blockLine = lines.find((line) => line.kind === 'block');
    expect(blockLine?.text, 'the recorded reason renders verbatim').toContain(block.reason);
    expect(blockLine?.text).toContain(block.judged_by);

    expect(lines.find((line) => line.kind === 'refix')?.text).toBe(t('research.replay.refix'));
  });

  it('two blocks in one round earn one refix, not two', () => {
    const { lines } = consoleLines(runOf('usaid-deficit'), 'en', t);
    expect(lines.filter((line) => line.kind === 'block')).toHaveLength(2);
    expect(lines.filter((line) => line.kind === 'refix')).toHaveLength(1);
    const kinds = lines.map((line) => line.kind);
    expect(kinds.indexOf('refix'), 'the refix follows the whole block round').toBe(kinds.lastIndexOf('block') + 1);
  });

  it('every published run ends in its recorded token, and Indonesian reads the id labels', () => {
    for (const run of REPLAY.narratives) {
      const en = consoleLines(run, 'en', t);
      expect(en.token, `${run.narrative_id} reaches its published token`).toMatch(/^[0-9a-f]{12}$/);

      const id = consoleLines(run, 'id', (key, vars) => translate('id', key, vars));
      const slot = run.events[0];
      if (slot?.kind !== 'slot') throw new Error(`${run.narrative_id} starts with a slot`);
      expect(id.lines[0]?.text).toContain(slot.label.id);
      // An empty recorded summary stays empty: the chrome sentence stands alone, nothing padded.
      for (const line of [...en.lines, ...id.lines]) expect(line.text.trim()).toBe(line.text);
    }
  });
});
