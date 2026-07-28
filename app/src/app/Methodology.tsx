/**
 * The methodology body: policy 6.5 verbatim, the symmetry receipt, the published receipts, the
 * AI disclosure and the corrections changelog.
 *
 * One component, two hosts. `/methodology` is the public citable page and `system.methodology`
 * is the same body inside the app shell, because a reader who taps the symmetry line and a
 * reader who is handed the URL must be able to check the same claim against the same numbers.
 * A second copy would be a second thing to keep true.
 *
 * The symmetry receipt is `methodology.symmetry`, which the contract marks DERIVED from the
 * narratives and the validator recomputes at publish. It is read here rather than recounted:
 * the receipt is a claim about the whole published archive, and this build has whatever subset
 * of it is on disk, so recounting on the client would report the subset and call it the archive.
 */
import { useT, type Key } from '../i18n';
import { useCorrections, useMethodology } from '../content';
import type { Corrections, Lang, Methodology } from '../../../contracts/types';

const KIND_LABEL: Record<Methodology['metrics'][number]['kind'], Key> = {
  measured: 'meth.kind.measured',
  design_target: 'meth.kind.design_target',
};

const STATUS_LABEL: Record<Corrections['entries'][number]['status'], Key> = {
  under_review: 'meth.status.under_review',
  corrected: 'meth.status.corrected',
  dismissed: 'meth.status.dismissed',
};

const STATUS_DOT: Record<Corrections['entries'][number]['status'], string> = {
  under_review: 'disputed',
  corrected: 'supported',
  dismissed: 'mut',
};

const pct = (part: number, total: number): string => (total === 0 ? '0' : ((part / total) * 100).toFixed(1));

export default function MethodologyBody({ lang }: { lang: Lang }) {
  const t = useT();
  const { data, error } = useMethodology();
  const corrections = useCorrections().data;

  if (data === null) {
    return <div className="m-pane-note">{error === null ? t('common.loading') : t('common.failed', { detail: error })}</div>;
  }

  const sym = data.symmetry;
  const total = sym.gov + sym.neutral + sym.opp;
  const bar: Array<{ key: Key; n: number; tone: string }> = [
    { key: 'archive.lean.gov', n: sym.gov, tone: 'gov' },
    { key: 'archive.lean.neutral', n: sym.neutral, tone: 'neutral' },
    { key: 'archive.lean.opp', n: sym.opp, tone: 'opp' },
  ];

  return (
    <>
      <div className="m-mblock">
        <div className="m-mhead">{t('meth.symmetry')}</div>
        <div className="m-mbody">{t('meth.symmetry.body')}</div>
        <div className="m-symbar" data-testid="methodology-symmetry">
          <div className="m-symbar-track" aria-hidden="true">
            {bar.map((slice) => (
              <span key={slice.tone} className="m-symbar-slice" data-lean={slice.tone} style={{ width: `${pct(slice.n, total)}%` }} />
            ))}
          </div>
          <div className="m-symbar-legend">
            {bar.map((slice) => (
              <span key={slice.tone} className="m-symbar-item">
                <span className="m-dot" data-lean={slice.tone} />
                {t(slice.key)} {slice.n} · {pct(slice.n, total)}%
              </span>
            ))}
          </div>
        </div>
        <div className="m-mmeta">{t('meth.symmetry.at', { at: sym.computed_at })}</div>
      </div>

      <div className="m-mblock">
        <div className="m-mhead">{t('meth.metrics')}</div>
        {data.metrics.map((metric) => (
          <div key={metric.key} className="m-mrow">
            <span className="m-mrow-v">{metric.value}</span>
            <span className="m-mrow-main">
              <span className="m-mrow-l">{metric.label[lang]}</span>
              <span className="m-mrow-k">{t(KIND_LABEL[metric.kind])}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="m-mblock">
        <div className="m-mhead">{t('meth.policy')}</div>
        <div className="m-mbody" data-testid="policy-65">
          {data.policy_65[lang]}
        </div>
      </div>

      <div className="m-mblock">
        <div className="m-mhead">{t('meth.disclosure')}</div>
        <div className="m-mbody" data-testid="methodology-disclosure">
          {data.disclosure[lang]}
        </div>
      </div>

      <div className="m-mblock">
        <div className="m-mhead">{t('meth.log')}</div>
        <div data-testid="corrections-log">
          {corrections === null ? <div className="m-mbody">{t('common.loading')}</div> : null}
          {(corrections?.entries ?? []).map((entry) => (
            <div key={`${entry.date}-${entry.narrative_id}`} className="m-mlog">
              <span className="m-mlog-head">
                <span className="m-dot" data-st={STATUS_DOT[entry.status]} />
                <span className="m-mlog-date">{entry.date}</span>
                <span className="m-mlog-st">{t(STATUS_LABEL[entry.status])}</span>
              </span>
              <span className="m-mlog-text">{entry.summary[lang]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
