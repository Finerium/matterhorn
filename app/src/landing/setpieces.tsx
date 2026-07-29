/**
 * The landing's set pieces: every figure blueprint 4.4 asks for, in its STATIC frame.
 *
 * Two kinds live here and the difference is what they are made of.
 *
 * Product-as-imagery (AC-LAND-12): the hero claim map, the eight grammar cards, the feed stack
 * and the phone. These import the app's own renderer modules and hand them real published JSON,
 * so the picture on the front door is the component, not a photograph of one. There is no
 * landing-only copy of a renderer anywhere in this file, and the only argument that differs from
 * what `/app` passes is the absence of an `onTap`, which is what leaves Card presentational.
 *
 * Diagrams: the problem spine, the cascade motif, the share storyboard, the browser chrome. These
 * carry no text at all. They are `aria-hidden` geometry beside the frozen prose that says what
 * they mean, which is also why they cannot drift from it: there is nothing in them to drift.
 *
 * Nothing here is a control. The renderers are handed a still context (`makeCtx(..., true)`), so
 * the layer draws its elements without a tab stop, a role or an evidence sheet, and every mount
 * carries `inert` on top of that: the context is the renderer's own refusal and `inert` is the
 * page's, covering anything a renderer marks addressable in a later gate. A set piece is a
 * picture, and a picture that answers Enter is not one.
 *
 * ponytail: no motion. The frames here are what a reader with reduced motion sees, so they are
 * built as the finished picture and the choreography pass animates from them, not toward them.
 */
import { useMemo, type ReactNode } from 'react';
import type {
  ClaimMapPanel,
  Constellation,
  DuelingPanel,
  IncidencePanel,
  MoneyFlowPanel,
  Narrative,
  Panel,
  ScaleCheckPanel,
  Source,
} from '../../../contracts/types';
import { PATHS, useJson } from '../content';
import { DASH, makeCtx, type ElStatus, type RenderCtx, type Theme } from '../renderers/ctx';
import Card from '../renderers/Card';
import ClaimMap from '../renderers/ClaimMap';
import Dueling from '../renderers/Dueling';
import Echo from '../renderers/Echo';
import Family from '../renderers/Family';
import Incidence from '../renderers/Incidence';
import MoneyFlow from '../renderers/MoneyFlow';
import ScaleCheck from '../renderers/ScaleCheck';
import { layout, VIEW } from '../research/graph';
import { HERO } from './copy';
import { HERO_ID } from './data';

/**
 * The two artifacts the hero narrative cannot supply. Grammar cards 5 and 6 are Dueling Numbers
 * and Cascade Echo, and `mbg-stop` carries neither panel: a narrative carries the panels its
 * story needs, so a grid that insisted on one artifact would be a grid with two empty cards.
 *
 * Both ids are picked to carry their panel in BOTH content roots. Dev and e2e read the seed
 * fixture and production reads the published archive, and a card fed by an id that only one of
 * them carries is a card that renders in the suite and not on the site, or the reverse.
 */
const DUEL_ID = 'mbg-poisoning';
const ECHO_ID = 'ppn-panic';

/**
 * Destructured rather than read where it renders. AC-INV-2 has a structural half that greps every
 * app module for `.headline` and allows exactly one (Card.tsx), because a second module reading a
 * narrative headline would be a second card contract. This is a frozen landing string that happens
 * to share a prefix, and keeping that grep blunt is worth more than a property access.
 */
const { headlineChip } = HERO.setPiece;

export interface Product {
  ctx: RenderCtx;
  hero: Narrative;
  duel: Narrative;
  echo: Narrative;
  graph: Constellation;
}

const panelOf = <T extends Panel>(narrative: Narrative, type: T['type']): T | undefined =>
  narrative.panels.find((p): p is T => p.type === type);

/** The theme the shell already applied to `<body>` before first paint, in the renderers' vocabulary. */
const bodyTheme = (): Theme => (document.body.dataset.mth === 'dark' ? 'dark' : 'light');

