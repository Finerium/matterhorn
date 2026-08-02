/**
 * The landing's copy of the direction's cursor listener (docs/design-direction.md, "Cursor
 * interaction rules"): one pointermove handler, rAF-throttled, writing viewport `--mx`/`--my` on
 * the page root, panel-relative `--px`/`--py` on each glass or tilt panel the cursor is inside,
 * and the capped magnetic pull on the two primary CTAs. CSS consumes the variables; JS never
 * styles. Each route carries its own copy of these 20 lines rather than importing a shared
 * runtime module across lazy chunks, which is the direction's own trade.
 *
 * Gated exactly as the direction gates the CSS that consumes it: reduced motion, no-hover and
 * coarse-pointer readers never attach the listener, and the variables' defaults (0.5 / 0px in
 * surface.css) are the rest state, which is the finished page. The gate re-arms on change the way
 * motion.ts does, so a reader who toggles reduced motion mid-visit is on the right side of it.
 */
import { useEffect, useReducer } from 'react';

const GATE = '(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)';
/** Magnets: the direction's 120px activation radius and 10px displacement cap. */
const REACH = 120;
const PULL = 10;

export function useCursor(): void {
  const [pass, again] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const gate = window.matchMedia(GATE);
    const bump = (): void => {
      again();
    };
    gate.addEventListener('change', bump);
    const page = document.querySelector<HTMLElement>('.m-l');
    if (!gate.matches || page === null) {
      return () => {
        gate.removeEventListener('change', bump);
      };
    }

    // Queried once: every panel and both magnets are in the first render (the fetched artifacts
    // land INSIDE mounts, they never add a panel). Rects are re-read per frame, reads before
    // writes, so a tilt written to one card never forces layout for the next card's read.
    const panels = [...page.querySelectorAll<HTMLElement>('.g-glass, .g-tilt')];
    const magnets = [...page.querySelectorAll<HTMLElement>('.g-magnet')];
    let x = 0;
    let y = 0;
    let queued = false;

    const paint = (): void => {
      queued = false;
      page.style.setProperty('--mx', `${String(x)}px`);
      page.style.setProperty('--my', `${String(y)}px`);
      const boxes = [...panels, ...magnets].map((el) => el.getBoundingClientRect());
      panels.forEach((el, at) => {
        const box = boxes[at];
        if (box === undefined || box.width === 0) return;
        const px = (x - box.left) / box.width;
        const py = (y - box.top) / box.height;
        if (px >= 0 && px <= 1 && py >= 0 && py <= 1) {
          el.style.setProperty('--px', String(px));
          el.style.setProperty('--py', String(py));
        } else {
          // Outside the panel the variables come off, so the sheen recentres and the tilt springs
          // flat through the rest-state defaults rather than freezing at the exit angle.
          el.style.removeProperty('--px');
          el.style.removeProperty('--py');
        }
      });
      magnets.forEach((el, at) => {
        const box = boxes[panels.length + at];
        if (box === undefined) return;
        const dx = x - box.left - box.width / 2;
        const dy = y - box.top - box.height / 2;
        if (Math.hypot(dx, dy) < REACH) {
          el.style.setProperty('--pull-x', `${String((dx * PULL) / REACH)}px`);
          el.style.setProperty('--pull-y', `${String((dy * PULL) / REACH)}px`);
        } else {
          el.style.removeProperty('--pull-x');
          el.style.removeProperty('--pull-y');
        }
      });
    };

    const move = (event: PointerEvent): void => {
      x = event.clientX;
      y = event.clientY;
      if (!queued) {
        queued = true;
        requestAnimationFrame(paint);
      }
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      gate.removeEventListener('change', bump);
      window.removeEventListener('pointermove', move);
    };
  }, [pass]);
}
