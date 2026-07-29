/**
 * PROVES: AC-LAND-4 responsive sweep, AC-LAND-5 mobile adaptations.
 *
 * Post-install home: tests/e2e/landing-responsive.spec.ts. Config: tests/e2e/landing.config.ts.
 *
 * The two halves are different kinds of evidence and are kept apart on purpose. The screenshots
 * are a baseline: they catch a layout that changed, and a human reads them at the gate. The
 * overflow sweep is a hard assertion: blueprint 4.3 says no horizontal overflow at any width from
 * 360 to 1920, so scrollWidth exceeding clientWidth at ANY of the seven widths is a failure, not
 * a diff to eyeball.
 *
 * Screenshots run under reduced motion (config-wide), so every set piece is captured at its final
 * frame. That is the only frame a committed baseline can be, and it is also the frame AC-LAND-7
 * requires to be legible on its own. Motion behavior itself belongs to AC-LAND-6 and AC-LAND-7 and
 * is asserted nowhere in this file.
 *
 * DOM HOOKS THIS SPEC PINS, the contract a landing implementer builds to:
 *   [data-testid=agent-console] wrapping [data-console-line] per line   blueprint 4.4.5
 *   [data-testid=hero-claim-map] wrapping the real ClaimMap renderer    blueprint 4.4.2
 *   [data-testid=two-modes-panel], two of them                          blueprint 4.4.7
 *   <nav> holding the wordmark, the five section links and the CTA      blueprint 4.4.1
 * The hero spine rows are counted as `.m-node`, which is the spine-node class
 * app/src/renderers/ClaimMap.tsx draws. AC-LAND-12 requires the hero to embed that same renderer,
 * so the class is the honest selector rather than a second testid the landing would have to invent.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';

import { FLEET, NAV } from '../../app/src/landing/copy';

/** Blueprint 4.3, the four widths AC-LAND-4 wants a picture of. */
const SHOTS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
  { width: 1680, height: 1050 },
] as const;

/** Blueprint 4.3, every width the page has to survive. Includes all four breakpoints and both ends. */
const WIDTHS = [360, 390, 480, 768, 1024, 1440, 1920] as const;

const MOBILE = { width: 390, height: 844 } as const;

/** WCAG 2.5.5 and blueprint 4.3: 44 CSS px, both axes. */
const TAP = 44;

/**
 * Opens the landing at `size` and walks the full scroll.
 *
 * The walk is load-bearing for both halves: a reveal that has never fired cannot overflow and
 * cannot be photographed, so measuring an unscrolled page would measure a page nobody sees.
 */
async function openLanding(page: Page, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.goto('/');
  await expect(page.locator('h1'), 'the landing renders an H1').toBeVisible();
  await page.evaluate(async () => {
    const frame = (): Promise<void> => new Promise((done) => requestAnimationFrame(() => { done(); }));
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
  });
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Every match's box, in DOM order, failing by index when one of them does not render. */
async function boxes(items: Locator): Promise<Box[]> {
  const total = await items.count();
  const found: Box[] = [];
  for (let index = 0; index < total; index += 1) {
    const box = await items.nth(index).boundingBox();
    if (box === null) throw new Error(`item ${String(index)} of ${String(total)} has no box`);
    found.push(box);
  }
  return found;
}

/**
 * Asserts a set of boxes reads as one column: each one starts at or below the bottom of the last.
 *
 * Geometry rather than a class name or a computed flex-direction, because "vertical feed" and
 * "stacked" are claims about what the reader sees, and a column produced by grid, by flex, or by
 * plain block flow all satisfy AC-LAND-5 equally.
 */
function expectStacked(found: Box[], what: string): void {
  expect(found.length, `${what}: nothing to stack`).toBeGreaterThan(1);
  const sideBySide = found
    .slice(1)
    .map((box, index) => ({ previous: found[index], box, index: index + 1 }))
    // One pixel of slack: a column whose rows abut can round to a hair of overlap and is still a
    // column. Anything more is two things sharing a row.
    .filter(({ previous, box }) => previous !== undefined && box.y < previous.y + previous.height - 1)
    .map(({ index, box }) => `item ${String(index)} at y=${String(Math.round(box.y))}`);
  expect(sideBySide, `AC-LAND-5: ${what} must stack vertically at 390`).toEqual([]);
}

// --- AC-LAND-4 -----------------------------------------------------------------------------------

test.describe('AC-LAND-4 responsive sweep', () => {
  for (const size of SHOTS) {
    test(`renders at ${String(size.width)}`, async ({ page }) => {
      await openLanding(page, size);
      await expect(page).toHaveScreenshot(`landing-${String(size.width)}.png`, { fullPage: true });
    });
  }

  for (const width of WIDTHS) {
    test(`no horizontal overflow at ${String(width)}`, async ({ page }) => {
      await openLanding(page, { width, height: 900 });

      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        if (root.scrollWidth <= root.clientWidth) return null;
        // Naming the culprit, because "the page is 12 px too wide" with no element to look at is
        // the worst kind of red. First offender in DOM order is where the fix goes.
        const limit = root.clientWidth;
        for (const element of document.querySelectorAll<HTMLElement>('body *')) {
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.right <= limit + 1) continue;
          // getAttribute rather than .className: on an SVG element the property is an
          // SVGAnimatedString and stringifies to "[object SVGAnimatedString]".
          const id = element.id === '' ? '' : `#${element.id}`;
          const classes = (element.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).join('.');
          return {
            scrollWidth: root.scrollWidth,
            clientWidth: limit,
            culprit: `${element.tagName.toLowerCase()}${id}${classes === '' ? '' : `.${classes}`}`,
            right: Math.round(box.right),
          };
        }
        return { scrollWidth: root.scrollWidth, clientWidth: limit, culprit: 'unknown', right: 0 };
      });

      expect(overflow, `AC-LAND-4: the page scrolls horizontally at ${String(width)}`).toBeNull();
    });
  }
});