/**
 * The four artifacts the figures draw from, or null until all of them are in hand. Reads go
 * through `content.ts`, so a reader arriving from `/app` pays for none of them twice and the
 * seed-mode switch points dev and e2e at the fixture root exactly as it does everywhere else.
 *
 * The feed is deliberately not read here. `useRadar` would pull every narrative in the pack for
 * the three cards section 5 shows, and the three artifacts already loaded are three real cards.
 */
export function useProduct(): Product | null {
  const sources = useJson<Source[]>(PATHS.sources).data;
  const hero = useJson<Narrative>(PATHS.narrative(HERO_ID)).data;
  const duel = useJson<Narrative>(PATHS.narrative(DUEL_ID)).data;
  const echo = useJson<Narrative>(PATHS.narrative(ECHO_ID)).data;
  const graph = useJson<Constellation>(PATHS.constellation).data;
  // English only, per 4.4, and still: every mount on this page is a picture (blueprint 4.4.6).
  const ctx = useMemo(() => makeCtx(sources ?? [], 'en', bodyTheme(), true), [sources]);

  if (sources === null || hero === null || duel === null || echo === null || graph === null) return null;
  return { ctx, hero, duel, echo, graph };
}

/** A renderer at landing scale: the real component, out of reach. */
function Mount({ className, testId, children }: { className: string; testId?: string; children: ReactNode }) {
  return (
    <div className={`m-l-mount ${className}`} data-testid={testId} inert>
      {children}
    </div>
  );
}

// --- the hero -----------------------------------------------------------------------------

/**
 * 4.4.2. The claim map for the narrative the frozen headline chip names, and the three callouts
 * that read it. Static frame: the whole composition, assembled. The choreography pass drops the
 * chip, cascades the spine, draws the edges and pops the counts from exactly this.
 *
 * The callout strokes are the renderer layer's own `DASH` patterns, so the line beside a label
 * is the line inside the map (colourblind safety travels with the copy, not beside it).
 */
export function HeroPiece({ product, counts }: { product: Product | null; counts: string }) {
  const panel = product === null ? undefined : panelOf<ClaimMapPanel>(product.hero, 'claim_map');
  return (
    <figure className="m-l-piece">
      <figcaption className="m-l-chip">{headlineChip}</figcaption>
      <Mount className="m-l-mount-hero" testId="hero-claim-map">
        {panel === undefined || product === null ? null : <ClaimMap panel={panel} ctx={product.ctx} />}
      </Mount>
      <ul className="m-l-callouts" role="list">
        <Callout status="supported" text={HERO.setPiece.edgeSupported} />
        <Callout status="missing" text={HERO.setPiece.edgeMissing} />
        <Callout status="hidden" text={HERO.setPiece.sidePanel} />
      </ul>
      <p className="m-l-counts" data-testid="hero-counts">
        {counts}
      </p>
    </figure>
  );
}

function Callout({ status, text }: { status: ElStatus; text: string }) {
  return (
    <li className="m-l-callout" data-st={status}>
      <svg width="22" height="6" aria-hidden="true">
        <line x1="0" y1="3" x2="22" y2="3" stroke="currentColor" strokeWidth="2" strokeDasharray={DASH[status]} />
      </svg>
      <span className="m-l-callout-text">{text}</span>
    </li>
  );
}

// --- section 1: the problem ---------------------------------------------------------------

/**
 * 4.4.3. The four beats as one diagram: the headline promise, the two real facts under it, the
 * arrow that was never stated, and the branches hanging off the spine.
 *
 * `data-beat` is the seam the pinned desktop sequence advances through. All four are drawn, which
 * is the beat-4 state and the only state that is legible standing still.
 */
