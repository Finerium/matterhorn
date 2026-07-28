/**
 * Playwright configuration for the Gate 2 grammar screenshots (AC-GRAM-1..8).
 *
 * Post-install home: tests/e2e/playwright.config.ts, which is what testDir and snapshotDir
 * below are relative to. Run it with `pnpm exec playwright test --config tests/e2e/playwright.config.ts`.
 *
 * The surface under test is the dev-only harness entry described in the Gate 2 plan: one
 * component per URL query, loading the seed content root by fetch at run time, never by
 * static import (validator check 7, asserted in tests/unit/renderers/quarantine.spec.ts).
 *
 * Flake budget, in order of how much each one buys:
 *   reducedMotion 'reduce' plus animations 'disabled'  entrance animations are frozen, which
 *     is what makes a screenshot of an animated panel meaningful at all. The single exception
 *     is the claim-map-motion case in grammar.spec.ts, which keeps default motion so that a
 *     catastrophically broken entrance (nothing ever arrives, everything arrives offscreen)
 *     is caught rather than frozen out of the frame. toHaveScreenshot re-samples until the
 *     page stops changing, so an animation that finishes is not a flake; one that never
 *     settles is a real failure. If that case still proves flaky in practice the implementer
 *     may quarantine it with test.fixme and say so in the gate report, and nothing else in
 *     this file changes.
 *   workers 1 and fullyParallel false   one dev server, one browser, no CPU contention
 *     skewing font rasterisation between shots.
 *   locale and timezone pinned   dates and number groupings are part of the image.
 *   scale 'device'   with deviceScaleFactor 2 the baseline is the 2x render rather than a
 *     downsample of it, which is the artifact the gate reviewer compares against the zip.
 *   platform in the snapshot path   darwin and linux rasterise text differently, and a
 *     committed baseline from one is not evidence about the other.
 *
 * chromium only for now. The plan configures webkit and firefox at Gate 3/6, where the state
 * matrix and the dark and ID variants arrive with them.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5199;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '.',
  testMatch: 'grammar.spec.ts',
  snapshotDir: './__screenshots__',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}-{platform}{ext}',

  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],
  timeout: 30_000,

  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
      // A few antialiased pixels are not a regression. A changed panel is.
      maxDiffPixelRatio: 0.01,
    },
  },

  use: {
    baseURL: BASE_URL,
    // The phone frame the whole product is designed at, per the Gate 2 plan.
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    contextOptions: { reducedMotion: 'reduce' },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },

  // browserName rather than devices['Desktop Chrome']: a device preset carries its own
  // viewport and deviceScaleFactor, and spreading it here would silently overwrite the two
  // settings this gate is specified in.
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    // pnpm resolves bins from the package root only; playwright spawns with the
    // config's directory as cwd, so pin it to the repo root explicitly.
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: `pnpm exec vite app --mode harness --port ${PORT}`,
    url: `${BASE_URL}/harness.html`,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
