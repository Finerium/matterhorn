/**
 * PROVES: AC-PERF-4. A synthetic 500-node constellation, a scripted 10 s pan and zoom, zero
 *         long tasks over 200 ms, and JS heap under 250 MB, with the measured numbers reported
 *         rather than merely asserted.
 *
 * Post-install home: tests/e2e/constellation-perf.spec.ts, the path blueprint 8.6 names.
 * Config: tests/e2e/research.config.ts, which builds and previews. That matters more here than
 * anywhere else in the repo: a dev server ships unminified React through a module graph of one
 * file per component, and a budget measured against it would be measuring vite, not the
 * product. This measures the bundle a reader gets.
 *
 * WHERE EACH NUMBER COMES FROM, because "CDP metrics" is two different instruments:
 *
 *   heap        CDP `Performance.getMetrics` -> `JSHeapUsedSize`, read after the gesture with
 *               no forced collection. Not collecting first is the conservative direction: the
 *               number includes garbage the collector has not taken yet, so it can only
 *               overstate, never flatter.
 *   long tasks  the Long Tasks API through a `PerformanceObserver` installed before the first
 *               script runs. `Performance.getMetrics` reports `TaskDuration` as a cumulative
 *               total only, which cannot answer "was any single task over 200 ms", so the
 *               per-task instrument is the one that can fail the criterion. Both are recorded.
 *
 * The window measured is the WHOLE session, load plus gesture, which is the strict reading of
 * "a 500-node fixture with a scripted pan and zoom". A blocking first render of 500 nodes is
 * exactly the failure this budget exists to catch, so excluding it would be grading the easy
 * half. The summary splits load from gesture so a failure says which half it was.
 *
 * The run also proves its own instrument. "Zero long tasks" from a graph that is genuinely fast
 * and "zero long tasks" from an observer that was never wired are the same string in a report,
 * so the test blocks the main thread for 260 ms on purpose at the end and asserts the observer
 * saw it. Without that control this file would be the kind of green this project has already
 * been burned by twice.
 */
import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

import { constellation500, NODE_COUNT } from '../fixtures/constellation-500';
import { guardConsole } from './console-collector';

guardConsole();

declare global {
  interface Window {
    /** Duration in ms of every long task since the document started. */
    __mthLongTasks?: number[];
  }
}

/** AC-PERF-4, both halves of the budget. */
const LONG_TASK_MS = 200;
const HEAP_LIMIT_BYTES = 250 * 1024 * 1024;
const GESTURE_MS = 10_000;

const FIXTURE = constellation500();
const MB = (bytes: number): number => Math.round((bytes / (1024 * 1024)) * 10) / 10;

interface Metric {
  name: string;
  value: number;
}

const valueOf = (metrics: Metric[], name: string): number =>
  metrics.find((entry) => entry.name === name)?.value ?? Number.NaN;

const readMetrics = async (cdp: CDPSession): Promise<Metric[]> => {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics;
};

/**
 * Every long task recorded so far. The wait is load-bearing: an observer callback is delivered
 * after the task it describes, so reading the array the instant a gesture ends drops the tail of
 * the very window being measured.
 */
const longTasks = async (page: Page): Promise<number[]> => {
  await page.waitForTimeout(400);
  return page.evaluate(() => window.__mthLongTasks ?? []);
};

/**
 * A deliberate 260 ms block, so the run can prove its own instrument rather than assume it.
 *
 * It has to be a task the PAGE owns. A busy-wait inside a bare `page.evaluate` runs as a CDP
 * `Runtime.evaluate` task, and Chromium does not report those to the Long Tasks API at all,
 * which was measured here and is exactly how a dead observer reads as a flawless run.
 */
const blockTheMainThread = (page: Page): Promise<void> =>
  page.evaluate(
    () =>
      new Promise<void>((done) => {
        setTimeout(() => {
          const until = performance.now() + 260;
          while (performance.now() < until) {
            /* block on purpose */
          }
          done();
        }, 0);
      }),
  );

interface Gesture {
  pans: number;
  zooms: number;
  elapsedMs: number;
}

/**
 * A lap of the graph and a zoom cycle, repeated until the clock runs out. The lap is a real
 * press-drag-release rather than four scattered moves, because a pan implementation only does
 * work while a pointer is down, and a script that never presses would measure an idle page and
 * call it a pass.
 */
async function panAndZoom(page: Page, box: { x: number; y: number; width: number; height: number }): Promise<Gesture> {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const lap: Array<[number, number]> = [
    [-0.2, 0],
    [0, -0.2],
    [0.2, 0],
    [0, 0.2],
  ];

  const started = Date.now();
  const deadline = started + GESTURE_MS;
  let pans = 0;
  let zooms = 0;
  await page.mouse.move(cx, cy);
  while (Date.now() < deadline) {
    await page.mouse.down();
    for (const [dx, dy] of lap) {
      await page.mouse.move(cx + dx * box.width, cy + dy * box.height, { steps: 6 });
    }
    await page.mouse.up();
    pans += 1;

    // Zoom over the middle: three notches in, three back out, so the view returns to a
    // comparable scale each lap rather than drifting to a single node or to nothing.
    for (const delta of [-120, -120, -120, 120, 120, 120]) {
      await page.mouse.wheel(0, delta);
      zooms += 1;
    }
  }
  return { pans, zooms, elapsedMs: Date.now() - started };
}

