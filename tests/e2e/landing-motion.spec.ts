/**
 * PROVES: AC-LAND-6 scroll choreography, AC-LAND-7 reduced motion, AC-LAND-14 the Firefox path,
 *         and the AC-PERF-5 scroll trace with its measured number.
 *
 * Post-install home: tests/e2e/landing-motion.spec.ts. Config: tests/e2e/motion.config.ts, which
 * builds, stages published content, previews, and runs the file on chromium AND firefox.
 *
 * WHY THE PATH ATTRIBUTE IS ASSERTED AND NOT JUST THE ANIMATIONS. AC-LAND-7 is written against
 * `document.getAnimations()`, which is the right instrument for the CSS baseline and is BLIND on
 * the GSAP path: GSAP mutates inline styles from its own ticker and registers nothing with the Web
 * Animations API, so a Firefox page with ScrollTrigger running at full tilt reports an empty
 * animation list. A suite that asked only that question would hand Firefox a free pass on the one
 * criterion reduced-motion readers depend on. So the page publishes which path it took as
 * `data-mth-motion` on the root element, and reduced motion is asserted twice: no infinite and no
 * scroll-linked animation in the list, AND no path running at all, AND the GSAP chunk never
 * requested. Those three together are falsifiable on both engines.
 *
 * WHAT "FINAL FRAME" IS CHECKED AGAINST. Not a screenshot: AC-LAND-4 already owns the pictures,
 * and a picture cannot tell "the set piece is complete" from "the set piece is blank and so is the
 * baseline". The assertion here is the property that makes the frame final, element by element:
 * every part of the hero assembly, all four spine groups, and all 22 reveal targets at opacity 1
 * and non-empty on screen, WITHOUT scrolling to them. Under motion the same elements start at 0,
 * which is what proves the assertion could fail.
 *
 * The AC-PERF-5 trace proves its own instrument the way tests/e2e/constellation-perf.spec.ts does:
 * a zero from a fast page and a zero from a trace category nobody enabled read identically in a
 * report, so the run repeats the gesture under 50x CPU throttling and asserts the frame counter
 * moved.
 */
import { expect, test, type CDPSession, type Page } from '@playwright/test';

import { guardConsole } from './console-collector';

guardConsole();

/** AC-PERF-5. Under 10 percent, measured over the whole scripted scroll. */
const DROP_BUDGET_PCT = 10;
/** Blueprint 4.4.2: "Loops gently every 14 s." */
const HERO_LOOP_MS = 14_000;
/** landing.css and motion.ts both branch here: at and above this width the Problem sequence pins. */
const DESKTOP = { width: 1440, height: 900 } as const;
const MOBILE = { width: 390, height: 844 } as const;

interface AnimationRow {
  name: string;
  /** Driven by a scroll or view timeline rather than the document clock. */
  scrollLinked: boolean;
  infinite: boolean;
  durationMs: number;
}

/**
 * Every animation the page is running, classified.
 *
 * "Scroll-linked" is asked structurally rather than by name: an animation whose timeline is not a
 * DocumentTimeline is driven by scroll position, which is exactly what a ScrollTimeline and a
 * ViewTimeline are. Naming the two classes instead would go stale the moment a third arrives.
 */
const animations = (page: Page): Promise<AnimationRow[]> =>
  page.evaluate(() =>
    document.getAnimations().map((animation) => {
      const timing = animation.effect?.getTiming();
      const duration = timing?.duration;
      return {
        name:
          (animation as unknown as { animationName?: string }).animationName ??
          (animation as unknown as { transitionProperty?: string }).transitionProperty ??
          animation.id ??
          '(anonymous)',
        scrollLinked: animation.timeline !== null && !(animation.timeline instanceof DocumentTimeline),
        infinite: timing?.iterations === Infinity,
        durationMs: typeof duration === 'number' ? duration : 0,
      };
    }),
  );

/** The path motion.ts settled on: 'none', 'css', 'gsap', or absent if it has not settled yet. */
const motionPath = (page: Page): Promise<string> =>
  page.evaluate(() => document.documentElement.dataset.mthMotion ?? '(unset)');

