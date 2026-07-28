/**
 * The radar tab: the zip's frosted feed header and the feed itself, rendered by the Gate 2 Card
 * components off the content loader. It is the wave's proof that shell and renderers meet.
 *
 * Deliberately thin. The crisis-hold card, the corrections chip, the region sheet, the velocity
 * sparkline and the tap into the autopsy are the radar surface's work, not the shell's. What is
 * here is the header chrome, the pack switch, and one list.
 *
 * Feed items flagged `via_dissect` are filtered out, per the 6.6 note on `Feed`: ppn-panic joins
 * the feed only through the fresh-dissect demo flow.
 */
import { useMemo } from 'react';
import type { Lang } from '../../../contracts/types';
import { useT } from '../i18n';
import { useMethodology, useRadar, type Pack } from '../content';
import { makeCtx, type Theme } from '../renderers/ctx';
import Card from '../renderers/Card';

const dateLabel = (iso: string, lang: Lang): string => {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(at);
};

export default function Radar({
  pack,
  lang,
  theme,
  onPack,
  onMethodology,
}: {
  pack: Pack;
  lang: Lang;
  theme: Theme;
  onPack: () => void;
  onMethodology: () => void;
}) {
  const t = useT();
  const { data, error } = useRadar(pack);
  const methodology = useMethodology().data;
  const ctx = useMemo(() => makeCtx(data?.sources ?? [], lang, theme), [data, lang, theme]);

  const items = (data?.items ?? []).filter((item) => !item.viaDissect);
  const sym =
    methodology === null
      ? '-'
      : `${String(methodology.symmetry.gov)}·${String(methodology.symmetry.neutral)}·${String(methodology.symmetry.opp)}`;

  return (
    <div className="m-tabpane m-tabpane-radar" data-stagger="1">
      <div className="m-topbar">
        <div className="m-topbar-row">
          <div className="m-brand">{t('common.wordmark')}</div>
          <button type="button" className="m-pack" data-testid="pack-switch" onClick={onPack}>
            <span>{t(pack === 'id' ? 'pack.id' : 'pack.en')}</span>
            <span className="m-pack-caret">▼</span>
          </button>
        </div>
        <div className="m-feedline">
          <span className="m-feedmeta">
            {t('radar.live', { date: data === null ? '' : dateLabel(data.updatedAt, lang), live: items.length })}
          </span>
          <button type="button" className="m-symlink" onClick={onMethodology}>
            {t('radar.symmetry', { sym })}
          </button>
        </div>
      </div>

      {error !== null ? <div className="m-pane-note">{t('common.failed', { detail: error })}</div> : null}
      {error === null && data === null ? <div className="m-pane-note">{t('common.loading')}</div> : null}
      {data !== null && items.length === 0 ? <div className="m-pane-note">{t('radar.empty')}</div> : null}

      {items.map((item) => (
        <div key={item.narrative.id} data-sr="1" data-feed-item={item.narrative.id}>
          <Card narrative={item.narrative} variant={item.slot} ctx={ctx} />
        </div>
      ))}

      {items.length === 0 ? null : <div className="m-feedfoot">{t('radar.footer')}</div>}
    </div>
  );
}