test.describe('AC-PERF-4 the constellation under load', () => {
  // Real motion. The config freezes animation for screenshot stability, and a constellation that
  // honours prefers-reduced-motion would then be measured with its layout and transitions turned
  // off, which is the flattering direction and not what a reader gets.
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('500 nodes, a 10 s pan and zoom, zero long tasks over 200 ms and heap under 250 MB', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);

    expect(FIXTURE.nodes.length, 'the fixture is the 500 nodes AC-PERF-4 names').toBe(NODE_COUNT);
    expect(new Set(FIXTURE.nodes.map((node) => node.id)).size, 'node ids are unique').toBe(NODE_COUNT);

    await page.addInitScript(() => {
      const seen: number[] = [];
      window.__mthLongTasks = seen;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) seen.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    });

    // The fixture reaches the app the way content does, over the network, so nothing in the app
    // knows it is under test. The service worker is blocked at config level, which is what keeps
    // this interception from being answered out of a cache instead.
    let served = 0;
    await page.route('**/constellation.json*', async (route) => {
      served += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(FIXTURE),
      });
    });

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');

    await page.goto('/research');
    const graph: Locator = page.getByTestId('research-constellation');
    await expect(graph).toBeVisible();
    const box = await graph.boundingBox();
    if (box === null) throw new Error('the constellation has no box to gesture over');

    expect(served, 'the app read the fixture rather than the published graph').toBeGreaterThan(0);
    // How many nodes are ON SCREEN is reported, not demanded. Drawing all 500 and drawing only
    // the ones in view are both honest ways to hold a budget, and the budget is what this test
    // is about; the count goes in the summary so a reviewer can see which one was measured.
    const drawn = await graph.evaluate((element) => element.querySelectorAll('[data-node], circle').length);
    expect(drawn, 'the constellation drew something to gesture over').toBeGreaterThan(0);

    const loadTasks = await longTasks(page);
    const before = await readMetrics(cdp);
    const beforeShot = await graph.screenshot();

    const gesture = await panAndZoom(page, box);

    const afterShot = await graph.screenshot();
    const allTasks = await longTasks(page);
    const after = await readMetrics(cdp);

    expect(
      beforeShot.equals(afterShot),
      'the pan and zoom changed what is drawn, so the budget was measured against a moving graph',
    ).toBe(false);

    // Prove the instrument before reporting what it did not see. A zero from a dead observer and
    // a zero from a fast graph look identical in the report, and only one of them is evidence.
    await blockTheMainThread(page);
    const withControl = await longTasks(page);
    const detected = withControl.length - allTasks.length;
    expect(
      detected,
      'the long-task observer did not see a deliberate 260 ms block, so the zero above proves nothing',
    ).toBeGreaterThan(0);

    const gestureTasks = allTasks.slice(loadTasks.length);
    const worst = allTasks.reduce((high, duration) => Math.max(high, duration), 0);
    const over = allTasks.filter((duration) => duration > LONG_TASK_MS);
    const heapUsed = valueOf(after, 'JSHeapUsedSize');

    const summary = {
      criterion: 'AC-PERF-4',
      fixture: { nodes: FIXTURE.nodes.length, links: FIXTURE.links.length, drawn },
      gesture,
      longTasks: {
        budgetMs: LONG_TASK_MS,
        overBudget: over.length,
        worstMs: Math.round(worst),
        count: { load: loadTasks.length, gesture: gestureTasks.length },
        /** The instrument's own receipt: how many entries a deliberate 260 ms block produced. */
        controlDetected: detected,
        totalMs: Math.round(allTasks.reduce((sum, duration) => sum + duration, 0)),
        cdpTaskDurationMs: Math.round((valueOf(after, 'TaskDuration') - valueOf(before, 'TaskDuration')) * 1000),
      },
      heap: {
        budgetMB: MB(HEAP_LIMIT_BYTES),
        usedMB: MB(heapUsed),
        totalMB: MB(valueOf(after, 'JSHeapTotalSize')),
        beforeGestureMB: MB(valueOf(before, 'JSHeapUsedSize')),
      },
      dom: { nodes: valueOf(after, 'Nodes'), layouts: valueOf(after, 'LayoutCount') },
    };
    await testInfo.attach('constellation-perf.json', {
      body: JSON.stringify(summary, null, 2),
      contentType: 'application/json',
    });
    // The criterion asks for the number, not just the verdict.
    console.log(`AC-PERF-4 measured: ${JSON.stringify(summary)}`);

    expect(over, `long tasks over ${String(LONG_TASK_MS)} ms: ${over.map((d) => Math.round(d)).join(', ')}`).toEqual(
      [],
    );
    expect(heapUsed, `JS heap used ${String(MB(heapUsed))} MB`).toBeLessThan(HEAP_LIMIT_BYTES);
  });
});
