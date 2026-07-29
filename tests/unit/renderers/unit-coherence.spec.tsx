// @vitest-environment jsdom
/**
 * PROVES: AC-INV-7, the dimensional half. A derived percentage must be dimensionally legal.
 *
 * derived.spec.tsx proves the percentage is COMPUTED (`value.amount / denominator.amount`)
 * rather than read from data. That is only half the invariant. A division is also a claim about
 * dimensions: "this segment is X% OF that denominator" asserts the two are the same kind of
 * quantity. Contract 6.4 gives every `Value` a `unit`, so the renderer can check that claim, and
 * a `Value` that fails it is not a renderable number any more than an orphan one is.
 *
 * The defect this file forecloses shipped: content/narratives/usaid-deficit.json panels[1] set
 * denominator = {amount: 5234.6, unit: "USD_B"} against two percent-unit segments (26 percent,
 * the share people guess goes to foreign aid; about 1 percent, the actual share). ScaleCheck
 * divided anyway and drew "26 percent -> 0.5%" and "about 1 percent -> 0.0%", plus SVG bars at
 * those widths, in both locales. The panel contradicted itself on screen and asserted that both
 * poll figures were shares of $5.23T when neither was, on the one narrative whose entire subject
 * is the 26-versus-1 misperception.
 *
 * The invariant, exactly: a scale_check may not derive a percentage when a segment's unit
 * DIFFERS FROM the denominator's unit. String inequality of `unit`, not membership in some
 * dimension family, and the USD-over-USD_B case below is why: dollars and billions of dollars
 * are the same dimension and dividing one by the other is still wrong by a factor of 10^9. There
 * is no safe loosening of this into "compatible units".
 *
 * Scope, and it is deliberately narrow, because a guard that rejects everything is not a guard:
 *   - SEGMENTS are guarded. They are the only Values the renderer divides.
 *   - context_chips are NOT. They render their display string and no derived percentage, so
 *     their unit is unconstrained by a rule about division. The shipped usaid-deficit panel
 *     carried percent-unit chips under its dollar denominator; those were never the defect.
 *
 * Every fixture here is hand-built, including the one-entry source registry: no seed root, no
 * published narrative, no disk. Content regeneration, or the Gate C deletion of
 * tests/fixtures/seed, must not be able to change what this file means or quietly make it pass.
 *
 * Post-install home of this file: tests/unit/renderers/.
 */
import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ScaleCheckPanel, Source, Value } from '../../../contracts/types';
import { UnitMismatchError, makeCtx } from '../../../app/src/renderers/ctx';
import ScaleCheck from '../../../app/src/renderers/ScaleCheck';

afterEach(cleanup);

/** The whole registry. One entry, hand-built, so nothing outside this file can move it. */
const SOURCE: Source = {
  id: 'xx-unit-coherence-fixture',
  title: 'Hand-built fixture entry for the unit-coherence spec',
  publisher: 'Fixture',
  url: 'https://example.invalid/unit-coherence',
  retrieved_at: '2026-07-29',
  period: 'not a real period',
  kind: 'official',
  self_reported: false,
  liveness: 'live',
};

const EN = makeCtx([SOURCE], 'en', 'light');
const ID = makeCtx([SOURCE], 'id', 'dark');
const LOCALES = [
  { lang: 'en', ctx: EN },
  { lang: 'id', ctx: ID },
] as const;

/** AC-INV-7's tolerance, in percentage points, matching derived.spec.tsx. */
const TOLERANCE_PP = 0.1;

type Unit = Value['unit'];
interface Spec {
  el_id: string;
  amount: number;
  unit: Unit;
}

/**
 * Display strings carry the unit NAME and never a percent sign, in either language, so the
 * only "%" that can reach the DOM is one the renderer derived. el_ids carry no digits, so the
 * only digits adjacent to a "%" are the derived ones.
 */
const value = ({ amount, unit }: { amount: number; unit: Unit }): Value => ({
  amount,
  unit,
  display: { en: `${amount} ${unit}`, id: `${amount} ${unit}` },
  source_id: SOURCE.id,
});

/**
 * ponytail: label text is the el_id verbatim. Deliberate, not lazy: it makes the "names the
 * offending segment" assertion below indifferent to whether the implementation identifies the
 * segment by el_id or by label, while keeping the offender-versus-innocent discrimination exact.
 */
const entry = (spec: Spec) => ({ el_id: spec.el_id, label: { en: spec.el_id, id: spec.el_id }, value: value(spec) });

