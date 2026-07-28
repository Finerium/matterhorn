/**
 * AC-GRAM-1. The claim map: the spine as the story tells it, the edges between its steps with
 * their status, and the column of what the story leaves out.
 *
 * Ported from the zip's `p.isMap` block: the 1.12fr / 0.92fr grid, the fill-backed spine rows,
 * the 12x32 edge stroke whose dash pattern carries the status alongside its colour, the dashed
 * connector rail down the hidden column, the four-entry legend, and the tap hint.
 */
import type { ClaimMapPanel } from '../../../contracts/types';
import { DASH, resolveAll, t, type ElStatus, type RenderCtx } from './ctx';
import { PANEL_TITLE, STATUS_LABEL, UI } from './copy';
import ValueText, { SourceLine } from './ValueText';
import { elProps, panelSheet, statusLabel, useEvidenceSheet } from './EvidenceSheet';

const LEGEND: ElStatus[] = ['supported', 'disputed', 'missing', 'unsourced'];

export default function ClaimMap({ panel, ctx }: { panel: ClaimMapPanel; ctx: RenderCtx }) {
  // Panel-scoped orphan refusal, before any numeral draws.
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.claim_map);

  return (
    <section
      className="m-panel"
      {...elProps(panel.el_id, open, () => panelSheet(ctx, title, [t(ctx, UI.tapHint)], sources), 'group')}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-map">
        <div>
          <div className="m-colhead">{t(ctx, UI.storyAsTold)}</div>
          {panel.spine.map((node) => {
            const edge = panel.edges.find((e) => e.from === node.el_id);
            return (
              <div key={node.el_id}>
                <div
                  className="m-node"
                  {...elProps(node.el_id, open, () => ({
                    label: t(ctx, UI.evidence),
                    title: t(ctx, node.label),
                    values: node.value === undefined ? [] : [node.value],
                    sources: node.value === undefined ? [] : [ctx.resolveSource(node.value.source_id)],
                  }))}
                >
                  <div className={node.value === undefined ? 'm-node-label' : 'm-node-label m-node-figure'}>
                    {t(ctx, node.label)}
                  </div>
                  {node.value === undefined ? null : (
                    <>
                      <div className="m-node-sub">
                        <ValueText value={node.value} ctx={ctx} />
                      </div>
                      <SourceLine source={ctx.resolveSource(node.value.source_id)} ctx={ctx} />
                    </>
                  )}
                </div>
                {edge === undefined ? null : (
                  <div
                    className="m-edge"
                    data-st={edge.status}
                    {...elProps(edge.el_id, open, () => ({
                      status: edge.status,
                      label: statusLabel(ctx, edge.status),
                      body: [edge.ev.quote],
                      why: t(ctx, edge.ev.why),
                      sources: edge.ev.source_id === undefined ? [] : [ctx.resolveSource(edge.ev.source_id)],
                    }))}
                  >
                    <svg width="12" height="32" viewBox="0 0 12 32" aria-hidden="true">
                      <line
                        x1="6"
                        y1="0"
                        x2="6"
                        y2="32"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={DASH[edge.status]}
                      />
                    </svg>
                    <div>
                      <div className="m-edge-label">{statusLabel(ctx, edge.status)}</div>
                      <div className="m-edge-note">{t(ctx, edge.ev.why)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div>
          <div className="m-colhead m-colhead-uns">{t(ctx, UI.leftOut)}</div>
          <div className="m-hiddens">
            {panel.hidden.map((entry) => (
              <div
                key={entry.el_id}
                className="m-hidden"
                {...elProps(entry.el_id, open, () => ({
                  status: 'hidden',
                  label: statusLabel(ctx, 'hidden'),
                  title: t(ctx, entry.label),
                  values: entry.value === undefined ? [] : [entry.value],
                  body: entry.ev === undefined ? [] : [entry.ev.quote],
                  why: t(ctx, entry.why_hidden),
                  whyLabel: t(ctx, UI.whyHidden),
                  sources: entry.ev === undefined ? [] : [ctx.resolveSource(entry.ev.source_id)],
                }))}
              >
                <div className="m-hidden-label">{t(ctx, entry.label)}</div>
                <div className="m-hidden-sub">{t(ctx, entry.why_hidden)}</div>
                {entry.value === undefined ? null : (
                  <div className="m-node-sub">
                    <ValueText value={entry.value} ctx={ctx} />
                  </div>
                )}
                {entry.ev === undefined ? null : (
                  <SourceLine source={ctx.resolveSource(entry.ev.source_id)} ctx={ctx} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="m-legend">
        {LEGEND.map((status) => (
          <span key={status} className="m-legend-item" data-st={status}>
            <svg width="16" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="16" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray={DASH[status]} />
            </svg>
            <span className="m-legend-label">{t(ctx, STATUS_LABEL[status])}</span>
          </span>
        ))}
      </div>
      <div className="m-hint">{t(ctx, UI.tapHint)}</div>
      {sheet}
    </section>
  );
}
