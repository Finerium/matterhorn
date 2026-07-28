/**
 * PROVES: AC-APP-2 onboarding, 3 honest auth, 4 radar states, 5 via-Dissect gating,
 *         6 dissect flows, 7 sparring S3, 8 S2/S1/S0 and the override, 9 panel behaviors,
 *         10 narration binding, 11 evidence sheets everywhere, 12 Nuance Card export,
 *         13 share-target resolution, 14 region and language switching, 17 offline,
 *         18 permalinks, 19 methodology and 404, 20 notification preview.
 *         AC-APP-22 rides along through guardConsole().
 *
 * Post-install home: tests/e2e/flows.spec.ts. Config: tests/e2e/app.config.ts, which serves
 * `vite app` in SEED MODE, so every string below is a tests/fixtures/seed value or an
 * app/src/i18n bundle value, quoted verbatim. A fixture edit is meant to show up here as a
 * failure rather than as a silently weaker test, which is the Gate 2 house rule.
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
 *
 * The autopsy is opened by `/n/{id}` throughout, because AC-APP-18 requires that route to
 * hydrate to the full autopsy anyway. One opener, four narratives, no second mechanism.
 */
import { readFileSync } from 'node:fs';

import { expect, test, type Page } from '@playwright/test';

import { guardConsole } from './console-collector';

guardConsole();

// --- verbatim strings ---------------------------------------------------------------------

/** app/src/i18n/en.json */
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
  symmetryLine: 'Symmetry 4·2·4 →',
  queueTitle: 'Queued to the private agent fleet',
  notFoundTitle: 'No such page',
} as const;

/** app/src/i18n/id.json, for the language toggle. */
const ID = {
  tabSettings: 'Pengaturan',
  radarFooter: 'Disajikan dari cache. Tidak ada model di jalur baca.',
  symmetryLine: 'Simetri 4·2·4 →',
} as const;

/** Blueprint Appendix C, FROZEN microcopy. */
const FROZEN = {
  cacheToast: 'Served from the shared cache · computed ',
  honestLine: 'Fresh dissections usually take up to 3 minutes. This demo compresses the wait.',
  queueBody:
    'This link is new to the archive. Fresh dissections are produced by the editorial fleet and land in the next cycle. Nothing is invented in the meantime.',
  notifTitle: 'New dissection · Indonesia',
  /** blueprint 6.7 permalink shell, FROZEN: counts summary, verdict-free. */
  ogDescription:
    '1 missing links · 1 unsourced assumptions · 4 hidden stakeholders. No verdicts. See the structure.',
} as const;

