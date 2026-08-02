/**
 * AC-INV-2 and AC-INV-10. The feed card, in the zip's two slots: hero and compact.
 *
 * Blueprint 6.5: chips render exclusively from `counts`, which is derived and never authored, so
 * an artifact without `counts` or without `tags` is refused rather than drawn. Absent is not
 * zero: a narrative whose every count is 0 is complete and simply shows no chips.
 *
 * This is the only module in the app that reads a narrative headline. That is asserted by a
 * filesystem grep in the unit suite, because a second headline path would be a second contract.
 * A surface that has to quote one (the Nuance Card) calls `headlineOf` rather than the field.
 *
 * Gate 3 adds two optional props and nothing else: `onTap`, which makes the card's own
 * affordances live where a surface owns a behaviour for them, and `meta`, the slot the radar
 * puts its corrections and via-Dissect chips in. Both absent, the markup is Gate 2's exactly.
 *
 * Provenance is transcribed, never authored: the names shown are the names in the artifact.
 * The manifest's per-step models are deliberately not drawn here; the card states who analyzed
 * and who narrated, and the full chain belongs to its own sheet at Gate 3.
 *
 * Ported from the zip's hero and compact card blocks. Compact gains a tag row the zip did not
 * carry, because the card contract asserts every tag renders in both slots.
 */
import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import type { DerivedCounts, DuelingPanel, Narrative } from '../../../contracts/types';
import { ASSET_BASE } from '../content';
import { CardContractError, resolveAll, t, type RenderCtx } from './ctx';
import { COUNT_CHIPS, dateLabel, UI } from './copy';

/** What a surface can wire the card's own affordances to. */
export type CardTap = 'open' | 'tag' | 'chip' | 'original' | 'dissect' | 'outbound';

interface CardProps {
  narrative: Narrative;
  variant: 'hero' | 'compact';
  ctx: RenderCtx;
  /**
   * Makes the card's affordances live. `key` is the tag, the chip status, or '' where the kind
   * carries no key. Omitted, every affordance stays presentational, which is what the feed's own
   * whole-card tap and the Gate 2 harness both want.
   */
  onTap?: (kind: CardTap, key: string) => void;
  /** Meta-row chrome the surface owns: the corrections chip, the via-Dissect chip. */
  meta?: ReactNode;
}

/**
 * The one headline read in the app, exported so a surface that quotes a headline (the Nuance
 * Card) goes through this module rather than opening a second path to the field. AC-INV-2 is
 * asserted as a filesystem grep, and this keeps the grep honest rather than merely satisfied.
 */
export const headlineOf = (narrative: Narrative, ctx: RenderCtx): string => t(ctx, narrative.headline);

/**
 * The five counts Section 6.5 derives for every narrative. `conflicts` is the CF-1 optional
 * sixth and is not demanded: a narrative with no dueling panel has none.
 */
const COUNT_KEYS = ['missing', 'unsourced', 'disputed', 'supported', 'hidden'] as const;

/**
 * The chips a `counts` block earns, in the blueprint's order. `supported` never earns one.
 * Exported because 6.5 binds the Nuance Card to the same derivation, and one derivation with two
 * call sites is not the same thing as two derivations.
 */
export function chipsFor(counts: DerivedCounts, ctx: RenderCtx): Array<{ st: string; label: string }> {
  return COUNT_CHIPS.flatMap(({ key, st, label }) => {
    const n = counts[key];
    return typeof n === 'number' && n > 0 ? [{ st, label: t(ctx, label(n)) }] : [];
  });
}

/**
 * The counts row on its own, for a surface that lists headlines in a shape that is not a card
 * (the Archive list, the Dissect recents). C2 binds the headline to its counts wherever the
 * headline appears, so those surfaces take the row from here rather than pairing a `headlineOf`
 * call with markup of their own and calling that the contract.
 */
export function CountChips({ counts, ctx }: { counts: DerivedCounts; ctx: RenderCtx }) {
  return (
    <span className="m-card-chips m-card-chips-c">
      {chipsFor(counts, ctx).map((chip) => (
        <span key={chip.label} className="m-card-chip" data-st={chip.st}>
          <span className="m-dot" />
          {chip.label}
        </span>
      ))}
    </span>
  );
}

