/**
 * AC-GRAM-2 and AC-INV-7. The scale check: a denominator, the segments read against it, the
 * takeaway, and the context chips.
 *
 * The percentage is derived here and nowhere else: `value.amount / denominator.value.amount`.
 * Section 6.4 carries no `pct` field, and one decimal place is the floor, because a whole-number
 * rounding of 1 in 3 is a third of a percentage point away from the truth.
 *
 * Ported from the zip's `p.isScale` block: the denominator line, the label / display / percent
 * row, the 9px rounded track with its `data-srb` bar, the takeaway rule, and the chip row.
 */
import type { ScaleCheckPanel } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import ValueText from './ValueText';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function ScaleCheck({ panel, ctx }: { panel: ScaleCheckPanel; ctx: RenderCtx }) {
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.scale_check);
  const denominator = panel.denominator.value.amount;
  const pct = (amount: number): number => (denominator === 0 ? 0 : (amount / denominator) * 100);
  const fmtPct = (value: number): string => {
    const fixed = value.toFixed(1);
    return `${ctx.lang === 'id' ? fixed.replace('.', ',') : fixed}%`;
  };

  return (
    <section
      className="m-panel"
      {...elProps(panel.el_id, open, () => panelSheet(ctx, title, [t(ctx, panel.takeaway)], sources), 'group')}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-scale">
        <div className="m-denom">
          {t(ctx, UI.denominator)}
          <span className="m-denom-label">{t(ctx, panel.denominator.label)}</span>
          {': '}
          <ValueText value={panel.denominator.value} ctx={ctx} />
          {' · '}
          {ctx.resolveSource(panel.denominator.value.source_id).publisher}
        </div>
        {panel.segments.map((segment, index) => (
          <div
            key={segment.el_id}
            className="m-seg"
            /* ponytail: the first segment is the subject, the rest are comparators. The zip
               carried an explicit highlight flag; Section 6.4 does not, and segment order is
               the only signal in the contract. A `hl` field would change this back to data. */
            data-st={index === 0 ? 'ink' : 'mut'}
            {...elProps(segment.el_id, open, () => ({
              label: t(ctx, UI.evidence),
              title: t(ctx, segment.label),
              values: [segment.value],
              body: [`${fmtPct(pct(segment.value.amount))} · ${t(ctx, panel.denominator.label)}`],
              sources: [ctx.resolveSource(segment.value.source_id)],
            }))}
          >
            <div className="m-seg-row">
              <span className="m-seg-label">{t(ctx, segment.label)}</span>
              <ValueText value={segment.value} ctx={ctx} className="m-seg-val" />
              <span className="m-seg-pct">{fmtPct(pct(segment.value.amount))}</span>
            </div>
            <svg width="100%" height="9" className="m-bar" aria-hidden="true">
              <rect x="0" y="0" width="100%" height="9" rx="4.5" className="m-bar-track" />
              <rect
                x="0"
                y="0"
                width={`${Math.min(pct(segment.value.amount), 100)}%`}
                height="9"
                rx="4.5"
                fill="currentColor"
                data-srb="1"
              />
            </svg>
          </div>
        ))}
        <div className="m-takeaway">
          <div className="m-takeaway-label">{t(ctx, UI.takeaway)}</div>
          <div className="m-takeaway-text">{t(ctx, panel.takeaway)}</div>
        </div>
        <div className="m-chips">
          {panel.context_chips.map((chip) => (
            <span
              key={chip.el_id}
              className="m-chip"
              {...elProps(chip.el_id, open, () => ({
                label: t(ctx, UI.evidence),
                title: t(ctx, chip.label),
                values: [chip.value],
                sources: [ctx.resolveSource(chip.value.source_id)],
              }))}
            >
              {t(ctx, chip.label)} · <ValueText value={chip.value} ctx={ctx} />
            </span>
          ))}
        </div>
      </div>
      {sheet}
    </section>
  );
}
