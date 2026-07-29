/**
 * PROVES: AC-LAND-1 frozen copy renders, AC-LAND-2 tagline everywhere and the old one nowhere,
 *         AC-LAND-3 data-bound slots resolve, AC-LAND-13 no video link.
 *
 * Post-install home: tests/e2e/landing-copy.spec.ts. Config: tests/e2e/landing.config.ts, which
 * builds and previews with the real `content/` root staged into the dist, because AC-LAND-3 is a
 * claim about PUBLISHED content and serve mode reads the seed fixture instead. The two roots
 * disagree on exactly the numbers under test: seed symmetry is 4/2/4, published is 6/1/3.
 *
 * WHAT THIS FILE DOES NOT PROVE, said plainly because it is the whole risk of AC-LAND-1.
 * Every string below is imported from app/src/landing/copy.ts rather than restated here. That
 * makes this suite an assertion of one thing only: WHAT RENDERS EQUALS WHAT THE MODULE HOLDS.
 * If the module transcribed blueprint 4.4 wrongly, a dropped clause, a straightened apostrophe,
 * a lowercased kicker, a sentence that drifted by one word, this suite stays green and says
 * nothing at all. A transcription error is INVISIBLE to it, by construction. Restating the strings
 * here would not fix that either; it would move the same hand-transcription risk into a second
 * file and add a way for the two copies to disagree with each other.
 * The check that closes the gap is scripts/check-landing-copy.ts, which reads blueprint 4.4 itself
 * and diffs it against the module. That script, not this file, is the AC-LAND-1 evidence for
 * fidelity. This file is the evidence for rendering. Neither is sufficient alone.
 *
 * WHAT `flatten` FORGIVES, and why. Both sides of every comparison run through it: whitespace
 * collapses, and `·` is treated as a separator rather than as a character. The blueprint uses that
 * middot two ways and never says which is which. In "Links: The problem · The fleet · ..." it
 * separates five things that become five links; in "Free · No account needed · Runs in your
 * browser" it may well be a character in one line, or three chips. Forgiving it is what keeps this
 * suite from dictating a layout the blueprint left open. Nothing else is forgiven: a dropped word,
 * a reworded clause or a missing sentence still fails. Punctuation fidelity is check-landing-copy's
 * job, which is the same division of labor as the paragraph above.
 *
 * DOM HOOKS THIS SPEC PINS, the contract a landing implementer builds to. These fail RED until
 * they exist, which is the point of writing this file before the page:
 *   semantic   exactly one <h1>, one <h2> per section in document order, one <footer>
 *   testids    [data-testid=receipt-card] x3, [data-testid=grammar-card] x8,
 *              [data-testid=hero-counts]
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import type { Methodology, Narrative } from '../../contracts/types';
import {
  FLEET,
  FOOTER,
  GRAMMAR,
  HERO,
  INTEGRITY,
  MODES,
  NAV,
  PACKS,
  PROBLEM,
  STAKES,
  TRY,
  fill,
  type Line,
  type Slot,
  type SlotValues,
} from '../../app/src/landing/copy';

/** In document order, which is also the order the H2 assertion below reads them in. */
const SECTIONS = { NAV, HERO, PROBLEM, STAKES, FLEET, GRAMMAR, MODES, INTEGRITY, PACKS, TRY, FOOTER };

// --- the published content root, read from disk so the assertions track the content -----------

const contentPath = (rel: string): string => fileURLToPath(new URL(`../../content/${rel}`, import.meta.url));

const readJson = <T>(rel: string): T => JSON.parse(readFileSync(contentPath(rel), 'utf8')) as T;

const METHODOLOGY = readJson<Methodology>('methodology.json');

/** The hero set piece is the mbg-stop claim map: blueprint 4.4.2 names its headline chip. */
const HERO_NARRATIVE = readJson<Narrative>('narratives/mbg-stop.json');

