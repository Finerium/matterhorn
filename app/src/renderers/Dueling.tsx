/**
 * AC-GRAM-5. Dueling counts: two to four institutions side by side, and the rule line that
 * refuses to pick between them.
 *
 * Each entry states who counted, what they counted, and over which window, because that is the
 * whole finding: the numbers differ because the methods differ.
 *
 * Ported from the zip's `p.isDuel` block: the auto-fit grid at a 96px minimum, the 22px tabular
 * figure, the period pill, and the note under the grid.
 */
import type { DuelingPanel } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import ValueText, { SourceLine } from './ValueText';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function Dueling({ panel, ctx }: { panel: DuelingPanel; ctx: RenderCtx }) {
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.dueling);

  return (
    <section
      className="m-panel"
      data-panel="dueling"
      {...elProps(panel.el_id, open, () => panelSheet(ctx, title, [t(ctx, panel.rule_line)], sources), 'group')}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-duel">
        {panel.counts.map((entry) => {
          const source = ctx.resolveSource(entry.value.source_id);
          return (
            <div
              key={entry.el_id}
              className="m-duel-card"
              data-press="1"
              {...elProps(entry.el_id, open, () => ({
                label: t(ctx, UI.evidence),
                title: entry.who,
                values: [entry.value],
                body: [t(ctx, entry.method), entry.period],
                sources: [source],
              }))}
            >
              <div className="m-duel-who">{entry.who}</div>
              <ValueText value={entry.value} ctx={ctx} className="m-duel-val" />
              <div className="m-duel-method">{t(ctx, entry.method)}</div>
              <div className="m-duel-period">{entry.period}</div>
              <SourceLine source={source} ctx={ctx} />
            </div>
          );
        })}
      </div>
      <div className="m-duel-note">{t(ctx, panel.rule_line)}</div>
      {sheet}
    </section>
  );
}
