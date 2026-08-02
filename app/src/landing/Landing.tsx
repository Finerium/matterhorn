/**
 * The landing at `/`: blueprint 4.4, all fourteen parts, in order.
 *
 * This file is the document. It holds no copy and no numbers of its own: every string comes from
 * `copy.ts`, which is 4.4 transcribed and checked against the blueprint by
 * `pnpm check:landing-copy`, and every figure comes from `setpieces.tsx`. The only literals here
 * are class names, anchors and routes. That is the point of the split, and it is what makes a
 * copy change a one-file change (AC-LAND-1) and a hardcoded number impossible to write by
 * accident (AC-LAND-3): a slot reaches the page through `fill` or it does not reach it.
 *
 * Structure is what the accessibility criterion is bought with rather than retrofitted for
 * (AC-LAND-10). One `h1`, one `h2` per section in source order, 4.4.9's `h3` under the `h2` above
 * it, and every section named by its own heading through `aria-labelledby`, so the region list a
 * screen reader builds is the section list the nav offers. The footer's two link groups are
 * `nav` landmarks named by their visible label, not headings, because they are navigation.
 *
 * Every set piece is drawn in the frame it holds STANDING STILL, and the choreography adds
 * transform and opacity over that rather than toward it. `data-reveal` marks what reveals on
 * enter; `data-beat` and `data-console-line` are in setpieces.tsx and this file's console list.
 * None of them is a placeholder: strip motion.ts and landing.css's `no-preference` blocks and
 * this document is still the finished page, which is exactly what a reduced-motion reader gets
 * (AC-LAND-7).
 *
 * No video link and no watch affordance anywhere, locked by AC-LAND-13. No outbound link either,
 * as it happens: 4.4 names outlets and institutions but publishes no URL for any of them, and the
 * one page that quotes headlines with their links is the app. AC-SEC-4 is satisfied by having
 * nothing to satisfy it with, and the moment that changes the rel goes on with the href.
 */
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  FLEET,
  FOOTER,
  GRAMMAR,
  HERO,
  INTEGRITY,
  MODES,
  NAV,
  PACKS,
  PROBLEM,
  STAKES,
  TRY,
  fill,
  type Line,
  type SlotValues,
} from './copy';
import { useCursor } from './cursor';
import { useLanding } from './data';
import { useChoreography } from './motion';
import {
  Cascade,
  DeskWindow,
  FeedStack,
  HeroPiece,
  PhoneFeed,
  ProblemSpine,
  ShareBoard,
  grammarShots,
  useProduct,
} from './setpieces';
import './landing.css';

/**
 * Slots before the artifacts land. The radar says `-` for a symmetry receipt it does not have
 * yet and this says the same thing for the same reason: the alternative is a plausible number
 * that is nobody's, and the alternative to that is a page that paints nothing until a fetch
 * resolves. Every one of these is replaced in the same paint the content arrives in.
 */
const PENDING: SlotValues = {
  missing: '-',
  unsourced: '-',
  hidden: '-',
  gov: '-',
  neutral: '-',
  opp: '-',
  packs: '-',
  components: '-',
  agents: '-',
  narratives: '-',
};

/**
 * Where each frozen footer item goes. Blueprint 6.7 publishes eight routes and four of the
 * Principles items are four things the methodology page states, so all four land there rather
 * than on invented URLs. `/research` is Gate 5's surface.
 */
const FOOT_ROUTE: Record<string, string> = {
  'Mobile app': '/app',
  'Research desk': '/research',
  'Methodology and symmetry': '/methodology',
  'Corrections changelog': '/methodology',
  'Verdict-free rules': '/methodology',
  'Stance-blindness': '/methodology',
  'Policy on protest and Echo': '/methodology',
  'AI disclosure': '/methodology',
};

/** One section frame: the anchor the nav points at, and the heading that names the region. */
function Section({ anchor, children }: { anchor: string; children: ReactNode }) {
  return (
    <section className="m-l-sec" id={anchor} aria-labelledby={`${anchor}-h`}>
      <div className="m-l-in">{children}</div>
    </section>
  );
}

