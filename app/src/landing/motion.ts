/**
 * The landing's scroll choreography: which of the four paths runs, and the only one that is JS.
 *
 * There are four, and a reader is on exactly one of them (`soft`, the GPU-less adaptive path, is
 * documented at `softwareRendered` below):
 *
 *   none   prefers-reduced-motion: reduce. Nothing animates, because nothing is DECLARED. The
 *          choreography in landing.css lives inside `@media (prefers-reduced-motion: no-preference)`
 *          and this module returns before it imports anything, so a reduced-motion reader has no
 *          animation to switch off. That is what AC-LAND-7 is bought with: `document.getAnimations()`
 *          is empty because there is nothing in it, not because something was overridden into
 *          stillness. The set pieces were built as their finished frames (setpieces.tsx), so this
 *          path is the design rather than a degradation of it.
 *   css    native scroll-driven animations. Reveals run on `view()`, the four beats run on the
 *          `--beats` view timeline, and the pin is `position: sticky`, which every browser has.
 *          No JS touches the page: this module only records which path won.
 *   gsap   everything else, which today is Firefox. Same pin (still sticky), same final frames;
 *          ScrollTrigger scrubs what the view timelines would have scrubbed.
 *
 * The loops (the hero's 14 s assembly, the fleet console) are in NEITHER capability branch: they
 * are ordinary keyframes with no timeline, so they run on all three engines and GSAP is never
 * asked to do work CSS already does everywhere.
 *
 * GSAP is imported dynamically and only on its own path, so a CSS-capable browser never fetches
 * the chunk and the landing's initial JS is unchanged for it (AC-PERF-1). `data-mth-motion` on
 * the root element is the observable half: a test can read which path a browser took, which is
 * what keeps AC-LAND-7 honest on the GSAP path, where GSAP mutates inline styles off its own
 * ticker and would therefore never show up in `document.getAnimations()` at all.
 */
import { useEffect, useReducer } from 'react';

/** 900px is the width landing.css gives the sticky figure at; below it the beats are a list. */
const PINNED = '(min-width: 900px)';
const REDUCE = '(prefers-reduced-motion: reduce)';
const MOVES = '(prefers-reduced-motion: no-preference)';

/**
 * The exact predicate landing.css gates its scroll-linked block on, restated for the branch that
 * decides whether to download GSAP. Both halves matter: `view()` covers the per-element reveals
 * and a named `view-timeline-name` covers the four beats, which are driven from an ancestor.
 * A browser with one and not the other would run half the CSS and none of the fallback.
 */
const cssTimelines = (): boolean =>
  CSS.supports('animation-timeline', 'view()') && CSS.supports('view-timeline-name', '--v');

/**
 * The fourth path, `soft`: a browser that renders WITHOUT A GPU (SwiftShader in a headless or
 * blocklisted Chromium, llvmpipe in a VM) rasterizes every composited frame on the CPU, and the
 * full choreography over the glass surfaces drops frames in the double digits there, measured
 * on the CI runner (AC-PERF-5's machine: 26 percent dropped). Those readers get the reduced
 * choreography: landing.css lands every animated element on its finished base frame, which the
 * set pieces were built as. This is the page adapting to the machine, and the smoothness trace
 * measures whichever page the machine actually gets.
 *
 * `__mthForceMotion = 'full'` is the test override: the structure suites assert the full
 * choreography's order and reveals, which are design facts a software renderer can still
 * execute, just not smoothly. Only the performance trace runs without the override.
 */
const softwareRendered = (): boolean => {
  if ((window as { __mthForceMotion?: string }).__mthForceMotion === 'full') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (gl === null) return true;
    const info = gl.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
    const renderer = String(gl.getParameter(info === null ? gl.RENDERER : info.UNMASKED_RENDERER_WEBGL));
    return /swiftshader|llvmpipe|software|basic render/i.test(renderer);
  } catch {
    return true;
  }
};

/**
 * The GSAP path, loaded only by the browsers that are on it.
 *
 * It drives the same two things the CSS block drives and nothing else. It does NOT pin: the pin
 * is `.m-l-beats-fig { position: sticky }`, which Firefox has had for years, and asking
 * ScrollTrigger for `pin: true` would rebuild that layout with a pin-spacer to reach a frame the
 * stylesheet already holds.
 *
 * `gsap.matchMedia` rather than a bare check, for the case this module cannot re-enter: a reader
 * who turns reduced motion ON after the page has loaded. matchMedia reverts every tween it set up
 * and puts the final frames back, which is the same picture the `none` path shows.
 */