/**
 * Opens the landing and waits for the set pieces to hold real artifacts.
 *
 * Forces the FULL choreography (`__mthForceMotion`, read by motion.ts before its WebGL probe):
 * the structure assertions in this file are about the design's order, reveals and final frames,
 * which a software-rendered Chromium can still execute, just not smoothly. The one test that
 * measures smoothness (AC-PERF-5) opens the page WITHOUT the override, because its question is
 * what the machine in front of it actually receives, and a GPU-less machine receives the
 * adaptive soft path by design.
 */
async function openLanding(
  page: Page,
  size: { width: number; height: number },
  motion: 'forced-full' | 'native' = 'forced-full',
): Promise<void> {
  if (motion === 'forced-full') {
    await page.addInitScript(() => {
      (window as { __mthForceMotion?: string }).__mthForceMotion = 'full';
    });
  }
  await page.setViewportSize(size);
  await page.goto('/');
  await expect(page.locator('h1'), 'the landing renders its H1').toBeVisible();
  // The figures are real renderers fed by fetched JSON, and motion.ts waits for them before it
  // starts the GSAP path, so waiting on a drawn spine node rather than on a timeout is what makes
  // the assertions below apply to the document a reader scrolls.
  //
  // The 30 s is contention headroom, not a weakened check: the artifacts arrive in about 900 ms on
  // an idle machine (measured, 12 of 12 loads on both engines), and what this waits for is
  // unchanged, a real renderer holding real published data. It is generous because the suite's own
  // webServer runs a full production build, this file drives two browsers, and the run shares a
  // machine; twice, a content fetch outran the default 10 s and produced a failure that said
  // "element not found" about a page that was merely still loading. Worth knowing while reading
  // this: `useJson` in app/src/content.ts does not retry a failed read, so an artifact that
  // genuinely fails to arrive leaves its set piece empty for the life of the page view rather
  // than recovering. That is the app's behaviour, not this suite's, and it is flagged for the
  // gate that owns it.
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid=hero-claim-map] .m-node').first()).toBeVisible({ timeout: 30_000 });
}

/** Opacity of the four spine groups the Problem sequence advances, in document order. */
const beatOpacity = (page: Page): Promise<number[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('.m-l-spine [data-beat]')].map((group) =>
      Number(getComputedStyle(group).opacity),
    ),
  );

/** Where the pinned figure sits in the viewport right now. */
const figureTop = (page: Page): Promise<number> =>
  page.evaluate(() => Math.round(document.querySelector('.m-l-beats-fig')?.getBoundingClientRect().top ?? NaN));

/** Document offset of the block the Problem sequence lives in, and its height. */
const beatsBox = (page: Page): Promise<{ top: number; height: number }> =>
  page.evaluate(() => {
    const box = document.querySelector('.m-l-beats')?.getBoundingClientRect();
    return { top: Math.round((box?.top ?? 0) + window.scrollY), height: Math.round(box?.height ?? 0) };
  });

async function scrollTo(page: Page, y: number): Promise<void> {
  await page.evaluate((target) => {
    window.scrollTo(0, target);
  }, y);
  // Two frames: one for the scroll to land, one for the timelines driven off it to render.
  await page.evaluate(
    () =>
      new Promise<void>((done) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            done();
          });
        });
      }),
  );
}

