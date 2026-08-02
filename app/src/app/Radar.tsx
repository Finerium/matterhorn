/**
 * The radar tab: the zip's frosted feed header, the feed itself through the Gate 2 Card, and the
 * four feed states Appendix A names beside the default one.
 *
 *   region sheet     the zip's `shRegion`, switching the pack from cache with no fetch
 *   crisis hold      the zip's CRISIS_CARD, verbatim EN. Chrome behind the demo toggle the zip
 *                    itself uses, per the Gate 3 ruling: the contract `crisis_hold` feed flag
 *                    stays available for Gate C editorial use and renders the same card
 *   under review     the corrections chip on a card whose narrative has an open corrections
 *                    entry, or one this device flagged (ADR-12), plus the open-corrections strip
 *   via Dissect      packs/id/feed.json marks ppn-panic `via_dissect`, so it is filtered out
 *                    until the fresh-dissect demo flips the flag (AC-APP-5)
 *
 * The pack pill is two controls in one shape, because the specs fix two behaviours for it: the
 * label switches the pack directly (AC-APP-14 measures that switch), the caret opens the region
 * sheet (AC-APP-4). Both read the same cache, so both are instant once a pack is warm.
 */
import { useEffect, useMemo } from 'react';
import type { Corrections, Lang } from '../../../contracts/types';
import { useT } from '../i18n';
import { useCorrections, useMethodology, useRadar, type Pack } from '../content';
import { trapRef } from '../trap';
import { makeCtx } from '../renderers/ctx';
import Card from '../renderers/Card';
import { LS, writeStore, type AppState } from './state';
import type { Nav } from './Onboarding';

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

/** The zip's four region rows. `id` and `intl` are the two packs; the rest roll out gradually. */
const REGIONS = [
  { id: 'id', pack: 'id' as Pack, label: 'regions.id', sub: 'regions.id.sub' },
  { id: 'intl', pack: 'en' as Pack, label: 'regions.intl', sub: 'regions.intl.sub' },
  { id: 'us', pack: null, label: 'regions.us', sub: 'regions.us.sub' },
  { id: 'more', pack: null, label: 'regions.more', sub: 'regions.more.sub' },
] as const;

/** Entries still open: the ones that earn a chip and the ones the strip lists. */
const openEntries = (corrections: Corrections | null): Corrections['entries'] =>
  (corrections?.entries ?? []).filter((entry) => entry.status === 'under_review');

/**
 * The pack switch brackets itself with performance marks, from the click to the frame that
 * carries the new feed. App mounts this component with `key={pack}`, so a switch is a fresh
 * mount whose initial state is the synchronous cache read: the mark is the evidence that it is.
 */
const packStart = () => {
  performance.mark('mth:pack:start');
};