export default function Card({ narrative, variant, ctx, onTap, meta }: CardProps) {
  // Narrative-scoped orphan refusal: the card draws no Value of its own, and a narrative
  // carrying a reference that does not resolve is not a renderable narrative.
  resolveAll(narrative, ctx);

  // Symmetric with the tags guard below: shape, not merely presence. `{}` and `[]` are objects
  // that never went through derivation, and a card drawn from either would show zero chips and
  // look complete. All-zero counts, which are five real numbers, still render with no chips.
  const counts = narrative.counts as DerivedCounts | undefined;
  if (counts === null || typeof counts !== 'object' || COUNT_KEYS.some((key) => typeof counts[key] !== 'number')) {
    throw new CardContractError(
      `narrative "${narrative.id}" carries no derived counts: ${COUNT_KEYS.join(', ')} must all be numbers`,
    );
  }
  const tags = narrative.tags as string[] | undefined;
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new CardContractError(`narrative "${narrative.id}" carries no technique tags`);
  }

  const chips = chipsFor(counts, ctx);
  const headline = headlineOf(narrative, ctx);

  /**
   * The affordance spread. A card whose surface passed no `onTap` stays exactly the markup Gate 2
   * shipped: no role, no tab stop, no handler, so nothing announces an affordance that is not one.
   */
  const tap = (kind: CardTap, key: string): Pick<HTMLAttributes<HTMLElement>, 'role' | 'tabIndex' | 'onClick' | 'onKeyDown'> => {
    if (onTap === undefined) return {};
    const fire = (event: MouseEvent | KeyboardEvent) => {
      // The feed wraps the whole card in its own tap; an affordance inside it is not that tap.
      event.stopPropagation();
      onTap(kind, key);
    };
    return {
      role: 'button',
      tabIndex: 0,
      onClick: fire,
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        fire(event);
      },
    };
  };
  const metaText = `${narrative.outlet} · ${dateLabel(narrative.published_date, ctx.lang)}`;
  const translated = narrative.original.lang !== ctx.lang;
  const review = narrative.status === 'under_review';
  // The zip's imgLabel, hero only: the placeholder names the outlet whose og:image belongs in
  // the slot. The compact card's 72px square carries the bare label, the way the zip draws it.
  const og = variant === 'hero' ? `${t(ctx, UI.ogPlaceholder)} · ${narrative.outlet}` : t(ctx, UI.ogPlaceholder);
  // The slot's real content, blueprint 7.3: the article's cached og:image, attributed by the
  // outlet name this same card draws in metaText, outbound via the card's Original affordance.
  // The label stays underneath as the recorded-fallback state: a narrative whose fetch is
  // `fallback` in og_attribution.json has no file here, the img 404s, and the placeholder shows.
  const ogImg = (
    <img
      className="m-card-ogimg"
      src={`${ASSET_BASE}/assets/og/${narrative.id}.jpg`}
      alt=""
      loading="lazy"
      decoding="async"
      onError={(event) => {
        (event.target as HTMLImageElement).style.display = 'none';
      }}
    />
  );
  // The zip's famLine. Section 6.4 calls the zip's family `note` the `skeleton`; same string.
  const famLine = `${narrative.family.skeleton}: ${narrative.family.members.map((m) => m.outlet).join(' · ')}`;
  // CF-1, as resolved in docs/understanding.md: the zip's compact teaser was fed by an authored
  // `teaser` field Section 6.4 does not carry, so the teaser is the dueling panel's rule_line,
  // which is already in the artifact and already cited. No dueling panel, no teaser.
  const dueling = narrative.panels.find((p): p is DuelingPanel => p.type === 'dueling');

  const chipRow = (
    <div className={variant === 'hero' ? 'm-card-chips' : 'm-card-chips m-card-chips-c'}>
      {chips.map((chip) => (
        <span key={chip.label} className="m-card-chip" data-st={chip.st} {...tap('chip', chip.st)}>
          <span className="m-dot" />
          {chip.label}
        </span>
      ))}
    </div>
  );
  const tagRow = (
    <div className={variant === 'hero' ? 'm-card-tags' : 'm-card-tags m-card-tags-c'}>
      {tags.map((tag) => (
        <span key={tag} className="m-tag" data-tag={tag} {...tap('tag', tag)}>
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
      <span className="m-card-metatext">{metaText}</span>
      {translated ? (
        <span className="m-card-trans" {...tap('original', '')}>
          {ctx.lang.toUpperCase()} ← {narrative.original.lang.toUpperCase()}
        </span>
      ) : null}
      {review ? <span className="m-card-review">{t(ctx, UI.underReview)}</span> : null}
      {meta}
    </div>
  );

  if (variant === 'compact') {
    return (
      <article className="m-card-c" data-press="1">
        <div className="m-card-c-body">
          {metaRow}
          <div className="m-card-c-head" {...tap('open', '')}>
            {headline}
          </div>
          {tagRow}
          {chipRow}
          {dueling === undefined ? null : <div className="m-card-teaser">{t(ctx, dueling.rule_line)}</div>}
          {provenance}
        </div>
        <div className="m-card-c-og">
          {og}
          {ogImg}
        </div>
      </article>
    );
  }

  return (
    <article className="m-card" data-press="1">
      <div className="m-card-og">
        {og}
        {ogImg}
      </div>
      <div className="m-card-body">
        {metaRow}
        <div className="m-card-head" {...tap('open', '')}>
          {headline}
        </div>
        {tagRow}
        {chipRow}
        <div className="m-card-fam">{famLine}</div>
        {provenance}
        <div className="m-card-actions">
          <span className="m-btn m-btn-acc" {...tap('dissect', '')}>
            {t(ctx, UI.dissect)}
          </span>
          <span className="m-btn m-btn-fill" {...tap('outbound', '')}>
            {t(ctx, UI.original)}
          </span>
        </div>
      </div>
    </article>
  );
}