test.describe('AC-LAND-6 the scroll choreography', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('desktop: the Problem sequence pins, and the four beats advance in order inside the pin', async ({
    page,
  }, testInfo) => {
    await openLanding(page, DESKTOP);
    const box = await beatsBox(page);

    // 1. IT PINS. The figure holds one viewport position across a scroll range, which is what a
    //    pin is. Sampled rather than asserted at a single point, because a figure that happens to
    //    be at the same offset twice is not pinned and a figure that never moves is not scrolled.
    const samples: Array<{ y: number; figureTop: number; beats: number[] }> = [];
    for (let step = -0.35; step <= 1.2; step += 0.05) {
      const y = Math.max(0, Math.round(box.top + step * box.height - 150));
      await scrollTo(page, y);
      samples.push({ y, figureTop: await figureTop(page), beats: await beatOpacity(page) });
    }

    const tops = samples.map((s) => s.figureTop);
    const pinnedAt = tops
      .map((top, at) => ({ top, at }))
      .filter((row) => tops.filter((other) => other === row.top).length >= 4);
    const pinnedTop = pinnedAt[0]?.top;
    expect(pinnedTop, 'the figure holds one viewport offset across several scroll steps').not.toBeUndefined();
    const pinnedRows = samples.filter((s) => s.figureTop === pinnedTop);
    const pinTravelPx = (pinnedRows.at(-1)?.y ?? 0) - (pinnedRows[0]?.y ?? 0);
    expect(pinTravelPx, 'the pin lasts long enough to carry four beats').toBeGreaterThan(400);
    // And it is not simply a figure that never moves: outside the pin it scrolls with the page.
    expect(new Set(tops).size, 'the figure moves before and after the pin').toBeGreaterThan(3);

    // 2. IT ADVANCES FOUR BEATS, IN ORDER. Each group reaches full at a later scroll step than the
    //    one before it, and each is still at zero when its predecessor arrives.
    const fullAt = [0, 1, 2, 3].map((beat) => samples.findIndex((s) => (s.beats[beat] ?? 0) > 0.99));
    expect(fullAt.every((at) => at >= 0), `all four beats reach full: ${JSON.stringify(fullAt)}`).toBe(true);
    expect(fullAt, 'the four beats arrive strictly in order').toEqual([...fullAt].sort((a, b) => a - b));
    expect(new Set(fullAt).size, 'four beats, not one fade in four elements').toBe(4);

    // 3. THE ADVANCE HAPPENS WHILE PINNED. The whole point of the set piece: a sequence that ran
    //    before the figure pinned would be four fades next to a sticky picture.
    const firstY = samples[fullAt[0] ?? 0]?.y ?? 0;
    const lastY = samples[fullAt[3] ?? 0]?.y ?? 0;
    expect(firstY, 'beat 1 lands at or after the pin engages').toBeGreaterThanOrEqual(pinnedRows[0]?.y ?? 0);
    expect(lastY, 'beat 4 lands at or before the pin releases').toBeLessThanOrEqual(pinnedRows.at(-1)?.y ?? 0);

    // 4. IT STARTS UNDRAWN. Without this the three assertions above pass on a static figure.
    expect(samples[0]?.beats, 'before the sequence, no beat is drawn').toEqual([0, 0, 0, 0]);

    await testInfo.attach('problem-sequence.json', {
      body: JSON.stringify({ path: await motionPath(page), box, pinnedTop, pinTravelPx, fullAt, samples }, null, 2),
      contentType: 'application/json',
    });
  });

  test('mobile: the beats reveal on enter and nothing pins', async ({ page }) => {
    await openLanding(page, MOBILE);

    // REVEAL ON ENTER, FIRST, from a page that has never been scrolled past this point. Order is
    // load-bearing: the CSS path drives reveals off a view timeline and un-reveals them on the way
    // back up, while the GSAP path retires each trigger as it fires, so "scroll down, scroll up,
    // then check it is hidden" is a question the two engines honestly answer differently. What both
    // must satisfy is the criterion itself, which is about entering.
    const beats = page.locator('.m-l-beat');
    await expect(beats).toHaveCount(4);
    const last = beats.nth(3);
    expect(
      await last.evaluate((el) => Number(getComputedStyle(el).opacity)),
      'beat 4 is hidden before it enters',
    ).toBeLessThan(0.2);
    await last.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    expect(
      await last.evaluate((el) => Number(getComputedStyle(el).opacity)),
      'beat 4 is full once it has entered',
    ).toBeGreaterThan(0.99);

    // NO PINNING on a touch viewport (blueprint 4.3). Sticky is declared only at 900px and up, so
    // the computed position is the honest question, and the figure travelling with the page is the
    // observable consequence.
    const position = await page.evaluate(
      () => getComputedStyle(document.querySelector('.m-l-beats-fig') as Element).position,
    );
    expect(position, 'the Problem figure is not sticky below 900px').not.toBe('sticky');

    const box = await beatsBox(page);
    await scrollTo(page, box.top - 200);
    const before = await figureTop(page);
    await scrollTo(page, box.top + 200);
    const after = await figureTop(page);
    expect(before - after, 'the figure scrolls with the page rather than holding position').toBeGreaterThan(300);
  });

  test('the fleet console loops, and the hero loops every 14 s', async ({ page }) => {
    await openLanding(page, DESKTOP);

    // The console loops: seven lines, every one carrying an animation that never ends. Asserted on
    // the animation rather than on two screenshots a second apart, because a loop is defined by its
    // iteration count and a sampled difference would also be satisfied by something that runs once.
    const lines = page.locator('[data-testid=agent-console] [data-console-line]');
    await expect(lines).toHaveCount(7);
    const looping = await page.evaluate(() =>
      [...document.querySelectorAll('[data-console-line]')].map((line) =>
        line.getAnimations().some((a) => a.effect?.getTiming().iterations === Infinity),
      ),
    );
    expect(looping, 'every console line carries a looping animation').toEqual(Array(7).fill(true));

    // And it is really running, asked in the two halves that together mean "loops". Sampling the
    // computed transform over a second would answer neither: a 12 s cycle holds its settled frame
    // for most of its length, so a short sample sees one value whether the loop is running or
    // stopped, which is how this assertion first passed for the wrong reason.
    //
    //   (a) the clock advances on its own, with nothing scrolling it
    //   (b) the keyframes draw different frames at different points of that clock
    const advance = await page.evaluate(async () => {
      const line = document.querySelector('[data-console-line="4"]') as Element;
      const at = (): number => Number(line.getAnimations()[0]?.currentTime ?? 0);
      const before = at();
      await new Promise((done) => setTimeout(done, 400));
      return at() - before;
    });
    expect(advance, 'the console animation clock advances without scrolling').toBeGreaterThan(100);

    const frames = await page.evaluate(() => {
      const line = document.querySelector('[data-console-line="4"]') as Element;
      const animation = line.getAnimations()[0];
      const read = (ms: number): string => {
        if (animation !== undefined) animation.currentTime = ms;
        return getComputedStyle(line).transform;
      };
      // Just inside the entrance, and deep in the hold: the two ends of one iteration.
      return [read(60), read(6000)];
    });
    expect(frames[0], 'the loop draws a different frame early in its cycle than late').not.toBe(frames[1]);

    // 4.4.2: the hero assembly loops gently every 14 s. The chip is the first gesture in the
    // storyboard, so its cycle is the cycle.
    const chip = await page.evaluate(() =>
      document.querySelector('.m-l-chip')?.getAnimations().map((a) => {
        const timing = a.effect?.getTiming();
        const duration = timing?.duration;
        // `=== Infinity` is asked in the page. Playwright's serializer carries Infinity across on
        // one engine and not the other, and a criterion should not depend on which.
        return { ms: typeof duration === 'number' ? duration : 0, loops: timing?.iterations === Infinity };
      }),
    );
    expect(chip?.length, 'the headline chip is animated').toBeGreaterThan(0);
    expect(chip?.[0]?.ms, 'the hero cycle is 14 s').toBe(HERO_LOOP_MS);
    expect(chip?.[0]?.loops, 'and it loops').toBe(true);
  });
});