export function ProblemSpine() {
  const branches = [0, 1, 2, 3];
  return (
    <svg className="m-l-spine" viewBox="0 0 240 272" aria-hidden="true">
      <g data-beat="1">
        <rect className="m-l-sp-head" x="4" y="6" width="150" height="38" rx="12" />
      </g>
      <g data-beat="2">
        <line className="m-l-sp-rail" x1="34" y1="44" x2="34" y2="78" />
        <rect className="m-l-sp-node" x="4" y="78" width="150" height="34" rx="11" />
        <rect className="m-l-sp-node" x="4" y="228" width="150" height="34" rx="11" />
      </g>
      <g data-beat="3">
        <line className="m-l-sp-gap" x1="34" y1="112" x2="34" y2="228" />
        <circle className="m-l-sp-break" cx="34" cy="132" r="9" />
      </g>
      <g data-beat="4">
        {branches.map((at) => {
          const y = 150 + at * 22;
          return (
            <g key={at}>
              <line className="m-l-sp-branch" x1="34" y1={y} x2="168" y2={y} />
              <rect className="m-l-sp-hidden" x="168" y={y - 8} width="68" height="16" rx="8" />
            </g>
          );
        })}
      </g>
    </svg>
  );
}

// --- section 2: the stakes ----------------------------------------------------------------

/** 4.4.4. One node fanning into many. Documentary, not dramatic: eleven thin lines and a dot each. */
export function Cascade() {
  const fan = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <svg className="m-l-cascade" viewBox="0 0 320 88" aria-hidden="true">
      <circle className="m-l-cas-seed" cx="10" cy="44" r="4.5" />
      {fan.map((at) => {
        const y = 6 + at * 7.6;
        return (
          <g key={at}>
            <path className="m-l-cas-line" d={`M16 44 C 130 44, 170 ${String(y)}, 296 ${String(y)}`} />
            <circle className="m-l-cas-dot" cx="300" cy={y} r="2.2" />
          </g>
        );
      })}
    </svg>
  );
}

// --- section 4: the grammar ---------------------------------------------------------------

/**
 * 4.4.6, in the order the eight frozen cards are written. Seven are the app's renderers; the
 * eighth is the constellation, which is a whole-archive picture rather than a panel and is drawn
 * from `research/graph.ts`, the same placement the research desk uses.
 *
 * A plain function rather than a component: it builds elements, calls no hook, and the section
 * that owns the frozen copy is the one that pairs each shot with its card text.
 */
export function grammarShots(product: Product | null): ReactNode[] {
  if (product === null) return [];
  const { ctx, hero, duel, echo, graph } = product;
  const claimMap = panelOf<ClaimMapPanel>(hero, 'claim_map');
  const scale = panelOf<ScaleCheckPanel>(hero, 'scale_check');
  const money = panelOf<MoneyFlowPanel>(hero, 'money_flow');
  const incidence = panelOf<IncidencePanel>(hero, 'incidence');
  const dueling = panelOf<DuelingPanel>(duel, 'dueling');
  return [
    claimMap === undefined ? null : <ClaimMap panel={claimMap} ctx={ctx} />,
    scale === undefined ? null : <ScaleCheck panel={scale} ctx={ctx} />,
    // Off, which is the panel's resting state: the severed frame is what the card's micro-animation
    // has left to show, and a miniature that opens already struck through reads as an error.
    money === undefined ? null : <MoneyFlow panel={money} ctx={ctx} stopped={false} />,
    incidence === undefined ? null : <Incidence panel={incidence} ctx={ctx} />,
    dueling === undefined ? null : <Dueling panel={dueling} ctx={ctx} />,
    <Echo panel={echo.echo} ctx={ctx} />,
    <Family narrative={hero} ctx={ctx} />,
    <MiniConstellation graph={graph} />,
  ];
}

/**
 * The archive as one picture, at card size. The full component pans, zooms, selects and carries
 * three buttons, none of which belong in a 150px thumbnail; what it and this share is `layout`,
 * so the shape here is the shape the research desk draws.
 *
 * ponytail: no labels. Past a couple of centimetres they are unreadable anyway, and the card's
 * frozen copy is what names the picture.
 */
