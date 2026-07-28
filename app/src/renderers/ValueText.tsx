/**
 * The numeral primitive, and the source line that always accompanies one.
 *
 * Blueprint 6.2: a number reaches the DOM only inside a `Value`, and only after its `source_id`
 * resolves. `ValueText` is where that resolution happens for every panel that draws a figure, so
 * the invariant is one call in one place rather than a rule everyone remembers.
 */
import type { Source, Value } from '../../../contracts/types';
import { t, type RenderCtx } from './ctx';
import { UI } from './copy';

interface ValueTextProps {
  value: Value;
  ctx: RenderCtx;
  className?: string;
}

/** The display string for the context language, in tabular numerals. Throws on an orphan. */
export default function ValueText({ value, ctx, className }: ValueTextProps) {
  ctx.resolveSource(value.source_id);
  return <span className={className === undefined ? 'm-num' : `m-num ${className}`}>{t(ctx, value.display)}</span>;
}

/** The zip's "Source: X · self-reported" line, from a source already resolved by the caller. */
export function SourceLine({ source, ctx }: { source: Source; ctx: RenderCtx }) {
  return (
    <div className="m-src">
      {t(ctx, UI.source)}
      {source.publisher}
      {source.self_reported ? <span className="m-selfrep">{t(ctx, UI.selfReported)}</span> : null}
    </div>
  );
}