/**
 * Every slot in blueprint 4.4, resolved from disk rather than restated, so a hardcoded numeral
 * goes red the moment the content behind it changes. That is the only difference between proving
 * a binding and proving that a digit is somewhere on the page.
 *
 * Two of the ten are not content counts and are honest about it. `components` counts the grammar
 * cards the frozen copy itself lists, so section 4 and the stats band can never disagree.
 * `agents` is thirteen because the pipeline has thirteen stages (blueprint 5.4, A1..A13); nothing
 * under content/ counts them.
 */
const SLOT_VALUES: SlotValues = {
  gov: METHODOLOGY.symmetry.gov,
  neutral: METHODOLOGY.symmetry.neutral,
  opp: METHODOLOGY.symmetry.opp,
  packs: readdirSync(contentPath('packs'), { withFileTypes: true }).filter((entry) => entry.isDirectory()).length,
  narratives: readdirSync(contentPath('narratives')).filter((file) => file.endsWith('.json')).length,
  components: GRAMMAR.cards.length,
  agents: 13,
  missing: HERO_NARRATIVE.counts.missing,
  unsourced: HERO_NARRATIVE.counts.unsourced,
  hidden: HERO_NARRATIVE.counts.hidden,
};

// --- walking the copy module ------------------------------------------------------------------

const isSlot = (part: unknown): part is { slot: Slot } =>
  typeof part === 'object' && part !== null && 'slot' in part;

/** A `Line` is an array carrying at least one slot; a plain array of strings is a list of items. */
const isLine = (value: unknown): value is Line => Array.isArray(value) && (value as unknown[]).some(isSlot);

interface Frozen {
  path: string;
  text: string;
}

/**
 * Every string the copy module holds, resolved, with the path that names it in a failure message.
 *
 * `anchor` is the one key skipped: copy.ts says so in its own header, those are the section ids
 * from the parentheses in 4.4 and they are markup, not copy. Everything else is frozen prose.
 */
function walk(node: unknown, path = ''): Frozen[] {
  if (typeof node === 'string') return [{ path, text: node }];
  if (isLine(node)) return [{ path, text: fill(node, SLOT_VALUES) }];
  if (Array.isArray(node)) {
    return (node as unknown[]).flatMap((child, index) => walk(child, `${path}[${String(index)}]`));
  }
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node as Record<string, unknown>)
      .filter(([key]) => key !== 'anchor')
      .flatMap(([key, value]) => walk(value, path === '' ? key : `${path}.${key}`));
  }
  return [];
}

const ALL_COPY = walk(SECTIONS);

/** Section headings, collected by key rather than by naming seven sections one at a time. */
const H2S = ALL_COPY.filter((frozen) => frozen.path.endsWith('.h2')).map((frozen) => frozen.text);

// --- helpers -----------------------------------------------------------------------------------

/** See the header: whitespace collapses, and `·` counts as a separator rather than a character. */
const flatten = (text: string): string => text.replace(/·/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Opens the landing and walks the full scroll.
 *
 * Load-bearing rather than tidy: scroll-driven reveals mount their content once the section has
 * been entered, so reading text off a page that was never scrolled would miss whole sections and
 * report them as unrendered copy. Reduced motion is on config-wide, so one pass settles everything
 * at its final frame.
 */
async function openLanding(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('h1'), 'the landing renders an H1').toBeVisible();
  await page.evaluate(async () => {
    const frame = (): Promise<void> => new Promise((done) => { requestAnimationFrame(() => { done(); }); });
    for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight) {
      window.scrollTo(0, y);
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
  });
}

/** All visible text on the page, flattened. Visible is what "renders" means for a copy assertion. */
const pageText = async (page: Page): Promise<string> => flatten(await page.locator('body').innerText());

// --- AC-LAND-1 ----------------------------------------------------------------------------------