/** tests/fixtures/seed */
const SEED = {
  stopHeadlineEn: 'Stop MBG Permanently to Save the State Budget',
  stopHeadlineId: 'Setop MBG Permanen demi Selamatkan APBN',
  poisoningHeadlineEn: 'BGN Chief: MBG Poisoning Victims Reach 6,517',
  canonicalStop: 'https://www.tribunnews.com/nasional/7844542',
  freshDemo:
    'https://www.antaranews.com/berita/4559522/kemenkeu-rilis-aturan-ppn-12-persen-hanya-untuk-barang-mewah',
  unknownUrl: 'https://example.com/not-in-the-index',
  /** mbg-stop money_flow: every row carries severed_if_stopped true. */
  severedRows: ['m1', 'm2', 'm3', 'm4'],
  /** mbg-stop narration, EN. */
  sentence1: 'The budget arithmetic itself checks out: stopping MBG frees up to Rp88.15T a year.',
  sentence1Els: ['p-claim', 'n1', 'n2'],
  sentence3Els: ['h0', 'h1', 'h2', 'h3'],
  /** mbg-stop sparring, EN. */
  q1: 'The claim is that stopping MBG saves the economy. What mechanism does the story state?',
  q1Right: 'It never states one',
  q1Wrong: 'Unspent funds are reallocated to productive sectors',
  q1Note:
    'No article in this family states a pathway from unspent funds to growth. The claim map renders that as a gap.',
  q2: 'Rp88.15T sounds enormous. Against what should it be read?',
  q2Right: 'Total 2026 state spending, Rp3,786.5T in the draft architecture',
  q3: 'If MBG stops today, who pays first?',
  q3Right: 'Kitchens, suppliers and 1.28M program workers, within weeks',
  q3Note:
    '29,679 kitchens and 142,387 supplier contracts absorb the shock in weeks; any fiscal benefit is diffuse and delayed.',
  /** mbg-poisoning prediction tap and dueling counts, EN. */
  predictionPrompt: 'Before the reveal: where is the weakest edge? Tap it.',
  duel: [
    {
      el: 'd0',
      who: 'BGN',
      count: '6,517 cases',
      method: 'Running count of verified case reports, stated to a parliamentary commission.',
      period: 'since January 2025, stated 1 Oct 2025',
    },
    {
      el: 'd1',
      who: 'BPOM',
      count: '9,089 cases',
      method: 'Food safety outbreak intake across districts and provinces.',
      period: 'as of 1 Oct 2025',
    },
    {
      el: 'd2',
      who: 'JPPI',
      count: '8,649 cases',
      method: 'Civil society network tally collected from member reports.',
      period: 'per 27 Sep 2025',
    },
  ],
  /** ppn-panic echo. */
  echoMotif: 'A restricted measure narrated as universal, with the alarm outliving the clarification.',
  /** methodology.json, EN. */
  policy65:
    'Matterhorn takes no position on whether any protest, boycott, or campaign should happen. Echo surfaces the documented costs of acting on broken causal models; it never frames collective action itself as the harm. Protest can be legitimate on imperfect information; the product’s contribution is that participants and observers see the structure of what they are being told.',
  disclosure:
    'Every dissection on this page was produced by an automated agent fleet and is labelled as such. Each artifact names the models that generated it, and the analysis is computed once, before anyone asks for it. These seed artifacts were transcribed from the design fixture data and are not published analysis.',
  /** corrections.json, EN. */
  correctionUnderReview:
    'The claim that MBG absorbs 1.28M workers was flagged by BGN. The entry stays open while the figure is re-read, and the review chip was visible within 24 hours.',
  correctionCorrected:
    'The net deposit figure in the judol dissection was updated to the PPATK Q1 2026 series, and the correction was published with equal prominence.',
} as const;

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

/** Past the sparring gate to the panel stack, whatever gate this narrative carries. */
async function skipSparring(page: Page): Promise<void> {
  const skip = page.getByTestId('spar-skip');
  if (await skip.isVisible()) await skip.click();
  await expect(page.locator('[data-el="p-claim"], [data-el="p-duel"], [data-el="p-scale"]').first()).toBeVisible();
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
    for (const route of ['/', '/methodology', '/n/mbg-stop', '/share?url=' + encodeURIComponent(SEED.canonicalStop)]) {
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
    await expect(page.locator('[data-feed-item="mbg-stop"] .m-card')).toBeVisible();
    await expect(page.locator('[data-feed-item="mbg-stop"]')).toContainText(SEED.stopHeadlineEn);
    await expect(page.locator('[data-feed-item="mbg-poisoning"] .m-card-c')).toBeVisible();
    await expect(page.locator('[data-feed-item="mbg-poisoning"]')).toContainText(SEED.poisoningHeadlineEn);

    // The symmetry receipt is computed from methodology.json: gov 4, neutral 2, opp 4.
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
    await jump(page, 'radar.under-review');
    // corrections.json carries mbg-jobs with status under_review and this summary.
    const chip = page.getByTestId('under-review-chip').first();
    await expect(chip).toBeVisible();
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(SEED.correctionUnderReview);
  });
});

// --- AC-APP-5 -------------------------------------------------------------------------------

