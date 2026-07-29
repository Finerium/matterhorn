/**
 * PROVES: AC-LAND-10 (zero serious or critical axe violations on the landing), and the same bar
 *         voluntarily on `/app` and `/research`. The blueprint only names the landing; a research
 *         surface nobody can navigate would be a poor reading of why that criterion exists, so
 *         every surface in Section 3.2 that this suite can reach is scanned at the same bar.
 *         AC-APP-15 rides along: every scan runs twice, light and dark, because a dark theme that
 *         drops a chip under 4.5:1 is exactly the kind of inversion the parity criterion is about.
 *
 * Post-install home: tests/e2e/a11y.spec.ts. Config: tests/e2e/a11y.config.ts, which builds and
 * previews the real dist over the published `content/` root.
 *
 * The bar, said once. `SERIOUS` is the assertion: zero nodes at impact serious or critical, which
 * is AC-LAND-10's wording verbatim. Everything axe reports at any impact is printed, so a moderate
 * regression is visible in the log before it is ever tolerated. The tag set is the WCAG 2.0 and
 * 2.1 A and AA rules plus axe's best-practice pack, which is a wider net than the criterion asks
 * for; the assertion stays at serious-or-critical, and the extra rules only ever add findings.
 *
 * Nothing here excludes a selector and nothing disables a rule. Two rules pass because the markup
 * now tells the truth rather than because they were switched off:
 *   color-contrast on the dimmed onboarding and region rows   those rows carry aria-disabled,
 *     which is what they are: options that cannot be selected and answer a tap with a toast that
 *     says so. WCAG 1.4.3 exempts inactive components, and the measured ratio is stated in the
 *     source comment rather than hidden (2.75:1 label, 1.83:1 sub, at the .45 dim).
 *   nested-interactive on the archive constellation   the teaser is role="group", not role="img",
 *     because its nodes are real buttons.
 *
 * The app walk drives real interaction rather than `window.__mthGoto`. That hook is folded out of
 * a production build, and this suite tests the production build; driving the shipped surface the
 * way a reader does is the stronger evidence anyway.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { guardConsole } from './console-collector';

guardConsole();

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const BLOCKING = new Set(['serious', 'critical']);

type Theme = 'light' | 'dark';

/**
 * Runs axe at one stop on a walk and asserts the AC-LAND-10 bar there.
 *
 * The wait is load-bearing: axe reads computed colour, and an element caught mid-fade reports the
 * blend against its background rather than its painted colour. Under `reducedMotion: 'reduce'` the
 * app freezes its entrance animations, and this drains whatever is left (a route transition, a
 * sheet spring) so a screenshot-stable frame is what gets measured. Measured, not assumed: before
 * the shell.css reduced-motion guard covered `.m-screen[data-anim]`, this scan read the radar feed
 * at 1.02:1 because it sampled the first frame of a 400 ms fade.
 */
async function scan(page: Page, label: string): Promise<void> {
  await page
    .waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'), null, {
      timeout: 10_000,
    })
    .catch(() => {
      // An animation that never settles is a finding for AC-LAND-7, not for this suite. Scan the
      // frame that is up rather than failing here with the wrong criterion's name on it.
    });

  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  for (const violation of violations) {
    console.log(`axe ${label}: [${violation.impact}] ${violation.id} on ${violation.nodes.length} node(s)`);
    for (const node of violation.nodes) console.log(`  ${node.target.join(' ')}`);
  }

  const blocking = violations.filter((violation) => BLOCKING.has(violation.impact ?? ''));
  expect(
    blocking.map((violation) => `${violation.id} (${violation.nodes.length}): ${violation.help}`),
    `${label} must have zero serious or critical axe violations`,
  ).toEqual([]);
}