test.describe('AC-LAND-1 frozen copy renders', () => {
  test('every string the copy module holds renders on the page', async ({ page }) => {
    await openLanding(page);
    const text = await pageText(page);

    // One assertion listing every miss rather than dying on the first: a section that was never
    // built should report as a section, not as its first sentence.
    const absent = ALL_COPY.filter((frozen) => !text.includes(flatten(frozen.text))).map(
      (frozen) => `${frozen.path}: ${frozen.text}`,
    );
    expect(absent, 'AC-LAND-1: frozen copy that does not render').toEqual([]);
  });

  test('the H1 is the H1, and there is one of them', async ({ page }) => {
    await openLanding(page);
    await expect(page.locator('h1'), 'a landing has exactly one H1').toHaveCount(1);
    expect(flatten(await page.locator('h1').innerText())).toBe(flatten(HERO.h1));
  });

  test('every H2 renders as an H2, in section order', async ({ page }) => {
    await openLanding(page);
    const rendered = (await page.locator('h2').allInnerTexts()).map(flatten);
    // Blueprint 4.4.9 is the one section headed with an H3, so it is absent here on purpose.
    expect(rendered, 'AC-LAND-1: the section headings are the frozen H2s, in order').toEqual(H2S.map(flatten));
  });

  test('the three receipt cards each carry their own text', async ({ page }) => {
    await openLanding(page);
    const cards = page.getByTestId('receipt-card');
    await expect(cards, 'blueprint 4.4.5 ships three receipt cards').toHaveCount(FLEET.receipts.length);
    for (const [index, receipt] of FLEET.receipts.entries()) {
      expect(flatten(await cards.nth(index).innerText()), `receipt card ${String(index + 1)}`).toContain(
        flatten(receipt),
      );
    }
  });

  test('the eight grammar cards each carry their own text', async ({ page }) => {
    await openLanding(page);
    const cards = page.getByTestId('grammar-card');
    // Eight cards, not one paragraph holding eight sentences: the grid is the section.
    await expect(cards, 'blueprint 4.4.6 ships an eight-card grid').toHaveCount(GRAMMAR.cards.length);
    for (const [index, card] of GRAMMAR.cards.entries()) {
      expect(flatten(await cards.nth(index).innerText()), `grammar card ${String(index + 1)}`).toContain(
        flatten(card),
      );
    }
  });

  test('the ethics microline and the bridge line render', async ({ page }) => {
    await openLanding(page);
    const text = await pageText(page);
    // Named apart from the sweep because AC-LAND-1 names them, and because these two lines are what
    // keeps section 2 from reading as a prediction of harm. Their absence is a product defect, not
    // a missing paragraph.
    expect(text, 'AC-LAND-1: the ethics microline').toContain(flatten(STAKES.ethicsMicroline));
    expect(text, 'AC-LAND-1: the bridge line').toContain(flatten(STAKES.bridgeLine));
  });

  test('every footer line renders inside the footer, credit and team included', async ({ page }) => {
    await openLanding(page);
    await expect(page.locator('footer')).toHaveCount(1);
    const footer = flatten(await page.locator('footer').innerText());

    // AC-LAND-1 names four ("all four footer lines including the credit and team lines"): the four
    // that 4.4.11 labels as lines are credit, team, disclosure and legal. The other footer strings
    // are asserted too, because asserting fewer would be a weaker test for no saving.
    const absent = walk(FOOTER)
      .filter((frozen) => !footer.includes(flatten(frozen.text)))
      .map((frozen) => `FOOTER.${frozen.path}: ${frozen.text}`);
    expect(absent, 'AC-LAND-1: footer copy that does not render inside the footer').toEqual([]);
    expect(footer, 'AC-LAND-1: the credit line').toContain(flatten(FOOTER.credit));
    expect(footer, 'AC-LAND-1: the team line').toContain(flatten(FOOTER.team));
  });
});

// --- AC-LAND-2 ----------------------------------------------------------------------------------

/** Blueprint 7.2 item 9 and D-10, locked. The one string quoted literally in this file. */
const TAGLINE = 'Most people see the peak. The Matterhorn shows the journey and its impact.';

