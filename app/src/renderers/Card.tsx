/**
 * AC-INV-2 and AC-INV-10. The feed card, in the zip's two slots: hero and compact.
 *
 * Blueprint 6.5: chips render exclusively from `counts`, which is derived and never authored, so
 * an artifact without `counts` or without `tags` is refused rather than drawn. Absent is not
 * zero: a narrative whose every count is 0 is complete and simply shows no chips.
 *
 * This is the only module in the app that reads a narrative headline. That is asserted by a
 * filesystem grep in the unit suite, because a second headline path would be a second contract.
 *
 * Provenance is transcribed, never authored: the names shown are the names in the artifact.
 * The manifest's per-step models are deliberately not drawn here; the card states who analyzed
 * and who narrated, and the full chain belongs to its own sheet at Gate 3.
 *
 * Ported from the zip's hero and compact card blocks. Compact gains a tag row the zip did not
 * carry, because the card contract asserts every tag renders in both slots.
 */
import type { DerivedCounts, Narrative } from '../../../contracts/types';
import { CardContractError, resolveAll, t, type RenderCtx } from './ctx';
import { COUNT_CHIPS, UI } from './copy';

interface CardProps {
  narrative: Narrative;
  variant: 'hero' | 'compact';
  ctx: RenderCtx;
}

/** The chips a `counts` block earns, in the blueprint's order. `supported` never earns one. */
function chipsFor(counts: DerivedCounts, ctx: RenderCtx): Array<{ st: string; label: string }> {
  return COUNT_CHIPS.flatMap(({ key, st, label }) => {
    const n = counts[key];
    return typeof n === 'number' && n > 0 ? [{ st, label: t(ctx, label(n)) }] : [];
  });
}

export default function Card({ narrative, variant, ctx }: CardProps) {
  // Narrative-scoped orphan refusal: the card draws no Value of its own, and a narrative
  // carrying a reference that does not resolve is not a renderable narrative.
  resolveAll(narrative, ctx);

  const counts = narrative.counts as DerivedCounts | undefined;
  if (counts === null || typeof counts !== 'object') {
    throw new CardContractError(`narrative "${narrative.id}" carries no derived counts`);
  }
  const tags = narrative.tags as string[] | undefined;
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new CardContractError(`narrative "${narrative.id}" carries no technique tags`);
  }

  const chips = chipsFor(counts, ctx);
  const headline = t(ctx, narrative.headline);
  const meta = `${narrative.outlet} · ${narrative.published_date}`;
  const translated = narrative.original.lang !== ctx.lang;
  const review = narrative.status === 'under_review';

  const chipRow = (
    <div className={variant === 'hero' ? 'm-card-chips' : 'm-card-chips m-card-chips-c'}>
      {chips.map((chip) => (
        <span key={chip.label} className="m-card-chip" data-st={chip.st}>
          <span className="m-dot" />
          {chip.label}
        </span>
      ))}
    </div>
  );
  const tagRow = (
    <div className={variant === 'hero' ? 'm-card-tags' : 'm-card-tags m-card-tags-c'}>
      {tags.map((tag) => (
        <span key={tag} className="m-tag">
          {tag}
        </span>
      ))}
    </div>
  );
  const provenance = (
    <div className="m-prov">
      {t(ctx, UI.analyzedBy)}
      {narrative.provenance.analyzed_by}
      {t(ctx, UI.narratedBy)}
      {narrative.provenance.narrated_by}
    </div>
  );
  const metaRow = (
    <div className="m-card-meta">
      <span className="m-card-metatext">{meta}</span>
      {translated ? <span className="m-card-trans">{ctx.lang.toUpperCase()} ← {narrative.original.lang.toUpperCase()}</span> : null}
      {review ? <span className="m-card-review">{t(ctx, UI.underReview)}</span> : null}
    </div>
  );

  if (variant === 'compact') {
    return (
      <article className="m-card-c" data-press="1">
        <div className="m-card-c-body">
          {metaRow}
          <div className="m-card-c-head">{headline}</div>
          {tagRow}
          {chipRow}
          {provenance}
        </div>
        <div className="m-card-c-og">{t(ctx, UI.ogPlaceholder)}</div>
      </article>
    );
  }

  return (
    <article className="m-card" data-press="1">
      <div className="m-card-og">{t(ctx, UI.ogPlaceholder)}</div>
      <div className="m-card-body">
        {metaRow}
        <div className="m-card-head">{headline}</div>
        {tagRow}
        {chipRow}
        <div className="m-card-fam">
          {narrative.family.members.length}
          {t(ctx, UI.familyMembers)}
        </div>
        {provenance}
        <div className="m-card-actions">
          <span className="m-btn m-btn-acc">{t(ctx, UI.dissect)}</span>
          <span className="m-btn m-btn-fill">{t(ctx, UI.original)}</span>
        </div>
      </div>
    </article>
  );
}
