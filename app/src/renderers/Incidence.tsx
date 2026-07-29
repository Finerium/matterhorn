/**
 * AC-GRAM-4. Incidence: who carries the consequence, and in which horizon.
 *
 * Grouped by horizon, as the zip groups it, with one item per lane that has a cell in that
 * horizon. Each item is the lane's addressable element.
 *
 * ponytail: a lane with cells in two horizons would draw its `el_id` under both. The contract
 * puts the id on the lane and the zip's layout groups by horizon, so one of the two has to give;
 * every lane in the seed carries exactly one cell, as every lane in the zip did. Moving `el_id`
 * onto the cell is the contract change that would fix it properly.
 */
import type { IncidencePanel } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import ValueText, { SourceLine } from './ValueText';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function Incidence({ panel, ctx }: { panel: IncidencePanel; ctx: RenderCtx }) {
  const sources = resolveAll(panel, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.incidence);

  return (
    <section
      className="m-panel"
      data-panel="incidence"
      {...elProps(
        panel.el_id,
        open,
        () => panelSheet(ctx, title, panel.horizons.map((horizon) => t(ctx, horizon.label)), sources),
        'group',
      )}
    >
      <div className="m-panel-title">{title}</div>
      <div className="m-inc">
        {panel.horizons.map((horizon) => {
          const rows = panel.lanes.flatMap((lane) => {
            const cells = lane.cells.filter((cell) => cell.horizon === horizon.key);
            return cells.length === 0 ? [] : [{ lane, cells }];
          });
          if (rows.length === 0) return null;
          return (
            <div key={horizon.key} className="m-inc-group">
              <div className="m-inc-horizon">{t(ctx, horizon.label)}</div>
              <div className="m-inc-items">
                {rows.map(({ lane, cells }) => {
                  const cellSources = cells.flatMap((cell) => [
                    ...(cell.value === undefined ? [] : [ctx.resolveSource(cell.value.source_id)]),
                    ...(cell.ev === undefined ? [] : [ctx.resolveSource(cell.ev.source_id)]),
                  ]);
                  const unique = cellSources.filter((s, i) => cellSources.findIndex((o) => o.id === s.id) === i);
                  return (
                    <div
                      key={lane.el_id}
                      className="m-inc-item"
                      {...elProps(lane.el_id, open, () => ({
                        label: t(ctx, UI.evidence),
                        title: t(ctx, lane.who),
                        values: cells.flatMap((cell) => (cell.value === undefined ? [] : [cell.value])),
                        body: [
                          ...cells.map((cell) => t(ctx, cell.text)),
                          ...cells.flatMap((cell) => (cell.ev === undefined ? [] : [cell.ev.quote])),
                        ],
                        sources: unique,
                      }))}
                    >
                      <div className="m-inc-who">{t(ctx, lane.who)}</div>
                      {cells.map((cell) => (
                        <div key={cell.horizon + t(ctx, cell.text)}>
                          <div className="m-inc-text">{t(ctx, cell.text)}</div>
                          {cell.value === undefined ? null : (
                            <div className="m-inc-val">
                              <ValueText value={cell.value} ctx={ctx} />
                            </div>
                          )}
                        </div>
                      ))}
                      {unique.map((source) => (
                        <SourceLine key={source.id} source={source} ctx={ctx} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {sheet}
    </section>
  );
}
