/**
 * The autopsy: the zip's screen, assembled out of the Gate 2 renderers.
 *
 * Order is the zip's. OG card, provenance line, the sparring gate, then the body: the diff card,
 * the narration, the panel stack in artifact order, Echo, the explore drawer, the action bar.
 * Every panel is a Gate 2 component rendered from the artifact, so nothing here draws a number,
 * a status or a source line of its own; what this module owns is the sequence and the state.
 *
 * Three bindings the panels cannot own, because each one crosses panels:
 *   narration    a sentence carries `els`, and selecting it paints `data-hl` on those elements
 *                wherever they are. The paint is a DOM write rather than a prop, because no
 *                renderer takes a highlight prop and threading one through eight of them to set
 *                one attribute would be eight contracts instead of one effect.
 *   count chips  the card's chips highlight by status: every edge of that status, plus the
 *                hidden entries for `hidden` and the dueling counts for `disputed`, which is the
 *                zip's own hlByStatus.
 *   the gate     S3 asks three questions, S2 asks one of them, S1 takes a prediction, S0 goes
 *                straight through with the spar-on-demand chip. The reader's picks and the
 *                artifact's answers meet in the diff card.
 *
 * Scaffold level is the narrative's `scaffold_default` unless the Settings demo override says
 * otherwise, which is the one place the two states meet.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  ClaimMapPanel,
  Narrative,
  Panel,
  ScaleCheckPanel,
  Source,
  SparringQuestion,
} from '../../../contracts/types';
import TECHNIQUE_TAGS from '../../../contracts/technique-tags.json';
import { useT, type Key } from '../i18n';
import { PATHS, useJson } from '../content';
import { makeCtx, t as copy, type RenderCtx } from '../renderers/ctx';
import Card from '../renderers/Card';
import ClaimMap from '../renderers/ClaimMap';
import Dueling from '../renderers/Dueling';
import Echo from '../renderers/Echo';
import { EvidenceSheet, statusLabel, type SheetPayload } from '../renderers/EvidenceSheet';
import Family from '../renderers/Family';
import Incidence from '../renderers/Incidence';
import MoneyFlow from '../renderers/MoneyFlow';
import Narration from '../renderers/Narration';
import Options from '../renderers/Options';
import ScaleCheck from '../renderers/ScaleCheck';
import Nuance from './Nuance';
import { LS, readStore, writeStore, type AppState } from './state';
import type { Nav } from './Onboarding';

/** Appendix B, locked: the tag vocabulary a technique tag resolves its label in. */
const TAG_LABEL: Record<string, { en: string; id: string }> = Object.fromEntries(
  TECHNIQUE_TAGS.tags.map((tag) => [tag.key, { en: tag.en, id: tag.id }]),
);

const MOVE_LABEL: Record<SparringQuestion['move'], Key> = {
  mechanism: 'spar.move.mechanism',
  denominator: 'spar.move.denominator',
  incidence: 'spar.move.incidence',
};

/** One panel, by type. Family reads the whole narrative; the other seven read their panel. */
function PanelView({
  panel,
  narrative,
  ctx,
  stopped,
  onToggle,
}: {
  panel: Panel;
  narrative: Narrative;
  ctx: RenderCtx;
  stopped: boolean;
  onToggle: () => void;
}): ReactNode {
  switch (panel.type) {
    case 'claim_map':
      return <ClaimMap panel={panel} ctx={ctx} />;
    case 'scale_check':
      return <ScaleCheck panel={panel} ctx={ctx} />;
    case 'money_flow':
      return <MoneyFlow panel={panel} ctx={ctx} stopped={stopped} onToggle={onToggle} />;
    case 'incidence':
      return <Incidence panel={panel} ctx={ctx} />;
    case 'dueling':
      return <Dueling panel={panel} ctx={ctx} />;
    case 'echo':
      return <Echo panel={panel} ctx={ctx} />;
    case 'options':
      return <Options panel={panel} ctx={ctx} />;
    case 'family':
      return <Family narrative={narrative} ctx={ctx} />;
    default:
      return null;
  }
}

