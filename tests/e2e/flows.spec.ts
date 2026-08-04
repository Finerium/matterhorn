/**
 * PROVES: AC-APP-2 onboarding, 3 honest auth, 4 radar states, 5 via-Dissect gating,
 *         6 dissect flows, 7 sparring S3, 8 S2/S1/S0 and the override, 9 panel behaviors,
 *         10 narration binding, 11 evidence sheets everywhere, 12 Nuance Card export,
 *         13 share-target resolution, 14 region and language switching, 17 offline,
 *         18 permalinks, 19 methodology and 404, 20 notification preview.
 *         Also docs/replay-protocol.md, both doors of the update receiver.
 *         AC-APP-22 rides along through guardConsole().
 *
 * Post-install home: tests/e2e/flows.spec.ts. Config: tests/e2e/app.config.ts, which serves
 * `vite app` over the PUBLISHED `content/` root. Nothing here reads tests/fixtures/seed: those
 * fixtures are frozen for the AC-GRAM component photographs and are reachable only from the
 * harness entry.
 *
 * Two kinds of string appear below, and the split is the point:
 *
 *   quoted     app/src/i18n bundle values and the blueprint's FROZEN microcopy. Those are code
 *              and specification, so they are transcribed verbatim and an edit to either is
 *              meant to fail here.
 *   computed   everything that is CONTENT: headlines, sparring questions, element ids, counts,
 *              narration, the symmetry receipt, the corrections log. Those are read from
 *              content/ off disk at collection time, the way research.spec.ts already does it,
 *              so both sides of the assertion move together when the pipeline republishes and
 *              the check cannot rot into a transcription of last month's run.
 *
 * Hooks this spec pins. Everything with a [data-testid] that is not already shipped is the
 * contract a surface implementer builds to; the assertion fails RED until it exists, which is
 * the point of writing this file before the surfaces.
 *
 *   shipped already   [data-screen], [data-sheet], [data-tab], [data-feed-item],
 *                     [data-toast], [data-el], [data-st], [data-strike], [data-echo],
 *                     [data-sent], [data-testid=evidence-sheet], [data-testid=pack-switch],
 *                     [data-testid=greeting], [data-testid=permalink-card],
 *                     [data-testid=policy-65], [data-testid=share-decision],
 *                     [data-testid=share-params], .m-card (hero), .m-card-c (compact)
 *   radar             [data-testid=region-switch], [data-sheet=region],
 *                     [data-testid=under-review-chip], [data-crisis=1],
 *                     [data-testid=via-dissect-chip]
 *   dissect           [data-testid=paste-box], [data-testid=paste-go],
 *                     [data-testid=chip-cached], [data-testid=chip-fresh],
 *                     [data-stage], [data-sheet=rate-limit]
 *   autopsy           [data-testid=spar-q], [data-spar-option] with [data-answer],
 *                     [data-spar-dot], [data-testid=spar-skip], [data-testid=spar-note],
 *                     [data-testid=diff-card], [data-testid=prediction-tap],
 *                     [data-testid=spar-chip], [data-hl], [data-tag],
 *                     [data-sheet=nuance-story], [data-sheet=nuance-chat],
 *                     [data-testid=nuance-export]
 *   settings          [data-testid=account-row], [data-scaffold-option]
 *   notifications     [data-testid=notif-cap], [data-testid=notif-quiet-start],
 *                     [data-testid=notif-preview]
 *   routes            [data-testid=route-notfound], [data-testid=route-offline],
 *                     [data-testid=methodology-symmetry], [data-testid=methodology-disclosure],
 *                     [data-testid=corrections-log]
 *   replay receiver   [data-testid=updated-badge], on the feed card and the provenance line
 *
 * The autopsy is opened by `/n/{id}` throughout, because AC-APP-18 requires that route to
 * hydrate to the full autopsy anyway. One opener, four narratives, no second mechanism.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test, type Page } from '@playwright/test';

import type {
  ClaimMapPanel,
  Corrections,
  DuelingPanel,
  Feed,
  Methodology,
  MoneyFlowPanel,
  Narrative,
  Panel,
  ScaleCheckPanel,
  Source,
  UrlIndex,
} from '../../contracts/types';
import { guardConsole } from './console-collector';
import { guardNetwork } from './net-collector';

guardConsole();
guardNetwork();

// --- what is published, read from disk -----------------------------------------------------

const CONTENT = fileURLToPath(new URL('../../content', import.meta.url));
const read = <T,>(relative: string): T => JSON.parse(readFileSync(join(CONTENT, relative), 'utf8')) as T;

/**
 * noUncheckedIndexedAccess makes every artifact lookup optional, and the contract makes a few
 * fields nullable. This is the one unwrap, and it names what was missing rather than throwing a
 * property access at a reader.
 */
function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`content/ carries no ${what}`);
  return value;
}

/** A panel by grammar component. A narrative that lost one is a content bug, not a flake. */
function panelOf<T extends Panel>(narrative: Narrative, type: T['type']): T {
  return must(
    narrative.panels.find((panel): panel is T => panel.type === type),
    `${type} panel in ${narrative.id}`,
  );
}

/** The url_index pattern for a role: the string the share resolver actually matches on. */
const urlFor = (id: string, role: UrlIndex['entries'][number]['role']): string =>
  must(
    read<UrlIndex>('url_index.json').entries.find((e) => e.narrative_id === id && e.role === role),
    `${role} url for ${id}`,
  ).pattern;

/**
 * The three narratives these flows drive, picked for what they carry rather than for their
 * subject: mbg-stop is the only S3 (AC-APP-7) and the only money_flow (AC-APP-9); mbg-poisoning
 * is S1 with the dueling panel; ppn-panic is S0, carries the echo, and is the via_dissect item.
 */
const STOP = read<Narrative>('narratives/mbg-stop.json');
const POISON = read<Narrative>('narratives/mbg-poisoning.json');
const PPN = read<Narrative>('narratives/ppn-panic.json');
const SOURCES = read<Source[]>('sources.json');
const METHODOLOGY = read<Methodology>('methodology.json');
const CORRECTIONS = read<Corrections>('corrections.json');

const STOP_CLAIM = panelOf<ClaimMapPanel>(STOP, 'claim_map');
const STOP_FLOW = panelOf<MoneyFlowPanel>(STOP, 'money_flow');
const STOP_SCALE = panelOf<ScaleCheckPanel>(STOP, 'scale_check');
const DUEL = panelOf<DuelingPanel>(POISON, 'dueling');

const publisherOf = (id: string): string => must(SOURCES.find((s) => s.id === id), `source ${id}`).publisher;

