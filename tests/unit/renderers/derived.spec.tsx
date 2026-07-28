// @vitest-environment jsdom
/**
 * PROVES: AC-INV-7 (percentages are derived at render, never read from data).
 *
 * Contract 6.4, ScaleCheckPanel: "pct DERIVED at render: value.amount / denominator.amount".
 * There is no pct field on the type, and the seed fixtures dropped the zip's authored one.
 * This file holds the derivation to within 0.1 percentage points of the displayed rounding,
 * which is what forces at least one decimal place: 1 of 3 rounded to a whole "33%" is 0.33pp
 * from the truth and fails here, "33.3%" is 0.03pp from it and passes.
 *
 * Three separate proofs that the number is computed, because any one of them alone is weak:
 *   1. structural  the panel object carries no pct-shaped key at all
 *   2. decoy       a pct field injected into the fixture is ignored, and the derived value renders
 *   3. behavioural the rendered percentage moves when the amount moves
 *
 * Percentages are read out of the DOM by scanning the segment's own [data-el] subtree for a
 * "<number>%" token. mbg-stop is used throughout precisely because none of its display strings
 * carry a percent sign of their own (ppn-panic's "4% of the basket" would poison the scan).
 *
 * Fixture paths: tests/fixtures/seed. Post-install home of this file: tests/unit/renderers/.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScaleCheckPanel, Value } from '../../../contracts/types';
import { makeCtx } from '../../../app/src/renderers/ctx';
import ScaleCheck from '../../../app/src/renderers/ScaleCheck';
import { seedNarrative, seedPanel, seedSources } from './seed';

afterEach(cleanup);

const ctx = makeCtx(seedSources(), 'en', 'light');
const stop = seedNarrative('mbg-stop');
const scale = seedPanel<ScaleCheckPanel>(stop, 'scale_check');

/** AC-INV-7's tolerance, in percentage points. */
const TOLERANCE_PP = 0.1;

/** The percentage rendered inside one element, locale separator tolerated. */
function renderedPct(root: HTMLElement, elId: string): number {
  const el = root.querySelector<HTMLElement>(`[data-el="${elId}"]`);
  expect(el, `no element carries data-el="${elId}"`).not.toBeNull();
  const match = /(\d+(?:[.,]\d+)?)\s*%/.exec(el?.textContent ?? '');
  expect(match, `no percentage rendered inside data-el="${elId}": ${el?.textContent ?? ''}`).not.toBeNull();
  return Number((match?.[1] ?? '').replace(',', '.'));
}

/** A panel with one segment, for the cases the seed root does not happen to contain. */
function onePanel(denominator: number, amount: number): ScaleCheckPanel {
  const value = (n: number): Value => ({
    amount: n,
    unit: 'count',
    display: { en: `${n} of them`, id: `${n} di antaranya` },
    source_id: 'id-seed-illustrative-basket',
  });
  return {
    type: 'scale_check',
    el_id: 'p-awkward',
    denominator: { label: { en: 'Everything', id: 'Semuanya' }, value: value(denominator) },
    segments: [{ el_id: 'sg-awkward', label: { en: 'The part', id: 'Bagiannya' }, value: value(amount) }],
    takeaway: { en: 'A crafted denominator, for the rounding.', id: 'Denominator buatan, untuk pembulatannya.' },
    context_chips: [],
  };
}

describe('AC-INV-7 seed scale_check percentages equal amount over denominator', () => {
  it('derives every mbg-stop segment within 0.1pp', () => {
    const { container } = render(<ScaleCheck panel={scale} ctx={ctx} />);
    const denominator = scale.denominator.value.amount;
    expect(scale.segments.length).toBeGreaterThan(0);

    for (const segment of scale.segments) {
      const expected = (segment.value.amount / denominator) * 100;
      expect(
        Math.abs(renderedPct(container, segment.el_id) - expected),
        `${segment.el_id}: ${segment.value.amount} of ${denominator} is ${expected}%`,
      ).toBeLessThanOrEqual(TOLERANCE_PP);
    }
  });
});

describe('AC-INV-7 awkward rounding', () => {
  // 1/3 is the case a whole-number renderer gets wrong by 0.33pp, so it is the case that
  // proves the tolerance is doing work rather than waving everything through.
  it.each([
    { denominator: 3, amount: 1, expected: 33.3333 },
    { denominator: 3, amount: 2, expected: 66.6667 },
    { denominator: 7, amount: 1, expected: 14.2857 },
    { denominator: 1000, amount: 1, expected: 0.1 },
  ])('renders $amount of $denominator within 0.1pp', ({ denominator, amount, expected }) => {
    const { container } = render(<ScaleCheck panel={onePanel(denominator, amount)} ctx={ctx} />);
    expect(Math.abs(renderedPct(container, 'sg-awkward') - expected)).toBeLessThanOrEqual(TOLERANCE_PP);
  });
});

describe('AC-INV-7 the percentage is computed, not read', () => {
  it('structural: the seed panel carries no pct-shaped key', () => {
    const keys = new Set<string>();
    const collect = (node: unknown): void => {
      if (Array.isArray(node)) return node.forEach(collect);
      if (typeof node !== 'object' || node === null) return;
      for (const [key, value] of Object.entries(node)) {
        keys.add(key);
        collect(value);
      }
    };
    collect(scale);
    expect([...keys].filter((k) => /^(pct|percent|percentage|share|ratio)$/i.test(k))).toEqual([]);
  });

  it('decoy: a pct field injected into the fixture is ignored', () => {
    const decoy = structuredClone(scale) as unknown as Record<string, unknown>;
    const segments = decoy.segments as Array<Record<string, unknown>>;
    for (const segment of segments) segment.pct = 99.9;
    (decoy.denominator as Record<string, unknown>).pct = 99.9;

    const { container } = render(<ScaleCheck panel={decoy as unknown as ScaleCheckPanel} ctx={ctx} />);
    const denominator = scale.denominator.value.amount;
    for (const segment of scale.segments) {
      const expected = (segment.value.amount / denominator) * 100;
      expect(Math.abs(renderedPct(container, segment.el_id) - expected)).toBeLessThanOrEqual(TOLERANCE_PP);
    }
    expect(container.textContent).not.toContain('99.9');
  });

  it('behavioural: doubling one amount moves that percentage to the new derivation', () => {
    const doubled = structuredClone(scale);
    const target = doubled.segments[0];
    if (target === undefined) throw new Error('the seed scale_check panel lost its first segment');
    target.value.amount = target.value.amount * 2;
    const expected = (target.value.amount / doubled.denominator.value.amount) * 100;

    const before = render(<ScaleCheck panel={scale} ctx={ctx} />);
    const after = render(<ScaleCheck panel={doubled} ctx={ctx} />);
    const pctBefore = renderedPct(before.container, target.el_id);
    const pctAfter = renderedPct(after.container, target.el_id);

    expect(Math.abs(pctAfter - expected)).toBeLessThanOrEqual(TOLERANCE_PP);
    expect(pctAfter).toBeGreaterThan(pctBefore);
  });
});
