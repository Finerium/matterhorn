/**
 * Playwright configuration for AC-APP-21: the cross-browser matrix.
 *
 *   pnpm test:e2e:cross
 *
 * Three projects, one spec, no per-engine branches in the assertions. AC-APP-21 names chromium,
 * webkit and firefox and names the four surfaces that must render correctly on all three:
 * onboarding, the autopsy, the share GET and the landing. Those four, and nothing else.
 *
 * AC-LAND-14 (the landing's firefox motion fallback) is NOT here: motion.config.ts already runs
 * landing-motion.spec.ts on chromium and firefox, and asserting the same attribute twice would
 * cost a second build to learn the same fact.
 *
 * Preview-backed for the reason every build-backed config in this directory gives: three engines
 * agreeing about a dev server says nothing about the artifact that deploys. Its own port (5249)
 * so it can run beside the landing, research and a11y previews.
 *
 * No screenshots anywhere in this suite, deliberately. A committed baseline is per engine and per
 * platform, so a three-engine matrix is three times the baselines and three times the rasterising
 * differences that are not regressions; "renders correctly" is asserted structurally instead, on
 * the things a broken engine actually breaks: the screen is reached, the copy is on it, the
 * elements are there, the layout does not overflow, and nothing hits the console. Pixel parity is
 * AC-GRAM-1..9's job and it is chromium's, on darwin, where the baselines were taken.
 *
 * Retries stay at CI's two. A first-run failure on webkit is usually a timing difference rather
 * than a defect, and a flake that fails the matrix teaches the reader to ignore the matrix.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5249;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: ['cross-browser.spec.ts'],

  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],
  timeout: 60_000,

  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    viewport: { width: 402, height: 874 },
    // Motion frozen, as everywhere else in this directory: an entrance animation that has not
    // finished is not a rendering defect, and three engines' worth of settling times would turn
    // every assertion here into a race. What a broken engine breaks is structure, and structure
    // is what this suite asks about.
    contextOptions: { reducedMotion: 'reduce' },
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],

  webServer: {
    cwd: REPO_ROOT,
    command: `pnpm build && pnpm exec vite preview app --port ${PORT} --strictPort`,
    url: `${BASE_URL}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