const SYM = METHODOLOGY.symmetry;
/** The receipt as the radar renders it, from the same numbers the methodology page reads. */
const SYMMETRY = `${String(SYM.gov)}·${String(SYM.neutral)}·${String(SYM.opp)}`;

// --- verbatim strings ---------------------------------------------------------------------

/** app/src/i18n/en.json. The symmetry line is the bundle template over published numbers. */
const EN = {
  continue: 'Continue',
  tagline: 'A causal literacy engine',
  langTitle: 'Choose your app language',
  regionsTitle: 'Which news do you care about?',
  notifTitle: 'One alert a day, at most.',
  notifEnable: 'Enable notifications',
  notifSkip: 'Not now',
  iosAllow: 'Allow',
  iosDeny: 'Don’t Allow',
  toastNotifOn: 'Radar will beat the narrative to you: once a day, at most',
  authTitle: 'Keep your progress.',
  authApple: 'Continue with Apple',
  authGoogle: 'Continue with Google',
  authSkip: 'Continue without an account',
  sheetAuthTitle: 'About accounts',
  sheetAuthBody:
    'Account sync ships with the store build; the demo runs fully on-device. Nothing you do here is transmitted anywhere.',
  radarFooter: 'Served from cache. No model on the read path.',
  badgeUpdated: 'Just updated',
  toastUpdated: 'Republished from research mode: this dissection carries a newer run',
  symmetryLine: `Symmetry ${SYMMETRY} →`,
  queueTitle: 'Queued to the private agent fleet',
  notFoundTitle: 'No such page',
} as const;

/** app/src/i18n/id.json, for the language toggle. */
const ID = {
  tabSettings: 'Pengaturan',
  radarFooter: 'Disajikan dari cache. Tidak ada model di jalur baca.',
  symmetryLine: `Simetri ${SYMMETRY} →`,
} as const;

/** Blueprint Appendix C, FROZEN microcopy. */
const FROZEN = {
  cacheToast: 'Served from the shared cache · computed ',
  honestLine: 'Fresh dissections usually take up to 3 minutes. This demo compresses the wait.',
  queueBody:
    'This link is new to the archive. Fresh dissections are produced by the editorial fleet and land in the next cycle. Nothing is invented in the meantime.',
  notifTitle: 'New dissection · Indonesia',
  /**
   * Blueprint 6.7 permalink shell, FROZEN: counts summary, verdict-free. The TEMPLATE is the
   * frozen part and is transcribed; the three numbers are mbg-stop's published derived counts,
   * so a republished narrative moves the expectation with it.
   */
  ogDescription:
    `${String(STOP.counts.missing)} missing links · ${String(STOP.counts.unsourced)} unsourced assumptions · ` +
    `${String(STOP.counts.hidden)} hidden stakeholders. No verdicts. See the structure.`,
} as const;

// --- published values, computed from the artifacts above -------------------------------------

/** mbg-stop sparring, EN. `correct` is the artifact's own index, so no answer is transcribed. */
const Q = STOP.sparring.questions.map((question, index) => {
  const options = question.options.map((option) => option.en);
  return {
    q: question.q.en,
    right: must(options[question.correct], `option ${String(question.correct)} of question ${String(index + 1)}`),
    wrong: must(
      options.find((_, at) => at !== question.correct),
      `a wrong option for question ${String(index + 1)}`,
    ),
    note: question.note.en,
  };
});

/** mbg-stop money_flow. Published content carries both kinds of row, which is what makes the
 *  stop toggle a real assertion: an exact set, not "everything dims". */
const SEVERED = STOP_FLOW.rows.filter((row) => row.severed_if_stopped).map((row) => row.el_id).sort();
const UNSEVERED = STOP_FLOW.rows.filter((row) => !row.severed_if_stopped).map((row) => row.el_id).sort();

/** mbg-stop narration, EN: the first sentence, and one that shares none of its elements. */
const V1 = must(STOP.narration.en.sentences[0], 'an EN narration sentence in mbg-stop');
const V_OTHER = must(
  STOP.narration.en.sentences.find((s) => s.id !== V1.id && !s.els.some((el) => V1.els.includes(el))),
  'a second EN mbg-stop sentence sharing no element with the first',
);

/** The hidden column, and an edge: what the hidden count chip must and must not light. An edge
 *  can never carry the hidden status by the 6.4 contract, so it is the honest negative. */
const HIDDEN_ELS = STOP_CLAIM.hidden.map((entry) => entry.el_id);
const NOT_HIDDEN_EL = must(STOP_CLAIM.edges[0], 'an mbg-stop edge, which is never a hidden entry').el_id;

/** Not in url_index by construction: the queue path. The share tests are what prove it. */
const UNKNOWN_URL = 'https://example.com/not-in-the-index';
const CANONICAL_STOP = urlFor(STOP.id, 'canonical');
const FRESH_DEMO = urlFor(PPN.id, 'fresh_demo');

/** The en pack's hero: what a pack switch has to land on, whichever narrative holds the slot. */
const EN_HERO = must(
  read<Feed>('packs/en/feed.json').items.find((item) => item.slot === 'hero'),
  'a hero item in the en feed',
).narrative_id;

// --- helpers -------------------------------------------------------------------------------

/** Boots /app and waits for the state-jump hook the matrix and these flows both ride. */
async function openApp(page: Page): Promise<void> {
  await page.goto('/app');
  await page.waitForFunction(() => typeof window.__mthGoto === 'function');
}

/** Jumps to a named state, failing by name when the shell cannot reach it. */
async function jump(page: Page, name: string): Promise<void> {
  await openApp(page);
  const reached = await page.evaluate((state: string) => window.__mthGoto?.(state) ?? false, name);
  expect(reached, `window.__mthGoto("${name}") returned false: that state does not exist yet`).toBe(true);
}

/** The autopsy for one narrative, through the permalink AC-APP-18 requires to hydrate anyway. */
async function openAutopsy(page: Page, id: string): Promise<void> {
  await page.goto(`/n/${id}`);
  await expect(page.locator('[data-screen="autopsy"]'), `/n/${id} must hydrate to the autopsy`).toBeVisible();
}

/**
 * Past the sparring gate to the panel stack, whatever gate this narrative carries.
 *
 * `data-panel` rather than `[data-el]`: every artifact names its own elements, so an element id
 * in a selector is a content string that stops matching on the next publish. `data-panel` is the
 * renderer's name for which grammar component it is, and the contract puts claim_map first in
 * every narrative.
 */
async function skipSparring(page: Page): Promise<void> {
  const skip = page.getByTestId('spar-skip');
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator('[data-panel="claim_map"]')).toBeVisible();
}

// --- AC-APP-2 -------------------------------------------------------------------------------

