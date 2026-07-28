/**
 * AC-GRAM-3. The money flow: one root line, and the documented flows that run off it.
 *
 * `stopped` is the zip's stop toggle. When it is on, every row marked `severed_if_stopped`
 * strikes through and takes the missing-link treatment: these are existing contracts, wages and
 * meals on record, so the panel says what an abrupt stop severs without projecting anything.
 *
 * Ported from the zip's `p.isMoney` block: the toggle row, the fill-backed root, the 2x14
 * connector, the two row states, and the note under them, which says what the strike means and
 * what the panel refuses to draw. That note is chrome, not content: it states the rule the
 * panel is built on, so it lives in copy.ts and no artifact can ship without it.
 */
import type { MoneyFlowPanel } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import ValueText, { SourceLine } from './ValueText';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

interface MoneyFlowProps {
  panel: MoneyFlowPanel;
  ctx: RenderCtx;
  stopped: boolean;
  /** Optional, so the toggle is live wherever a surface owns the state. */
  onToggle?: () => void;
}

export default function MoneyFlow({ panel, ctx, stopped, onToggle }: MoneyFlowProps) {
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.money_flow);
  const rootSource = ctx.resolveSource(panel.root.value.source_id);

  return (
    <section
      className="m-panel"
      {...elProps(panel.el_id, open, () => panelSheet(ctx, title, [t(ctx, panel.root.label)], sources), 'group')}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-flow">
        <div className="m-flow-head">
          <span className="m-flow-headlabel">{t(ctx, UI.ifStopped)}</span>
          <span
            className={stopped ? 'm-toggle m-toggle-on' : 'm-toggle'}
            role="switch"
            aria-checked={stopped}
            aria-label={t(ctx, UI.stopToggle)}
            tabIndex={onToggle === undefined ? -1 : 0}
            onClick={(event) => {
              event.stopPropagation();
              onToggle?.();
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onToggle?.();
            }}
          >
            <span className="m-toggle-knob" />
          </span>
          {stopped ? <span className="m-flow-struck">{t(ctx, UI.struckBreak)}</span> : null}
        </div>
        <div className="m-flow-root">
          <div className="m-flow-label">{t(ctx, panel.root.label)}</div>
          <div className="m-flow-sub">
            <ValueText value={panel.root.value} ctx={ctx} />
          </div>
          <SourceLine source={rootSource} ctx={ctx} />
        </div>
        <div className="m-flow-stem">
          <svg width="2" height="14" aria-hidden="true">
            <line x1="1" y1="0" x2="1" y2="14" strokeWidth="2" className="m-stem-line" />
          </svg>
        </div>
        <div className="m-flow-rows">
          {panel.rows.map((row) => {
            const severed = stopped && row.severed_if_stopped;
            const source = ctx.resolveSource(row.value.source_id);
            return (
              <div
                key={row.el_id}
                className={severed ? 'm-flow-row m-flow-row-cut' : 'm-flow-row'}
                data-strike={severed ? '1' : '0'}
                {...elProps(row.el_id, open, () => ({
                  label: t(ctx, UI.evidence),
                  title: t(ctx, row.label),
                  values: [row.value],
                  body: row.note === undefined ? [] : [t(ctx, row.note)],
                  sources: [source],
                }))}
              >
                <div className="m-flow-labelrow">
                  <span className="m-flow-label mfl">{t(ctx, row.label)}</span>
                  {severed ? <span className="m-breaks">{t(ctx, UI.breaks)}</span> : null}
                </div>
                <div className="m-flow-sub mfl">
                  <ValueText value={row.value} ctx={ctx} />
                </div>
                {row.note === undefined ? null : <div className="m-flow-note">{t(ctx, row.note)}</div>}
                <SourceLine source={source} ctx={ctx} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="m-flow-foot">{t(ctx, UI.moneyNote)}</div>
      {sheet}
    </section>
  );
}
