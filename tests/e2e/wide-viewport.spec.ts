/**
 * PROVES: blueprint 3.2 item 20 and 4.3 (`/app` renders inside the ported iPhone frame at 768
 *         and above, centered on the paper background, with a caption row beneath it linking to
 *         `/research`; below 768 it is the full-bleed installable PWA), blueprint 3.2 item 19
 *         (the wide-viewport autopsy puts the narration rail beside the panels, reachable from a
 *         research row and from `/n/{id}`), and the Appendix A rows `desktop.app-framed` and
 *         `desktop.autopsy-wide` behaviourally.
 *         AC-APP-22 rides along through guardConsole().
 *
 * Post-install home: tests/e2e/wide-viewport.spec.ts. Config: tests/e2e/research.config.ts.
 *
 * Two things about this config change how a test here is written, and both are honest
 * consequences of testing a built bundle rather than a dev server:
 *
 *   no __mthGoto   `__MTH_DEV__` is false in a build, so the dev-only state jump does not
 *                  exist. Onboarding is passed the way a returning reader passes it, by the
 *                  `mth:onboarded` key already in their storage. That is a truer path anyway:
 *                  it proves the frame wraps the shell a real second visit lands on.
 *   real content   the narration and panel ids below come from content/, not from fixtures.
 *
 * Hooks this spec pins, beyond what Gate 3 already ships ([data-screen], [data-el], [data-sent],
 * [data-hl], [data-testid=permalink-card], [data-testid=spar-skip]):
 *
 *   [data-testid=app-frame]      the ported phone shell, present only at 768 and above
 *   [data-testid=frame-caption]  the caption row beneath it, carrying a link to /research
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { guardConsole } from './console-collector';

guardConsole();

/** Blueprint 4.3: the frame is the zip's iPhone, 402 x 874 logical. */
const FRAME_WIDTH = 402;

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function boxOf(locator: Locator, what: string): Promise<Box> {
  const at = await locator.boundingBox();
  if (at === null) throw new Error(`${what} has no box: it is not rendered`);
  return at;
}

/**
 * A returning reader: onboarded, so `/app` opens on the Radar the desktop rows name. Set before
 * the first script runs, because `initialState()` reads storage during the first render.
 */
async function asReturningReader(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('mth:onboarded', '1');
  });
}

async function openApp(page: Page): Promise<void> {
  await asReturningReader(page);
  await page.goto('/app');
  await expect(page.locator('[data-screen="main-radar"]')).toBeVisible();
}

/** The app's own surface, whatever is wrapped around it. */
const screen = (page: Page): Locator => page.locator('[data-screen]').first();

// --- /app on wide viewports ------------------------------------------------------------------

test.describe('blueprint 4.3, /app at 768 and above renders inside the phone frame', () => {
  test('desktop.app-framed: the frame is 402 wide, centered, with a caption row to /research', async ({
    page,
  }) => {
    await openApp(page);

    const frame = page.getByTestId('app-frame');
    await expect(frame, 'a 1280 viewport renders the ported frame').toBeVisible();

    // The app inside it is still the phone: the frame constrains the shell rather than the shell
    // stretching to the desktop.
    const inner = await boxOf(screen(page), 'the app screen');
    expect(Math.abs(inner.width - FRAME_WIDTH), `the framed app is ${String(FRAME_WIDTH)} logical px wide`).toBeLessThanOrEqual(2);

    const box = await boxOf(frame, 'the frame');
    const viewport = page.viewportSize();
    if (viewport === null) throw new Error('this test needs a fixed viewport');
    const drift = Math.abs(box.x + box.width / 2 - viewport.width / 2);
    expect(drift, 'the frame is centered on the paper background').toBeLessThanOrEqual(viewport.width * 0.02);

    const caption = page.getByTestId('frame-caption');
    await expect(caption).toBeVisible();
    const captionBox = await boxOf(caption, 'the caption row');
    expect(captionBox.y, 'the caption row sits beneath the frame').toBeGreaterThanOrEqual(box.y + box.height - 1);
    await expect(caption.locator('a[href="/research"]'), 'the caption links to /research').toBeVisible();
    // Blueprint 4.3 asks the caption for two things: the research link and install instructions.
    await expect(caption).toContainText(/install/i);
  });

  test.describe('at exactly 768', () => {
    test.use({ viewport: { width: 768, height: 900 } });

    test('the frame is already on, because the rule is 768 and above', async ({ page }) => {
      await openApp(page);
      await expect(page.getByTestId('app-frame')).toBeVisible();
      const inner = await boxOf(screen(page), 'the app screen');
      expect(Math.abs(inner.width - FRAME_WIDTH)).toBeLessThanOrEqual(2);
    });
  });

  test.describe('at 767', () => {
    test.use({ viewport: { width: 767, height: 900 } });

    test('one pixel below the rule there is no frame, and the app is full-bleed', async ({ page }) => {
      await openApp(page);
      await expect(page.getByTestId('app-frame')).toHaveCount(0);
      const inner = await boxOf(screen(page), 'the app screen');
      // Minus whatever the scrollbar takes: full-bleed means the viewport, not a column in it.
      expect(inner.width, 'the installable PWA fills the viewport').toBeGreaterThanOrEqual(767 - 20);
    });
  });

  test.describe('at 390', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('a phone gets the phone, with no frame drawn around it', async ({ page }) => {
      await openApp(page);
      await expect(page.getByTestId('app-frame')).toHaveCount(0);
      const inner = await boxOf(screen(page), 'the app screen');
      expect(inner.width).toBeGreaterThanOrEqual(390 - 20);
    });
  });
});