test.describe('AC-APP-2 onboarding end to end', () => {
  test('hello, language, regions, notification primer, iOS allow, auth, Radar', async ({ page }) => {
    await page.goto('/app');

    await expect(page.locator('[data-screen="onb-hello"]')).toBeVisible();
    await expect(page.getByTestId('greeting')).toBeVisible();
    await expect(page.locator('[data-screen="onb-hello"]')).toContainText(EN.tagline);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.locator('[data-screen="onb-lang"]')).toBeVisible();
    await expect(page.locator('[data-screen="onb-lang"]')).toContainText(EN.langTitle);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.locator('[data-screen="onb-regions"]')).toBeVisible();
    await expect(page.locator('[data-screen="onb-regions"]')).toContainText(EN.regionsTitle);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.locator('[data-screen="onb-notif"]')).toBeVisible();
    await expect(page.locator('[data-screen="onb-notif"]')).toContainText(EN.notifTitle);
    await page.getByRole('button', { name: EN.notifEnable }).click();

    await expect(page.locator('[data-sheet="ios-notif"]')).toBeVisible();
    await page.getByRole('button', { name: EN.iosAllow, exact: true }).click();

    await expect(page.locator('[data-screen="onb-auth"]')).toBeVisible();
    await expect(page.locator('[data-toast]')).toContainText(EN.toastNotifOn);
    expect(await page.evaluate(() => window.localStorage.getItem('mth:notif'))).toBe('on');

    await page.getByRole('button', { name: EN.authSkip }).click();
    await expect(page.locator('[data-screen="main-radar"]')).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('mth:onboarded'))).toBe('1');
  });

  test('the iOS deny path also lands on auth, and records the refusal', async ({ page }) => {
    await jump(page, 'onb.notif.ios-dialog');
    await page.getByRole('button', { name: EN.iosDeny }).click();

    await expect(page.locator('[data-screen="onb-auth"]')).toBeVisible();
    expect(await page.evaluate(() => window.localStorage.getItem('mth:notif'))).toBe('off');
    // Denying is not an error state and says nothing further about it.
    await expect(page.locator('[data-toast]')).toHaveCount(0);
  });

  test('the notification skip path reaches auth without touching the dialog', async ({ page }) => {
    await jump(page, 'onb.notif');
    await page.getByRole('button', { name: EN.notifSkip }).click();
    await expect(page.locator('[data-screen="onb-auth"]')).toBeVisible();
    await expect(page.locator('[data-sheet="ios-notif"]')).toHaveCount(0);
  });
});

// --- AC-APP-3 -------------------------------------------------------------------------------

/** Any wording that would claim a session this build does not have. */
const SIGNED_IN = /\bsigned in\b|\bsign out\b|\bsigned-in\b|\blog ?out\b|\blogged in\b|\bmy account\b|\bprofile\b/i;

test.describe('AC-APP-3 honest auth', () => {
  for (const provider of [EN.authApple, EN.authGoogle]) {
    test(`${provider} opens the honest sheet rather than a session`, async ({ page }) => {
      await jump(page, 'onb.auth');
      await page.getByRole('button', { name: provider }).click();

      const sheet = page.locator('[data-sheet="honest-auth"]');
      await expect(sheet).toBeVisible();
      await expect(sheet).toContainText(EN.sheetAuthTitle);
      await expect(sheet).toContainText(EN.sheetAuthBody);
      await expect(sheet).toContainText(EN.authSkip);
    });
  }

  test('the Settings account row still reads not-signed-in afterward', async ({ page }) => {
    await jump(page, 'onb.auth');
    await page.getByRole('button', { name: EN.authApple }).click();
    await page.locator('[data-sheet="honest-auth"]').getByRole('button', { name: EN.authSkip }).click();

    await expect(page.locator('[data-screen="main-radar"]')).toBeVisible();
    await page.locator('[data-tab="settings"]').click();

    const account = page.getByTestId('account-row');
    await expect(account).toBeVisible();
    await expect(account).not.toHaveText(SIGNED_IN);
  });

  test('no signed-in string renders in any reachable state', async ({ page }) => {
    const states = [
      'onb.auth',
      'onb.auth.honest-sheet',
      'radar.default',
      'dissect.default',
      'archive.default',
      'settings.default',
      'autopsy.default',
      'system.methodology',
      'system.notif-settings',
    ];
    for (const state of states) {
      await jump(page, state);
      const text = await page.locator('body').innerText();
      expect(text, `state ${state} renders a signed-in string`).not.toMatch(SIGNED_IN);
    }
    for (const route of ['/', '/methodology', `/n/${STOP.id}`, `/share?url=${encodeURIComponent(CANONICAL_STOP)}`]) {
      await page.goto(route);
      const text = await page.locator('body').innerText();
      expect(text, `route ${route} renders a signed-in string`).not.toMatch(SIGNED_IN);
    }
  });
});

// --- AC-APP-4 -------------------------------------------------------------------------------

test.describe('AC-APP-4 radar states', () => {
  test('hero card, compact cards, and the symmetry line render from feed.json', async ({ page }) => {
    await jump(page, 'radar.default');

    // The default app language is en and the default pack is id, so an id-pack narrative shows
    // its en headline with the EN <- ID translated marker. Two independent settings, on purpose.
    await expect(page.locator(`[data-feed-item="${STOP.id}"] .m-card`)).toBeVisible();
    await expect(page.locator(`[data-feed-item="${STOP.id}"]`)).toContainText(STOP.headline.en);
    await expect(page.locator(`[data-feed-item="${POISON.id}"] .m-card-c`)).toBeVisible();
    await expect(page.locator(`[data-feed-item="${POISON.id}"]`)).toContainText(POISON.headline.en);

    // The symmetry receipt is methodology.json's own derived spread, not a number typed here.
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(EN.symmetryLine);
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(EN.radarFooter);
  });

  test('the symmetry line opens the methodology screen', async ({ page }) => {
    await jump(page, 'radar.default');
    await page.getByRole('button', { name: EN.symmetryLine }).click();
    await expect(page.locator('[data-screen="methodology"]')).toBeVisible();
  });

  test('the region switcher opens its sheet over the feed', async ({ page }) => {
    await jump(page, 'radar.default');
    await page.getByTestId('region-switch').click();
    await expect(page.locator('[data-sheet="region"]')).toBeVisible();
    await expect(page.locator('[data-screen="main-radar"]')).toBeVisible();
  });

  test('the crisis-hold card renders as its own feed state', async ({ page }) => {
    await jump(page, 'radar.crisis-hold');
    const held = page.locator('[data-feed-item][data-crisis="1"]');
    await expect(held, 'a feed item carrying crisis_hold renders the crisis-hold card').toBeVisible();
  });

  test('the under-review chip renders from corrections.json', async ({ page }) => {
    // Whatever is open in the published log is what the strip must be carrying, summary for
    // summary. An empty log would leave nothing to assert, so that is a failure here too.
    const open = CORRECTIONS.entries.filter((entry) => entry.status === 'under_review');
    expect(open.length, 'corrections.json carries at least one open entry').toBeGreaterThan(0);

    await jump(page, 'radar.under-review');
    const chip = page.getByTestId('under-review-chip').first();
    await expect(chip).toBeVisible();
    for (const entry of open) {
      await expect(page.locator('[data-screen="main-radar"]')).toContainText(entry.summary.en);
    }
  });
});