export default function Landing() {
  const { data } = useLanding();
  const product = useProduct();
  // `data-reveal` below and `data-beat` in setpieces.tsx are the seams; this only picks the path
  // that drives them, and on the CSS baseline it does nothing but say which one won.
  useChoreography(product !== null);
  // The direction's cursor system: writes the custom properties surface.css consumes, and only
  // on fine-pointer readers who have not asked for reduced motion.
  useCursor();
  // The shell's static hero (app/index.html) held the LCP while this component booted. The
  // TIMING of this removal is the whole point: an effect runs after this tree's first paint,
  // and Chromium only emits a new LCP entry on a LARGER PAINT, so removing the (equal-sized)
  // under-layer after the real hero has painted retracts nothing. Removing it before that
  // paint, the way unmounting #root children did, makes the real hero the next entry and gives
  // the whole boot back to the metric. Removal, not hiding, because the duplicate copy must
  // leave the text and accessibility trees once the real hero carries it.
  useEffect(() => {
    document.getElementById('static-hero')?.remove();
  }, []);
  // Predecode the demo cards' imagery once the page is idle. Below-fold images are lazy
  // (AC-LAND-11) and stay lazy: decode() triggers their load without touching the attribute.
  // Without this, each image decodes and uploads mid-scroll, in the exact window AC-PERF-5
  // traces, and on a machine without a GPU that is a run of partially presented frames. The
  // cost is honest and small: the landing's six 480px previews, fetched while nothing else is
  // happening, for every reader whose scroll then stays smooth.
  useEffect(() => {
    // typeof-guarded because lib.dom declares requestIdleCallback unconditionally and Safari
    // below 18 does not have it.
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const run = () => {
      for (const img of Array.from(document.images)) void img.decode().catch(() => undefined);
    };
    const handle = hasIdle ? window.requestIdleCallback(run) : window.setTimeout(run, 1200);
    return () => {
      if (hasIdle) window.cancelIdleCallback(handle);
      else window.clearTimeout(handle);
    };
  }, []);
  const values: SlotValues = data ?? PENDING;
  const say = (parts: Line): string => fill(parts, values);
  const shots = grammarShots(product);

  return (
    // `data-theme` mirrors the theme the shell stamped on `<body>` (its vocabulary is `data-mth`)
    // into surface.css's, so the paper and glass tokens follow a dark reader arriving from /app.
    <div className="m-l" data-testid="landing" data-theme={document.body.dataset.mth === 'dark' ? 'dark' : 'light'}>
      {/* 4.4.1. One `nav` on the page and it holds all three of 4.4.1's parts, so the collapsed
          mobile bar is a subset of the same landmark rather than a second one. */}
      <header className="m-l-nav">
        <nav className="m-l-nav-in">
          <a className="m-l-mark" href={`#${HERO.anchor}`}>
            {NAV.wordmark}
          </a>
          <span className="m-l-nav-links">
            {NAV.links.map((link) => (
              <a key={link.anchor} className="m-l-nav-link" href={`#${link.anchor}`}>
                {link.label}
              </a>
            ))}
          </span>
          <Link className="m-l-cta m-l-cta-sm" to="/app">
            {NAV.cta}
          </Link>
        </nav>
      </header>

      <main className="m-l-main">
        {/* 4.4.2 */}
        <section className="m-l-hero" id={HERO.anchor} aria-labelledby="top-h">
          <div className="m-l-in m-l-hero-in">
            <div className="m-l-hero-say">
              <p className="m-l-eyebrow">{HERO.eyebrow}</p>
              <h1 className="m-l-h1" id="top-h">
                {HERO.h1}
              </h1>
              <p className="m-l-lead">{HERO.subhead}</p>
              <div className="m-l-ctas">
                {/* One of the direction's two magnets; the inner span is the 40 percent
                    counter-move surface.css drives. */}
                <Link className="m-l-cta g-magnet" to="/app">
                  <span className="g-magnet-inner">{HERO.ctaPrimary}</span>
                </Link>
                <Link className="m-l-cta m-l-cta-soft" to="/research">
                  {HERO.ctaSecondary}
                </Link>
              </div>
              <p className="m-l-micro">{HERO.microline}</p>
            </div>
            <HeroPiece product={product} counts={say(HERO.setPiece.countChips)} />
          </div>
        </section>

        <div className="m-l-pull">
          <p className="m-l-in m-l-pull-text">{HERO.dividerPullQuote}</p>
        </div>

        {/* 4.4.3 */}
        <Section anchor={PROBLEM.anchor}>
          <p className="m-l-kicker">{PROBLEM.kicker}</p>
          <h2 className="m-l-h2" id={`${PROBLEM.anchor}-h`}>
            {PROBLEM.h2}
          </h2>
          <p className="m-l-lead">{PROBLEM.lead}</p>
          <div className="m-l-beats">
            <div className="m-l-beats-fig g-paper">
              <ProblemSpine />
            </div>
            <ol className="m-l-beatlist" role="list">
              {PROBLEM.beats.map((beat, at) => (
                <li key={beat.kicker} className="m-l-beat" data-beat={at + 1} data-reveal>
                  <p className="m-l-beat-k">{beat.kicker}</p>
                  <p className="m-l-beat-b">{beat.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <p className="m-l-closing">{PROBLEM.closing}</p>
          <p className="m-l-micro">{PROBLEM.sourceMicroline}</p>
        </Section>

        {/* 4.4.4 */}
        <Section anchor={STAKES.anchor}>
          <p className="m-l-kicker">{STAKES.kicker}</p>
          <h2 className="m-l-h2" id={`${STAKES.anchor}-h`}>
            {STAKES.h2}
          </h2>
          <p className="m-l-lead">{STAKES.lead}</p>
          <Cascade />
          <ul className="m-l-cases" role="list">
            {/* The reveal stays on the li: its scroll-driven animation holds `transform: none` at
                fill, so the glass card inside is what tilts and the two never share an element. */}
            {STAKES.cases.map((text) => (
              <li key={text} className="m-l-case" data-reveal>
                <div className="m-l-case-in g-glass g-tilt">{text}</div>
              </li>
            ))}
          </ul>
          <p className="m-l-note">{STAKES.ethicsMicroline}</p>
          <p className="m-l-bridge">{STAKES.bridgeLine}</p>
        </Section>

        {/* 4.4.5 */}
        <Section anchor={FLEET.anchor}>
          <p className="m-l-kicker">{FLEET.kicker}</p>
          <h2 className="m-l-h2" id={`${FLEET.anchor}-h`}>
            {FLEET.h2}
          </h2>
          <p className="m-l-lead">{FLEET.lead}</p>
          <div className="m-l-fleet">
            <div className="m-l-console-hold">
              <ol className="m-l-console g-glass" role="list" data-testid="agent-console">
                {FLEET.consoleLines.map((text, at) => (
                  <li key={text} className="m-l-cline" data-console-line={at + 1}>
                    <svg className="m-l-tick" width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
                      <path d="M2.4 6.9 5.2 9.6 10.6 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    </svg>
                    <span className="m-l-cline-text">{text}</span>
                  </li>
                ))}
              </ol>
            </div>
            <ul className="m-l-receipts" role="list">
              {FLEET.receipts.map((text) => (
                <li key={text} className="m-l-receipt g-glass" data-testid="receipt-card" data-reveal>
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        {/* 4.4.6 */}
        <Section anchor={GRAMMAR.anchor}>
          <p className="m-l-kicker">{GRAMMAR.kicker}</p>
          <h2 className="m-l-h2" id={`${GRAMMAR.anchor}-h`}>
            {GRAMMAR.h2}
          </h2>
          <p className="m-l-lead">{GRAMMAR.lead}</p>
          <ul className="m-l-grid" role="list">
            {GRAMMAR.cards.map((text, at) => (
              <li key={text} className="m-l-gcard g-glass" data-testid="grammar-card" data-reveal>
                <div className="m-l-shot" inert>
                  {shots[at]}
                </div>
                <p className="m-l-gtext">{text}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* 4.4.7 */}
        <Section anchor={MODES.anchor}>
          <p className="m-l-kicker">{MODES.kicker}</p>
          <h2 className="m-l-h2" id={`${MODES.anchor}-h`}>
            {MODES.h2}
          </h2>
          <div className="m-l-modes">
            <FeedStack product={product} />
            <p className="m-l-block">{MODES.blocks[0]}</p>
            <ShareBoard wordmark={NAV.wordmark} />
            <p className="m-l-block">{MODES.blocks[1]}</p>
            <p className="m-l-block m-l-block-wide">{MODES.blocks[2]}</p>
          </div>
        </Section>

        {/* 4.4.8 */}
        <Section anchor={INTEGRITY.anchor}>
          <p className="m-l-kicker">{INTEGRITY.kicker}</p>
          <h2 className="m-l-h2" id={`${INTEGRITY.anchor}-h`}>
            {INTEGRITY.h2}
          </h2>
          <ul className="m-l-icards" role="list">
            {INTEGRITY.cards.map((card) => (
              <li key={say(card)} className="m-l-icard g-paper" data-reveal>
                {say(card)}
              </li>
            ))}
          </ul>
          <ul className="m-l-strips" role="list">
            {INTEGRITY.strips.map((text) => (
              <li key={text} className="m-l-strip">
                {text}
              </li>
            ))}
          </ul>
        </Section>

        {/* 4.4.9. The one section 4.4 heads with an h3, which is legal directly under the h2 above. */}
        <Section anchor={PACKS.anchor}>
          <h3 className="m-l-h2" id={`${PACKS.anchor}-h`}>
            {PACKS.h3}
          </h3>
          <p className="m-l-lead">{PACKS.body}</p>
          <ul className="m-l-stats" role="list">
            {say(PACKS.statsBand)
              .split(' · ')
              .map((stat) => (
                <li key={stat} className="m-l-stat">
                  {stat}
                </li>
              ))}
          </ul>
          <p className="m-l-micro">{say(PACKS.caption)}</p>
        </Section>

        {/* 4.4.10 */}
        <Section anchor={TRY.anchor}>
          <p className="m-l-kicker">{TRY.kicker}</p>
          <h2 className="m-l-h2" id={`${TRY.anchor}-h`}>
            {TRY.h2}
          </h2>
          <p className="m-l-lead">{TRY.body}</p>
          <div className="m-l-try">
            <PhoneFeed product={product} />
            <DeskWindow product={product} />
          </div>
          <div className="m-l-ctas">
            {/* The second magnet. Two per page, which is the direction's cap per viewport. */}
            <Link className="m-l-cta g-magnet" to="/app">
              <span className="g-magnet-inner">{TRY.ctaPrimary}</span>
            </Link>
            <Link className="m-l-cta m-l-cta-soft" to="/research">
              {TRY.ctaSecondary}
            </Link>
          </div>
          <ul className="m-l-micros" role="list">
            {TRY.microlines.map((text) => (
              <li key={text} className="m-l-micro">
                {text}
              </li>
            ))}
          </ul>
        </Section>
      </main>

      {/* 4.4.11 */}
      <footer className="m-l-foot">
        <div className="m-l-in">
          <p className="m-l-foot-1">{FOOTER.line1}</p>
          <p className="m-l-foot-2">{FOOTER.line2}</p>
          {/* Groups rather than landmarks: the page has one `nav` and it is the bar at the top.
              A second and a third landmark named Product and Principles buys a screen reader
              nothing here and costs it two more stops in the landmark list. */}
          <div className="m-l-cols">
            {FOOTER.columns.map((column) => (
              <div key={column.heading} className="m-l-col" role="group" aria-labelledby={`foot-${column.heading}`}>
                <p className="m-l-col-head" id={`foot-${column.heading}`}>
                  {column.heading}
                </p>
                <ul className="m-l-col-list" role="list">
                  {column.items.map((item) => (
                    <li key={item}>
                      <Link className="m-l-col-link" to={FOOT_ROUTE[item] ?? '/methodology'}>
                        {item}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="m-l-foot-credit">{FOOTER.credit}</p>
          <p className="m-l-foot-credit">{FOOTER.team}</p>
          <p className="m-l-foot-fine">{FOOTER.disclosure}</p>
          <p className="m-l-foot-fine">{FOOTER.legal}</p>
          <p className="m-l-foot-fine">{FOOTER.copyright}</p>
        </div>
      </footer>
    </div>
  );
}
