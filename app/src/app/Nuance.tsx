/**
 * The Nuance Card overlay: the zip's `shNuance`, in the two templates Appendix C fixes.
 *
 *   Story  1080x1350
 *   Chat   1200x628
 *
 * Appendix C's contract note binds both: the counts row, the technique tags, the deep link and
 * the provenance microline travel on every variant. Counts come from the same `chipsFor` the
 * card uses, because 6.5 says card chips, autopsy chips, notification copy and Nuance Cards all
 * render from the derived counts and from nothing else. No verdict language reaches the asset,
 * because no verdict language exists anywhere in the artifact to reach it.
 *
 * The card is laid out at its real pixel size and previewed through a scale transform on its
 * parent, so the export is the same DOM at 1:1 rather than an upscale of a thumbnail. The
 * exporter (html-to-image) is imported at click time: it is the only dependency this build adds,
 * and it stays out of the initial chunk.
 */
import { useRef, type ReactNode } from 'react';
import type { ClaimMapPanel, Narrative } from '../../../contracts/types';
import { useT } from '../i18n';
import { chipsFor, headlineOf } from '../renderers/Card';
import { t as copy, type RenderCtx } from '../renderers/ctx';
import { statusLabel } from '../renderers/EvidenceSheet';
import type { Nav } from './Onboarding';

export type Template = 'story' | 'chat';

/** Appendix C, FROZEN: the two asset sizes. */
const SIZE: Record<Template, { w: number; h: number }> = {
  story: { w: 1080, h: 1350 },
  chat: { w: 1200, h: 628 },
};

/** The preview width inside the overlay. The scale factor follows from it. */
const PREVIEW = 300;

export default function Nuance({
  narrative,
  ctx,
  template,
  nav,
}: {
  narrative: Narrative;
  ctx: RenderCtx;
  template: Template;
  nav: Nav;
}) {
  const t = useT();
  const card = useRef<HTMLDivElement>(null);
  const size = SIZE[template];
  const scale = PREVIEW / size.w;

  const chips = chipsFor(narrative.counts, ctx);
  const headline = headlineOf(narrative, ctx);
  const link = `${window.location.host}/n/${narrative.id}`;
  const ground = t('nuance.ground', {
    sources: narrative.provenance.source_count,
    analyzed: narrative.provenance.analyzed_by,
  });

  const save = async (): Promise<void> => {
    const node = card.current;
    if (node === null) return;
    const { toBlob } = await import('html-to-image');
    const blob = await toBlob(node, { pixelRatio: 1, backgroundColor: '#141412' });
    if (blob === null) throw new Error('the card produced no image');
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `matterhorn-${narrative.id}-${template}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    // ponytail: revoked on a timer rather than immediately. The download reads the blob after
    // the click returns, and revoking in the same tick cancels it in Chromium.
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 10_000);
    nav.toast(t('toast.nuance.saved'));
  };

  const countsRow = (
    <div className="m-nf-chips">
      {chips.map((chip) => (
        <span key={chip.label} className="m-nf-chip" data-st={chip.st}>
          <span className="m-nf-dot" />
          {chip.label}
        </span>
      ))}
    </div>
  );
  // The zip's nRows: the first three spine nodes with the status of the edge between them. The
  // structure is what the asset exists to carry, so it travels with the counts rather than under
  // them. Nothing is authored here: labels and statuses are the claim map's own.
  const map = narrative.panels.find((panel): panel is ClaimMapPanel => panel.type === 'claim_map');
  const spine = (map?.spine ?? []).slice(0, 3);
  const spineRows = spine.length === 0 ? null : (
    <div className="m-nf-spine">
      {spine.map((node, index) => {
        const edge = map?.edges.find((candidate) => candidate.from === node.el_id);
        return (
          <div key={node.el_id}>
            <div className="m-nf-node">{copy(ctx, node.label)}</div>
            {edge === undefined || index === spine.length - 1 ? null : (
              <div className="m-nf-edge" data-st={edge.status}>
                {statusLabel(ctx, edge.status)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
  const tagRow = (
    <div className="m-nf-tags">
      {narrative.tags.map((tag) => (
        <span key={tag} className="m-nf-tag">
          {tag}
        </span>
      ))}
    </div>
  );
  const foot = (
    <div className="m-nf-foot">
      {ground}
      <br />
      {t('nuance.link', { link })}
    </div>
  );

  const templates: Record<Template, ReactNode> = {
    story: (
      <>
        <div className="m-nf-mark">{t('common.wordmark')}</div>
        <div className="m-nf-head">“{headline}”</div>
        <div className="m-nf-attr">{t('nuance.attr', { outlet: narrative.outlet })}</div>
        {spineRows}
        {countsRow}
        {narrative.counts.hidden === 0 ? null : (
          <div className="m-nf-hidden">{t('nuance.hidden', { n: narrative.counts.hidden })}</div>
        )}
        {tagRow}
        {foot}
      </>
    ),
    chat: (
      <>
        <div className="m-nf-mark">{t('nuance.dissected')}</div>
        <div className="m-nf-head m-nf-head-chat">“{headline}”</div>
        {countsRow}
        {tagRow}
        {foot}
      </>
    ),
  };

  return (
    <div
      className="m-nf-wrap"
      data-sheet={`nuance-${template}`}
      role="dialog"
      aria-label={t('action.nuance')}
      onClick={() => {
        nav.patch({ sheet: null });
      }}
    >
      <div
        className="m-nf-inner"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="m-nf-switch">
          {(['story', 'chat'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className="m-nf-pick"
              aria-pressed={option === template}
              onClick={() => {
                nav.patch({ sheet: option === 'story' ? 'nuance-story' : 'nuance-chat' });
              }}
            >
              {t(option === 'story' ? 'nuance.story' : 'nuance.chat')}
            </button>
          ))}
        </div>

        <div className="m-nf-frame" style={{ width: PREVIEW, height: Math.round(size.h * scale) }}>
          <div className="m-nf-zoom" style={{ transform: `scale(${String(scale)})` }}>
            <div
              className={template === 'story' ? 'm-nf-card' : 'm-nf-card m-nf-card-chat'}
              style={{ width: size.w, height: size.h }}
              ref={card}
            >
              {templates[template]}
            </div>
          </div>
        </div>

        <div className="m-nf-actions">
          <button
            type="button"
            className="m-nf-save"
            data-press="1"
            data-testid="nuance-export"
            onClick={() => {
              save().catch(() => {
                nav.toast(t('toast.nuance.failed'));
              });
            }}
          >
            {t('nuance.save')}
          </button>
          <button
            type="button"
            className="m-nf-share"
            data-press="1"
            onClick={() => {
              nav.toast(t('toast.nuance.share'));
            }}
          >
            {t('nuance.share')}
          </button>
        </div>
        <div className="m-nf-note">
          {t('nuance.note.a')}
          <br />
          {t('nuance.note.b')}
        </div>
      </div>
    </div>
  );
}
