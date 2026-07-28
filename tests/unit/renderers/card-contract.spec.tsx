// @vitest-environment jsdom
/**
 * PROVES: AC-INV-2 (the card contract, and no second headline path).
 *
 * Blueprint 6.5: card chips, autopsy chips, notification copy and Nuance Cards render
 * exclusively from `counts`, which is derived and never authored. Gate 2 plan: the card
 * component throws `CardContractError` when `counts` or `tags` are absent or empty.
 *
 * Absent is not the same as zero. A narrative whose every count is 0 is a complete artifact
 * that simply has nothing to flag, and it renders with no chips. A narrative with no `counts`
 * key at all never went through derivation, and refusing it is the whole point.
 *
 * Chip vocabulary is the zip's, verbatim (Matterhorn.dc.html chipsFor):
 *   missing    "N missing link" / "N missing links"   data-st="missing"
 *   unsourced  "N unsourced"                          data-st="unsourced"
 *   disputed   "N disputed"                           data-st="disputed"
 *   conflicts  "N official counts conflict"           data-st="disputed"
 *   hidden     "N hidden"                             data-st="hidden"
 * `supported` has no chip. Assertions match the count plus one keyword, never a whole
 * sentence, so pluralisation stays the implementer's business.
 *
 * The structural half is a filesystem grep, run at test time against the real app tree: the
 * string ".headline" may appear in app/src/renderers/Card.tsx and in the harness only. A
 * second module that quietly renders a headline is a second contract, unpoliced by this file
 * and by the counts derivation, so the grep forecloses it rather than trusting review.
 *
 * Fixture paths: tests/fixtures/seed. Post-install home of this file: tests/unit/renderers/.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Narrative } from '../../../contracts/types';
import { CardContractError, makeCtx } from '../../../app/src/renderers/ctx';
import Card from '../../../app/src/renderers/Card';
import { seedNarrative, seedSources } from './seed';

afterEach(cleanup);

const ctx = makeCtx(seedSources(), 'en', 'light');
const stop = seedNarrative('mbg-stop');
const poisoning = seedNarrative('mbg-poisoning');

/** Drops one required key, which is exactly the artifact shape the card must refuse. */
function without(narrative: Narrative, key: 'counts' | 'tags'): Narrative {
  const copy = structuredClone(narrative) as unknown as Record<string, unknown>;
  delete copy[key];
  return copy as unknown as Narrative;
}

/** The chip carrying `status` whose text matches, or undefined. */
function chip(root: HTMLElement, status: string, text: RegExp): HTMLElement | undefined {
  return [...root.querySelectorAll<HTMLElement>(`[data-st="${status}"]`)].find((el) =>
    text.test(el.textContent ?? ''),
  );
}

describe('AC-INV-2 the card refuses an incomplete artifact', () => {
  it('throws CardContractError when counts is absent', () => {
    expect(() => render(<Card narrative={without(stop, 'counts')} variant="hero" ctx={ctx} />)).toThrow(
      CardContractError,
    );
  });

  it('throws CardContractError when tags is absent', () => {
    expect(() => render(<Card narrative={without(stop, 'tags')} variant="hero" ctx={ctx} />)).toThrow(
      CardContractError,
    );
  });

  it('throws CardContractError when tags is an empty array', () => {
    const noTags: Narrative = { ...structuredClone(stop), tags: [] };
    expect(() => render(<Card narrative={noTags} variant="hero" ctx={ctx} />)).toThrow(CardContractError);
  });

  it('refuses in the compact variant too, so neither slot is a way around the contract', () => {
    expect(() => render(<Card narrative={without(stop, 'counts')} variant="compact" ctx={ctx} />)).toThrow(
      CardContractError,
    );
  });

  it('accepts counts whose every field is zero and renders no chips', () => {
    const quiet: Narrative = {
      ...structuredClone(stop),
      counts: { missing: 0, unsourced: 0, disputed: 0, supported: 0, hidden: 0 },
    };
    const { container } = render(<Card narrative={quiet} variant="hero" ctx={ctx} />);
    expect(container.textContent).toContain(quiet.headline.en);
    expect(container.querySelectorAll('[data-st]')).toHaveLength(0);
  });
});

