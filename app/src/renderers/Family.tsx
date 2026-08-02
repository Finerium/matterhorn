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
 *
 * Each row is a link preview, blueprint 7.3 and the policy string in `og_attribution.json`: a
 * cached og:image renders only WITH the outlet's name and an outbound link to the article it was
 * taken from, never as loose decoration. `og` is the record that says which image belongs to
 * which member; a member with no entry, or an entry whose `image_path` is null, gets the neutral
 * placeholder, which is the honest state and the only state the seed root has.
 */
import type { FamilyPanel, Narrative, OgAttribution } from '../../../contracts/types';
import { ASSET_BASE } from '../content';
import { resolveAll, t, type RenderCtx } from './ctx';
import { PANEL_TITLE, UI } from './copy';
import { elProps, panelSheet, useEvidenceSheet } from './EvidenceSheet';

export default function Family({
  narrative,
  ctx,
  og,
}: {
  narrative: Narrative;
  ctx: RenderCtx;
  /** The link-preview record. Absent (the harness, the landing's still miniature) is placeholders. */
  og?: OgAttribution | null;
}) {
  const sources = resolveAll(narrative, ctx);
  const { open, sheet } = useEvidenceSheet(ctx);
  const title = t(ctx, PANEL_TITLE.family);
  const panel = narrative.panels.find((p): p is FamilyPanel => p.type === 'family');
  const members = narrative.family.members;
  const body = [narrative.family.skeleton, ...members.map((m) => `${m.outlet} · ${m.date}`)];
  const frame =
    panel === undefined ? {} : elProps(panel.el_id, open, () => panelSheet(ctx, title, body, sources), 'group');
  /** The staged image for one member, or null. Matched on the pair the record is keyed by. */
  const thumb = (url: string): string | null => {
    const entry = og?.entries.find((e) => e.narrative_id === narrative.id && e.member_url === url);
    const path = entry?.image_path;
    return path === undefined || path === null ? null : `${ASSET_BASE}${path}`;
  };

  return (
    <section className="m-panel" data-panel="family" {...frame}>
      <div className="m-panel-title">{title}</div>
      <div className="m-fam-note">{narrative.family.skeleton}</div>
      <div className="m-fam-list">
        {members.map((member) => {
          const image = thumb(member.url);
          const preview = (
            <>
              {image === null ? (
                // Neutral, and empty of text: at this size a label is unreadable, and the row
                // already names the outlet. Which previews were not fetched, and why, is recorded
                // per entry in og_attribution.json rather than guessed at here.
                <span className="m-fam-thumb m-fam-thumb-ph" aria-hidden="true" />
              ) : (
                // Empty alt on purpose: the outlet and the date beside it are the same
                // information, and a screen reader announcing the preview twice is noise. Width
                // and height are attributes so the row never reflows around a late image.
                <img className="m-fam-thumb" src={image} alt="" width="48" height="48" loading="lazy" decoding="async" />
              )}
              <span className="m-fam-outlet">{member.outlet}</span>
              <span className="m-fam-date">{member.date}</span>
            </>
          );
          return (
            <div key={member.url} className="m-fam-row">
              {/* Still mode draws the row and offers nothing to press, the same refusal `elProps`
                  makes: a miniature of the product is a picture, not forty tab stops. */}
              {ctx.still === true ? (
                preview
              ) : (
                <a className="m-fam-link" href={member.url} target="_blank" rel="noopener noreferrer">
                  {preview}
                </a>
              )}
            </div>
          );
        })}
      </div>
      <div className="m-fam-count">
        {members.length}
        {t(ctx, UI.familyMembers)}
      </div>
      {sheet}
    </section>
  );
}