/**
 * The zip's tagline that D-10 replaces, in both forms it takes there: the Hello subline uses a
 * period ("You have seen the peak. Matterhorn shows you the mountain."), the About intro uses a
 * semicolon. Matched on the two distinctive halves, so a third punctuation variant cannot slip
 * through on a technicality.
 */
const OLD_TAGLINE = /You have seen the peak|shows you the mountain/i;

test.describe('AC-LAND-2 tagline everywhere, old tagline nowhere', () => {
  test('the copy module carries the locked tagline in the hero H1 and in footer line 2', () => {
    // The one place this suite checks the module against the blueprint rather than against the
    // page, and it earns the exception: D-10 makes this exact string load-bearing in four separate
    // surfaces, so the two landing copies of it must be byte-identical to each other and to it.
    expect(HERO.h1, 'blueprint 4.4.2 H1 is the locked tagline').toBe(TAGLINE);
    expect(FOOTER.line2, 'blueprint 4.4.11 line 2 is the locked tagline').toBe(TAGLINE);
  });

  test('the tagline renders in the hero and in the footer', async ({ page }) => {
    await openLanding(page);
    await expect(page.locator('h1'), 'AC-LAND-2: the hero').toHaveText(TAGLINE);
    await expect(page.locator('footer'), 'AC-LAND-2: footer line 2').toContainText(TAGLINE);
  });

  test('the old tagline appears nowhere in the document', async ({ page }) => {
    await openLanding(page);
    // The whole document rather than the visible text: a replaced tagline surviving in a meta
    // description or an alt attribute is still the old tagline shipping.
    expect(await page.content(), 'AC-LAND-2: D-10 replaced this everywhere').not.toMatch(OLD_TAGLINE);
  });
});

// --- AC-LAND-3 ----------------------------------------------------------------------------------