export default function Radar({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  useEffect(() => {
    performance.mark('mth:pack:end');
  }, []);
  const { data, error } = useRadar(state.pack);
  const methodology = useMethodology().data;
  const corrections = useCorrections().data;
  const ctx = useMemo(
    () => makeCtx(data?.sources ?? [], state.lang, state.theme),
    [data, state.lang, state.theme],
  );

  const items = (data?.items ?? []).filter((item) => !item.viaDissect || state.viaDissect);
  const open = openEntries(corrections);
  const sym =
    methodology === null
      ? '-'
      : `${String(methodology.symmetry.gov)}·${String(methodology.symmetry.neutral)}·${String(methodology.symmetry.opp)}`;

  return (
    <div className="m-tabpane m-tabpane-radar" data-stagger="1">
      <div className="m-topbar">
        <div className="m-topbar-row">
          <div className="m-brand">{t('common.wordmark')}</div>
          <div className="m-pack">
            <button
              type="button"
              className="m-pack-label"
              data-testid="pack-switch"
              onClick={() => {
                packStart();
                nav.patch({ pack: state.pack === 'id' ? 'en' : 'id' });
              }}
            >
              {t(state.pack === 'id' ? 'pack.id' : 'pack.en')}
            </button>
            <button
              type="button"
              className="m-pack-caret"
              data-testid="region-switch"
              aria-label={t('radar.region')}
              onClick={() => {
                nav.openSheet('region');
              }}
            >
              ▼
            </button>
          </div>
        </div>
        <div className="m-feedline">
          <span className="m-feedmeta">
            {t('radar.live', {
              date: data === null ? '' : dateLabel(data.updatedAt, state.lang),
              live: items.length,
            })}
          </span>
          <button
            type="button"
            className="m-symlink"
            onClick={() => {
              nav.go('methodology');
            }}
          >
            {t('radar.symmetry', { sym })}
          </button>
        </div>
      </div>

      {error !== null ? <div className="m-pane-note">{t('common.failed', { detail: error })}</div> : null}
      {error === null && data === null ? <div className="m-pane-note">{t('common.loading')}</div> : null}
      {data !== null && items.length === 0 ? <div className="m-pane-note">{t('radar.empty')}</div> : null}

      {/* The zip draws the hold notice under the cards. It leads here instead: it is a statement
          about the whole feed, and a reader who has to scroll past three dissections to find out
          why the fourth is missing has not been told. */}
      {/* Blueprint 3.2 item 17. Android only, because it is education about a share target that
          only Android registers; small and dismissible, because a hint that cannot be dismissed
          is an advert. */}
      {!state.installHint ? null : (
        <div className="m-install" data-sr="1" data-testid="install-hint">
          {/* Appendix C freezes this hint as one line in both locales, so it renders as one. */}
          <div className="m-install-main">
            <div className="m-install-title">{t('install.title')}</div>
          </div>
          <button
            type="button"
            className="m-install-x"
            aria-label={t('install.dismiss')}
            onClick={() => {
              writeStore(LS.installed, '1');
              nav.patch({ installHint: false });
            }}
          >
            ×
          </button>
        </div>
      )}

      {!state.crisis ? null : (
        <div className="m-crisis" data-sr="1" data-feed-item="crisis-hold" data-crisis="1">
          <div className="m-crisis-kicker">{t('radar.crisis.kicker')}</div>
          <div className="m-crisis-title">{t('radar.crisis.title')}</div>
          <div className="m-crisis-body">{t('radar.crisis.body')}</div>
          <div className="m-crisis-foot">
            <button
              type="button"
              className="m-crisis-link"
              onClick={() => {
                nav.toast(t('toast.crisis.link'));
              }}
            >
              {t('radar.crisis.link')}
            </button>
            <span className="m-crisis-policy">{t('radar.crisis.policy')}</span>
          </div>
        </div>
      )}

      {!state.corrections || open.length === 0 ? null : (
        <div className="m-notice" data-sr="1">
          <div className="m-notice-kicker">{t('radar.review.title')}</div>
          {open.map((entry) => (
            <div key={entry.narrative_id} className="m-notice-row">
              <span className="m-notice-date">{entry.date}</span> {entry.summary[state.lang]}
            </div>
          ))}
          <div className="m-notice-foot">{t('radar.review.body')}</div>
        </div>
      )}

      {items.map((item) => {
        const id = item.narrative.id;
        const reviewed = open.some((entry) => entry.narrative_id === id) || state.flags.includes(id);
        const openAutopsy = () => {
          nav.patch({ screen: 'autopsy', narrative: id, spar: 'gate' });
        };
        return (
          // ponytail: the wrapper takes the mouse tap the zip gives the whole card, and nothing
          // else. The keyboard path is inside the card, where the headline, the tags, the chips
          // and the two actions are each their own focus stop rather than one nested in another.
          <div key={id} data-sr="1" data-feed-item={id} onClick={openAutopsy}>
            <Card
              narrative={item.narrative}
              variant={item.slot}
              ctx={ctx}
              onTap={(kind) => {
                if (kind === 'original') nav.patch({ narrative: id, sheet: 'original' });
                else if (kind === 'outbound') nav.toast(t('toast.outbound', { url: item.narrative.url }));
                else openAutopsy();
              }}
              meta={
                <>
                  {reviewed ? (
                    <span className="m-card-review" data-testid="under-review-chip">
                      {t('radar.review')}
                    </span>
                  ) : null}
                  {item.viaDissect ? (
                    <span className="m-card-via" data-testid="via-dissect-chip">
                      {t('radar.viadissect')}
                    </span>
                  ) : null}
                  {/* docs/replay-protocol.md: the desk republished this one, and the badge stays
                      on the card until the reader opens its autopsy. */}
                  {state.updated[id] === undefined ? null : (
                    <span className="m-updated" data-testid="updated-badge">
                      {t('badge.updated')}
                    </span>
                  )}
                </>
              }
            />
          </div>
        );
      })}

      {items.length === 0 ? null : <div className="m-feedfoot">{t('radar.footer')}</div>}

      {state.sheet !== 'region' ? null : (
        <>
          <div
            className="m-scrim"
            onClick={() => {
              nav.patch({ sheet: null });
            }}
          />
          <div
            className="m-sheet"
            data-sheet="region"
            role="dialog"
            aria-modal="true"
            aria-label={t('radar.region')}
            ref={trapRef}
          >
            <div className="m-grab" />
            <div className="m-sheet-h">{t('radar.region')}</div>
            <div className="m-sheet-p">{t('radar.region.body')}</div>
            <div className="m-onb-list">
              {REGIONS.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  className="m-row"
                  data-dim={region.pack === null ? '1' : '0'}
                  // Same reason as the onboarding rows: a region with no pack is not selectable,
                  // and saying so is what makes the .45 dim honest to AT and exempt under WCAG
                  // 1.4.3 rather than a silent 2.75:1 contrast failure.
                  aria-disabled={region.pack === null ? true : undefined}
                  aria-pressed={region.pack !== null && region.pack === state.pack}
                  onClick={() => {
                    if (region.pack === null) {
                      nav.toast(t('toast.region.soon'));
                      return;
                    }
                    packStart();
                    nav.patch({ pack: region.pack, sheet: null });
                    nav.toast(t('toast.region.cache'));
                  }}
                >
                  <span className="m-row-main">
                    <span className="m-row-label">{t(region.label)}</span>
                    <span className="m-row-sub">{t(region.sub)}</span>
                  </span>
                  <span
                    className={region.pack === state.pack ? 'm-radio m-radio-on' : 'm-radio'}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
