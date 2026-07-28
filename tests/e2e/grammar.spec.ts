/**
 * PROVES: AC-GRAM-1 claim_map, AC-GRAM-2 scale_check, AC-GRAM-3 money_flow,
 *         AC-GRAM-4 incidence, AC-GRAM-5 dueling, AC-GRAM-6 echo (and its silence state),
 *         AC-GRAM-7 options, AC-GRAM-8 family.
 * Also carries the card screenshots that AC-INV-2 is asserted against in the unit suite.
 *
 * The surface is the dev-only harness: one component per URL, seed content root fetched at
 * run time. Post-install home of this file: tests/e2e/grammar.spec.ts.
 *
 *   /harness.html?panel=<panel>&narrative=<id>&lang=<en|id>&theme=<light|dark>
 *
 * Hooks this spec pins, which the harness and the renderers must provide:
 *   [data-testid="harness-panel"]   the mounted component, present only once the content root
 *                                   has resolved, so a screenshot cannot race the fetch
 *   [data-testid="evidence-sheet"]  the sheet, role="dialog"
 *   [data-el="<el_id>"]             every element carrying an el_id, tabIndex 0
 *   [data-echo="silence"]           the Echo silence state
 *   stroke-dasharray                every status stroke, so status survives colour blindness
 *
 * Deviation, declared rather than papered over: the brief asks for an evidence sheet on every
 * component. Five of the eight open one, which is exactly the five the zip reference makes
 * tappable (claim_map rows and edges and hidden branches, scale_check segments, money_flow
 * rows, incidence cells, dueling counts). Options, Echo and Family have no tap target in the
 * zip, and blueprint 4.1 says port, do not redesign, so inventing three is out of scope for
 * this gate. Those three are asserted on the identity they do render: the proponent, the
 * citations, and the family members, each of which still has to come out of a resolved
 * Source or the narrative artifact. If Gate 3 gives them tap targets, they move up.
 *
 * Assertion strings are verbatim seed fixture values, quoted here so a fixture edit shows up
 * as a test failure rather than as a silently weaker test.
 */
import { expect, test, type Page } from '@playwright/test';

const harness = (panel: string, narrative: string, lang = 'en', theme = 'light'): string =>
  `/harness.html?panel=${panel}&narrative=${narrative}&lang=${lang}&theme=${theme}`;

async function open(page: Page, panel: string, narrative: string): Promise<void> {
  await page.goto(harness(panel, narrative));
  await page.waitForLoadState('networkidle');
  await expect(page.getByTestId('harness-panel')).toBeVisible();
}

interface PanelCase {
  ac: string;
  panel: string;
  narrative: string;
  snapshot: string;
  /** false for the two cards and for the silence state, which declare no el_id of their own. */
  hasEls: boolean;
}

const PANELS: PanelCase[] = [
  { ac: 'AC-GRAM-1', panel: 'claim_map', narrative: 'mbg-stop', snapshot: 'claim-map', hasEls: true },
  { ac: 'AC-GRAM-2', panel: 'scale_check', narrative: 'mbg-stop', snapshot: 'scale-check', hasEls: true },
  { ac: 'AC-GRAM-3', panel: 'money_flow', narrative: 'mbg-stop', snapshot: 'money-flow', hasEls: true },
  { ac: 'AC-GRAM-4', panel: 'incidence', narrative: 'mbg-stop', snapshot: 'incidence', hasEls: true },
  { ac: 'AC-GRAM-5', panel: 'dueling', narrative: 'mbg-poisoning', snapshot: 'dueling', hasEls: true },
  { ac: 'AC-GRAM-6', panel: 'echo', narrative: 'ppn-panic', snapshot: 'echo', hasEls: true },
  { ac: 'AC-GRAM-6', panel: 'echo_silence', narrative: 'mbg-stop', snapshot: 'echo-silence', hasEls: false },
  { ac: 'AC-GRAM-7', panel: 'options', narrative: 'mbg-stop', snapshot: 'options', hasEls: true },
  { ac: 'AC-GRAM-8', panel: 'family', narrative: 'mbg-stop', snapshot: 'family', hasEls: true },
  { ac: 'AC-INV-2', panel: 'card_hero', narrative: 'mbg-stop', snapshot: 'card-hero', hasEls: false },
  { ac: 'AC-INV-2', panel: 'card_compact', narrative: 'mbg-poisoning', snapshot: 'card-compact', hasEls: false },
];

for (const c of PANELS) {
  test(`${c.ac} ${c.panel} renders ${c.narrative}`, async ({ page }) => {
    await open(page, c.panel, c.narrative);
    await expect(page).toHaveScreenshot(`${c.snapshot}-${c.narrative}-en-light.png`);
  });

  if (c.hasEls) {
    test(`${c.ac} ${c.panel} gives every el_id a focusable data-el`, async ({ page }) => {
      await open(page, c.panel, c.narrative);
      const els = await page
        .locator('[data-el]')
        .evaluateAll((nodes) =>
          nodes.map((n) => ({ el: n.getAttribute('data-el'), tabindex: n.getAttribute('tabindex') })),
        );
      expect(els.length, 'a grammar panel renders at least one addressable element').toBeGreaterThan(0);
      for (const { el, tabindex } of els) expect(tabindex, `data-el="${el ?? ''}"`).toBe('0');
    });
  }
}

