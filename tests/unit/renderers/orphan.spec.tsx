// @vitest-environment jsdom
/**
 * PROVES: AC-INV-1 (no orphan numbers).
 *
 * Blueprint 6.2: renderers accept numbers only inside a `Value`, and a `Value` whose
 * `source_id` fails resolution throws `OrphanNumberError` at render. Gate 2 plan: that throw
 * lands "before any numeral draws".
 *
 * Every one of the eight grammar components, plus Card and ValueText, gets a matched pair
 * built from the seed content root:
 *   red    the same props with exactly ONE source reference rewritten to an unknown id
 *   green  the pristine props, as a positive control that the red case failed for the orphan
 *          and not because the component cannot render its own fixture
 *
 * Two scopes of refusal, both required:
 *   panel-scoped (ClaimMap, ScaleCheck, MoneyFlow, Incidence, Dueling, Echo, Options) refuse
 *     when a reference inside their own panel props does not resolve;
 *   narrative-scoped (Card, Family) refuse when ANY reference in the narrative they are handed
 *     does not resolve. Neither draws a numeral of its own, and a narrative carrying an orphan
 *     is not a renderable narrative: fail closed at the surface that owns the whole artifact.
 *
 * Echo and Options carry no `Value`; their source references are `historical.citations[]` and
 * `proponent.source_id`. The invariant is about references that must resolve, so those count.
 *
 * Fixture paths: tests/fixtures/seed. Post-install home of this file: tests/unit/renderers/.
 */
import type { ReactElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  ClaimMapPanel,
  DuelingPanel,
  EchoPanel,
  IncidencePanel,
  MoneyFlowPanel,
  OptionsPanel,
  ScaleCheckPanel,
} from '../../../contracts/types';
import { OrphanNumberError, makeCtx } from '../../../app/src/renderers/ctx';
import ValueText from '../../../app/src/renderers/ValueText';
import ClaimMap from '../../../app/src/renderers/ClaimMap';
import ScaleCheck from '../../../app/src/renderers/ScaleCheck';
import MoneyFlow from '../../../app/src/renderers/MoneyFlow';
import Incidence from '../../../app/src/renderers/Incidence';
import Dueling from '../../../app/src/renderers/Dueling';
import Echo from '../../../app/src/renderers/Echo';
import Options from '../../../app/src/renderers/Options';
import Family from '../../../app/src/renderers/Family';
import Card from '../../../app/src/renderers/Card';
import {
  UNKNOWN_SOURCE_ID,
  requireValue,
  seedNarrative,
  seedPanel,
  seedSources,
  withOneOrphan,
} from './seed';

afterEach(cleanup);

const sources = seedSources();
const ctx = makeCtx(sources, 'en', 'light');

const stop = seedNarrative('mbg-stop');
const poisoning = seedNarrative('mbg-poisoning');
const ppn = seedNarrative('ppn-panic');

const claimMap = seedPanel<ClaimMapPanel>(stop, 'claim_map');
const scaleCheck = seedPanel<ScaleCheckPanel>(stop, 'scale_check');
const moneyFlow = seedPanel<MoneyFlowPanel>(stop, 'money_flow');
const incidence = seedPanel<IncidencePanel>(stop, 'incidence');
const options = seedPanel<OptionsPanel>(stop, 'options');
const dueling = seedPanel<DuelingPanel>(poisoning, 'dueling');
const echo: EchoPanel = requireEcho(ppn.echo);

const spineValue = requireValue(claimMap.spine[1]?.value, 'mbg-stop claim_map spine[1].value');

function requireEcho(panel: EchoPanel | null): EchoPanel {
  if (panel === null) throw new Error('seed narrative ppn-panic carries no echo panel');
  return panel;
}

interface OrphanCase {
  name: string;
  good: ReactElement;
  orphaned: ReactElement;
}

/** Same element factory, once over pristine props and once over props with one broken ref. */
function orphanCase<S>(name: string, subject: S, element: (subject: S) => ReactElement): OrphanCase {
  return { name, good: element(subject), orphaned: element(withOneOrphan(subject)) };
}

const cases: OrphanCase[] = [
  orphanCase('ValueText', spineValue, (value) => <ValueText value={value} ctx={ctx} />),
  orphanCase('ClaimMap', claimMap, (panel) => <ClaimMap panel={panel} ctx={ctx} />),
  orphanCase('ScaleCheck', scaleCheck, (panel) => <ScaleCheck panel={panel} ctx={ctx} />),
  orphanCase('MoneyFlow', moneyFlow, (panel) => <MoneyFlow panel={panel} ctx={ctx} stopped={false} />),
  orphanCase('Incidence', incidence, (panel) => <Incidence panel={panel} ctx={ctx} />),
  orphanCase('Dueling', dueling, (panel) => <Dueling panel={panel} ctx={ctx} />),
  orphanCase('Echo', echo, (panel) => <Echo panel={panel} ctx={ctx} />),
  orphanCase('Options', options, (panel) => <Options panel={panel} ctx={ctx} />),
  orphanCase('Family', stop, (narrative) => <Family narrative={narrative} ctx={ctx} />),
  orphanCase('Card', stop, (narrative) => <Card narrative={narrative} variant="hero" ctx={ctx} />),
];

describe.each(cases)('AC-INV-1 $name', ({ good, orphaned }) => {
  it('throws OrphanNumberError when one source reference does not resolve', () => {
    expect(() => render(orphaned)).toThrow(OrphanNumberError);
  });

  it('renders the pristine seed props without throwing', () => {
    expect(() => render(good)).not.toThrow();
  });
});

describe('AC-INV-1 positive controls the case table cannot express', () => {
  it('Echo renders the silence state from a null panel', () => {
    expect(() => render(<Echo panel={null} ctx={ctx} />)).not.toThrow();
  });

  it('MoneyFlow renders with the stop toggle on', () => {
    expect(() => render(<MoneyFlow panel={moneyFlow} ctx={ctx} stopped={true} />)).not.toThrow();
  });

  it('Card renders the compact variant', () => {
    expect(() => render(<Card narrative={poisoning} variant="compact" ctx={ctx} />)).not.toThrow();
  });
});

describe('AC-INV-1 RenderCtx.resolveSource', () => {
  it('returns the registry entry for an id that resolves', () => {
    const first = sources[0];
    expect(first).toBeDefined();
    expect(ctx.resolveSource(first?.id ?? '')).toEqual(first);
  });

  it('throws OrphanNumberError naming the id that does not resolve', () => {
    expect(() => ctx.resolveSource(UNKNOWN_SOURCE_ID)).toThrow(OrphanNumberError);
    expect(() => ctx.resolveSource(UNKNOWN_SOURCE_ID)).toThrow(UNKNOWN_SOURCE_ID);
  });

  it('carries the language and theme it was built with', () => {
    expect(ctx.lang).toBe('en');
    expect(ctx.theme).toBe('light');
    expect(makeCtx(sources, 'id', 'dark').lang).toBe('id');
    expect(makeCtx(sources, 'id', 'dark').theme).toBe('dark');
  });
});