async function gsapPath(): Promise<() => void> {
  const [{ gsap }, { ScrollTrigger }] = await Promise.all([import('gsap'), import('gsap/ScrollTrigger')]);
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();

  // Reveal on enter, every width. Matches the `[data-reveal]` rule in landing.css.
  //
  // `set` then `to` with `once`, rather than the shorter `gsap.from`: a `from` tween re-applies its
  // start values on every ScrollTrigger refresh, and a refresh after the trigger has already fired
  // leaves the element hidden with nothing left to play it back. Measured on Firefox, where the
  // grammar cards went to zero the second time they were scrolled to. `once` retires each trigger
  // as it fires, so there is nothing left for a later refresh to reset.
  mm.add(MOVES, () => {
    for (const el of gsap.utils.toArray<HTMLElement>('.m-l [data-reveal]')) {
      gsap.set(el, { opacity: 0, y: 14 });
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    }
  });

  // The four beats, desktop only, scrubbed across the block the figure is pinned inside. `top top`
  // to `bottom bottom` is the same window the CSS block drives with `contain 0%` to `contain 100%`,
  // said in ScrollTrigger's vocabulary, so the two paths advance the beats at the same scroll
  // positions rather than merely both advancing them. The spacing (1.6 of a 1.0 tween) leaves each
  // beat a moment at full before the next starts, which is what reads as four beats rather than
  // one long fade.
  mm.add(`${MOVES} and ${PINNED}`, () => {
    // `scrub: true`, not a smoothed number. A smoothing value eases the playhead toward the scroll
    // position over a fraction of a second, which looks marginally nicer on a wheel and makes this
    // path lag the CSS one: measured, beat 4 was still catching up after the pin had released. A
    // view timeline has no such lag, and two paths that reach the same frames at different scroll
    // positions are two designs.
    const timeline = gsap.timeline({
      scrollTrigger: { trigger: '.m-l-beats', start: 'top top', end: 'bottom bottom', scrub: true },
    });
    const groups = gsap.utils.toArray<SVGGElement>('.m-l-spine [data-beat]');
    // `set` then `to`, rather than four `fromTo`s: a `fromTo` inside a scrubbed timeline renders
    // its from-state at CREATION rather than at playhead zero, so the four of them fight over the
    // pre-roll frame and the beats arrive out of order. Measured on Firefox, where beat 4 sat at
    // full while beat 3 was mid-scrub. One `set` for the whole pre-roll and plain `to` tweens after
    // it leaves the playhead as the only thing deciding what is drawn.
    gsap.set(groups, { opacity: 0, y: 8 });
    groups.forEach((group, at) => {
      timeline.to(group, { opacity: 1, y: 0, duration: 1 }, at * 1.6);
    });
  });

  return () => {
    mm.revert();
  };
}

/**
 * Picks the path and records it.
 *
 * `ready` is whether the set pieces have their content, and it gates the GSAP branch alone. The
 * landing's figures are real renderers fed by fetched JSON, so the document grows once after first
 * paint; ScrollTriggers measured before that measure the short page. Gating rather than rebuilding
 * on the change is also what keeps there being ONE setup: an effect that tore down and re-ran would
 * have a second import in flight while the first was still resolving, and the loser's `revert`
 * would clear the winner's `set` and leave every reveal stuck. Measured, on Firefox.
 *
 * The CSS path needs none of this, which is one more reason it is the default: view timelines are
 * live against layout and a document that grew simply re-resolves.
 */
export function useChoreography(ready: boolean): void {
  const [pass, again] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const reduce = window.matchMedia(REDUCE);
    const bump = (): void => {
      again();
    };
    reduce.addEventListener('change', bump);

    const root = document.documentElement;
    let live = true;
    let stop: (() => void) | undefined;

    if (reduce.matches) {
      root.dataset.mthMotion = 'none';
    } else if (softwareRendered()) {
      root.dataset.mthMotion = 'soft';
    } else if (cssTimelines()) {
      root.dataset.mthMotion = 'css';
    } else if (ready) {
      // Recorded after the import lands, not before: the attribute says what is RUNNING, and a
      // chunk that failed to arrive would otherwise be reported as a working fallback.
      //
      // The chunk is deliberately not precached (app/vite.config.ts), so an offline Firefox is a
      // real case rather than a theoretical one. It is also a harmless one: no path runs, no
      // attribute is set, and every set piece stays on the final frame it was built as. Swallowed
      // rather than logged, because an uncaught rejection and a console error are both things this
      // project asserts the absence of (AC-APP-22) and neither would tell a reader anything.
      void gsapPath()
        .then((off) => {
          if (!live) {
            off();
            return;
          }
          stop = off;
          root.dataset.mthMotion = 'gsap';
        })
        .catch(() => {
          /* no fallback path; the static frames are the page */
        });
    }

    return () => {
      live = false;
      reduce.removeEventListener('change', bump);
      stop?.();
      delete root.dataset.mthMotion;
    };
  }, [pass, ready]);
}