test('AC-GRAM-6 the echo silence state is distinguishable from a rendered echo', async ({ page }) => {
  await open(page, 'echo_silence', 'mbg-stop');
  await expect(page.locator('[data-echo="silence"]')).toBeVisible();

  await open(page, 'echo', 'ppn-panic');
  await expect(page.locator('[data-echo="silence"]')).toHaveCount(0);
});

test('AC-GRAM-1 claim_map carries the edge statuses and their dash patterns', async ({ page }) => {
  await open(page, 'claim_map', 'mbg-stop');

  // Verbatim from tests/fixtures/seed/narratives/mbg-stop.json.
  await expect(page.locator('[data-el="e0"]')).toHaveAttribute('data-st', 'supported');
  await expect(page.locator('[data-el="e1"]')).toHaveAttribute('data-st', 'missing');
  await expect(page.locator('[data-el="e2"]')).toHaveAttribute('data-st', 'unsourced');

  // Colour is never the only carrier of status: each one ships a stroke pattern too.
  const dashes = await page
    .locator('[stroke-dasharray]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('stroke-dasharray') ?? ''));
  expect(new Set(dashes.filter((d) => d !== '')).size, 'statuses must differ by dash, not only by colour').toBeGreaterThanOrEqual(3);
});

// --- the evidence sheet ------------------------------------------------------------------

interface SheetCase {
  ac: string;
  panel: string;
  narrative: string;
  /** the el_id that is tapped */
  el: string;
  /** fragments the opened sheet must carry: the evidence, then the resolved Source */
  sheet: RegExp[];
}

const SHEETS: SheetCase[] = [
  {
    ac: 'AC-GRAM-1',
    panel: 'claim_map',
    narrative: 'mbg-stop',
    el: 'e0',
    sheet: [/Realisasi anggaran MBG mencapai/, /Antara News/],
  },
  {
    ac: 'AC-GRAM-2',
    panel: 'scale_check',
    narrative: 'mbg-stop',
    el: 'sg0',
    sheet: [/MBG realized/, /Rp88\.15T/, /Antara News/],
  },
  {
    ac: 'AC-GRAM-3',
    panel: 'money_flow',
    narrative: 'mbg-stop',
    el: 'm1',
    sheet: [/29,679 SPPG kitchens/, /Kompas\.com/],
  },
  {
    ac: 'AC-GRAM-4',
    panel: 'incidence',
    narrative: 'mbg-stop',
    el: 'i0',
    sheet: [/29,679 SPPG operating as of May 2026/, /Kompas\.com/],
  },
  {
    ac: 'AC-GRAM-5',
    panel: 'dueling',
    narrative: 'mbg-poisoning',
    el: 'd0',
    sheet: [/Running count of verified case reports/, /CNN Indonesia/],
  },
];

for (const c of SHEETS) {
  test(`${c.ac} ${c.panel} opens the evidence sheet from data-el="${c.el}"`, async ({ page }) => {
    await open(page, c.panel, c.narrative);
    await expect(page.getByTestId('evidence-sheet')).toHaveCount(0);

    await page.locator(`[data-el="${c.el}"]`).click();

    const sheet = page.getByTestId('evidence-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('role', 'dialog');
    for (const fragment of c.sheet) await expect(sheet).toHaveText(fragment);
  });
}

// --- the three components the zip gives no tap target ------------------------------------

test('AC-GRAM-7 options renders each option with the proponent behind it', async ({ page }) => {
  await open(page, 'options', 'mbg-stop');
  const option = page.locator('[data-el="o-1"]');
  await expect(option).toContainText('Phased restructuring');
  await expect(option).toContainText('Fiscal economists named in reporting');
  await expect(page.locator('[data-el="o-2"]')).toBeVisible();
  await expect(page.locator('[data-el="o-3"]')).toBeVisible();
  // No ranking, no recommendation: the playbook is process, and it is present.
  await expect(page.locator('[data-el="pb-1"]')).toContainText('Read the primary document.');
});

test('AC-GRAM-6 echo renders the motif, the documented outcome, and its resolved citations', async ({ page }) => {
  await open(page, 'echo', 'ppn-panic');
  const echo = page.locator('[data-el="p-echo"]');
  await expect(echo).toContainText('A restricted measure narrated as universal');
  await expect(echo).toContainText('weeks of mispriced fear followed');
  // citations resolve through the registry, so either identity of a cited source may show.
  await expect(echo).toHaveText(/Direktorat Jenderal Pajak|PMK 131\/2024|Bisnis\.com|Barang Mewah/);
});

test('AC-GRAM-8 family renders the skeleton and every member outlet', async ({ page }) => {
  await open(page, 'family', 'mbg-stop');
  const family = page.locator('[data-el="p-family"]');
  await expect(family).toContainText('one budget lever framed as sufficient to rescue the state budget');
  for (const outlet of ['Tribunnews', 'Kompas video', 'Antara Gorontalo']) {
    await expect(family).toContainText(outlet);
  }
});

// --- entrance motion, deliberately unfrozen ----------------------------------------------

test.describe('entrance motion', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('AC-GRAM-1 claim_map settles after its entrance animation', async ({ page }) => {
    await open(page, 'claim_map', 'mbg-stop');
    // toHaveScreenshot re-samples until two consecutive frames match, so a finishing animation
    // is not a flake and one that never settles is a real failure. See the config comment for
    // the quarantine path if this proves otherwise on CI hardware.
    await expect(page).toHaveScreenshot('claim-map-motion.png', { animations: 'allow' });
  });
});