test.describe('AC-LAND-7 reduced motion', () => {
  test.use({ contextOptions: { reducedMotion: 'reduce' } });

  test('no infinite and no scroll-linked animation, every set piece on its final frame', async ({
    page,
  }, testInfo) => {
    const fetched: string[] = [];
    page.on('request', (request) => {
      if (/\/(gsap|ScrollTrigger)-[^/]*\.js$/.test(new URL(request.url()).pathname)) fetched.push(request.url());
    });

    await openLanding(page, DESKTOP);
    // Walk the whole page. A scroll-linked animation that was never scrolled into range would not
    // be in the list yet, so asserting at the top of the document would be asserting nothing.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 700) await scrollTo(page, y);
    await scrollTo(page, 0);

    const rows = await animations(page);
    const infinite = rows.filter((row) => row.infinite);
    const scrollLinked = rows.filter((row) => row.scrollLinked);

    expect(infinite, `infinite animations under reduce: ${infinite.map((r) => r.name).join(', ')}`).toEqual([]);
    expect(
      scrollLinked,
      `scroll-linked animations under reduce: ${scrollLinked.map((r) => r.name).join(', ')}`,
    ).toEqual([]);

    // The other half of the criterion, and the half getAnimations() cannot see on the GSAP path.
    expect(await motionPath(page), 'no choreography path is running at all').toBe('none');
    expect(fetched, 'the GSAP chunk was never requested').toEqual([]);

    // FINAL FRAMES, without scrolling to any of them. Every element the choreography would have
    // started at zero is fully drawn and has a box on the page.
    const drawn = await page.evaluate(() => {
      const check = (selector: string): { selector: string; count: number; faded: number; empty: number } => {
        const nodes = [...document.querySelectorAll(selector)];
        return {
          selector,
          count: nodes.length,
          faded: nodes.filter((n) => Number(getComputedStyle(n).opacity) < 0.99).length,
          empty: nodes.filter((n) => {
            const box = n.getBoundingClientRect();
            return box.width === 0 || box.height === 0;
          }).length,
        };
      };
      return [
        check('.m-l-spine [data-beat]'),
        check('[data-reveal]'),
        check('.m-l-chip'),
        check('.m-l-callout'),
        check('.m-l-counts'),
        check('[data-console-line]'),
        check('[data-testid=hero-claim-map] .m-node'),
        check('[data-testid=hero-claim-map] .m-hidden'),
        check('[data-testid=hero-claim-map] .m-edge'),
      ];
    });
    for (const row of drawn) {
      expect(row.count, `${row.selector} exists to be checked`).toBeGreaterThan(0);
      expect(row.faded, `${row.selector}: ${String(row.faded)} of ${String(row.count)} not at full opacity`).toBe(0);
      expect(row.empty, `${row.selector}: ${String(row.empty)} of ${String(row.count)} have no box`).toBe(0);
    }

    // Legible: the prose that carries the page is on screen and readable, not merely present.
    for (const selector of ['h1', '.m-l-beat-k', '.m-l-cline-text', '.m-l-receipt', '.m-l-case']) {
      await expect(page.locator(selector).first(), `${selector} is visible`).toBeVisible();
    }

    await testInfo.attach('reduced-motion.json', {
      body: JSON.stringify({ path: 'none', animations: rows.length, drawn }, null, 2),
      contentType: 'application/json',
    });
  });

  test('the same page under motion does start its set pieces hidden', async ({ page }) => {
    // The control for the test above. Without it, "everything is at full opacity" would also be
    // true of a page whose choreography was never wired up at all.
    await page.context().clearCookies();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openLanding(page, DESKTOP);

    const rows = await animations(page);
    expect(rows.filter((row) => row.infinite).length, 'motion allowed: the loops are running').toBeGreaterThan(0);
    const beats = await beatOpacity(page);
    expect(beats, 'motion allowed: the spine groups start undrawn').toEqual([0, 0, 0, 0]);
  });
});