test.describe('AC-APP-5 via-Dissect gating', () => {
  test('ppn-panic is absent from the initial Indonesia feed', async ({ page }) => {
    await jump(page, 'radar.default');
    await expect(page.locator('[data-feed-item="mbg-stop"]')).toBeVisible();
    await expect(
      page.locator('[data-feed-item="ppn-panic"]'),
      'packs/id/feed.json marks ppn-panic via_dissect, so it is filtered out until the demo runs',
    ).toHaveCount(0);
  });

  test('ppn-panic joins the feed with the via-Dissect chip after the fresh-demo flow', async ({ page }) => {
    await jump(page, 'dissect.default');
    await page.getByTestId('paste-box').fill(SEED.freshDemo);
    await page.getByTestId('paste-go').click();

    await expect(page.locator('[data-screen="progress"]')).toBeVisible();
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible({ timeout: 20_000 });

    await jump(page, 'radar.default');
    const item = page.locator('[data-feed-item="ppn-panic"]');
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
    await page.getByTestId('paste-box').fill(SEED.unknownUrl);
    await page.getByTestId('paste-go').click();

    const queue = page.locator('[data-screen="queue"]');
    await expect(queue).toBeVisible();
    await expect(queue).toContainText(EN.queueTitle);
    await expect(queue).toContainText(FROZEN.queueBody);
    await expect(page.locator('[data-stage]'), 'nothing is invented while a link waits').toHaveCount(0);
    await expect(page.locator('[data-screen="progress"]')).toHaveCount(0);
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
    await openAutopsy(page, 'mbg-stop');

    await expect(page.getByTestId('spar-q')).toContainText(SEED.q1);
    await expect(page.locator('[data-spar-dot]'), 'S3 is three questions').toHaveCount(3);
    await page.locator('[data-spar-option]', { hasText: SEED.q1Right }).click();
    await expect(page.getByTestId('spar-note')).toContainText(SEED.q1Note);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.getByTestId('spar-q')).toContainText(SEED.q2);
    await page.locator('[data-spar-option]', { hasText: SEED.q2Right }).click();
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.getByTestId('spar-q')).toContainText(SEED.q3);
    await page.locator('[data-spar-option]', { hasText: SEED.q3Right }).click();
    await expect(page.getByTestId('spar-note')).toContainText(SEED.q3Note);
    await page.getByRole('button', { name: EN.continue }).click();

    await expect(page.getByTestId('diff-card')).toBeVisible();
    await expect(page.locator('[data-el="p-claim"]')).toBeVisible();
  });

  test('a wrong answer is marked wrong and still shows the note, without a verdict', async ({ page }) => {
    await openAutopsy(page, 'mbg-stop');

    const wrong = page.locator('[data-spar-option]', { hasText: SEED.q1Wrong });
    await wrong.click();
    await expect(wrong).toHaveAttribute('data-answer', 'wrong');
    await expect(page.locator('[data-spar-option]', { hasText: SEED.q1Right })).toHaveAttribute(
      'data-answer',
      'right',
    );
    await expect(page.getByTestId('spar-note')).toContainText(SEED.q1Note);
    // Sparring corrects a move, it does not score a person.
    await expect(page.getByTestId('spar-note')).not.toHaveText(/\bwrong\b|\bincorrect\b|\bfailed\b/i);
  });

  test('Skip is visible and functional at every step', async ({ page }) => {
    for (const step of [0, 1, 2]) {
      await openAutopsy(page, 'mbg-stop');
      for (let advance = 0; advance < step; advance += 1) {
        await page.locator('[data-spar-option]').first().click();
        await page.getByRole('button', { name: EN.continue }).click();
      }
      const skip = page.getByTestId('spar-skip');
      await expect(skip, `Skip must be visible at question ${String(step + 1)}`).toBeVisible();
      await skip.click();
      await expect(page.locator('[data-el="p-claim"]')).toBeVisible();
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

    await openAutopsy(page, 'mbg-stop');
    await expect(page.getByTestId('spar-q')).toBeVisible();
    await expect(page.locator('[data-spar-dot]'), 'S2 is one rotating question, one dot').toHaveCount(1);

    await page.locator('[data-spar-option]').first().click();
    await page.getByRole('button', { name: EN.continue }).click();
    await expect(page.getByTestId('spar-q'), 'S2 does not ask a second').toHaveCount(0);
  });

  test('S1 shows the prediction tap', async ({ page }) => {
    // mbg-poisoning carries scaffold_default S1, so Auto reaches this without an override.
    await openAutopsy(page, 'mbg-poisoning');
    const prediction = page.getByTestId('prediction-tap');
    await expect(prediction).toBeVisible();
    await expect(prediction).toContainText(SEED.predictionPrompt);
    await expect(page.getByTestId('spar-q')).toHaveCount(0);
  });

  test('S0 shows the autopsy directly with a working spar-on-demand chip', async ({ page }) => {
    // ppn-panic carries scaffold_default S0.
    await openAutopsy(page, 'ppn-panic');
    await expect(page.locator('[data-el="p-claim"]')).toBeVisible();
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
    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);

    const flow = page.locator('[data-el="p-flow"]');
    await expect(flow).toBeVisible();
    await expect(flow.locator('[data-strike="1"]'), 'nothing is struck before the toggle').toHaveCount(0);

    await flow.locator('[role="switch"]').click();
    // Every mbg-stop row carries severed_if_stopped true, so the exact set is all four.
    const struck = await flow
      .locator('[data-strike="1"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-el') ?? ''));
    expect(struck.sort((a, b) => a.localeCompare(b))).toEqual([...SEED.severedRows]);
    await expect(flow.locator('[data-strike="0"]'), 'no unsevered row is dimmed').toHaveCount(0);
  });

  test('dueling shows all three institutional counts with method and period', async ({ page }) => {
    await openAutopsy(page, 'mbg-poisoning');
    await skipSparring(page);

    const duel = page.locator('[data-el="p-duel"]');
    await expect(duel).toBeVisible();
    for (const count of SEED.duel) {
      const row = duel.locator(`[data-el="${count.el}"]`);
      await expect(row).toContainText(count.who);
      await expect(row).toContainText(count.count);
      await expect(row).toContainText(count.method);
      await expect(row).toContainText(count.period);
    }
    // No winner is chosen: the panel states the rule instead.
    await expect(duel).not.toHaveText(/\bcorrect count\b|\bthe real number\b|\bactually\b/i);
  });

  test('echo renders only on ppn-panic, and the silence state elsewhere', async ({ page }) => {
    await openAutopsy(page, 'ppn-panic');
    await skipSparring(page);
    await expect(page.locator('[data-echo="cited"]')).toBeVisible();
    await expect(page.locator('[data-el="p-echo"]')).toContainText(SEED.echoMotif);
    await expect(page.locator('[data-echo="silence"]')).toHaveCount(0);

    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);
    await expect(page.locator('[data-echo="silence"]')).toBeVisible();
    await expect(page.locator('[data-echo="cited"]')).toHaveCount(0);
  });
});