// --- AC-APP-5 -------------------------------------------------------------------------------

test.describe('AC-APP-5 via-Dissect gating', () => {
  test('ppn-panic is absent from the initial Indonesia feed', async ({ page }) => {
    await jump(page, 'radar.default');
    await expect(page.locator(`[data-feed-item="${STOP.id}"]`)).toBeVisible();
    await expect(
      page.locator(`[data-feed-item="${PPN.id}"]`),
      `packs/id/feed.json marks ${PPN.id} via_dissect, so it is filtered out until the demo runs`,
    ).toHaveCount(0);
  });

  test('ppn-panic joins the feed with the via-Dissect chip after the fresh-demo flow', async ({ page }) => {
    await jump(page, 'dissect.default');
    await page.getByTestId('paste-box').fill(FRESH_DEMO);
    await page.getByTestId('paste-go').click();

    await expect(page.locator('[data-screen="progress"]')).toBeVisible();
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible({ timeout: 20_000 });

    await jump(page, 'radar.default');
    const item = page.locator(`[data-feed-item="${PPN.id}"]`);
    await expect(item).toBeVisible();
    await expect(item.getByTestId('via-dissect-chip')).toBeVisible();
  });
});

// --- AC-APP-6 -------------------------------------------------------------------------------

test.describe('AC-APP-6 dissect flows', () => {
  test('the cached chip opens the autopsy instantly with the cache toast', async ({ page }) => {
    await jump(page, 'dissect.default');
    await page.getByTestId('chip-cached').click();

    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await expect(page.locator('[data-toast]')).toContainText(FROZEN.cacheToast);
    // Instant means no staged progress at all, not a fast one.
    await expect(page.locator('[data-stage]')).toHaveCount(0);
  });

  test('the fresh chip runs four stages and states the honest line verbatim', async ({ page }) => {
    await jump(page, 'dissect.default');
    await page.getByTestId('chip-fresh').click();

    const progress = page.locator('[data-screen="progress"]');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(FROZEN.honestLine);
    await expect(progress.locator('[data-stage]'), 'the demo runs four stages').toHaveCount(4);

    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible({ timeout: 20_000 });
  });

  test('an unknown URL shows the queue state with no progress animation', async ({ page }) => {
    await jump(page, 'dissect.default');
    await page.getByTestId('paste-box').fill(UNKNOWN_URL);
    await page.getByTestId('paste-go').click();

    const queue = page.locator('[data-screen="queue"]');
    await expect(queue).toBeVisible();
    await expect(queue).toContainText(EN.queueTitle);
    await expect(queue).toContainText(FROZEN.queueBody);
    await expect(page.locator('[data-stage]'), 'nothing is invented while a link waits').toHaveCount(0);
    await expect(page.locator('[data-screen="progress"]')).toHaveCount(0);
    // The miss is recorded: the reader-demand queue the research desk counts carries the URL.
    const queued = await page.evaluate(() => localStorage.getItem('mth:queue') ?? '');
    expect(queued, 'the unresolved link joins the reader-demand queue').toContain(UNKNOWN_URL);
  });

  test('the third fresh attempt in a day opens the rate-limit sheet', async ({ page }) => {
    await jump(page, 'dissect.default');
    for (const attempt of [1, 2]) {
      await page.getByTestId('chip-fresh').click();
      await expect(page.locator('[data-screen="autopsy"]'), `attempt ${String(attempt)} runs`).toBeVisible({
        timeout: 20_000,
      });
      await jump(page, 'dissect.default');
    }
    await page.getByTestId('chip-fresh').click();
    await expect(page.locator('[data-sheet="rate-limit"]'), 'two fresh dissections a day').toBeVisible();
    await expect(page.locator('[data-screen="progress"]')).toHaveCount(0);
  });
});

// --- AC-APP-7 -------------------------------------------------------------------------------

test.describe('AC-APP-7 sparring S3', () => {
  test('the right path walks three questions to the diff card', async ({ page }) => {
    // The contract fixes three questions; the artifact fixes which three and which option is
    // right. Walking `Q` rather than three transcribed pairs is what keeps this true after a
    // republish, and what makes an artifact with two questions fail here rather than pass.
    expect(Q.length, 'the contract fixes S3 sparring at three questions').toBe(3);

    await openAutopsy(page, STOP.id);
    await expect(page.locator('[data-spar-dot]'), 'S3 is three questions').toHaveCount(3);

    for (const question of Q) {
      await expect(page.getByTestId('spar-q')).toContainText(question.q);
      await page.locator('[data-spar-option]', { hasText: question.right }).click();
      await expect(page.getByTestId('spar-note')).toContainText(question.note);
      await page.getByRole('button', { name: EN.continue }).click();
    }

    await expect(page.getByTestId('diff-card')).toBeVisible();
    await expect(page.locator('[data-panel="claim_map"]')).toBeVisible();
  });

  test('a wrong answer is marked wrong and still shows the note, without a verdict', async ({ page }) => {
    const first = must(Q[0], 'a first sparring question');
    await openAutopsy(page, STOP.id);

    const wrong = page.locator('[data-spar-option]', { hasText: first.wrong });
    await wrong.click();
    await expect(wrong).toHaveAttribute('data-answer', 'wrong');
    await expect(page.locator('[data-spar-option]', { hasText: first.right })).toHaveAttribute(
      'data-answer',
      'right',
    );
    await expect(page.getByTestId('spar-note')).toContainText(first.note);
    // Sparring corrects a move, it does not score a person.
    await expect(page.getByTestId('spar-note')).not.toHaveText(/\bwrong\b|\bincorrect\b|\bfailed\b/i);
  });

  test('Skip is visible and functional at every step', async ({ page }) => {
    for (const step of Q.keys()) {
      await openAutopsy(page, STOP.id);
      for (let advance = 0; advance < step; advance += 1) {
        await page.locator('[data-spar-option]').first().click();
        await page.getByRole('button', { name: EN.continue }).click();
      }
      const skip = page.getByTestId('spar-skip');
      await expect(skip, `Skip must be visible at question ${String(step + 1)}`).toBeVisible();
      await skip.click();
      await expect(page.locator('[data-panel="claim_map"]')).toBeVisible();
      await expect(page.getByTestId('spar-q')).toHaveCount(0);
    }
  });
});