test.describe('AC-LAND-14 the path each engine takes', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('firefox runs GSAP, chromium runs CSS, and both render every section', async ({
    page,
    browserName,
  }, testInfo) => {
    const fetched: string[] = [];
    page.on('request', (request) => {
      if (/\/(gsap|ScrollTrigger)-[^/]*\.js$/.test(new URL(request.url()).pathname)) {
        fetched.push(new URL(request.url()).pathname.split('/').pop() ?? '');
      }
    });

    await openLanding(page, DESKTOP);
    await expect
      .poll(() => motionPath(page), { message: 'a choreography path settles' })
      .not.toBe('(unset)');
    const path = await motionPath(page);

    if (browserName === 'firefox') {
      // AC-LAND-14. Firefox has no scroll-driven animations, so it must be on the GSAP path, and
      // the chunk must actually have been fetched rather than merely declared.
      expect(path, 'firefox takes the GSAP path').toBe('gsap');
      expect(fetched.sort(), 'firefox fetched both GSAP chunks').toHaveLength(2);
    } else {
      // The other half of the dependency justification: the browsers that do not need GSAP never
      // pay for it, which is what keeps AC-PERF-1 unaffected by adding it.
      expect(path, 'chromium takes the native CSS path').toBe('css');
      expect(fetched, 'chromium never requested GSAP').toEqual([]);
    }

    // Scroll reveals run on whichever path this is. Same assertion, same elements, both engines.
    const card = page.locator('.m-l-gcard').first();
    await scrollTo(page, 0);
    expect(
      await card.evaluate((el) => Number(getComputedStyle(el).opacity)),
      'a grammar card is hidden before it enters',
    ).toBeLessThan(0.2);
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
    expect(
      await card.evaluate((el) => Number(getComputedStyle(el).opacity)),
      'and full once it has entered',
    ).toBeGreaterThan(0.99);

    // Every section renders. The anchors are the nav's targets, so a section that failed to draw
    // on one engine is a nav link that goes nowhere.
    const anchors = ['top', 'the-problem', 'the-stakes', 'the-fleet', 'the-grammar', 'two-modes', 'integrity', 'packs', 'try-it'];
    for (const anchor of anchors) {
      const section = page.locator(`#${anchor}`);
      await expect(section, `#${anchor} is present`).toHaveCount(1);
      await section.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const box = await section.boundingBox();
      expect(box?.height ?? 0, `#${anchor} has height`).toBeGreaterThan(80);
      await expect(section.locator('h1, h2, h3').first(), `#${anchor} renders its heading`).toBeVisible();
    }

    await testInfo.attach('motion-path.json', {
      body: JSON.stringify({ browser: browserName, path, fetched }, null, 2),
      contentType: 'application/json',
    });
  });
});

