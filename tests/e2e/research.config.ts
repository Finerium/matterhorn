/**
 * Playwright configuration for the Gate 5 desktop suite: `/research` (blueprint 3.2 item 18),
 * the wide-viewport frame and autopsy (items 19 and 20), and AC-PERF-4.
 *
 *   pnpm exec playwright test --config tests/e2e/research.config.ts
 *
 * Why its own config instead of a project inside app.config.ts: the surface and the content root
 * both differ.
 *
 *   surface   Gate 3 drives a 402 x 874 phone. Every test here is a desktop viewport, and the
 *             two that are not are asserting what happens BELOW 768, which is the same
 *             statement from the other side. A default viewport is not a per-test detail here,
 *             it is the subject.
 *   content   Gate 3 serves `vite app` in SEED MODE, so the app reads tests/fixtures/seed.
 *             This gate builds and previews, which is the only configuration in the repo where
 *             `__CONTENT_BASE__` is `/content`, and then stages the REAL published root into
 *             the dist. That matters because AC-PERF-4 aside, the export tests assert that
 *             downloaded rows equal content/ read from disk, and an export checked against
 *             fixtures would prove nothing about what a researcher downloads.
 *
 * The staging line is the same indirection preview.config.ts already uses for the offline
 * trio: `vite build` emits no content root of its own (app/vite.config.ts has no copy step),
 * so the suite puts one where the built bundle expects it. When the deploy gate adds that copy
 * to the build, this line becomes a no-op and can go.
 *
 * `serviceWorkers: 'block'`. A built bundle registers the real worker, and a worker between the
 * suite and the server would answer the perf fixture's intercepted request out of its own cache
 * and quietly measure the published 10-node graph instead of the 500-node one. Offline is
 * AC-APP-17's subject under preview.config.ts, not this gate's.
 *
 * testMatch is pinned to this gate's three specs, as every config in this directory pins its
 * own: they all share one testDir, and a suite that collects a sibling's spec runs it against
 * the wrong server. The port is its own for the same reason (5199 grammar, 5219 app, 5223
 * offline preview, 5227 landing, 5231 here): two --strictPort preview builds on one port is a
 * failure with nothing to do with the product.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5231;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: ['research.spec.ts', 'wide-viewport.spec.ts', 'constellation-perf.spec.ts'],
  // Nothing in this gate screenshots yet (the six Appendix A desktop rows still belong to
  // matrix.spec.ts). The root is declared so the first one written lands beside its siblings
  // rather than in tests/e2e/.
  snapshotDir: './__screenshots__/gate5',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}-{platform}{ext}',

  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],
  // A preview build plus a 10 s scripted gesture. The perf spec extends its own further.
  timeout: 60_000,

  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    // Blueprint 4.3 designs /research at 1024 and above; the state matrix notes 1280x800 for
    // the two desktop rows. Tests that are about another width say so with test.use.
    viewport: { width: 1280, height: 800 },
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    cwd: REPO_ROOT,
    command:
      'pnpm build && rm -rf app/dist/content && cp -R content app/dist/content && pnpm exec vite preview app --port 5231 --strictPort',
    // /research rather than /app: a 200 here is the SPA fallback answering, which is true before
    // the route exists, so the readiness probe stays honest about what it proves.
    url: `${BASE_URL}/research`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