// --- AC-APP-8 -------------------------------------------------------------------------------

/** The five demo override values, in the Settings order blueprint 3.2 item 9 fixes. */
const SCAFFOLDS = ['auto', 'S3', 'S2', 'S1', 'S0'] as const;

test.describe('AC-APP-8 S2, S1 and S0', () => {
  test('S2 shows exactly one question with a single dot', async ({ page }) => {
    await jump(page, 'settings.default');
    await page.locator('[data-scaffold-option="S2"]').click();

    await openAutopsy(page, STOP.id);
    await expect(page.getByTestId('spar-q')).toBeVisible();
    await expect(page.locator('[data-spar-dot]'), 'S2 is one rotating question, one dot').toHaveCount(1);

    await page.locator('[data-spar-option]').first().click();
    await page.getByRole('button', { name: EN.continue }).click();
    await expect(page.getByTestId('spar-q'), 'S2 does not ask a second').toHaveCount(0);
  });

  test('S1 shows the prediction tap', async ({ page }) => {
    // mbg-poisoning carries scaffold_default S1, so Auto reaches this without an override.
    expect(POISON.scaffold_default, 'this test needs the S1 narrative').toBe('S1');
    await openAutopsy(page, POISON.id);
    const prediction = page.getByTestId('prediction-tap');
    await expect(prediction).toBeVisible();
    await expect(prediction).toContainText(POISON.prediction_tap.prompt.en);
    await expect(page.getByTestId('spar-q')).toHaveCount(0);
  });

  test('S0 shows the autopsy directly with a working spar-on-demand chip', async ({ page }) => {
    // ppn-panic carries scaffold_default S0.
    expect(PPN.scaffold_default, 'this test needs the S0 narrative').toBe('S0');
    await openAutopsy(page, PPN.id);
    await expect(page.locator('[data-panel="claim_map"]')).toBeVisible();
    await expect(page.getByTestId('spar-q')).toHaveCount(0);

    const chip = page.getByTestId('spar-chip');
    await expect(chip).toBeVisible();
    await chip.click();
    await expect(page.getByTestId('spar-q')).toBeVisible();
  });

  test('the Settings override switches among all five', async ({ page }) => {
    await jump(page, 'settings.default');
    for (const level of SCAFFOLDS) {
      const option = page.locator(`[data-scaffold-option="${level}"]`);
      await expect(option, `the override offers ${level}`).toBeVisible();
      await option.click();
      await expect(option).toHaveAttribute('aria-pressed', 'true');
      for (const other of SCAFFOLDS.filter((o) => o !== level)) {
        await expect(page.locator(`[data-scaffold-option="${other}"]`)).toHaveAttribute('aria-pressed', 'false');
      }
    }
  });
});

// --- AC-APP-9 -------------------------------------------------------------------------------

test.describe('AC-APP-9 panel behaviors', () => {
  test('the money_flow stop toggle dims exactly the severed_if_stopped rows', async ({ page }) => {
    // Published mbg-stop carries both kinds of row, so "exactly" has two sides to check: the
    // severed set is struck and the unsevered set is not. A panel whose rows were all severed
    // would make the second half vacuous, so it is asserted rather than assumed.
    expect(SEVERED.length, 'mbg-stop money_flow has severed rows').toBeGreaterThan(0);
    expect(UNSEVERED.length, 'mbg-stop money_flow has a row a stop does not reach').toBeGreaterThan(0);

    await openAutopsy(page, STOP.id);
    await skipSparring(page);

    const flow = page.locator('[data-panel="money_flow"]');
    await expect(flow).toBeVisible();
    await expect(flow.locator('[data-strike="1"]'), 'nothing is struck before the toggle').toHaveCount(0);

    await flow.locator('[role="switch"]').click();
    const elsOf = async (strike: '0' | '1'): Promise<string[]> =>
      (
        await flow
          .locator(`[data-strike="${strike}"]`)
          .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-el') ?? ''))
      ).sort();
    expect(await elsOf('1'), 'the struck rows are the severed_if_stopped rows').toEqual(SEVERED);
    expect(await elsOf('0'), 'and nothing else is dimmed').toEqual(UNSEVERED);
  });

  test('dueling shows every institutional count with method and period', async ({ page }) => {
    await openAutopsy(page, POISON.id);
    await skipSparring(page);

    const duel = page.locator('[data-panel="dueling"]');
    await expect(duel).toBeVisible();
    expect(DUEL.counts.length, 'a dueling panel is 2 to 4 institutions').toBeGreaterThanOrEqual(2);
    for (const count of DUEL.counts) {
      const row = duel.locator(`[data-el="${count.el_id}"]`);
      await expect(row).toContainText(count.who);
      await expect(row).toContainText(count.value.display.en);
      await expect(row).toContainText(count.method.en);
      await expect(row).toContainText(count.period);
    }
    // No winner is chosen: the panel states the rule instead.
    await expect(duel).not.toHaveText(/\bcorrect count\b|\bthe real number\b|\bactually\b/i);
  });

  test('echo renders only on the narrative that carries one, and the silence state elsewhere', async ({ page }) => {
    const echo = must(PPN.echo, 'an echo panel on ppn-panic');
    expect(STOP.echo, 'mbg-stop is the silence case').toBeNull();

    await openAutopsy(page, PPN.id);
    await skipSparring(page);
    await expect(page.locator('[data-echo="cited"]')).toBeVisible();
    await expect(page.locator('[data-panel="echo"]')).toContainText(echo.current_motif.en);
    await expect(page.locator('[data-echo="silence"]')).toHaveCount(0);

    await openAutopsy(page, STOP.id);
    await skipSparring(page);
    await expect(page.locator('[data-echo="silence"]')).toBeVisible();
    await expect(page.locator('[data-echo="cited"]')).toHaveCount(0);
  });
});

// --- AC-APP-10 ------------------------------------------------------------------------------