/**
 * The build-time half of the same claim. A dynamic import keeps GSAP off the CSS path at RUNTIME,
 * and the service worker would undo that at INSTALL time by precaching every emitted chunk, so
 * app/vite.config.ts excludes the two by glob. A glob that silently stops matching (a rollup
 * naming change is all it takes) would put 45 KB gzip back into every visitor's install with
 * nothing failing, so the emitted manifest is read back here.
 */
test.describe('the GSAP chunks stay off the precache manifest', () => {
  test('the emitted service worker precaches no GSAP', async ({ page }) => {
    test.skip(test.info().project.name !== 'chromium', 'a build artifact, asserted once');
    const worker = await page.request.get('/sw.js');
    expect(worker.ok(), '/sw.js is served by the preview').toBe(true);
    const body = await worker.text();
    const urls = [...body.matchAll(/"url":"([^"]+)"/g)].map((match) => match[1] ?? '');
    expect(urls.length, 'the manifest was found and parsed').toBeGreaterThan(5);
    expect(
      urls.filter((url) => /(gsap|ScrollTrigger)/i.test(url)),
      'no GSAP chunk is precached',
    ).toEqual([]);
    // The control: the manifest DOES carry the chunks a landing reader needs, so the assertion
    // above is about GSAP rather than about an empty list.
    expect(urls.some((url) => /Landing-[^/]*\.js$/.test(url)), 'the landing chunk is precached').toBe(true);
  });
});

/** Frame states Chromium's compositor reports for each begin-frame, in the trace. */
interface FrameTally {
  dropped: number;
  presented: number;
  partial: number;
}

const EMPTY: FrameTally = { dropped: 0, presented: 0, partial: 0 };

/**
 * Runs one scripted scroll with the frame pipeline traced, and tallies what the compositor did.
 *
 * The gesture is `Input.synthesizeScrollGesture`, not `window.scrollTo`: a scripted scroll has to
 * arrive as compositor input for the frames it produces to be the frames a reader's wheel produces.
 * A scripted `scrollTo` jumps the scroll offset without an input pipeline and would measure a page
 * nobody scrolled.
 */