// --- AC-APP-10 ------------------------------------------------------------------------------

test.describe('AC-APP-10 narration binding', () => {
  test('tapping a sentence highlights its els, and a second tap clears them', async ({ page }) => {
    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);

    const sentence = page.locator('[data-sent]', { hasText: SEED.sentence1 }).first();
    await expect(sentence).toBeVisible();
    await expect(page.locator('[data-hl]')).toHaveCount(0);

    await sentence.click();
    await expect(sentence).toHaveAttribute('data-sent', 'on');
    for (const el of SEED.sentence1Els) {
      await expect(page.locator(`[data-el="${el}"]`), `sentence v-1 highlights ${el}`).toHaveAttribute('data-hl', '1');
    }
    // Only its own els: v-3's four hidden branches are not part of this sentence.
    for (const el of SEED.sentence3Els) {
      await expect(page.locator(`[data-el="${el}"]`)).not.toHaveAttribute('data-hl', '1');
    }

    await sentence.click();
    await expect(sentence).toHaveAttribute('data-sent', 'off');
    await expect(page.locator('[data-hl="1"]')).toHaveCount(0);
  });

  test('tapping a count chip highlights every element of that status', async ({ page }) => {
    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);

    // mbg-stop counts: hidden 4, which is h0..h3 in the claim map.
    await page.locator('[data-st="hidden"]').first().click();
    for (const el of SEED.sentence3Els) {
      await expect(page.locator(`[data-el="${el}"]`), `the hidden chip highlights ${el}`).toHaveAttribute('data-hl', '1');
    }
    // counts.missing is 1, and e1 is the edge it refers to, which this chip must not light.
    await expect(page.locator('[data-el="e1"]')).not.toHaveAttribute('data-hl', '1');
  });
});