test.describe('AC-APP-10 narration binding', () => {
  test('tapping a sentence highlights its els, and a second tap clears them', async ({ page }) => {
    await openAutopsy(page, STOP.id);
    await skipSparring(page);

    const sentence = page.locator('[data-sent]', { hasText: V1.text }).first();
    await expect(sentence).toBeVisible();
    await expect(page.locator('[data-hl]')).toHaveCount(0);

    await sentence.click();
    await expect(sentence).toHaveAttribute('data-sent', 'on');
    for (const el of V1.els) {
      await expect(page.locator(`[data-el="${el}"]`), `sentence ${V1.id} highlights ${el}`).toHaveAttribute(
        'data-hl',
        '1',
      );
    }
    // Only its own els: the elements of a sentence that shares none of them stay dark.
    for (const el of V_OTHER.els) {
      await expect(page.locator(`[data-el="${el}"]`)).not.toHaveAttribute('data-hl', '1');
    }

    await sentence.click();
    await expect(sentence).toHaveAttribute('data-sent', 'off');
    await expect(page.locator('[data-hl="1"]')).toHaveCount(0);
  });

  test('tapping a count chip highlights every element of that status', async ({ page }) => {
    // The hidden column IS counts.hidden, by the 6.5 derivation. Asserting that first is what
    // makes the loop below a check on the app rather than a restatement of the artifact.
    expect(HIDDEN_ELS.length, 'the hidden column is counts.hidden').toBe(STOP.counts.hidden);

    await openAutopsy(page, STOP.id);
    await skipSparring(page);

    await page.locator('[data-st="hidden"]').first().click();
    for (const el of HIDDEN_ELS) {
      await expect(page.locator(`[data-el="${el}"]`), `the hidden chip highlights ${el}`).toHaveAttribute('data-hl', '1');
    }
    // An edge is not a hidden entry, and this chip must not light one.
    await expect(page.locator(`[data-el="${NOT_HIDDEN_EL}"]`)).not.toHaveAttribute('data-hl', '1');
  });
});

// --- AC-APP-11 ------------------------------------------------------------------------------

interface SheetCase {
  from: string;
  narrative: string;
  el: string;
  /** the quote, the value, the resolved source line and the rationale, per AC-APP-11 */
  fragments: string[];
}

/** The first element of each kind the artifacts carry, with the text its sheet must show. */
const NODE = must(
  STOP_CLAIM.spine.find((node) => node.value !== undefined),
  'a claim-map node carrying a value in mbg-stop',
);
const EDGE = must(STOP_CLAIM.edges[0], 'a claim-map edge in mbg-stop');
const HIDDEN = must(
  STOP_CLAIM.hidden.find((entry) => entry.ev !== undefined),
  'a hidden branch with evidence in mbg-stop',
);
const SEGMENT = must(STOP_SCALE.segments[0], 'a scale segment in mbg-stop');
const COUNT = must(DUEL.counts[0], 'a dueling count in mbg-poisoning');

/**
 * One opening per kind of tap target blueprint AC-APP-11 names, every fragment read off the
 * artifact the sheet is rendering. Nothing here is a transcription, so a re-analysed narrative
 * moves the element, the quote and the publisher together and this stays a real check.
 */
const EVIDENCE: SheetCase[] = [
  {
    from: 'a claim-map node',
    narrative: STOP.id,
    el: NODE.el_id,
    fragments: [
      NODE.label.en,
      must(NODE.value, 'the node value').display.en,
      publisherOf(must(NODE.value, 'the node value').source_id),
    ],
  },
  {
    from: 'a claim-map edge',
    narrative: STOP.id,
    el: EDGE.el_id,
    fragments: [EDGE.ev.quote, EDGE.ev.why.en],
  },
  {
    from: 'a hidden branch',
    narrative: STOP.id,
    el: HIDDEN.el_id,
    fragments: [
      HIDDEN.label.en,
      HIDDEN.why_hidden.en,
      must(HIDDEN.ev, 'the hidden entry evidence').quote,
      publisherOf(must(HIDDEN.ev, 'the hidden entry evidence').source_id),
    ],
  },
  {
    from: 'a scale segment',
    narrative: STOP.id,
    el: SEGMENT.el_id,
    fragments: [SEGMENT.label.en, SEGMENT.value.display.en, publisherOf(SEGMENT.value.source_id)],
  },
  {
    from: 'a dueling count',
    narrative: POISON.id,
    el: COUNT.el_id,
    fragments: [COUNT.who, COUNT.method.en, COUNT.period, publisherOf(COUNT.value.source_id)],
  },
];

test.describe('AC-APP-11 evidence sheets everywhere', () => {
  for (const c of EVIDENCE) {
    test(`opens from ${c.from} in ${c.narrative}`, async ({ page }) => {
      await openAutopsy(page, c.narrative);
      await skipSparring(page);
      await expect(page.getByTestId('evidence-sheet')).toHaveCount(0);

      await page.locator(`[data-el="${c.el}"]`).click();

      const sheet = page.getByTestId('evidence-sheet');
      await expect(sheet).toBeVisible();
      await expect(sheet).toHaveAttribute('role', 'dialog');
      for (const fragment of c.fragments) await expect(sheet).toContainText(fragment);
    });
  }

  test('opens from a technique tag', async ({ page }) => {
    const tag = must(STOP.tags[0], 'a technique tag on mbg-stop');
    await openAutopsy(page, STOP.id);
    await skipSparring(page);
    await page.locator(`[data-tag="${tag}"]`).first().click();
    const sheet = page.getByTestId('evidence-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('role', 'dialog');
    // The vocabulary is locked in contracts/technique-tags.json; the sheet names the tag it opened.
    await expect(sheet).toContainText(tag);
  });
});

// --- AC-APP-12 ------------------------------------------------------------------------------

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test.describe('AC-APP-12 Nuance Card export', () => {
  for (const template of ['story', 'chat'] as const) {
    test(`the ${template} template exports a PNG`, async ({ page }) => {
      await jump(page, `autopsy.nuance.${template}`);

      const overlay = page.locator(`[data-sheet="nuance-${template}"]`);
      await expect(overlay).toBeVisible();
      // Appendix C: no template variant may omit the counts row.
      await expect(overlay.locator('[data-st]').first()).toBeVisible();
      await expect(overlay).toContainText(`/n/${STOP.id}`);

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        overlay.getByTestId('nuance-export').click(),
      ]);
      expect(download.suggestedFilename()).toMatch(/\.png$/);

      const file = await download.path();
      expect(file, 'the export produced a file').toBeTruthy();
      const bytes = readFileSync(String(file));
      expect(bytes.subarray(0, 8), 'the export is a real PNG').toEqual(PNG_MAGIC);
      expect(bytes.byteLength, 'a rendered card is not an empty canvas').toBeGreaterThan(10_000);
    });
  }
});

// --- AC-APP-13 ------------------------------------------------------------------------------

