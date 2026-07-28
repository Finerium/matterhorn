/**
 * AC-GRAM-8. The family: the skeleton this story shares with its siblings, and the outlets that
 * carried it.
 *
 * `FamilyPanel` carries no data of its own, so this renders from `Narrative.family` and takes
 * its `el_id` from the family panel in the narrative's panel list. Like the card, it draws no
 * Value of its own and therefore refuses narrative-scoped: any reference anywhere in the
 * narrative that does not resolve stops the render.
 *
 * Ported from the zip's "Who else says this?" block: the note line and the hairline-separated
 * member rows. The velocity spark and the lean-spread bar the zip drew have no field in Section
 * 6.4 and arrive when the data does.
 */
import type { FamilyPanel, Narrative } from '../../../contracts/types';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function Family({ narrative, ctx }: { narrative: Narrative; ctx: RenderCtx }) {
  const sources = resolveAll(narrative, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.family);
  const panel = narrative.panels.find((p): p is FamilyPanel => p.type === 'family');
  const members = narrative.family.members;
  const body = [narrative.family.skeleton, ...members.map((m) => `${m.outlet} · ${m.date}`)];
  const frame =
    panel === undefined ? {} : elProps(panel.el_id, open, () => panelSheet(ctx, title, body, sources), 'group');

  return (
    <section className="m-panel" {...frame}>
      <div className="m-panel-title">{title}</div>
      <div className="m-fam-note">{narrative.family.skeleton}</div>
      <div className="m-fam-list">
        {members.map((member) => (
          <div key={member.url} className="m-fam-row">
            <span className="m-fam-outlet">{member.outlet}</span>
            <span className="m-fam-date">{member.date}</span>
          </div>
        ))}
      </div>
      <div className="m-fam-count">
        {members.length}
        {t(ctx, UI.familyMembers)}
      </div>
      {sheet}
    </section>
  );
}
