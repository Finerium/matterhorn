/**
 * PROVES: AC-APP-21. Onboarding, the autopsy, the share GET and the landing render correctly on
 *         Playwright chromium, webkit AND firefox. AC-APP-22 rides along through guardConsole(),
 *         which means the console assertion is made on all three engines rather than on one.
 *
 * Post-install home: tests/e2e/cross-browser.spec.ts. Config: tests/e2e/cross-browser.config.ts,
 * which builds the app, previews the dist over the published `content/` root, and declares the
 * three projects. Every string below is a `content/` value or an app/src constant, quoted.
 *
 * WHAT "RENDERS CORRECTLY" IS TAKEN TO MEAN, since the criterion does not spell it out and a
 * vague bar is a bar nobody can fail. Four things, per surface:
 *   reached      the screen the flow should be on is the screen that is up, by [data-screen]
 *   populated    the text and the elements that carry the surface's meaning are visible, by
 *                their published values rather than by "something is there"
 *   laid out     `document.scrollWidth <= clientWidth`, which is the one layout property an
 *                engine difference reliably breaks and the reader immediately feels
 *   quiet        zero console errors and zero uncaught rejections, on every engine
 * What it deliberately does NOT mean is pixel parity. A committed baseline is per engine and per
 * platform; three engines is three sets of baselines and three sets of antialiasing differences
 * that are not regressions. AC-GRAM-1..9 owns the pictures, on chromium, on darwin.
 *
 * No `test.skip(browserName === ...)` anywhere in this file, and that is the point. A matrix with
 * an engine excused from an assertion is a matrix that reports green about a surface it never
 * checked. If an engine cannot do something the product needs, this file is where it should go
 * red and the gate report is where the reason belongs.
 */
import { expect, test, type Page } from '@playwright/test';

import { guardConsole } from './console-collector';

guardConsole();

/** app/src/i18n/en.json, verbatim. */
const EN = {
  continue: 'Continue',
  tagline: 'A causal literacy engine',
  langTitle: 'Choose your app language',
  regionsTitle: 'Which news do you care about?',
  notifTitle: 'One alert a day, at most.',
  notifEnable: 'Enable notifications',
  iosAllow: 'Allow',
  authTitle: 'Keep your progress.',
  authSkip: 'Continue without an account',
} as const;

/** app/src/landing/copy.ts, verbatim. */
const LANDING = {
  wordmark: 'MATTERHORN',
  eyebrow: 'A VERDICT-FREE CAUSAL LITERACY ENGINE',
  h1: 'Most people see the peak. The Matterhorn shows the journey and its impact.',
  ctaPrimary: 'Open Matterhorn',
  credit: 'Built for the UNESCO Youth Hackathon 2026 · AI and MIL track',
  team: 'Ghaisan Khoirul Badruzaman & Kesya Austin',
  anchors: ['the-problem', 'the-stakes', 'the-fleet', 'the-grammar', 'two-modes', 'integrity', 'packs', 'try-it'],
} as const;

/** content/url_index.json: the canonical that resolves to the flagship autopsy. */
const CANONICAL = 'https://www.tribunnews.com/nasional/7844542';

/** No horizontal scrollbar. The one layout property an engine difference reliably breaks. */
async function fits(page: Page, where: string): Promise<void> {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `${where} must not scroll horizontally`).toBeLessThanOrEqual(overflow.clientWidth);
}

/** A fresh device: onboarding runs from the first screen. */
async function freshDevice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
}

/** A device that has been through onboarding, so a surface can be opened directly. */
async function settledDevice(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('mth:onboarded', '1');
  });
}