// --- AC-APP-11 ------------------------------------------------------------------------------

interface SheetCase {
  from: string;
  narrative: string;
  el: string;
  /** the evidence quote, the resolved source line, and the rationale */
  fragments: RegExp[];
}

/** One opening per kind of tap target blueprint AC-APP-11 names. */
const EVIDENCE: SheetCase[] = [
  {
    from: 'a claim-map node',
    narrative: 'mbg-stop',
    el: 'n2',
    fragments: [/Rp88\.15T/, /Antara News/],
  },
  {
    from: 'a claim-map edge',
    narrative: 'mbg-stop',
    el: 'e0',
    fragments: [/Realisasi anggaran MBG mencapai/, /Antara News/, /The saving exists and is correctly sized/],
  },
  {
    from: 'a hidden branch',
    narrative: 'mbg-stop',
    el: 'h0',
    fragments: [/BGN mencatat 142\.387 pemasok/, /CNBC/, /Documented existing counterparties of the program/],
  },
  {
    from: 'a scale segment',
    narrative: 'mbg-stop',
    el: 'sg0',
    fragments: [/MBG realized/, /Rp88\.15T/, /Antara News/],
  },
  {
    from: 'a dueling count',
    narrative: 'mbg-poisoning',
    el: 'd0',
    fragments: [/Running count of verified case reports/, /CNN Indonesia/],
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
      for (const fragment of c.fragments) await expect(sheet).toHaveText(fragment);
    });
  }

  test('opens from a technique tag', async ({ page }) => {
    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);
    // mbg-stop tags: missing-link, hidden-stakeholder, no-denominator.
    await page.locator('[data-tag="missing-link"]').first().click();
    const sheet = page.getByTestId('evidence-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('role', 'dialog');
    await expect(sheet).toHaveText(/missing/i);
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
      await expect(overlay).toContainText('/n/mbg-stop');

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
    await page.goto(`/share?url=${encodeURIComponent(SEED.canonicalStop)}`);
    await expect(page.getByTestId('share-decision')).toContainText('mbg-stop');
    await expect(page.getByTestId('share-decision')).toContainText('exact');
  });

  test('a text param carrying the URL resolves too', async ({ page }) => {
    await page.goto(`/share?title=Shared&text=${encodeURIComponent(`Look at this ${SEED.canonicalStop}`)}`);
    await expect(page.getByTestId('share-decision')).toContainText('mbg-stop');
  });

  test('an unknown URL routes to the queue state', async ({ page }) => {
    await page.goto(`/share?url=${encodeURIComponent(SEED.unknownUrl)}`);
    await expect(page.locator('[data-screen="queue"]')).toBeVisible();
    await expect(page.locator('[data-screen="queue"]')).toContainText(EN.queueTitle);
  });

  test('the fresh_demo URL routes to the progress flow', async ({ page }) => {
    await page.goto(`/share?url=${encodeURIComponent(SEED.freshDemo)}`);
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
    await expect(page.locator('[data-feed-item="mbg-stop"]')).toBeVisible();

    // The warm-up prefetch has already resolved both packs, so the switch is a cache read.
    const requests: string[] = [];
    page.on('request', (request) => requests.push(request.url()));

    await page.getByTestId('pack-switch').click();
    await expect(page.locator('[data-feed-item="tariffs-pay"]')).toBeVisible();

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
    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);
    await expect(page.locator('[data-el="p-claim"]')).toContainText('Stop MBG permanently');

    await jump(page, 'settings.default');
    await page.locator('[data-lang-option="id"]').click();

    await jump(page, 'radar.default');
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(ID.radarFooter);
    await expect(page.locator('[data-screen="main-radar"]')).toContainText(ID.symmetryLine);
    await expect(page.locator('[data-tab="settings"]')).toContainText(ID.tabSettings);
    // Content follows the app language too: the same card now draws its id headline.
    await expect(page.locator('[data-feed-item="mbg-stop"]')).toContainText(SEED.stopHeadlineId);

    await openAutopsy(page, 'mbg-stop');
    await skipSparring(page);
    // Narration is content, localized inside the artifact rather than in the bundle.
    await expect(page.locator('[data-sent]').first()).toContainText(
      'Aritmetika anggarannya sendiri konsisten',
    );
    await expect(page.locator('[data-el="p-claim"]')).toContainText('Setop MBG permanen');
  });
});

