/**
 * The render context every grammar component takes, and the three refusals the layer is built on.
 *
 * Blueprint 6.2: renderers accept numbers only inside a `Value`, and a `Value` whose `source_id`
 * fails resolution throws `OrphanNumberError` at render, before any numeral draws. Blueprint 6.5:
 * card chips render exclusively from derived `counts`, so a narrative missing `counts` or `tags`
 * is not a renderable artifact and the card throws `CardContractError`. Blueprint 6.4: the one
 * percentage this layer derives is a division of one `Value` by another, so a segment whose unit
 * differs from its denominator's is not a share of it and throws `UnitMismatchError` rather than
 * render a figure that is arithmetically fine and means nothing.
 *
 * Two scopes of refusal, both real:
 *   panel-scoped    a grammar component resolves every reference inside its own panel props
 *   narrative-scoped Card and Family draw no Value of their own, so they resolve every reference
 *                   in the whole narrative they are handed. A narrative carrying an orphan is not
 *                   a renderable narrative.
 * Both are one call to `resolveAll` at the top of the component body.
 */
import type { Lang, Source, SourceId, Value } from '../../../contracts/types';

export type Theme = 'light' | 'dark';

/** A localized copy pair. `id` is optional because Narrative.headline declares it optional. */
export interface Copy {
  en: string;
  id?: string;
}

/** Blueprint 6.2. Thrown at render, never caught inside the renderer layer. */
export class OrphanNumberError extends Error {
  readonly sourceId: string;

  constructor(sourceId: string) {
    super(
      `OrphanNumberError: source id "${sourceId}" resolves in no registry. ` +
        'A number without a source that resolves does not render.',
    );
    this.name = 'OrphanNumberError';
    this.sourceId = sourceId;
  }
}

/** Blueprint 6.5. An artifact that never went through derivation cannot be carded. */
export class CardContractError extends Error {
  constructor(detail: string) {
    super(`CardContractError: ${detail}. Card chips render from derived counts only.`);
    this.name = 'CardContractError';
  }
}

/**
 * Blueprint 6.4. Two Values divide into a share only when they measure the same thing.
 *
 * The parts are constructor arguments rather than a formatted detail string because an invariant
 * that fires without naming the element that broke it is a bug report nobody can action.
 */
export class UnitMismatchError extends Error {
  readonly elId: string;

  constructor(panelElId: string, elId: string, unit: Value['unit'], denominatorUnit: Value['unit']) {
    super(
      `UnitMismatchError: panel "${panelElId}" element "${elId}" is in ${unit}, ` +
        `its denominator in ${denominatorUnit}. A share is only a share across one unit.`,
    );
    this.name = 'UnitMismatchError';
    this.elId = elId;
  }
}

export interface RenderCtx {
  lang: Lang;
  theme: Theme;
  /** The registry entry for `id`, or `OrphanNumberError`. */
  resolveSource(id: SourceId): Source;
}

export function makeCtx(sources: Source[], lang: Lang, theme: Theme): RenderCtx {
  const byId = new Map(sources.map((s) => [s.id, s]));
  return {
    lang,
    theme,
    resolveSource(id: SourceId): Source {
      const found = byId.get(id);
      if (found === undefined) throw new OrphanNumberError(id);
      return found;
    },
  };
}

/** The string for the context language, falling back to `en` where `id` is absent. */
export const t = (ctx: RenderCtx, copy: Copy): string =>
  ctx.lang === 'id' && copy.id !== undefined ? copy.id : copy.en;

/**
 * Every source reference reachable in `node`, depth first in declaration order, deduped.
 * The two reference shapes in Section 6.4 are a `source_id` string and a `citations` array of
 * ids; there is no third, and a new one would have to be added here and to the contract together.
 */
export function sourceIds(node: unknown, out: SourceId[] = []): SourceId[] {
  if (Array.isArray(node)) {
    for (const item of node) sourceIds(item, out);
    return out;
  }
  if (typeof node !== 'object' || node === null) return out;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'source_id' && typeof value === 'string') {
      if (!out.includes(value)) out.push(value);
    } else if (key === 'citations' && Array.isArray(value)) {
      for (const cite of value) if (typeof cite === 'string' && !out.includes(cite)) out.push(cite);
    } else {
      sourceIds(value, out);
    }
  }
  return out;
}

/** Resolves every reference in `node`, throwing on the first that does not. */
export const resolveAll = (node: unknown, ctx: RenderCtx): Source[] =>
  sourceIds(node).map((id) => ctx.resolveSource(id));

/** Status vocabulary shared by the claim map, the chips, and the evidence sheet pill. */
export type ElStatus = 'supported' | 'disputed' | 'missing' | 'unsourced' | 'hidden';

/**
 * Stroke patterns, so status never travels by colour alone. Ported from the zip's claim-map
 * edges; `supported` is solid and carries no attribute at all.
 */
export const DASH: Record<ElStatus, string | undefined> = {
  supported: undefined,
  disputed: '5 3.5',
  missing: '2 3.5',
  unsourced: '7 2.5 2 2.5',
  hidden: '2 3.5',
};