test.describe('AC-APP-13 share-target resolution', () => {
  test('a canonical URL resolves to the cached autopsy', async ({ page }) => {
    await page.goto(`/share?url=${encodeURIComponent(CANONICAL_STOP)}`);
    await expect(page.getByTestId('share-decision')).toContainText(STOP.id);
    await expect(page.getByTestId('share-decision')).toContainText('exact');
  });

  test('a text param carrying the URL resolves too', async ({ page }) => {
    await page.goto(`/share?title=Shared&text=${encodeURIComponent(`Look at this ${CANONICAL_STOP}`)}`);
    await expect(page.getByTestId('share-decision')).toContainText(STOP.id);
  });

  test('an unknown URL routes to the queue state', async ({ page }) => {
    await page.goto(`/share?url=${encodeURIComponent(UNKNOWN_URL)}`);
    await expect(page.locator('[data-screen="queue"]')).toBeVisible();
    await expect(page.locator('[data-screen="queue"]')).toContainText(EN.queueTitle);
  });

  test('the fresh_demo URL routes to the progress flow', async ({ page }) => {
    await page.goto(`/share?url=${encodeURIComponent(FRESH_DEMO)}`);
    const progress = page.locator('[data-screen="progress"]');
    await expect(progress).toBeVisible();
    await expect(progress).toContainText(FROZEN.honestLine);
  });

  test('a script payload in the params renders escaped', async ({ page }) => {
    const payload = '<script>window.__mthPwned = true;</script>';
    await page.goto(`/share?title=${encodeURIComponent(payload)}&text=${encodeURIComponent('<img src=x onerror=1>')}`);

    const params = page.getByTestId('share-params');
    // The payload is on screen as characters, which is the proof that it is text.
    await expect(params).toContainText(payload);
    expect(
      await page.evaluate(() => (window as unknown as Record<string, unknown>).__mthPwned ?? false),
      'the payload executed',
    ).toBe(false);
    expect(
      await params.evaluate((node) => node.querySelectorAll('script, img').length),
      'the payload became markup',
    ).toBe(0);
  });
});

// --- AC-APP-14 ------------------------------------------------------------------------------

test.describe('AC-APP-14 region and language switching', () => {
  test('a region switch swaps the feed in under 300 ms of scripting, with no network', async ({ page }) => {
    await jump(page, 'radar.default');
    await expect(page.locator(`[data-feed-item="${STOP.id}"]`)).toBeVisible();

    // The warm-up prefetch has already resolved both packs, so the switch is a cache read.
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.getByTestId('pack-switch').click();
    await expect(page.locator(`[data-feed-item="${EN_HERO}"]`)).toBeVisible();

    const ms = await page.evaluate(() => {
      try {
        return performance.measure('mth:pack', 'mth:pack:start', 'mth:pack:end').duration;
      } catch {
        // The marks are the contract: without them there is no scripting-time evidence at all.
        return -1;
      }
    });
    expect(ms, 'the pack switch must bracket itself with performance marks mth:pack:start and mth:pack:end').toBeGreaterThanOrEqual(0);
    expect(ms, 'a warm pack switch costs under 300 ms of scripting').toBeLessThan(300);
    expect(
      requests.filter((url) => url.endsWith('.json')),
      'a warm pack switch fetches nothing',
    ).toEqual([]);
  });

  test('the language toggle re-renders both the chrome and the narration', async ({ page }) => {
    const claim = page.locator('[data-panel="claim_map"]');
    const spine = must(STOP_CLAIM.spine[0], 'the first mbg-stop spine node');
    const narrationId = must(STOP.narration.id.sentences[0], 'an ID narration sentence in mbg-stop');

    await openAutopsy(page, STOP.id);
    await skipSparring(page);
    await expect(claim).toContainText(spine.label.en);

    await jump(page, 'settings.default');
    await page.locator('[data-lang-option="id"]').click();

    await jump(page, 'radar.default');
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(ID.radarFooter);
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(ID.symmetryLine);
    await expect(page.locator('[data-tab="settings"]')).toContainText(ID.tabSettings);
    // Content follows the app language too: the same card now draws its id headline.
    await expect(page.locator(`[data-feed-item="${STOP.id}"]`)).toContainText(
      must(STOP.headline.id, 'an ID headline for mbg-stop'),
    );

    await openAutopsy(page, STOP.id);
    await skipSparring(page);
    // Narration is content, localized inside the artifact rather than in the bundle.
    await expect(page.locator('[data-sent]').first()).toContainText(narrationId.text);
    await expect(claim).toContainText(spine.label.id);
  });
});

// --- AC-APP-17 ------------------------------------------------------------------------------

test.describe('AC-APP-17 offline', () => {
  test.fixme(
    process.env.MTH_PREVIEW === undefined,
    'offline needs the real service worker: runs under tests/e2e/preview.config.ts, which builds and previews with the SW registered.',
  );

  test('a cached /app reloads offline', async ({ page, context }) => {
    await page.goto('/app');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('[data-screen^="main-"], [data-screen^="onb-"]').first()).toBeVisible();
  });

  test('a visited /n/{id} reloads offline', async ({ page, context }) => {
    await page.goto('/app');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await page.goto(`/n/${STOP.id}`);
    await expect(page.getByTestId('permalink-card')).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('permalink-card')).toBeVisible();
  });

  test('an uncached route renders the offline fallback', async ({ page, context }) => {
    await page.goto('/app');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    await context.setOffline(true);
    await page.goto('/n/never-visited-before');
    await expect(page.getByTestId('route-offline')).toBeVisible();
  });
});

// --- AC-APP-18 ------------------------------------------------------------------------------

test.describe('AC-APP-18 permalinks', () => {
  test(`/n/${STOP.id} serves a shell whose og tags parse`, async ({ page }) => {
    const response = await page.request.get(`/n/${STOP.id}`);
    expect(response.status()).toBe(200);
    const html = await response.text();

    const meta = (property: string): string => {
      const match = new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
        'i',
      ).exec(html);
      expect(match, `${property} is present in the /n/${STOP.id} shell`).not.toBeNull();
      return match?.[1] ?? '';
    };

    expect(meta('og:title')).toMatch(/ · Matterhorn$/);
    expect(
      meta('og:title').includes(STOP.headline.en) || meta('og:title').includes(STOP.headline.id ?? '\0'),
      'og:title carries the narrative headline',
    ).toBe(true);
    // Blueprint 6.7, FROZEN template over mbg-stop's own derived counts, verdict-free by construction.
    expect(meta('og:description')).toBe(FROZEN.ogDescription);
    expect(meta('og:image')).toMatch(/^https?:\/\/|^\//);
    expect(meta('og:url')).toContain(`/n/${STOP.id}`);
    expect(html).toMatch(/<title>[^<]*Matterhorn[^<]*<\/title>/i);
  });

  test(`/n/${STOP.id} hydrates to the full autopsy`, async ({ page }) => {
    await page.goto(`/n/${STOP.id}`);
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await expect(page.getByTestId('permalink-card')).toContainText(STOP.headline.en);
    await skipSparring(page);
    await expect(page.locator('[data-panel="claim_map"]')).toBeVisible();
    await expect(page.locator('[data-panel="money_flow"]')).toBeVisible();
  });
});

