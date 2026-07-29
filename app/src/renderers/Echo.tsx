/**
 * AC-GRAM-6. Echo: the motif now, the same motif on file, and what was documented to have
 * happened that time. Retrospective and cited, never predictive.
 *
 * `panel === null` is the silence state, and it is a first-class render rather than an absence:
 * the section keeps its frame and its title and says that no case on file carries this motif.
 * It does not dramatize. The disclaimer region named by `disclaimer_key` is simply not there,
 * because there is no retrospective claim to qualify.
 *
 * Ported from the zip's `p.isEcho` block: the two-up now / on-file grid with the unsourced
 * border treatment on the historical card, the documented-outcome rule, and the citation chips.
 */
import type { EchoPanel } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function Echo({ panel, ctx }: { panel: EchoPanel | null; ctx: RenderCtx }) {
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.echo);

  if (panel === null) {
    return (
      <section className="m-panel" data-echo="silence">
        <div className="m-panel-title">{title}</div>
        <div className="m-echo-silence">{t(ctx, UI.echoSilence)}</div>
      </section>
    );
  }

  const citations = panel.historical.citations.map((id) => ctx.resolveSource(id));
  return (
    <section
      className="m-panel"
      data-panel="echo"
      data-echo="cited"
      {...elProps(
        panel.el_id,
        open,
        () => panelSheet(ctx, title, [t(ctx, panel.historical.outcome)], sources),
        'group',
      )}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-echo">
        <div className="m-echo-now">
          <div className="m-echo-label">{t(ctx, UI.now)}</div>
          <div className="m-echo-motif">{t(ctx, panel.current_motif)}</div>
        </div>
        <div className="m-echo-hist">
          <div className="m-echo-label m-echo-label-uns">
            {t(ctx, UI.onFile)}
            {panel.historical.case_id}
          </div>
          <div className="m-echo-motif">{t(ctx, panel.historical.motif)}</div>
        </div>
      </div>
      <div className="m-echo-out">
        <div className="m-echo-outlabel">{t(ctx, UI.documentedOutcome)}</div>
        <div className="m-echo-outtext">{t(ctx, panel.historical.outcome)}</div>
        <div className="m-chips">
          {citations.map((source) => (
            <span key={source.id} className="m-chip">
              {source.publisher}
            </span>
          ))}
        </div>
        <div className="m-echo-note">
          {t(ctx, UI.echoDisclaimer)}
          {panel.historical.case_id}
        </div>
      </div>
      {sheet}
    </section>
  );
}
