/**
 * AC-GRAM-7. Options: the positions named actors occupy, unranked, and the citizen playbook.
 *
 * No recommendation is drawn and no option is ordered by merit: the panel reports the spectrum.
 * Each option names its proponent, and the proponent resolves to a registry entry, which is what
 * its evidence sheet shows.
 *
 * Ported from the zip's options block: the fill-backed option cards with the "trades:" line, the
 * hairline-separated playbook rows, and the footer that states the rule.
 */
import type { OptionsPanel } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function Options({ panel, ctx }: { panel: OptionsPanel; ctx: RenderCtx }) {
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.options);

  return (
    <section
      className="m-panel"
      {...elProps(panel.el_id, open, () => panelSheet(ctx, title, [t(ctx, UI.optionsIntro)], sources), 'group')}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-opt-intro">{t(ctx, UI.optionsIntro)}</div>
      {panel.options.map((option) => {
        const source = ctx.resolveSource(option.proponent.source_id);
        return (
          <div
            key={option.el_id}
            className="m-opt"
            {...elProps(option.el_id, open, () => ({
              label: t(ctx, UI.evidence),
              title: t(ctx, option.label),
              body: [option.proponent.name, `${t(ctx, UI.trades)}${t(ctx, option.tradeoff)}`],
              sources: [source],
            }))}
          >
            <div className="m-opt-label">{t(ctx, option.label)}</div>
            <div className="m-opt-by">{option.proponent.name}</div>
            <div className="m-opt-trade">
              {t(ctx, UI.trades)}
              {t(ctx, option.tradeoff)}
            </div>
          </div>
        );
      })}
      <div className="m-pb-label">{t(ctx, UI.playbook)}</div>
      {panel.playbook.map((step, index) => (
        <div
          key={step.el_id}
          className="m-pb"
          {...elProps(step.el_id, open, () => ({
            label: t(ctx, UI.playbookStep),
            title: t(ctx, step.action),
            body: [t(ctx, step.channel)],
          }))}
        >
          {/* The zip's zero-padded step index: 01, 02, 03, so the column does not ragged out. */}
          <span className="m-pb-i">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <div className="m-pb-action">{t(ctx, step.action)}</div>
            <div className="m-pb-channel">{t(ctx, step.channel)}</div>
          </div>
        </div>
      ))}
      <div className="m-opt-foot">{t(ctx, UI.optionsFooter)}</div>
      {sheet}
    </section>
  );
}