// --- AC-APP-19 ------------------------------------------------------------------------------

test.describe('AC-APP-19 methodology and 404', () => {
  test('/methodology renders policy 6.5 verbatim, the symmetry receipt, the disclosure and the changelog', async ({
    page,
  }) => {
    await page.goto('/methodology');

    await expect(page.getByTestId('policy-65')).toHaveText(METHODOLOGY.policy_65.en);
    await expect(page.getByTestId('methodology-disclosure')).toHaveText(METHODOLOGY.disclosure.en);

    // The receipt is methodology.json's own derived spread, and the page prints each lean with
    // its share of the total. Recomputing the share here is what makes this a check on the
    // rendering rather than a second copy of the number.
    const receipt = page.getByTestId('methodology-symmetry');
    const total = SYM.gov + SYM.neutral + SYM.opp;
    for (const lean of [SYM.gov, SYM.neutral, SYM.opp]) {
      await expect(receipt).toContainText(`${String(lean)} · ${((lean / total) * 100).toFixed(1)}%`);
    }

    // Every published correction, whatever the log holds. An empty log is a failure: AC-APP-19
    // asks for the changelog, and a page with nothing on it would satisfy a weaker assertion.
    expect(CORRECTIONS.entries.length, 'corrections.json carries a changelog').toBeGreaterThan(0);
    const log = page.getByTestId('corrections-log');
    for (const entry of CORRECTIONS.entries) {
      await expect(log).toContainText(entry.summary.en);
      await expect(log).toContainText(entry.date);
    }
  });

  test('an unknown route renders the 404', async ({ page }) => {
    await page.goto('/no-such-page');
    await expect(page.getByTestId('route-notfound')).toBeVisible();
    await expect(page.locator('body')).toContainText(EN.notFoundTitle);
  });
});

// --- AC-APP-20 ------------------------------------------------------------------------------

test.describe('AC-APP-20 notification settings and preview', () => {
  test('the cap and quiet hours persist across a reload', async ({ page }) => {
    await jump(page, 'system.notif-settings');

    await page.getByTestId('notif-cap').selectOption('1');
    await page.getByTestId('notif-quiet-start').fill('22:00');

    await page.reload();
    await page.waitForFunction(() => typeof window.__mthGoto === 'function');
    await page.evaluate(() => window.__mthGoto?.('system.notif-settings'));

    await expect(page.getByTestId('notif-cap')).toHaveValue('1');
    await expect(page.getByTestId('notif-quiet-start')).toHaveValue('22:00');
  });

  test('the preview row fires a notification on the autopsy-first template', async ({ page, context }) => {
    await context.grantPermissions(['notifications']);
    // Both paths are recorded: the service worker registration under a real SW, and the page
    // constructor without one. The surface may take either; it may not take neither.
    await page.addInitScript(() => {
      const seen: Array<{ title: string; body: string }> = [];
      (window as unknown as Record<string, unknown>).__mthNotifications = seen;
      const record = (title: string, options?: { body?: string }): void => {
        seen.push({ title, body: options?.body ?? '' });
      };
      if ('ServiceWorkerRegistration' in window) {
        ServiceWorkerRegistration.prototype.showNotification = function showNotification(
          title: string,
          options?: NotificationOptions,
        ) {
          record(title, options);
          return Promise.resolve();
        };
      }
      class Recorder {
        constructor(title: string, options?: NotificationOptions) {
          record(title, options);
        }
        static permission = 'granted';
        static requestPermission(): Promise<string> {
          return Promise.resolve('granted');
        }
      }
      (window as unknown as Record<string, unknown>).Notification = Recorder;
    });

    await jump(page, 'system.notif-settings');
    await page.getByTestId('notif-preview').click();

    const fired = await page.evaluate(
      () => (window as unknown as { __mthNotifications: Array<{ title: string; body: string }> }).__mthNotifications,
    );
    expect(fired.length, 'the preview row fires exactly one notification').toBe(1);
    // Appendix C autopsy-first template: title "New dissection · {pack_label}",
    // body "{headline_short} · {top_tag} · {missing} missing links · {hidden} hidden stakeholders".
    expect(fired[0]?.title).toBe(FROZEN.notifTitle);
    expect(fired[0]?.body).toMatch(/·/);
    expect(fired[0]?.body).toMatch(/\d+ missing links/);
    expect(fired[0]?.body).toMatch(/\d+ hidden stakeholders/);
  });
});

// --- docs/replay-protocol.md ------------------------------------------------------------------

/** The map the protocol persists the badge in, and the flag the feed join is remembered by. */
const readKey = (page: Page, key: string): Promise<string | null> =>
  page.evaluate((name: string) => window.localStorage.getItem(name), key);

test.describe('docs/replay-protocol.md, the update receiver', () => {
  test('the same-machine channel badges the feed card, toasts, and persists', async ({ page }) => {
    await jump(page, 'radar.default');

    // A second BroadcastChannel object in the page, because the protocol's sender is the research
    // desk in another tab and a channel never delivers to the object that posted.
    await page.evaluate((id: string) => {
      new BroadcastChannel('mth-updates').postMessage({
        type: 'published',
        narrative_id: id,
        at: new Date().toISOString(),
      });
    }, STOP.id);

    await expect(page.locator('[data-toast="1"]')).toHaveText(EN.toastUpdated);
    const card = page.locator(`[data-feed-item="${STOP.id}"]`);
    await expect(card.getByTestId('updated-badge')).toHaveText(EN.badgeUpdated);
    await expect
      .poll(() => readKey(page, 'mth:updated'), { message: 'the badge survives a reload until it is read' })
      .toContain(STOP.id);
  });

  test('the QR door badges the provenance line, joins the feed, and is consumed by the read', async ({ page }) => {
    // No server can push to a second device, so `?published=1` IS the cross-device channel.
    await page.goto(`/n/${PPN.id}?published=1`);
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();

    await expect(page.locator('.m-provline').getByTestId('updated-badge')).toHaveText(EN.badgeUpdated);
    await expect
      .poll(() => readKey(page, 'mth:updated'), { message: 'opening the autopsy consumes the badge' })
      .not.toContain(PPN.id);
    await expect
      .poll(() => readKey(page, 'mth:via'), { message: `${PPN.id} is via_dissect, so a publish opens the feed too` })
      .toBe('1');

    // The same join the fresh-dissect demo produces, reached through the other door.
    await jump(page, 'radar.default');
    const item = page.locator(`[data-feed-item="${PPN.id}"]`);
    await expect(item).toBeVisible();
    await expect(item.getByTestId('via-dissect-chip')).toBeVisible();
    await expect(item.getByTestId('updated-badge'), 'a consumed badge does not come back').toHaveCount(0);
  });
});