describe('AC-INV-2 the card renders headline, every nonzero chip, and every tag', () => {
  it('renders mbg-stop: 1 missing link, 1 unsourced, 4 hidden', () => {
    const { container } = render(<Card narrative={stop} variant="hero" ctx={ctx} />);

    expect(container.textContent).toContain(stop.headline.en);
    expect(chip(container, 'missing', /\b1\b.*missing link/i)).toBeDefined();
    expect(chip(container, 'unsourced', /\b1\b.*unsourced/i)).toBeDefined();
    expect(chip(container, 'hidden', /\b4\b.*hidden/i)).toBeDefined();

    for (const tag of stop.tags) expect(container.textContent).toContain(tag);

    // counts.disputed is 0 and counts.supported never gets a chip at all.
    expect(container.textContent).not.toMatch(/\d+\s*disputed/i);
    expect(container.textContent).not.toMatch(/supported/i);
  });

  it('renders mbg-poisoning: 1 disputed, 3 official counts conflict, 2 hidden', () => {
    const { container } = render(<Card narrative={poisoning} variant="compact" ctx={ctx} />);

    expect(container.textContent).toContain(poisoning.headline.en);
    expect(chip(container, 'disputed', /\b1\b.*disputed/i)).toBeDefined();
    expect(chip(container, 'disputed', /\b3\b.*official counts conflict/i)).toBeDefined();
    expect(chip(container, 'hidden', /\b2\b.*hidden/i)).toBeDefined();

    for (const tag of poisoning.tags) expect(container.textContent).toContain(tag);

    // counts.missing and counts.unsourced are both 0 here.
    expect(container.textContent).not.toMatch(/\d+\s*missing link/i);
    expect(container.textContent).not.toMatch(/\d+\s*unsourced/i);
  });

  it('reads the chip numbers from counts, not from the panels', () => {
    // The validator owns "counts match the panels". The card owns "chips match counts", and
    // the only way to tell the two apart is to hand it counts the panels do not justify.
    const restated: Narrative = {
      ...structuredClone(stop),
      counts: { missing: 7, unsourced: 0, disputed: 0, supported: 0, hidden: 0 },
    };
    const { container } = render(<Card narrative={restated} variant="hero" ctx={ctx} />);
    expect(chip(container, 'missing', /\b7\b.*missing link/i)).toBeDefined();
    expect(container.querySelectorAll('[data-st]')).toHaveLength(1);
  });
});

// --- the structural half: no alternative headline path ---------------------------------

const APP_SRC = join(process.cwd(), 'app', 'src');
const CARD_MODULE = join('renderers', 'Card.tsx');
const HARNESS_DIR = `harness${sep}`;

/** Every .ts and .tsx module under app/src, repo-relative to app/src. */
function appModules(): string[] {
  return readdirSync(APP_SRC, { recursive: true })
    .map(String)
    .filter((rel) => /\.tsx?$/.test(rel) && statSync(join(APP_SRC, rel)).isFile())
    .sort((a, b) => a.localeCompare(b));
}

/**
 * ponytail: comment stripping by regex, not by parse. Ceiling: a `.headline` inside a string
 * literal that itself contains a comment delimiter would confuse it. Swap in a real scan only
 * if that ever happens.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('AC-INV-2 only one module renders a headline', () => {
  it('finds .headline in no app module except Card.tsx and the harness', () => {
    const offenders = appModules().filter(
      (rel) =>
        rel !== CARD_MODULE &&
        !rel.startsWith(HARNESS_DIR) &&
        stripComments(readFileSync(join(APP_SRC, rel), 'utf8')).includes('.headline'),
    );
    expect(offenders, `these app modules render a headline outside ${CARD_MODULE}`).toEqual([]);
  });

  it('is not vacuous: Card.tsx is the module that reads .headline', () => {
    const card = stripComments(readFileSync(join(APP_SRC, CARD_MODULE), 'utf8'));
    expect(card).toContain('.headline');
  });
});
