/**
 * PROVES: AC-APP-1 (the state matrix drives every named state and captures a screenshot),
 *         and the second half of AC-APP-16 (no raw i18n key renders in the matrix run).
 *         AC-APP-22 rides along through guardConsole().
 *
 * Post-install home: tests/e2e/matrix.spec.ts, reading tests/state-matrix.json.
 * Config: tests/e2e/app.config.ts. Screenshots: tests/e2e/__screenshots__/app/chromium/.
 *
 * One test per entry, named by the entry, so a failure names the state that is missing rather
 * than "matrix failed". The order inside a test is deliberate:
 *
 *   1. reach the state. For app state that is `window.__mthGoto(name)`, and it must return
 *      true. False means state.ts has no GOTO row for that name, which is exactly what an
 *      unimplemented surface looks like from here: it fails loudly instead of screenshotting
 *      whatever screen happened to be up. For a route it is a navigation.
 *   2. assert the state is what it says it is: data-screen, data-sheet, and the entry's own
 *      selector where its siblings share a screen.
 *   3. only then screenshot. A screenshot taken before the assertions would bake a wrong
 *      screen into a baseline and call it evidence.
 *
 * research.* and desktop.* carry `gate5` and are skipped here; they land with the Gate 5
 * surface. The dark.* and land.* rows of Appendix A are not in the file at all.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import { guardConsole } from './console-collector';
import { guardNetwork } from './net-collector';

interface MatrixEntry {
  name: string;
  goto: string | null;
  url?: string;
  screen?: string;
  sheet?: string;
  visible?: string;
  gate5?: boolean;
  note: string;
}

const MATRIX_PATH = fileURLToPath(new URL('../state-matrix.json', import.meta.url));
const ENTRIES: MatrixEntry[] = (
  JSON.parse(readFileSync(MATRIX_PATH, 'utf8')) as { entries: MatrixEntry[] }
).entries;

/**
 * The shape a raw i18n key has when it leaks to screen: a dotted lowercase token whose first
 * segment is one of the bundle's namespaces. Matching the namespaces rather than "anything
 * dotted" is what keeps a URL, a filename or a decimal out of it.
 */
const RAW_KEY =
  /\b(common|hello|lang|regions|notif|auth|sheet|tab|pack|radar|dissect|archive|settings|screen|queue|route|share|toast|boundary)\.[a-z][a-z0-9]*(\.[a-z0-9-]+)*\b/;

guardConsole();
guardNetwork();

test('AC-APP-1 the matrix covers the Appendix A minimum', () => {
  const live = ENTRIES.filter((entry) => entry.gate5 !== true);
  expect(live.length, 'Appendix A minus the dark and land rows is 60+ named states').toBeGreaterThanOrEqual(60);
  expect(new Set(ENTRIES.map((entry) => entry.name)).size, 'state names are unique').toBe(ENTRIES.length);
  for (const entry of ENTRIES) {
    expect(entry.goto !== null || entry.url !== undefined, `${entry.name} is reachable by goto or by url`).toBe(true);
    expect(
      entry.screen !== undefined || entry.sheet !== undefined || entry.visible !== undefined,
      `${entry.name} asserts something about what it reached`,
    ).toBe(true);
  }
});

/** Jumps the shell to `name`, failing by name when the shell has no row for it. */
async function jump(page: Page, name: string): Promise<void> {
  await page.goto('/app');
  // __mthGoto is installed in an effect, so it exists a tick after the bundle evaluates.
  await page.waitForFunction(() => typeof window.__mthGoto === 'function');
  const reached = await page.evaluate((state: string) => window.__mthGoto?.(state) ?? false, name);
  expect(
    reached,
    `window.__mthGoto("${name}") returned false: app/src/app/state.ts has no GOTO row for that state, so the surface behind it does not exist yet`,
  ).toBe(true);
}

for (const entry of ENTRIES) {
  test(`AC-APP-1 ${entry.name}`, async ({ page }) => {
    test.skip(entry.gate5 === true, 'research and desktop states land with the Gate 5 surface');

    if (entry.url === undefined) {
      await jump(page, entry.goto ?? entry.name);
    } else {
      await page.goto(entry.url);
    }

    if (entry.screen !== undefined) {
      await expect(
        page.locator(`[data-screen="${entry.screen}"]`),
        `${entry.name} must render data-screen="${entry.screen}"`,
      ).toBeVisible();
    }
    if (entry.sheet !== undefined) {
      await expect(
        page.locator(`[data-sheet="${entry.sheet}"]`),
        `${entry.name} must render data-sheet="${entry.sheet}"`,
      ).toBeVisible();
    }
    if (entry.visible !== undefined) {
      await expect(
        page.locator(entry.visible).first(),
        `${entry.name} must render ${entry.visible}`,
      ).toBeVisible();
    }

    // AC-APP-15. Without this a dark row whose theme never applied screenshots the light surface
    // and passes, which is the one way a parity picture can lie. `data-mth` on body is what every
    // token in app/src/tokens.css hangs off, so asserting it is asserting the whole dark block.
    if (entry.name.startsWith('dark.')) {
      await expect(page.locator('body[data-mth="dark"]'), `${entry.name} must apply the dark theme`).toBeAttached();
    }

    // AC-APP-16, the half a key scan cannot prove: a key declared in both bundles and looked
    // up under the wrong name still reaches the screen as itself.
    const text = await page.locator('body').innerText();
    expect(text, `${entry.name} renders a raw i18n key`).not.toMatch(RAW_KEY);

    await expect(page).toHaveScreenshot(`state-${entry.name}.png`);
  });
}