export function MiniConstellation({ graph }: { graph: Constellation }) {
  const places = layout(graph);
  return (
    <svg className="m-l-const" viewBox={`0 0 ${String(VIEW.w)} ${String(VIEW.h)}`} aria-hidden="true">
      <g className="m-l-const-links">
        {graph.links.map((link) => {
          const from = places.get(link.a);
          const to = places.get(link.b);
          if (from === undefined || to === undefined) return null;
          return (
            <line
              key={`${link.a}|${link.b}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          );
        })}
      </g>
      <g className="m-l-const-nodes">
        {graph.nodes.map((node) => {
          const at = places.get(node.id);
          return at === undefined ? null : <circle key={node.id} cx={at.x} cy={at.y} r="2.2" />;
        })}
      </g>
    </svg>
  );
}

// --- section 5: two modes -----------------------------------------------------------------

/** 4.4.7 left panel: real feed cards behind a mask, in the compact slot the radar uses below its hero. */
export function FeedStack({ product }: { product: Product | null }) {
  return (
    <div className="m-l-mask" data-testid="two-modes-panel">
      <Mount className="m-l-mount-feed">
        {product === null ? null : (
          <>
            <Card narrative={product.duel} variant="compact" ctx={product.ctx} />
            <Card narrative={product.echo} variant="compact" ctx={product.ctx} />
            <Card narrative={product.hero} variant="compact" ctx={product.ctx} />
          </>
        )}
      </Mount>
    </div>
  );
}

/**
 * 4.4.7 right panel: the two taps, standing still. Frame one is the message that arrives, frame
 * two is the share sheet with Matterhorn in it. No copy is invented for either: the only word in
 * the storyboard is the wordmark, and the section's frozen block says what the sequence is.
 */
export function ShareBoard({ wordmark }: { wordmark: string }) {
  return (
    <div className="m-l-board" data-testid="two-modes-panel">
      <div className="m-l-board-frame" aria-hidden="true">
        <div className="m-l-bubble">
          <span className="m-l-bubble-line" />
          <span className="m-l-bubble-link" />
        </div>
      </div>
      <div className="m-l-board-frame" aria-hidden="true">
        <div className="m-l-sheet">
          <span className="m-l-sheet-grab" />
          <div className="m-l-sheet-row m-l-sheet-row-on">
            <span className="m-l-sheet-icon" />
            <span className="m-l-sheet-name">{wordmark}</span>
          </div>
          <div className="m-l-sheet-row">
            <span className="m-l-sheet-icon" />
            <span className="m-l-sheet-bar" />
          </div>
          <div className="m-l-sheet-row">
            <span className="m-l-sheet-icon" />
            <span className="m-l-sheet-bar" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- section 8: try it --------------------------------------------------------------------

/**
 * 4.4.10. The phone the app was built for, with the real feed inside it, and the research desk
 * beside it as the archive picture behind browser chrome.
 *
 * The frame's geometry is `app/src/app/wide.css`'s, restated rather than reused: those rules live
 * inside a `min-width: 768px` block and collapse to `display: contents` under it, which is right
 * for an app that goes full bleed on a phone and wrong for a figure that stays a figure at 360px.
 *
 * AC-LAND-13: a still with a play button is a watch affordance, so there is no still. This is the
 * feed, rendered.
 */
export function PhoneFeed({ product }: { product: Product | null }) {
  return (
    <div className="m-l-phone">
      <div className="m-l-phone-screen">
        <Mount className="m-l-mount-phone">
          {product === null ? null : (
            <>
              <Card narrative={product.hero} variant="hero" ctx={product.ctx} />
              <Card narrative={product.duel} variant="compact" ctx={product.ctx} />
            </>
          )}
        </Mount>
      </div>
    </div>
  );
}

/** The desktop surface, framed. Chrome only: no address text, because there is none to quote. */
export function DeskWindow({ product }: { product: Product | null }) {
  return (
    <div className="m-l-window">
      <div className="m-l-window-bar" aria-hidden="true">
        <span className="m-l-window-dot" />
        <span className="m-l-window-dot" />
        <span className="m-l-window-dot" />
        <span className="m-l-window-url" />
      </div>
      <div className="m-l-window-body">{product === null ? null : <MiniConstellation graph={product.graph} />}</div>
    </div>
  );
}