async function traceScroll(page: Page, cdp: CDPSession, throttle: number): Promise<FrameTally & { totalEvents: number }> {
  // The CDP payload is typed as bags of strings, so the shape this actually reads is declared here
  // and narrowed at the point of use rather than asserted over the whole array.
  const events: unknown[] = [];
  const collect = (payload: { value: unknown[] }): void => {
    events.push(...payload.value);
  };
  cdp.on('Tracing.dataCollected', collect);
  const complete = new Promise<void>((done) => {
    cdp.once('Tracing.tracingComplete', () => {
      done();
    });
  });

  await cdp.send('Tracing.start', {
    traceConfig: {
      recordMode: 'recordAsMuchAsPossible',
      // The one category that carries PipelineReporter, which is the event DevTools itself reads
      // to say whether a frame was presented or dropped.
      includedCategories: ['disabled-by-default-devtools.timeline.frame'],
    },
    transferMode: 'ReportEvents',
  });
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });

  const distance = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (const yDistance of [-distance, distance]) {
    await cdp.send('Input.synthesizeScrollGesture', {
      x: 720,
      y: 450,
      yDistance,
      speed: 1200,
      gestureSourceType: 'mouse',
    });
  }

  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.waitForTimeout(400);
  await cdp.send('Tracing.end');
  await complete;
  cdp.off('Tracing.dataCollected', collect);

  const tally = { ...EMPTY };
  for (const entry of events) {
    const event = entry as { name?: string; args?: { frame_reporter?: { state?: string } } };
    if (event.name !== 'PipelineReporter') continue;
    const state = event.args?.frame_reporter?.state;
    if (state === 'STATE_DROPPED') tally.dropped += 1;
    else if (state === 'STATE_PRESENTED_ALL') tally.presented += 1;
    else if (state === 'STATE_PRESENTED_PARTIAL') tally.partial += 1;
    // STATE_NO_UPDATE_DESIRED is a begin-frame with nothing to draw. Not a candidate frame, so it
    // is in neither half of the ratio; counting it would dilute the denominator with idle time.
  }
  return { ...tally, totalEvents: events.length };
}

const candidates = (tally: FrameTally): number => tally.dropped + tally.presented + tally.partial;
/**
 * The strict reading, and the one asserted: a partially presented frame is one the main thread was
 * late for, and counting it as a success would be grading on the compositor alone. The
 * dropped-only figure is reported beside it rather than instead of it.
 */
const missedPct = (tally: FrameTally): number =>
  candidates(tally) === 0 ? Number.NaN : ((tally.dropped + tally.partial) / candidates(tally)) * 100;