// --- AC-LAND-5 -----------------------------------------------------------------------------------

test.describe('AC-LAND-5 mobile adaptations at 390', () => {
  test('the nav collapses to the wordmark and the single CTA', async ({ page }) => {
    await openLanding(page, MOBILE);
    const nav = page.getByRole('navigation');

    // exact:true is load bearing. An accessible-name match is a substring by default, so
    // "MATTERHORN" also matches the "Open Matterhorn" CTA that 4.4.1 puts in the same nav, and
    // strict mode then fails on two hits. Without it NO conformant implementation can pass.
    // The wordmark is letterspaced in the zip's treatment ("M A T T E R H O R N"), so it is matched
    // as an accessible name rather than as a text run. A visual effect must not decide a test.
    await expect(
      nav
        .getByRole('link', { name: NAV.wordmark, exact: true })
        .or(nav.getByRole('heading', { name: NAV.wordmark, exact: true })),
      'blueprint 4.4.1: the wordmark stays',
    ).toBeVisible();
    await expect(
      nav
        .getByRole('link', { name: NAV.cta, exact: true })
        .or(nav.getByRole('button', { name: NAV.cta, exact: true })),
      'blueprint 4.4.1: Open Matterhorn stays',
    ).toBeVisible();

    // "Collapsed" here is the blueprint's own definition: wordmark plus Open Matterhorn ONLY. Not
    // a hamburger that hides the same five links behind a tap. toBeHidden passes for an element
    // that is absent too, so either implementation of "drops the links" satisfies this.
    for (const { label } of NAV.links) {
      await expect(
        nav.getByRole('link', { name: label, exact: true }),
        `AC-LAND-5: the nav link "${label}" must not render at 390`,
      ).toBeHidden();
    }
  });

  test('the agent console is a vertical feed', async ({ page }) => {
    await openLanding(page, MOBILE);
    const lines = page.getByTestId('agent-console').locator('[data-console-line]');
    await expect(lines, 'blueprint 4.4.5 loops its console lines').toHaveCount(FLEET.consoleLines.length);
    expectStacked(await boxes(lines), 'the agent console');
  });

  test('the claim-map hero renders at most four spine rows', async ({ page }) => {
    await openLanding(page, MOBILE);
    const spine = page.getByTestId('hero-claim-map').locator('.m-node');
    const rows = await spine.count();
    expect(rows, 'AC-LAND-5: the hero claim map renders at least one spine row').toBeGreaterThan(0);
    expect(rows, 'AC-LAND-5: blueprint 4.3 caps the mobile hero at four spine rows').toBeLessThanOrEqual(4);
  });

  test('the two-modes diffs stack', async ({ page }) => {
    await openLanding(page, MOBILE);
    const panels = page.getByTestId('two-modes-panel');
    await expect(panels, 'blueprint 4.4.7 is a split panel, feed on one side, share on the other').toHaveCount(2);
    expectStacked(await boxes(panels), 'the two-modes split panel');
  });

  test('every interactive target is at least 44 px', async ({ page }) => {
    await openLanding(page, MOBILE);

    const small = await page.evaluate((minimum: number) => {
      const selector =
        'a[href], button, input, select, textarea, summary, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';
      const offenders: string[] = [];
      for (const element of document.querySelectorAll<HTMLElement>(selector)) {
        const box = element.getBoundingClientRect();
        // A zero box is an element that is not laid out at this width, which at 390 is exactly
        // what the collapsed nav links are. visibility is inherited, so reading it off the element
        // also catches an ancestor hiding it.
        if (box.width === 0 || box.height === 0) continue;
        if (getComputedStyle(element).visibility === 'hidden') continue;
        if (box.width >= minimum && box.height >= minimum) continue;
        const label = (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        offenders.push(
          `${element.tagName.toLowerCase()} "${label}" ${String(Math.round(box.width))}x${String(Math.round(box.height))}`,
        );
      }
      return offenders;
    }, TAP);

    expect(small, 'AC-LAND-5: tap targets under 44 px at 390').toEqual([]);
  });
});