/** The overlay frame every autopsy sheet shares. The evidence sheet brings its own, from Gate 2. */
function Sheet({
  name,
  label,
  onClose,
  children,
}: {
  name: string;
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className="m-scrim" onClick={onClose} />
      <div className="m-sheet" data-sheet={name} role="dialog" aria-label={label}>
        <div className="m-grab" />
        {children}
      </div>
    </>
  );
}

export default function Autopsy({ state, nav }: { state: AppState; nav: Nav }) {
  const t = useT();
  const narrative = useJson<Narrative>(PATHS.narrative(state.narrative));
  const sources = useJson<Source[]>(PATHS.sources);
  const ctx = useMemo(
    () => makeCtx(sources.data ?? [], state.lang, state.theme),
    [sources.data, state.lang, state.theme],
  );
  const [tagSheet, setTagSheet] = useState<SheetPayload | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const n = narrative.data;

  /**
   * The highlight set: a narration sentence's own `els`, or every element of a status. Both are
   * derived from the artifact, so a sentence that names an element the panels do not carry
   * simply highlights nothing.
   */
  const highlighted = useMemo((): string[] => {
    if (n === null) return [];
    if (state.sent !== null) {
      return n.narration[state.lang].sentences.find((s) => s.id === state.sent)?.els ?? [];
    }
    if (state.hlStatus === null) return [];
    const ids: string[] = [];
    for (const panel of n.panels) {
      if (panel.type === 'claim_map') {
        for (const edge of panel.edges) if (edge.status === state.hlStatus) ids.push(edge.el_id);
        if (state.hlStatus === 'hidden') for (const hidden of panel.hidden) ids.push(hidden.el_id);
      }
      if (panel.type === 'dueling' && state.hlStatus === 'disputed') {
        for (const count of panel.counts) ids.push(count.el_id);
      }
    }
    return ids;
  }, [n, state.sent, state.hlStatus, state.lang]);

  /**
   * ponytail: the highlight is painted onto the rendered tree rather than passed down. It runs
   * after every render, because a panel that re-renders replaces its nodes and the attribute has
   * to follow. Ceiling: one querySelectorAll over the panel stack per render, and it is the only
   * writer of `data-hl` anywhere, which is what keeps the write safe.
   */
  useEffect(() => {
    const root = body.current;
    if (root === null) return;
    for (const node of root.querySelectorAll('[data-el]')) {
      if (highlighted.includes(node.getAttribute('data-el') ?? '')) node.setAttribute('data-hl', '1');
      else node.removeAttribute('data-hl');
    }
  });

  /** A state that names a panel scrolls to it, so the state is what is on screen. */
  useEffect(() => {
    if (state.focus === null || n === null) return;
    body.current?.querySelector(state.focus)?.scrollIntoView({ block: 'center' });
  }, [state.focus, n]);

  if (n === null || sources.data === null) {
    return (
      <div className="m-screen m-autopsy" data-screen="autopsy">
        <div className="m-ascroll">
          <div className="m-pane-note">
            {narrative.error === null && sources.error === null
              ? t('common.loading')
              : t('common.failed', { detail: narrative.error ?? sources.error ?? '' })}
          </div>
        </div>
      </div>
    );
  }

  // --- the gate -------------------------------------------------------------------------

  const level = state.scaffold === 'auto' ? n.scaffold_default : state.scaffold;
  const questions = n.sparring.questions;
  // S2 is the S3 card with one question and one dot. Which question rotates per device: the
  // counter advances once a gate is answered, so a first run is always the first question.
  const rotation = questions.length === 0 ? 0 : Math.max(0, Number(readStore(LS.s2) ?? '0') || 0) % questions.length;
  const asked = level === 'S2' ? questions.slice(rotation, rotation + 1) : questions;
  const gate = state.spar === 'gate' && (level !== 'S0' || state.sparDemand);
  const prediction = gate && level === 'S1';
  const quiz = gate && !prediction;
  const qi = Math.min(state.sparIdx, asked.length - 1);
  const question = asked[qi];
  const picked = state.sparPicked[qi];

  const finish = () => {
    if (level === 'S2') writeStore(LS.s2, String(rotation + 1));
    nav.patch({ spar: 'answered' });
  };

  const claimMap = n.panels.find((p): p is ClaimMapPanel => p.type === 'claim_map');
  const scale = n.panels.find((p): p is ScaleCheckPanel => p.type === 'scale_check');
  const edge = claimMap?.edges[0];

  /** The Gate 2 sheet for the first inspectable edge: what the matrix state addresses. */
  const edgePayload = (): SheetPayload | null =>
    edge === undefined
      ? null
      : {
          status: edge.status,
          label: statusLabel(ctx, edge.status),
          body: [edge.ev.quote],
          why: copy(ctx, edge.ev.why),
          sources: edge.ev.source_id === undefined ? [] : [ctx.resolveSource(edge.ev.source_id)],
        };

  const evidence = state.sheet === 'evidence' ? edgePayload() : tagSheet;
  const closeSheet = () => {
    setTagSheet(null);
    if (state.sheet !== null) nav.patch({ sheet: null });
  };

  const diff = ((): { title: string; rows: Array<{ key: string; st: string; text: string }> } | null => {
    if (state.spar !== 'answered') return null;
    if (level === 'S1') {
      const option = state.predPick === null ? undefined : n.prediction_tap.options[state.predPick];
      return {
        title: t('spar.diff.pred.title'),
        rows: [
          { key: 'pred', st: 'ink', text: t('spar.diff.pred', { label: option === undefined ? '' : copy(ctx, option) }) },
        ],
      };
    }
    const hits = asked.filter((q, i) => state.sparPicked[i] === q.correct).length;
    return {
      title: t('spar.diff.title', { hits, total: asked.length }),
      rows: asked.map((q, i) => {
        const hit = state.sparPicked[i] === q.correct;
        return {
          key: String(i),
          st: hit ? 'supported' : 'missing',
          text: `${t(MOVE_LABEL[q.move])}: ${t(hit ? 'spar.diff.hit' : 'spar.diff.miss')}`,
        };
      }),
    };
  })();

  const packLabel = t(n.pack === 'id' ? 'pack.id' : 'pack.en');

  return (
    <div className="m-screen m-autopsy" data-screen="autopsy">
      <div className="m-abar">
        <button
          type="button"
          className="m-round"
          aria-label={t('common.back')}
          onClick={() => {
            nav.patch({ screen: 'main', tab: 'radar', sheet: null });
          }}
        >
          <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12.5 4.5 7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="m-abar-title">{t('autopsy.title', { pack: packLabel })}</div>
        <button
          type="button"
          className="m-round"
          aria-label={t('action.nuance')}
          onClick={() => {
            nav.openSheet('nuance-story');
          }}
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 12.5V3.5M6.5 6.5 10 3l3.5 3.5M4.5 10.5v6h11v-6" />
          </svg>
        </button>
      </div>

      <div className="m-ascroll" ref={body}>
        <div data-testid={state.permalink ? 'permalink-card' : undefined}>
          <Card
            narrative={n}
            variant="hero"
            ctx={ctx}
            onTap={(kind, key) => {
              if (kind === 'tag') {
                const label = TAG_LABEL[key];
                setTagSheet({
                  label: t('autopsy.tag.pill'),
                  title: label === undefined ? key : copy(ctx, label),
                  body: [key],
                  why: t('autopsy.tag.why'),
                });
              } else if (kind === 'chip') {
                nav.patch({ hlStatus: key, sent: null });
                nav.toast(t('toast.highlight', { n: highlightCount(n, key) }));
              } else if (kind === 'original') {
                nav.openSheet('original');
              } else if (kind === 'outbound') {
                nav.toast(t('toast.outbound', { url: n.url }));
              } else {
                nav.patch({ spar: 'skipped' });
              }
            }}
          />
        </div>

        <div className="m-provline">
          <button
            type="button"
            className="m-provlink"
            onClick={() => {
              nav.openSheet('provenance');
            }}
          >
            {/* The card already names who analyzed and who narrated, per the Gate 2 split. This
                line carries what the card does not: the source count and the way into the chain. */}
            {t('autopsy.prov', { sources: n.provenance.source_count })}
          </button>
          <span className="m-provcached">{t('autopsy.cached', { at: n.provenance.computed_at })}</span>
          {level === 'S0' && state.spar === 'gate' && !state.sparDemand ? (
            <button
              type="button"
              className="m-sparchip"
              data-testid="spar-chip"
              onClick={() => {
                nav.patch({ sparDemand: true, sparIdx: 0, sparPicked: [] });
              }}
            >
              {t('spar.chip')}
            </button>
          ) : null}
        </div>

        {!gate ? null : (
          <div className="m-spar">
            <div className="m-spar-head">
              <span className="m-spar-kicker">{t('spar.kicker')}</span>
              <button
                type="button"
                className="m-spar-skip"
                data-testid="spar-skip"
                onClick={() => {
                  nav.patch({ spar: 'skipped' });
                }}
              >
                {t('spar.skip')}
              </button>
            </div>

            {!quiz || question === undefined ? null : (
              <>
                <div className="m-spar-dots">
                  {asked.map((_, index) => (
                    <span
                      key={String(index)}
                      className="m-spar-dot"
                      data-spar-dot={index}
                      data-on={index <= qi ? '1' : '0'}
                      data-st={index <= qi ? 'ink' : 'mut'}
                    />
                  ))}
                </div>
                <div className="m-spar-q" data-testid="spar-q">
                  {copy(ctx, question.q)}
                </div>
                {question.options.map((option, index) => (
                  <button
                    key={copy(ctx, option)}
                    type="button"
                    className="m-spar-opt"
                    data-spar-option="1"
                    data-answer={
                      picked === undefined ? undefined : index === question.correct ? 'right' : picked === index ? 'wrong' : 'dim'
                    }
                    onClick={() => {
                      if (picked !== undefined) return;
                      const next = state.sparPicked.slice();
                      next[qi] = index;
                      nav.patch({ sparPicked: next });
                    }}
                  >
                    {copy(ctx, option)}
                  </button>
                ))}
                {picked === undefined ? null : (
                  <>
                    <div className="m-spar-note" data-testid="spar-note">
                      {copy(ctx, question.note)}
                    </div>
                    <button
                      type="button"
                      className="m-cta"
                      data-press="1"
                      onClick={() => {
                        if (qi < asked.length - 1) nav.patch({ sparIdx: qi + 1 });
                        else finish();
                      }}
                    >
                      {t(qi < asked.length - 1 ? 'spar.next' : 'spar.reveal')}
                    </button>
                  </>
                )}
              </>
            )}

            {!prediction ? null : (
              <div data-testid="prediction-tap">
                <div className="m-spar-q">{copy(ctx, n.prediction_tap.prompt)}</div>
                {n.prediction_tap.options.map((option, index) => (
                  <button
                    key={copy(ctx, option)}
                    type="button"
                    className="m-spar-opt"
                    data-spar-option="1"
                    data-answer={state.predPick === null ? undefined : state.predPick === index ? 'picked' : 'dim'}
                    onClick={() => {
                      if (state.predPick === null) nav.patch({ predPick: index });
                    }}
                  >
                    {String(index + 1)} · {copy(ctx, option)}
                  </button>
                ))}
                {state.predPick === null ? null : (
                  <button type="button" className="m-cta" data-press="1" onClick={finish}>
                    {t('spar.reveal')}
                  </button>
                )}
              </div>
            )}

            <div className="m-spar-foot">{t('spar.foot')}</div>
          </div>
        )}

        {gate ? null : (
          <>
            {diff === null ? null : (
              <div className="m-diff" data-testid="diff-card">
                <div className="m-diff-title">{diff.title}</div>
                {diff.rows.map((row) => (
                  <div key={row.key} className="m-diff-row">
                    <span className="m-dot" data-st={row.st} />
                    <span className="m-diff-text">{row.text}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="m-panel">
              <div className="m-panel-title">{t('autopsy.voice')}</div>
              <Narration
                narrative={n}
                ctx={ctx}
                activeId={state.sent}
                onSelect={(id) => {
                  nav.patch({ sent: state.sent === id ? null : id, hlStatus: null });
                }}
              />
            </div>

            {n.panels.map((panel) => (
              <PanelView
                key={panel.el_id}
                panel={panel}
                narrative={n}
                ctx={ctx}
                stopped={state.moneyStopped}
                onToggle={() => {
                  nav.patch({ moneyStopped: !state.moneyStopped });
                }}
              />
            ))}
            {n.panels.some((panel) => panel.type === 'echo') ? null : <Echo panel={n.echo} ctx={ctx} />}

            <button
              type="button"
              className="m-explore"
              onClick={() => {
                nav.openSheet('explore');
              }}
            >
              {t('autopsy.explore')}
            </button>
          </>
        )}
      </div>

      <div className="m-actionbar">
        <button
          type="button"
          className="m-cta"
          data-press="1"
          onClick={() => {
            nav.openSheet('nuance-story');
          }}
        >
          {t('action.nuance')}
        </button>
        <button
          type="button"
          className="m-round m-round-fill"
          data-press="1"
          aria-label={t('action.original')}
          onClick={() => {
            nav.toast(t('toast.outbound', { url: n.url }));
          }}
        >
          →
        </button>
        <button
          type="button"
          className="m-round m-round-fill"
          data-press="1"
          aria-label={t('action.flag')}
          onClick={() => {
            nav.patch({ sheet: 'flag-form', flagReason: null });
          }}
        >
          <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 18V3M5 3.5h9.5L12 7l2.5 3.5H5" />
          </svg>
        </button>
      </div>

      {evidence === null ? null : <EvidenceSheet payload={evidence} ctx={ctx} onClose={closeSheet} />}

      {state.sheet !== 'original' ? null : (
        <Sheet name="original" label={t('orig.kicker', { lang: t(n.original.lang === 'id' ? 'lang.id' : 'lang.en') })} onClose={closeSheet}>
          <div className="m-sheet-kicker">
            {t('orig.kicker', { lang: t(n.original.lang === 'id' ? 'lang.id' : 'lang.en') })}
          </div>
          <div className="m-orig-text">{n.original.text}</div>
          <div className="m-sheet-meta">
            {n.outlet} · {n.published_date} · {n.url}
          </div>
          <div className="m-sheet-foot">{t('orig.foot')}</div>
        </Sheet>
      )}

      {state.sheet !== 'provenance' ? null : (
        <Sheet name="provenance" label={t('autopsy.chain.title')} onClose={closeSheet}>
          <div className="m-sheet-h">{t('autopsy.chain.title')}</div>
          <div className="m-sheet-p">{t('autopsy.chain.body')}</div>
          <div className="m-chain">
            {n.manifest.steps.map((step, index) => (
              <div key={`${String(index)}-${step.role}`} className="m-chain-row">
                <span className="m-chain-i">{String(index + 1).padStart(2, '0')}</span>
                <span className="m-chain-main">
                  <span className="m-chain-step">
                    {step.role} · {step.model}
                  </span>
                  <span className="m-chain-who">
                    {step.started_at} to {step.finished_at} · {step.input_hash}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <div className="m-sheet-meta">{t('autopsy.chain.run', { run: n.manifest.run_id, at: n.manifest.generated_at })}</div>
          <div className="m-sheet-foot">{t('autopsy.chain.foot')}</div>
        </Sheet>
      )}

      {state.sheet !== 'explore' ? null : (
        <Sheet name="explore" label={t('explore.title')} onClose={closeSheet}>
          <div className="m-sheet-h">{t('explore.title')}</div>
          <div className="m-sheet-p">{t('explore.body')}</div>
          <div className="m-explore-card">
            <div className="m-explore-title">{t('explore.constellation')}</div>
            <div className="m-explore-body">{t('explore.constellation.body')}</div>
            <button
              type="button"
              className="m-ghost"
              onClick={() => {
                nav.patch({ screen: 'main', tab: 'archive', sheet: null });
              }}
            >
              {t('explore.archive')}
            </button>
          </div>
          {scale === undefined ? null : (
            <div className="m-explore-card">
              <div className="m-explore-title">{t('explore.denoms')}</div>
              <div className="m-explore-chips">
                {scale.context_chips.map((chip) => (
                  <button
                    key={chip.el_id}
                    type="button"
                    className="m-tag"
                    onClick={() => {
                      nav.toast(t('toast.denominator'));
                    }}
                  >
                    {copy(ctx, chip.label)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      )}

      {state.sheet !== 'flag-form' ? null : (
        <Sheet name="flag-form" label={t('flag.title')} onClose={closeSheet}>
          <div className="m-sheet-h">{t('flag.title')}</div>
          <div className="m-sheet-p">{t('flag.body')}</div>
          <div className="m-onb-list">
            {(['flag.r0', 'flag.r1', 'flag.r2', 'flag.r3'] as const).map((key, index) => (
              <button
                key={key}
                type="button"
                className="m-row"
                aria-pressed={state.flagReason === index}
                onClick={() => {
                  nav.patch({ flagReason: index });
                }}
              >
                <span className={state.flagReason === index ? 'm-radio m-radio-on' : 'm-radio'} aria-hidden="true" />
                <span className="m-row-main">
                  <span className="m-row-label">{t(key)}</span>
                </span>
              </button>
            ))}
          </div>
          {state.flagReason === null ? null : (
            <button
              type="button"
              className="m-cta"
              data-press="1"
              onClick={() => {
                const flags = state.flags.includes(n.id) ? state.flags : [...state.flags, n.id];
                nav.patch({ flags, sheet: 'flag-received' });
              }}
            >
              {t('flag.submit')}
            </button>
          )}
        </Sheet>
      )}

      {state.sheet !== 'flag-received' ? null : (
        <Sheet name="flag-received" label={t('flag.done.title')} onClose={closeSheet}>
          <div className="m-flag-done">
            <div className="m-flag-check">
              <svg width="19" height="19" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="var(--accInk)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="m-sheet-h">{t('flag.done.title')}</div>
            <div className="m-sheet-p">{t('flag.done.body')}</div>
            <button type="button" className="m-ghost" onClick={closeSheet}>
              {t('flag.done.cta')}
            </button>
          </div>
        </Sheet>
      )}

      {state.sheet !== 'nuance-story' && state.sheet !== 'nuance-chat' ? null : (
        <Nuance narrative={n} ctx={ctx} template={state.sheet === 'nuance-story' ? 'story' : 'chat'} nav={nav} />
      )}
    </div>
  );
}

/** How many elements a count chip lights, so the toast can say it before the reader scrolls. */
function highlightCount(narrative: Narrative, status: string): number {
  let total = 0;
  for (const panel of narrative.panels) {
    if (panel.type === 'claim_map') {
      total += panel.edges.filter((edge) => edge.status === status).length;
      if (status === 'hidden') total += panel.hidden.length;
    }
    if (panel.type === 'dueling' && status === 'disputed') total += panel.counts.length;
  }
  return total;
}
