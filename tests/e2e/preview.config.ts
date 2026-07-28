/**
 * Preview-backed config for the AC-APP-17 offline trio (and nothing else).
 *
 * Serve-mode vite has no service worker, so those three tests are fixme'd under
 * app.config.ts. This config builds the app, stages the seed content root into the
 * dist (the same indirection Gate C replaces with real content/), emits the permalink
 * shells, and serves the result with vite preview, which registers the real SW.
 *
 * MTH_PREVIEW is set here in the runner process; workers inherit it, and the
 * AC-APP-17 describe keys its fixme off it.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

process.env.MTH_PREVIEW = '1';

const PORT = 5223;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: 'flows.spec.ts',
  grep: /AC-APP-17/,
  snapshotDir: './__screenshots__/app',
  snapshotPathTemplate: '{snapshotDir}/{projectName}/{arg}-{platform}{ext}',

  fullyParallel: false,
  workers: 1,
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI !== undefined ? 2 : 0,
  reporter: [['list']],

  use: {
    baseURL: BASE_URL,
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    contextOptions: { reducedMotion: 'reduce' },
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    cwd: REPO_ROOT,
    command:
      'pnpm build && rm -rf app/dist/content && cp -R tests/fixtures/seed app/dist/content && pnpm build:permalinks --content tests/fixtures/seed && pnpm exec vite preview app --port 5223 --strictPort',
    url: `${BASE_URL}/app`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
