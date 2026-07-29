/**
 * PROVES: the half of blueprint 3.2 item 20 that is not about geometry: the ported iPhone frame
 *         around `/app` is chrome, and chrome that steals focus, eats a scroll or swallows a tap
 *         is a broken app wearing a phone. AC-APP-22 rides along through guardConsole().
 *
 * Post-install home: tests/e2e/wide.spec.ts. Config: tests/e2e/app.config.ts, whose viewport is
 * the phone; every block here sets the desktop width it is about.
 *
 * Split with tests/e2e/wide-viewport.spec.ts, deliberately, because they are two different
 * questions about one surface. That spec owns the geometry and the breakpoints (402 x 874,
 * centred, the caption row, 768 on and 767 off, and the item 19 rail beside the panels, against a
 * built preview). This one owns what the frame must never do to the app inside it, and it drives
 * the dev server so it can reach an autopsy sheet through `__mthGoto`.
 */
import { expect, test } from '@playwright/test';

import { guardConsole } from './console-collector';

guardConsole();

declare global {
  interface Window {
    __mthGoto?: (name: string) => boolean;
  }
}

const APP = '/app';
const DESKTOP = { width: 1280, height: 800 };
/** The ported logical width, blueprint 4.3 and the zip's ios-frame.jsx default. */
const FRAME_WIDTH = 402;

test.describe('the frame is chrome and nothing else', () => {
  test.use({ viewport: DESKTOP });

  test('holds no focus: the caption is reachable, and tabbing past it returns to the app', async ({ page }) => {
    await page.goto(APP);

    // The app fills the frame and nothing else is inside it. The island and the home indicator
    // are pseudo-elements: no element, so no tab stop and no accessibility node, by construction.
    const frame = page.getByTestId('app-frame');
    expect(await frame.evaluate((el) => el.children.length)).toBe(1);
    expect(await frame.evaluate((el) => el.firstElementChild?.className)).toBe('m-app');

    const where: string[] = [];
    for (let i = 0; i < 24; i += 1) {
      await page.keyboard.press('Tab');
      where.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          if (el === null || el === document.body) return 'body';
          if (el.closest('.m-app') !== null) return 'app';
          if (el.closest('.m-caption') !== null) return 'caption';
          return 'other';
        }),
      );
    }

    // Everything the frame adds is in the caption, and the caption comes after the app.
    expect(where).not.toContain('other');
    expect(where).toContain('app');
    expect(where).toContain('caption');
    expect(where.indexOf('caption')).toBeGreaterThan(where.indexOf('app'));
    // The cycle comes back round: nothing holds focus at either end.
    expect(where.lastIndexOf('app')).toBeGreaterThan(where.indexOf('caption'));
  });

  test('intercepts no tap: the island and the home indicator hit-test through to the app', async ({ page }) => {
    await page.goto(APP);

    const hits = await page.evaluate(() => {
      const frame = document.querySelector('.m-frame');
      const stage = document.querySelector('.m-stage');
      if (frame === null || stage === null) return null;
      // Each end is hit-tested with that end on screen: at 800px of viewport the frame is taller
      // than the window, and elementFromPoint answers null outside it.
      const at = (dy: number): string => {
        const box = frame.getBoundingClientRect();
        const el = document.elementFromPoint(box.left + box.width / 2, dy < 0 ? box.bottom + dy : box.top + dy);
        if (el === null) return 'none';
        return el.closest('.m-app') !== null ? 'app' : 'chrome';
      };
      stage.scrollTop = 0;
      const island = at(29); // the middle of the dynamic island
      stage.scrollTop = stage.scrollHeight;
      const home = at(-10); // the middle of the home indicator
      return { island, home };
    });
    expect(hits).toEqual({ island: 'app', home: 'app' });

    // And the tap the indicator lies over still arrives: the tab bar switches tabs.
    await page.evaluate(() => window.__mthGoto?.('radar.default'));
    await page.locator('[data-tab="archive"]').click();
    await expect(page.locator('[data-screen="main-archive"]')).toBeVisible();
  });

  test('keeps the app overlays inside it: the sheet is 402 wide, not 1280', async ({ page }) => {
    await page.goto(APP);
    await page.evaluate(() => window.__mthGoto?.('autopsy.evidence-sheet'));

    // `position: fixed` inside the frame means fixed to the frame. Without the containment in
    // wide.css these two cover the whole desktop, which is a phone sheet over a browser window.
    const widths = await page.locator('.m-sheet, .m-scrim').evaluateAll((nodes) =>
      nodes.map((node) => Math.round(node.getBoundingClientRect().width)),
    );
    expect(widths).toEqual([FRAME_WIDTH, FRAME_WIDTH]);
  });

  test('breaks no scrolling: the stage scrolls when the frame is taller than the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto(APP);

    const scrolled = await page.evaluate(() => {
      const stage = document.querySelector('.m-stage');
      if (stage === null) return null;
      const room = stage.scrollHeight - stage.clientHeight;
      stage.scrollTop = room;
      return { room, at: stage.scrollTop, overflowX: stage.scrollWidth - stage.clientWidth };
    });
    expect(scrolled?.room ?? 0).toBeGreaterThan(0);
    expect(scrolled?.at).toBe(scrolled?.room);
    expect(scrolled?.overflowX).toBe(0);
    // Scrolled to the end the caption is on screen: the frame strands nothing below it.
    await expect(page.locator('.m-caption a[href="/research"]')).toBeInViewport();
  });
});