test.describe('AC-LAND-3 data-bound slots resolve', () => {
  // Two widths: a slot living in a mobile-only or a desktop-only element must not escape by being
  // measured at the width where it does not render.
  for (const width of [390, 1280]) {
    test(`no literal curly brace renders at ${String(width)}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await openLanding(page);
      // copy.ts stores slots as typed objects rather than braces inside strings, so a brace on
      // screen can only come from a component doing its own templating. Asserted anyway: this is
      // the reader-visible form of AC-LAND-3 and it costs one line.
      expect(await pageText(page), `AC-LAND-3: an unresolved slot renders at ${String(width)}`).not.toMatch(/[{}]/);
    });
  }

  test('the symmetry numbers equal content/methodology.json', async ({ page }) => {
    await openLanding(page);
    const text = await pageText(page);

    const card = INTEGRITY.cards.find((parts) => parts.some((part) => isSlot(part) && part.slot === 'gov'));
    expect(card, 'blueprint 4.4.8 card 3 carries the symmetry slots').toBeDefined();
    // The whole resolved sentence, not the three numbers: 6, 1 and 3 appear all over a page about
    // counts, and finding them proves nothing. Finding them in this sentence proves the binding.
    expect(text, 'AC-LAND-3: the symmetry receipt equals methodology.json').toContain(
      flatten(fill(card ?? [], SLOT_VALUES)),
    );
  });

  test('the stats band and the caption equal the published content counts', async ({ page }) => {
    await openLanding(page);
    const text = await pageText(page);
    expect(text, 'AC-LAND-3: the stats band').toContain(flatten(fill(PACKS.statsBand, SLOT_VALUES)));
    expect(text, 'AC-LAND-3: the archive caption').toContain(flatten(fill(PACKS.caption, SLOT_VALUES)));
  });

  test('the hero count chips equal the hero narrative counts', async ({ page }) => {
    await openLanding(page);
    const chips = flatten(await page.getByTestId('hero-counts').innerText());
    // Scoped to the chips rather than the page for the same reason as the symmetry card. The
    // expected string is built from mbg-stop's own counts.json values, so a developer who typed
    // the numbers in goes red the next time the pipeline republishes that narrative.
    expect(chips, 'AC-LAND-3: the hero count chips are bound to mbg-stop counts').toContain(
      flatten(fill(HERO.setPiece.countChips, SLOT_VALUES)),
    );
  });
});

// --- AC-LAND-13 ---------------------------------------------------------------------------------

/** Any host or file extension that means "this is a video". */
// The extension alternation is \b-anchored: an unanchored `\.webm` also matches the
// `manifest.webmanifest` link vite-plugin-pwa injects into every route, which is a PWA
// manifest and not a video. Anchoring keeps the check honest instead of loud.
const VIDEO_URL =
  /youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|wistia\.|loom\.com|streamable\.com|\.(?:mp4|webm|mov|m4v|ogv)\b/i;

/**
 * Copy that offers a video to watch.
 *
 * Scoped tightly on purpose, in two directions. Frozen copy already contains the word "video"
 * (4.4.4 case card 3: "A viral death video mobilized nationwide protests within hours"), so a
 * blanket ban would fail the blueprint for being correct. And 4.4.10 explicitly permits a captured
 * still with a PLAY affordance for the set piece, so a bare play control is not banned either.
 * What AC-LAND-13 forbids is a link to a film.
 */
const WATCH_COPY = [
  /\bwatch (the |a |our |this )?(video|demo|film|clip|trailer|walkthrough|recording|pitch)\b/i,
  /\b(video|demo) (walkthrough|tour|reel|trailer|recording)\b/i,
  /\bplay (the |a |our )?(video|film|clip|trailer|recording)\b/i,
  /\bwatch (it|now|here|again)\b/i,
  /\b(pitch|demo|full|explainer|intro) video\b/i,
  /\bvideo (demo|link|below|above)\b/i,
];

test.describe('AC-LAND-13 no video link', () => {
  test('no media element and no player embed exists', async ({ page }) => {
    await openLanding(page);
    await expect(page.locator('video, source, track'), 'AC-LAND-13: a media element').toHaveCount(0);
    // No frame of any kind: nothing on this landing needs one, and a frame is how a player arrives.
    await expect(page.locator('iframe, embed, object'), 'AC-LAND-13: an embed').toHaveCount(0);
    await expect(
      page.locator('meta[property^="og:video"], meta[name="twitter:player"]'),
      'AC-LAND-13: a video card',
    ).toHaveCount(0);
  });

  test('no attribute anywhere points at a video or offers one to watch', async ({ page }) => {
    await openLanding(page);
    const attributes = await page.evaluate(() => {
      const names = ['href', 'src', 'srcset', 'data', 'poster', 'aria-label', 'title', 'alt', 'content'];
      const found: string[] = [];
      for (const element of document.querySelectorAll('*')) {
        for (const name of names) {
          const value = element.getAttribute(name);
          if (value !== null && value !== '') found.push(`${element.tagName.toLowerCase()}[${name}]="${value}"`);
        }
      }
      return found;
    });

    // Slugs separate words with punctuation, so "/watch-the-demo" has to read as copy too.
    const asWords = (value: string): string => value.replace(/[-_/?&=+.]/g, ' ');
    const offenders = attributes.filter(
      (attribute) => VIDEO_URL.test(attribute) || WATCH_COPY.some((pattern) => pattern.test(asWords(attribute))),
    );
    expect(offenders, 'AC-LAND-13: no video URL and no watch affordance').toEqual([]);
  });

  test('no copy on the page offers a video to watch', async ({ page }) => {
    await openLanding(page);
    const text = await pageText(page);
    const offenders = WATCH_COPY.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
    expect(offenders, 'AC-LAND-13: watch-affordance copy on the landing').toEqual([]);
    expect(text, 'AC-LAND-13: a video URL rendered as text').not.toMatch(VIDEO_URL);
  });
});