test.describe('AC-APP-21 cross-browser core', () => {
  test('onboarding runs end to end', async ({ page }) => {
    await freshDevice(page);
    await page.goto('/app');

    await expect(page.locator('[data-screen="onb-hello"]')).toBeVisible();
    await expect(page.locator('[data-screen="onb-hello"]')).toContainText(EN.tagline);
    await fits(page, 'onb-hello');
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.locator('[data-screen="onb-lang"]')).toContainText(EN.langTitle);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.locator('[data-screen="onb-regions"]')).toContainText(EN.regionsTitle);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.locator('[data-screen="onb-notif"]')).toContainText(EN.notifTitle);
    await page.getByRole('button', { name: EN.notifEnable }).click();

    // The simulated iOS dialog is the one piece of chrome this product draws itself, so it is the
    // one most likely to differ between engines. Asserting it is reachable and dismissable is
    // asserting the backdrop, the stacking and the focus trap all survived the trip.
    await expect(page.locator('[data-sheet="ios-notif"]')).toBeVisible();
    await page.getByRole('button', { name: EN.iosAllow, exact: true }).click();

    await expect(page.locator('[data-screen="onb-auth"]')).toContainText(EN.authTitle);
    await page.getByRole('button', { name: EN.authSkip }).click();

    await expect(page.locator('[data-screen="main-radar"]')).toBeVisible();
    await expect(page.locator('[data-feed-item]').first()).toBeVisible();
    await fits(page, 'radar');
    expect(await page.evaluate(() => window.localStorage.getItem('mth:onboarded'))).toBe('1');
  });

  test('the autopsy hydrates from its permalink and opens an evidence sheet', async ({ page }) => {
    await settledDevice(page);
    await page.goto('/n/mbg-stop');

    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await expect(page.getByTestId('permalink-card')).toBeVisible();
    await fits(page, 'autopsy');

    const skip = page.getByTestId('spar-skip');
    if (await skip.isVisible()) await skip.click();

    // The panel stack is the surface. An engine that failed to lay out the claim map renders a
    // header and nothing under it, which is exactly what this count catches.
    const elements = page.locator('[data-el]');
    await expect(elements.first()).toBeVisible();
    expect(await elements.count(), 'the autopsy must render its panel elements').toBeGreaterThan(5);

    await elements.first().click();
    await expect(page.getByTestId('evidence-sheet')).toBeVisible();
    await fits(page, 'autopsy with evidence sheet');
  });

  test('the share GET resolves the canonical to its cached autopsy', async ({ page }) => {
    await settledDevice(page);
    await page.goto(`/share?url=${encodeURIComponent(CANONICAL)}`);

    await expect(page.getByTestId('share-decision')).toBeVisible();
    await expect(page.getByTestId('share-params')).toContainText(CANONICAL);
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await fits(page, 'share GET');
  });

  test('the landing renders its nav, hero, every section and its footer', async ({ page }) => {
    await settledDevice(page);
    await page.goto('/');

    // The landing is a lazy route behind a null Suspense fallback, so `goto` resolves on an empty
    // document and every assertion after it has to wait for the chunk, not for the navigation.
    await expect(page.getByTestId('landing')).toBeVisible();
    await expect(page.locator('h1#top-h')).toHaveText(LANDING.h1);
    await expect(page.getByText(LANDING.eyebrow, { exact: true })).toBeVisible();
    await expect(page.getByText(LANDING.wordmark, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: LANDING.ctaPrimary }).first()).toBeVisible();

    // Every 4.4 section is present and carries its heading. A section that failed to mount on one
    // engine is a hole in the page a screenshot on another engine would never show.
    // `[id="…-h"]` rather than `h2#…-h`: 4.4.9 heads the country-packs section with an H3 and no
    // kicker, which is a copy decision and not this suite's to relevel. What is asserted is that
    // every section has its heading and that the heading has words in it.
    for (const anchor of LANDING.anchors) {
      await expect(page.locator(`#${anchor}`), `section #${anchor} must render`).toBeVisible();
      await expect(page.locator(`[id="${anchor}-h"]`), `section #${anchor} must carry its heading`).not.toBeEmpty();
    }

    // Product-as-imagery: the landing mounts the app's real renderers. If one engine cannot lay
    // them out, the page is a wall of prose and this is what says so.
    await expect(page.getByTestId('hero-claim-map').locator('.m-map')).toBeVisible();
    await expect(page.getByTestId('hero-counts')).not.toBeEmpty();

    await expect(page.locator('footer')).toContainText(LANDING.credit);
    await expect(page.locator('footer')).toContainText(LANDING.team);
    await fits(page, 'landing at 402');

    // Desktop too: the landing is the one surface with a real two-column layout, and a grid that
    // one engine resolves differently overflows there rather than on the phone.
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.locator('h1#top-h')).toBeVisible();
    await fits(page, 'landing at 1280');
  });
});