function panelOf(denominator: { amount: number; unit: Unit }, segments: Spec[], chips: Spec[] = []): ScaleCheckPanel {
  return {
    type: 'scale_check',
    el_id: 'uc-panel',
    denominator: { label: { en: 'Denominator', id: 'Penyebut' }, value: value(denominator) },
    segments: segments.map(entry),
    takeaway: { en: 'Hand-built takeaway, carrying no percent sign.', id: 'Kesimpulan buatan tangan, tanpa tanda persen.' },
    context_chips: chips.map(entry),
  };
}

/** The error a render threw, or a loud failure. Sharper than `.not.toThrow(substring)`. */
function thrownBy(element: ReactElement, container: HTMLElement): Error {
  try {
    render(element, { container });
  } catch (error) {
    return error as Error;
  }
  throw new Error('the render was expected to throw and did not');
}

/** The percentage rendered inside one element, locale separator tolerated. */
function renderedPct(root: HTMLElement, elId: string): number {
  const el = root.querySelector<HTMLElement>(`[data-el="${elId}"]`);
  expect(el, `no element carries data-el="${elId}"`).not.toBeNull();
  const match = /(\d+(?:[.,]\d+)?)\s*%/.exec(el?.textContent ?? '');
  expect(match, `no percentage rendered inside data-el="${elId}": ${el?.textContent ?? ''}`).not.toBeNull();
  return Number((match?.[1] ?? '').replace(',', '.'));
}

// --- the refusal -------------------------------------------------------------------------

const MISMATCHES = [
  {
    name: 'the shipped usaid-deficit shape: a percent segment over a dollar denominator',
    denominator: { amount: 5234.6, unit: 'USD_B' as Unit },
    segment: { el_id: 'uc-seg-guessed-share', amount: 26, unit: 'percent' as Unit },
  },
  {
    name: 'same currency, different scale: a USD segment over a USD_B denominator',
    denominator: { amount: 5234.6, unit: 'USD_B' as Unit },
    segment: { el_id: 'uc-seg-dollars', amount: 43_800_000_000, unit: 'USD' as Unit },
  },
  {
    name: 'a count of cases over a population denominator',
    denominator: { amount: 280_000_000, unit: 'people' as Unit },
    segment: { el_id: 'uc-seg-cases', amount: 4711, unit: 'count' as Unit },
  },
  {
    name: 'a rupiah trillion segment under a rupiah billion denominator',
    denominator: { amount: 3_842_700, unit: 'IDR_B' as Unit },
    segment: { el_id: 'uc-seg-programme', amount: 71, unit: 'IDR_T' as Unit },
  },
];

describe.each(MISMATCHES)('AC-INV-7 dimensional: refuses $name', ({ denominator, segment }) => {
  const panel = panelOf(denominator, [segment]);

  it.each(LOCALES)('throws UnitMismatchError in $lang', ({ ctx }) => {
    expect(() => render(<ScaleCheck panel={panel} ctx={ctx} />)).toThrow(UnitMismatchError);
  });

  it.each(LOCALES)('draws no percentage at all in $lang, so the wrong number never reaches a reader', ({ ctx }) => {
    const container = document.createElement('div');
    thrownBy(<ScaleCheck panel={panel} ctx={ctx} />, container);
    // fmtPct is the only thing in this panel that can emit "%": every display string above
    // spells its unit out. A refusal that arrives after the numeral draws is not a refusal.
    expect(container.textContent ?? '').not.toContain('%');
  });
});

describe('AC-INV-7 dimensional: the error names the offending segment', () => {
  // One coherent segment and one mismatched one, so "names a segment" and "names the RIGHT
  // segment" are different assertions. A guard that reports the panel and leaves the reader to
  // find which of five rows is broken has not done the job.
  const mixed = panelOf({ amount: 5234.6, unit: 'USD_B' }, [
    { el_id: 'uc-seg-innocent', amount: 43.8, unit: 'USD_B' },
    { el_id: 'uc-seg-offender', amount: 26, unit: 'percent' },
  ]);

  it('names the mismatched segment and not the coherent one', () => {
    const error = thrownBy(<ScaleCheck panel={mixed} ctx={EN} />, document.createElement('div'));
    expect(error).toBeInstanceOf(UnitMismatchError);
    expect(error.message).toContain('uc-seg-offender');
    expect(error.message).not.toContain('uc-seg-innocent');
  });

  it('carries both units, so the failure states which division was refused', () => {
    const error = thrownBy(<ScaleCheck panel={mixed} ctx={EN} />, document.createElement('div'));
    expect(error.message).toContain('percent');
    expect(error.message).toContain('USD_B');
  });

  it('is thrown under the name the ctx error family uses', () => {
    const error = thrownBy(<ScaleCheck panel={mixed} ctx={EN} />, document.createElement('div'));
    expect(error.name).toBe('UnitMismatchError');
  });

  it('refuses on a later segment too, not only the first', () => {
    // The first segment is the panel's subject and the obvious one to check. A loop that stops
    // early, or a guard written against segments[0], would pass every case above and still ship
    // usaid-deficit's second row.
    const trailing = panelOf({ amount: 12, unit: 'percent' }, [
      { el_id: 'uc-seg-first', amount: 11, unit: 'percent' },
      { el_id: 'uc-seg-second', amount: 11, unit: 'percent' },
      { el_id: 'uc-seg-third', amount: 4711, unit: 'count' },
    ]);
    const error = thrownBy(<ScaleCheck panel={trailing} ctx={EN} />, document.createElement('div'));
    expect(error).toBeInstanceOf(UnitMismatchError);
    expect(error.message).toContain('uc-seg-third');
  });
});