// --- AC-APP-17 ------------------------------------------------------------------------------

test.describe('AC-APP-17 offline', () => {
  test.fixme(
    true,
    'SKIP-IF-SW-DISABLED-IN-DEV: app/vite.config.ts leaves VitePWA out while serving, so no service worker exists under app.config.ts. These run against a built preview (pnpm build && pnpm exec vite preview app), which is where the Gate 3 offline evidence comes from. Remove the fixme once the suite points at the preview server.',
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
    await page.goto('/n/mbg-stop');
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
  test('/n/mbg-stop serves a shell whose og tags parse', async ({ page }) => {
    const response = await page.request.get('/n/mbg-stop');
    expect(response.status()).toBe(200);
    const html = await response.text();

    const meta = (property: string): string => {
      const match = new RegExp(
        `<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`,
        'i',
      ).exec(html);
      expect(match, `${property} is present in the /n/mbg-stop shell`).not.toBeNull();
      return match?.[1] ?? '';
    };

    expect(meta('og:title')).toMatch(/ · Matterhorn$/);
    expect(
      meta('og:title').includes(SEED.stopHeadlineEn) || meta('og:title').includes(SEED.stopHeadlineId),
      'og:title carries the narrative headline',
    ).toBe(true);
    // Blueprint 6.7, FROZEN template, verdict-free by construction.
    expect(meta('og:description')).toBe(FROZEN.ogDescription);
    expect(meta('og:image')).toMatch(/^https?:\/\/|^\//);
    expect(meta('og:url')).toContain('/n/mbg-stop');
    expect(html).toMatch(/<title>[^<]*Matterhorn[^<]*<\/title>/i);
  });

  test('/n/mbg-stop hydrates to the full autopsy', async ({ page }) => {
    await page.goto('/n/mbg-stop');
    await expect(page.locator('[data-screen="autopsy"]')).toBeVisible();
    await expect(page.getByTestId('permalink-card')).toContainText(SEED.stopHeadlineEn);
    await skipSparring(page);
    await expect(page.locator('[data-el="p-claim"]')).toBeVisible();
    await expect(page.locator('[data-el="p-flow"]')).toBeVisible();
  });
});

// --- AC-APP-19 ------------------------------------------------------------------------------

test.describe('AC-APP-19 methodology and 404', () => {
  test('/methodology renders policy 6.5 verbatim, the symmetry receipt, the disclosure and the changelog', async ({
    page,
  }) => {
    await page.goto('/methodology');

    await expect(page.getByTestId('policy-65')).toHaveText(SEED.policy65);
    // Computed from the published lean fields: gov 4, neutral 2, opp 4.
    await expect(page.getByTestId('methodology-symmetry')).toContainText('4');
    await expect(page.getByTestId('methodology-symmetry')).toContainText('2');
    await expect(page.getByTestId('methodology-disclosure')).toHaveText(SEED.disclosure);

    const log = page.getByTestId('corrections-log');
    await expect(log).toContainText(SEED.correctionUnderReview);
    await expect(log).toContainText(SEED.correctionCorrected);
    await expect(log).toContainText('2026-06-24');
    await expect(log).toContainText('2026-06-02');
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
