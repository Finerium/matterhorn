/**
 * The sheet focus trap, and with it the `aria-modal="true"` the Gate 2 ruling held back.
 *
 * The ruling, restated so it is not lost: `aria-modal="true"` tells assistive technology that
 * everything outside the element is inert. Only a trap keeps that promise, so the attribute and
 * the trap land together or neither lands. This module is the trap; every `role="dialog"` in the
 * app now carries `ref={trapRef}` and `aria-modal="true"` on the same element.
 *
 * It is a plain callback ref rather than a hook, for one reason that matters: every sheet in
 * this app is mounted inside a conditional expression (`state.sheet === 'x' ? <Sheet/> : null`).
 * A hook cannot be called there without hoisting each sheet into a component of its own, which
 * would be six new components to hold one effect. A ref prop composes with the markup that
 * already exists. React 19 calls it with the node on mount and calls the returned cleanup on
 * unmount, which is exactly the trap's lifetime.
 *
 * What it does, in order:
 *   mount     remember what had focus, move focus to the sheet, take Tab over
 *   Tab       cycle inside the sheet, in both directions, wrapping at each end
 *   unmount   restore focus to the opener
 *
 * ponytail: a stack rather than a single slot, because the autopsy can open an evidence sheet
 * over a sheet, and the inner one must not restore focus past the outer one on the way out.
 * Known ceiling: the trap is Tab only. Pointer and screen-reader virtual cursors are held out
 * by `aria-modal` and the scrim, which is the same floor a `<dialog>` element would give.
 */

/** Tab stops, in DOM order. `:not([tabindex="-1"])` keeps the sheet container itself out. */
const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Openers, innermost last. A sheet restores to the element that had focus when it opened. */
const openers: Array<HTMLElement | null> = [];

const stops = (root: HTMLElement): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => node.offsetParent !== null || node === document.activeElement,
  );

/**
 * Attach to the element that carries `role="dialog"`: `<div role="dialog" aria-modal="true"
 * ref={trapRef}>`. Module-level identity, so React never re-runs it on a re-render.
 */
export function trapRef(node: HTMLElement | null): (() => void) | undefined {
  if (node === null) return undefined;
  const opener = document.activeElement as HTMLElement | null;
  openers.push(opener);

  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Tab' || openers.at(-1) !== opener) return;
    const items = stops(node);
    const first = items[0];
    const last = items.at(-1);
    // An empty sheet still traps: focus stays on the container rather than walking out.
    if (first === undefined || last === undefined) {
      event.preventDefault();
      node.focus();
      return;
    }
    const active = document.activeElement;
    const leaving = event.shiftKey ? active === first : active === last;
    if (leaving || !node.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  // The container takes focus itself rather than the first control: a sheet that stole focus
  // onto its own primary button would read as if that button had been chosen.
  node.tabIndex = -1;
  node.focus();
  document.addEventListener('keydown', onKey, true);

  return () => {
    document.removeEventListener('keydown', onKey, true);
    openers.pop();
    // Only if it is still on screen. A sheet whose opener was itself unmounted (the tab
    // changed underneath it) restores nothing rather than throwing.
    if (opener !== null && opener.isConnected) opener.focus();
  };
}
