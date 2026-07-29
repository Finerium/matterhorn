/**
 * Playwright configuration for the Gate 4 landing suite: AC-LAND-1, 2, 3, 4, 5 and 13.
 *
 * Post-install home: tests/e2e/landing.config.ts, which testDir and snapshotDir are relative to.
 *   pnpm exec playwright test --config tests/e2e/landing.config.ts
 *
 * A third config rather than a project inside app.config.ts, for one reason that is not layout
 * preference: THE CONTENT ROOT. `vite app` in serve mode is SEED MODE, and its define pins
 * `__CONTENT_BASE__` at tests/fixtures/seed. AC-LAND-3 asks that the landing's data-bound slots
 * equal `content/methodology.json` and the published content counts, and the seed root disagrees
 * with the published root on exactly those numbers (seed symmetry is 4/2/4, published is 6/1/3).
 * A suite that proved the landing renders the seed numbers would prove nothing about AC-LAND-3.
 * So this config builds, stages the real `content/` into the dist the way production serves it,
 * and previews that. The page under test is the page that ships.
 *
 * Same shape as preview.config.ts, including `reuseExistingServer: false`. A build-backed server
 * that is reused is a stale dist quietly passing, which is the one failure mode worse than a slow
 * suite. Every run rebuilds. That is the cost of testing the built artifact and it is paid on
 * purpose.
 *
 * Deliberately NOT staged: repo-root `public/assets/`. Today vite's publicDir is `app/public`, so
 * the landing photography at `public/assets/land/` does not reach the dist at all. Copying it here
 * would hide a real wiring gap behind a test-only step and leave the deployed site broken; if the
 * landing needs those files the build is what has to place them.
 *
 * Flake budget is the same as the other two configs and for the same reasons: workers 1,
 * animations frozen, locale and timezone pinned, platform in the snapshot path. Note what freezing
 * buys and what it costs here. AC-LAND-4's screenshots are the set pieces at their FINAL FRAME,
 * which is the only frame a committed baseline can be. Motion itself (AC-LAND-6 choreography,
 * AC-LAND-7 reduced motion) is a separate suite's job and is not asserted anywhere in this one.
 *
 * chromium only. AC-LAND-14 (firefox fallback) is a CI matrix concern at Gate 6, not a project here.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5227;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  // Pinned, like every other config in this directory: three suites share one testDir and none of
  // them may collect another's specs.
  testMatch: ['landing-copy.spec.ts', 'landing-responsive.spec.ts'],
  // Its own root, so a landing width never collides with a Gate 2 panel or a Gate 3 state.
  snapshotDir: './__screenshots__/landing',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}-{platform}{ext}',

  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],
  // A full-page screenshot of a long landing at four widths is slower than an app flow.
  timeout: 60_000,

  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'device',
      maxDiffPixelRatio: 0.01,
    },
  },

  use: {
    baseURL: BASE_URL,
    // The per-test widths of AC-LAND-4 and AC-LAND-5 are set with page.setViewportSize; this is
    // only the default a test that says nothing inherits.
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
    contextOptions: { reducedMotion: 'reduce' },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    cwd: REPO_ROOT,
    // `pnpm build` already emits the permalink shells over `content/`; the copy is what puts the
    // published artifacts where `__CONTENT_BASE__` points in a production build, which is `/content`.
    command:
      'pnpm build && rm -rf app/dist/content && cp -R content app/dist/content && pnpm exec vite preview app --port 5227 --strictPort',
    // `/` rather than a port probe: a 200 here is the landing route answering, which is the whole
    // surface under test.
    url: `${BASE_URL}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
