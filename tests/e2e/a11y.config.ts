/**
 * Playwright configuration for the axe suite: AC-LAND-10, plus the two surfaces the blueprint
 * does not name and this repo scans anyway (`/app` and `/research`).
 *
 *   pnpm test:e2e:a11y
 *
 * Preview-backed, and for the same reason landing.config.ts is: the page under test has to be
 * the page that ships. A dev server's unminified CSS, its extra dev-only DOM and its lack of a
 * service worker are all things an accessibility claim about production must not rest on. The
 * command is the landing suite's verbatim, including `reuseExistingServer: false`: a build-backed
 * server that gets reused is a stale dist quietly passing.
 *
 * Its own port (5243) so it can run beside the landing and research previews, both of which take
 * a --strictPort.
 *
 * chromium only, deliberately. axe evaluates the accessibility tree and the computed styles, and
 * both are the DOM's, not the engine's; running the identical ruleset three times would triple
 * the wall clock and report the same violations. Cross-engine rendering is AC-APP-21's job and
 * lives in cross-browser.config.ts.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5243;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  // Pinned, like every config in this directory: they share one testDir and none may collect
  // another's specs.
  testMatch: ['a11y.spec.ts'],

  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],
  // Each test walks a surface and runs axe at every stop; the app walk has fifteen of them.
  timeout: 120_000,

  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    // Reduced motion is not a convenience here. axe samples computed colour, so an element caught
    // mid-fade reports the blend rather than the paint, and this suite would report contrast
    // failures that no reader ever sees. The spec additionally waits for every animation to stop.
    contextOptions: { reducedMotion: 'reduce' },
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    cwd: REPO_ROOT,
    command: `pnpm build && rm -rf app/dist/content && cp -R content app/dist/content && pnpm exec vite preview app --port ${PORT} --strictPort`,
    url: `${BASE_URL}/`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
