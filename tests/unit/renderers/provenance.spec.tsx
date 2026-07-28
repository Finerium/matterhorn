// @vitest-environment jsdom
/**
 * PROVES: AC-INV-10 (provenance is transcribed, never authored).
 *
 * Blueprint 6.3 gives every narrative a `provenance` block and a `GenerationManifest`. The
 * honest claim the product makes is that the names it shows are the names that ran, read out
 * of the artifact at render time. A model name typed into a component is the exact failure
 * this AC exists to prevent: it survives a pipeline change, it survives a model swap, and it
 * lies quietly.
 *
 * No provenance line component is pinned for Gate 2, so the card is where this is asserted:
 * Card is the one narrative-scoped surface that exists, so it is the one that carries the
 * provenance strings. Two halves:
 *   render  the strings the card shows are byte-identical to the fixture fields, which the
 *           mutation case proves by changing the fixture and watching the render follow
 *   grep    no module under app/src carries a hardcoded model name outside a comment
 *
 * The seed root writes "seed-fixture" into every provenance and manifest model field, which
 * is itself the point: a seed artifact must not be able to claim a real model ran on it.
 *
 * Fixture paths: tests/fixtures/seed. Post-install home of this file: tests/unit/renderers/.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Narrative } from '../../../contracts/types';
import { makeCtx } from '../../../app/src/renderers/ctx';
import Card from '../../../app/src/renderers/Card';
import { seedNarrative, seedSources } from './seed';

afterEach(cleanup);

const ctx = makeCtx(seedSources(), 'en', 'light');
const stop = seedNarrative('mbg-stop');

/**
 * A vendor name followed by a version-ish token. Narrow on purpose: it catches "Claude 4.5",
 * "GPT 5", "Opus 4" and their unspaced forms, and it does not fire on ordinary prose.
 */
const HARDCODED_MODEL = /(Opus|Sonnet|Haiku|Fable|GPT|Gemini|Claude)\s*[0-9.]/;

/** ponytail: regex comment stripping, same ceiling as card-contract.spec.tsx. */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('AC-INV-10 the card renders provenance verbatim from the artifact', () => {
  it('shows analyzed_by and narrated_by exactly as the fixture writes them', () => {
    const { container } = render(<Card narrative={stop} variant="hero" ctx={ctx} />);
    expect(stop.provenance.analyzed_by).toBe('seed-fixture');
    expect(stop.provenance.narrated_by).toBe('seed-fixture');
    expect(container.textContent).toContain(stop.provenance.analyzed_by);
    expect(container.textContent).toContain(stop.provenance.narrated_by);
  });

  it('follows the artifact when the artifact changes, so the strings are read and not typed', () => {
    const restated: Narrative = structuredClone(stop);
    restated.provenance.analyzed_by = 'a5-analyst-under-test';
    restated.provenance.narrated_by = 'a11-narrator-under-test';

    const { container } = render(<Card narrative={restated} variant="hero" ctx={ctx} />);
    expect(container.textContent).toContain('a5-analyst-under-test');
    expect(container.textContent).toContain('a11-narrator-under-test');
    expect(container.textContent).not.toContain('seed-fixture');
  });

  it('renders no hardcoded model name of its own', () => {
    const { container } = render(<Card narrative={stop} variant="hero" ctx={ctx} />);
    expect(container.textContent ?? '').not.toMatch(HARDCODED_MODEL);
  });

  it('keeps the seed manifest honest: every step model is the seed placeholder', () => {
    for (const step of stop.manifest.steps) {
      expect(step.model).toBe('seed-fixture');
      expect(step.model).not.toMatch(HARDCODED_MODEL);
    }
  });
});

// --- the structural half: no model name compiled into the app ---------------------------

const APP_SRC = join(process.cwd(), 'app', 'src');

function appModules(): string[] {
  return readdirSync(APP_SRC, { recursive: true })
    .map(String)
    .filter((rel) => /\.(?:ts|tsx|js|jsx|mjs|css|html)$/.test(rel) && statSync(join(APP_SRC, rel)).isFile())
    .sort((a, b) => a.localeCompare(b));
}

describe('AC-INV-10 no app module hardcodes a model name', () => {
  it('finds no vendor-plus-version token in app/src outside comments', () => {
    const offenders = appModules().filter((rel) =>
      HARDCODED_MODEL.test(stripComments(readFileSync(join(APP_SRC, rel), 'utf8'))),
    );
    expect(offenders, 'model names belong in the artifact manifest, never in a module').toEqual([]);
  });

  it('is not vacuous: the pattern fires on the string it is meant to catch', () => {
    expect(HARDCODED_MODEL.test('narrated by Claude 4.5 Sonnet')).toBe(true);
    expect(HARDCODED_MODEL.test('analyzed_by: seed-fixture')).toBe(false);
  });
});
