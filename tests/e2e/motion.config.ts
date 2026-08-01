/**
 * Playwright configuration for the landing's choreography: AC-LAND-6, AC-LAND-7, AC-LAND-14 and
 * the AC-PERF-5 scroll trace.
 *
 * Post-install home: tests/e2e/motion.config.ts.
 *   pnpm exec playwright test --config tests/e2e/motion.config.ts
 *
 * A fourth config, and the two reasons are both things landing.config.ts cannot give up.
 *
 * 1. REDUCED MOTION IS THE SUBJECT, not a setting. landing.config.ts pins
 *    `contextOptions: { reducedMotion: 'reduce' }` for the whole run, which is right for a
 *    screenshot baseline and fatal for a suite whose job is to compare the two preferences. Here
 *    every test states its own.
 * 2. FIREFOX. AC-LAND-14 asks that the landing's scroll reveals run through the GSAP path on
 *    Playwright firefox. landing.config.ts is chromium-only because its evidence is committed
 *    chromium screenshots. This file takes no screenshots, so it can carry both engines, and the
 *    same specs run on each: the point of AC-LAND-14 is that the two paths reach the same page.
 *
 * `channel: 'chromium'` rather than the default. Playwright's default chromium is the headless
 * SHELL, which has no display compositor: `Input.synthesizeScrollGesture` moves nothing there
 * (measured: scrollY 0 to 0) and the frame pipeline emits a handful of events for a whole
 * gesture. AC-PERF-5 is a frame-drop measurement, so it needs a browser that actually produces
 * frames. The full Chromium in new headless mode does, with software rasterisation, which is
 * also what a GPU-less CI runner gives it.
 *
 * The build-and-preview webServer is landing.config.ts's, for the same reason: the choreography
 * ships as one minified stylesheet and one lazily imported chunk, and a dev server would be
 * measuring vite's module graph rather than the page. Content is staged the way production
 * serves it so the set pieces hold the real artifacts. Port differs so both suites can run.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5229;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  // Pinned, like every other config in this directory: five suites share one testDir and none of
  // them may collect another's specs.
  testMatch: ['landing-motion.spec.ts'],

  fullyParallel: false,
  // One worker. A dropped-frame ratio measured while a second browser is rendering on the same
  // machine is a measurement of the machine.
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  // Zero, deliberately, even in CI. A retry that turns a red performance trace green is a budget
  // that reports the best of three, and AC-PERF-5 asks for the number rather than the best number.
  retries: 0,
  reporter: [['list']],
  // The AC-PERF-5 gesture alone is a 16 s scroll, run twice.
  timeout: 180_000,

  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    // Stated per test. Nothing here, so that a test which forgets to say fails loudly rather
    // than inheriting a preference that happens to suit it.
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    // The worker would answer the GSAP chunk out of a cache and hide whether it was fetched at
    // all, which is half of what this suite measures.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
  ],

  webServer: {
    cwd: REPO_ROOT,
    command:
      'pnpm build && rm -rf app/dist/content && cp -R content app/dist/content && pnpm exec vite preview app --port 5229 --strictPort',
    url: `${BASE_URL}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