// --- the negative control ----------------------------------------------------------------

const COHERENT = [
  { name: 'rupiah trillions, the mbg shape', unit: 'IDR_T' as Unit, denominator: 400, amount: 100, expected: 25 },
  { name: 'percent over percent, the ppn-panic shape', unit: 'percent' as Unit, denominator: 12, amount: 11, expected: 91.6667 },
  { name: 'dollars in billions, usaid-deficit made coherent', unit: 'USD_B' as Unit, denominator: 5234.6, amount: 43.8, expected: 0.8367 },
  { name: 'a count over a count, awkward rounding', unit: 'count' as Unit, denominator: 3, amount: 1, expected: 33.3333 },
];

describe.each(COHERENT)('AC-INV-7 dimensional: still renders $name', ({ unit, denominator, amount, expected }) => {
  const panel = panelOf({ amount: denominator, unit }, [{ el_id: 'uc-seg-coherent', amount, unit }]);

  it.each(LOCALES)('derives the percentage within 0.1pp in $lang', ({ ctx }) => {
    const { container } = render(<ScaleCheck panel={panel} ctx={ctx} />);
    expect(
      Math.abs(renderedPct(container, 'uc-seg-coherent') - expected),
      `${amount} of ${denominator} ${unit} is ${expected}%`,
    ).toBeLessThanOrEqual(TOLERANCE_PP);
  });
});

describe('AC-INV-7 dimensional: the guard is scoped to the division', () => {
  it('renders every segment of a multi-segment coherent panel', () => {
    const panel = panelOf({ amount: 3842.7, unit: 'IDR_T' }, [
      { el_id: 'uc-seg-a', amount: 71, unit: 'IDR_T' },
      { el_id: 'uc-seg-b', amount: 689.1, unit: 'IDR_T' },
      { el_id: 'uc-seg-c', amount: 268, unit: 'IDR_T' },
    ]);
    const { container } = render(<ScaleCheck panel={panel} ctx={EN} />);
    for (const segment of panel.segments) {
      const expected = (segment.value.amount / panel.denominator.value.amount) * 100;
      expect(
        Math.abs(renderedPct(container, segment.el_id) - expected),
        `${segment.el_id}: ${segment.value.amount} of 3842.7 is ${expected}%`,
      ).toBeLessThanOrEqual(TOLERANCE_PP);
    }
  });

  it('does not refuse a context chip whose unit differs, because no chip is divided', () => {
    // The shipped usaid-deficit panel carried percent chips ("11 percent correct guess",
    // "58 percent support before") under its dollar denominator. Chips render a display string
    // and nothing else. Rejecting them would be a guard on the word "unit" rather than on the
    // division, and would refuse content the invariant has no quarrel with.
    const panel = panelOf(
      { amount: 5234.6, unit: 'USD_B' },
      [{ el_id: 'uc-seg-aid', amount: 43.8, unit: 'USD_B' }],
      [
        { el_id: 'uc-chip-correct-guess', amount: 11, unit: 'percent' },
        { el_id: 'uc-chip-recipients', amount: 4711, unit: 'count' },
      ],
    );
    const { container } = render(<ScaleCheck panel={panel} ctx={EN} />);
    expect(container.querySelector('[data-el="uc-chip-correct-guess"]')?.textContent).toContain('11 percent');
    expect(container.querySelector('[data-el="uc-chip-recipients"]')?.textContent).toContain('4711 count');
    expect(Math.abs(renderedPct(container, 'uc-seg-aid') - 0.8367)).toBeLessThanOrEqual(TOLERANCE_PP);
  });

  it('renders a panel with no segments at all', () => {
    // Vacuously coherent. A guard that throws on an empty segment list is checking the wrong
    // thing, and the empty case is the one an over-eager rewrite of the loop gets wrong.
    expect(() => render(<ScaleCheck panel={panelOf({ amount: 100, unit: 'count' }, [])} ctx={EN} />)).not.toThrow();
  });
});