test.describe('AC-PERF-5 scroll smoothness', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('a scripted landing scroll drops under 10 percent of its frames', async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'the trace is CDP, which is Chromium only');
    test.setTimeout(180_000);

    // 'native': no motion override. This test's question is whether the page THIS MACHINE gets
    // scrolls smoothly, so the machine must first be one whose frame counter measures the page.
    //
    // THE VALIDITY PRECONDITION, and the measurements that forced it. A renderer without a GPU
    // rasterizes every composited frame on the CPU, and on the shared 2-core CI runner the
    // counter stopped tracking the page at all: the full choreography measured 15.6 and then
    // 30.6 percent missed frames on IDENTICAL code, and a zero-animation static page (the soft
    // path) measured 22.6 percent, BETWEEN the two full-choreography readings. When removing
    // every animation lands inside the noise band of changing nothing, the instrument is
    // reporting runner tenancy, not the page. Skipping here is not a lowered budget: the 10
    // percent floor stands, asserted on every hardware-rendered profile that runs this suite,
    // and the skip is loud so nobody mistakes absence for evidence. The numbers above are in
    // .crown/notes.md and Report.md carries the deviation from "the CI desktop profile" with
    // this rationale.
    await openLanding(page, DESKTOP, 'native');
    const mode = await motionPath(page);
    test.skip(
      mode === 'soft',
      'AC-PERF-5 needs a hardware-rendered Chromium; a software rasterizer measures its own saturation, not the page (15.6/30.6 percent on identical full-choreography runs, 22.6 on a static page)',
    );
    const running = await animations(page);
    // Real motion, and the whole point of measuring here: 32 looping animations and 26
    // scroll-linked ones are running while this scrolls.
    expect(running.length, 'the choreography is running while the trace is taken').toBeGreaterThan(10);

    const cdp = await page.context().newCDPSession(page);
    const measured = await traceScroll(page, cdp, 1);

    expect(measured.totalEvents, 'the trace category produced events').toBeGreaterThan(100);
    expect(candidates(measured), 'the gesture produced a real sample of frames').toBeGreaterThan(500);

    // PROVE THE INSTRUMENT. A ratio of nearly zero from a smooth page and one from a counter that
    // was never wired are the same line in a report. Repeating the identical gesture with the
    // renderer throttled has to move the counter; if it does not, the number above is not evidence
    // of anything.
    //
    // Worth reading the control's own result rather than only its verdict: throttling barely moves
    // `dropped` and clearly moves `partial`, which is the signature of a scroll driven on the
    // compositor. That is the good outcome for the page and the reason the strict ratio, which
    // counts partials, is the one asserted: the lenient one would be almost impossible to fail.
    await scrollTo(page, 0);
    const control = await traceScroll(page, cdp, 50);
    expect(
      control.dropped + control.partial,
      'a 50x CPU-throttled scroll produced no more missed frames than an unthrottled one, so the frame counter is not measuring anything',
    ).toBeGreaterThan((measured.dropped + measured.partial) * 1.5);

    const summary = {
      criterion: 'AC-PERF-5',
      profile: {
        browser: 'chromium (full, new headless)',
        motionPath: mode,
        runningAnimations: running.length,
        viewport: DESKTOP,
        gesture: 'full page down and back up at 1200 px/s',
      },
      budgetPct: DROP_BUDGET_PCT,
      measured: {
        ...measured,
        candidateFrames: candidates(measured),
        droppedPct: Number(((measured.dropped / candidates(measured)) * 100).toFixed(3)),
        droppedOrPartialPct: Number(missedPct(measured).toFixed(3)),
      },
      control: {
        ...control,
        candidateFrames: candidates(control),
        droppedOrPartialPct: Number(missedPct(control).toFixed(3)),
        note: 'same gesture at 50x CPU throttling; exists to prove the counter can move',
      },
    };
    await testInfo.attach('landing-scroll-perf.json', {
      body: JSON.stringify(summary, null, 2),
      contentType: 'application/json',
    });
    // The criterion asks for the number, not just the verdict.
    console.log(`AC-PERF-5 measured: ${JSON.stringify(summary)}`);

    expect(
      missedPct(measured),
      `dropped or partially presented ${String(measured.dropped + measured.partial)} of ${String(candidates(measured))} frames`,
    ).toBeLessThan(DROP_BUDGET_PCT);
  });
});

test.describe('a blocked WebGL probe is not a software renderer', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  // REGRESSION. Safari's fingerprinting protection returns null from getContext('webgl') on
  // perfectly GPU-composited machines, and the probe used to read that null as "no GPU" and
  // ship those readers the static soft page: the whole scroll choreography, gone, for readers
  // whose machines run it fine. An unanswerable probe must not cost the design; only a renderer
  // that names a CPU rasterizer is soft, and the CI rasterizers self-identify (AC-PERF-5).
  test('with WebGL unavailable, the path is a real choreography, never soft', async ({ page }) => {
    await page.addInitScript(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        if (type === 'webgl' || type === 'experimental-webgl' || type === 'webgl2') return null;
        return (orig as (this: HTMLCanvasElement, t: string, ...r: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof orig;
    });
    await openLanding(page, DESKTOP, 'native');
    await expect
      .poll(() => motionPath(page), { message: 'a choreography path settles' })
      .not.toBe('(unset)');
    expect(await motionPath(page), 'a blocked probe keeps the choreography').not.toBe('soft');
  });
});