/** Puts the device in a theme and past onboarding before the first paint of the next load. */
async function device(page: Page, theme: Theme, onboarded: boolean): Promise<void> {
  await page.addInitScript(
    ({ mode, done }: { mode: string; done: boolean }) => {
      window.localStorage.setItem('mth:theme', mode);
      if (done) window.localStorage.setItem('mth:onboarded', '1');
      else window.localStorage.removeItem('mth:onboarded');
    },
    { mode: theme, done: onboarded },
  );
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`axe ${theme}`, () => {
    // AC-LAND-10 proper. The landing is the criterion; the rest of this file is the reading.
    test('AC-LAND-10 the landing', async ({ page }) => {
      await device(page, theme, true);
      await page.goto('/');
      // The landing is a lazy route behind a null Suspense fallback, so `goto` resolves on an
      // empty document. Without this wait axe scans nothing and reports a clean page, which is
      // the one result this suite must never produce. Caught exactly that way on the first run.
      await expect(page.getByTestId('landing')).toBeVisible();
      await expect(page.locator('h1#top-h')).toBeVisible();
      await scan(page, `${theme} landing`);
    });

    test('the app, from a fresh device through onboarding to a panel stack', async ({ page }) => {
      await device(page, theme, false);

      await page.goto('/app');
      await expect(page.locator('[data-screen="onb-hello"]')).toBeVisible();
      await scan(page, `${theme} onb-hello`);

      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.locator('[data-screen="onb-lang"]')).toBeVisible();
      await scan(page, `${theme} onb-lang`);

      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.locator('[data-screen="onb-regions"]')).toBeVisible();
      await scan(page, `${theme} onb-regions`);

      await page.getByRole('button', { name: 'Continue' }).click();
      await expect(page.locator('[data-screen="onb-notif"]')).toBeVisible();
      await scan(page, `${theme} onb-notif`);

      await page.getByRole('button', { name: 'Enable notifications' }).click();
      await expect(page.locator('[data-sheet="ios-notif"]')).toBeVisible();
      await scan(page, `${theme} onb-notif ios dialog`);

      await page.getByRole('button', { name: 'Allow', exact: true }).click();
      await expect(page.locator('[data-screen="onb-auth"]')).toBeVisible();
      await scan(page, `${theme} onb-auth`);

      await page.getByRole('button', { name: 'Continue with Apple' }).click();
      await expect(page.locator('[data-sheet="honest-auth"]')).toBeVisible();
      await scan(page, `${theme} honest-auth sheet`);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Continue without an account' }).click();
      await expect(page.locator('[data-screen="main-radar"]')).toBeVisible();
      await scan(page, `${theme} radar`);

      await page.getByTestId('region-switch').click();
      await expect(page.locator('[data-sheet="region"]')).toBeVisible();
      await scan(page, `${theme} radar region sheet`);
      await page.keyboard.press('Escape');

      for (const tab of ['dissect', 'archive', 'settings'] as const) {
        await page.locator(`[data-tab="${tab}"]`).click();
        await expect(page.locator(`[data-tab="${tab}"][data-on="1"]`)).toBeVisible();
        await scan(page, `${theme} tab ${tab}`);
      }
    });

    test('the autopsy, its panel stack and an evidence sheet', async ({ page }) => {
      await device(page, theme, true);

      await page.goto('/n/mbg-stop');
      await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
      await scan(page, `${theme} autopsy sparring gate`);

      const skip = page.getByTestId('spar-skip');
      if (await skip.isVisible()) await skip.click();
      await expect(page.locator('[data-el]').first()).toBeVisible();
      await scan(page, `${theme} autopsy panels`);

      await page.locator('[data-el]').first().click();
      await expect(page.getByTestId('evidence-sheet')).toBeVisible();
      await scan(page, `${theme} autopsy evidence sheet`);
    });

    test('the research surface', async ({ page }) => {
      await device(page, theme, true);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto('/research');
      await expect(page.getByTestId('research')).toBeVisible();
      await scan(page, `${theme} research`);
    });

    test('the standalone routes: methodology, share, offline, 404', async ({ page }) => {
      await device(page, theme, true);

      await page.goto('/methodology');
      await expect(page.getByTestId('policy-65')).toBeVisible();
      await scan(page, `${theme} methodology`);

      await page.goto('/share?url=https%3A%2F%2Fwww.tribunnews.com%2Fnasional%2F7844542');
      await expect(page.getByTestId('share-decision')).toBeVisible();
      await scan(page, `${theme} share GET`);

      await page.goto('/offline');
      await expect(page.getByTestId('route-offline')).toBeVisible();
      await scan(page, `${theme} offline`);

      await page.goto('/no-such-page');
      await expect(page.getByTestId('route-notfound')).toBeVisible();
      await scan(page, `${theme} 404`);
    });
  });
}