// --- the wide autopsy --------------------------------------------------------------------------

/**
 * Past the sparring gate to the panel stack, whatever gate this narrative carries.
 *
 * `data-panel` rather than `[data-el]`: element ids belong to the artifact and change on every
 * publish, while `data-panel` is the renderer's own name for which grammar component it is.
 */
async function skipSparring(page: Page): Promise<void> {
  // Wait for the autopsy to have decided what it is showing before asking whether Skip is up.
  // A bare `isVisible()` on a page still fetching its artifact answers false, and the walk then
  // waits for panels the gate is still covering.
  await expect(page.locator('[data-testid="spar-skip"], [data-panel="claim_map"]').first()).toBeVisible();
  const skip = page.getByTestId('spar-skip');
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator('[data-panel="claim_map"]')).toBeVisible();
}

/** The narration and the first panel, measured. `.m-voice` is the narration renderer's root. */
async function narrationAndPanels(page: Page): Promise<{ narration: Box; panels: Box }> {
  const narration = await boxOf(page.locator('.m-voice'), 'the narration');
  const panels = await boxOf(page.locator('[data-panel="claim_map"]'), 'the claim map panel');
  return { narration, panels };
}

const beside = (a: Box, b: Box): boolean =>
  (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1) && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('blueprint 3.2 item 19, the wide-viewport autopsy', () => {
  test('desktop.autopsy-wide: /n/{id} puts the narration rail beside the panels', async ({ page }) => {
    await page.goto('/n/mbg-stop');
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await expect(page.getByTestId('permalink-card')).toBeVisible();
    // A permalink is not the app in its frame: item 19 and item 20 are two different layouts.
    await expect(page.getByTestId('app-frame'), 'the wide autopsy is not the framed app').toHaveCount(0);

    await skipSparring(page);
    const { narration, panels } = await narrationAndPanels(page);
    expect(
      beside(narration, panels),
      `the narration rail sits beside the panels: narration ${JSON.stringify(narration)} panels ${JSON.stringify(panels)}`,
    ).toBe(true);
  });

  test('the binding still works in the wide layout, so the rail is the real narration', async ({ page }) => {
    await page.goto('/n/mbg-stop');
    await skipSparring(page);

    const sentence = page.locator('[data-sent]').first();
    const els = ((await sentence.getAttribute('data-els')) ?? '').split(' ').filter((el) => el !== '');
    expect(els.length, 'every narration sentence carries at least one binding (AC-INV-6)').toBeGreaterThan(0);

    await sentence.click();
    await expect(sentence).toHaveAttribute('data-sent', 'on');
    for (const el of els) {
      await expect(page.locator(`[data-el="${el}"]`), `the rail highlights ${el}`).toHaveAttribute('data-hl', '1');
    }
  });

  test.describe('at 390', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('a phone stacks the same autopsy, so beside is a breakpoint and not the only layout', async ({
      page,
    }) => {
      await page.goto('/n/mbg-stop');
      await skipSparring(page);
      const { narration, panels } = await narrationAndPanels(page);
      expect(beside(narration, panels), 'one column on a phone').toBe(false);
    });
  });

  test('it is reachable from a research row', async ({ page }) => {
    await page.goto('/research');
    await expect(page.getByTestId('research-table')).toBeVisible();

    await page.locator('[data-testid="research-row"][data-narrative="mbg-stop"]').click();
    const rail = page.getByTestId('research-rail');
    await expect(rail).toBeVisible();
    await rail.locator('a[href="/n/mbg-stop"]').click();

    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await skipSparring(page);
    const { narration, panels } = await narrationAndPanels(page);
    expect(beside(narration, panels), 'the row lands on the wide layout, not the phone one').toBe(true);
  });
});
