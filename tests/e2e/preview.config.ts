/**
 * Preview-backed config for the AC-APP-17 offline trio (and nothing else).
 *
 * Serve-mode vite has no service worker, so those three tests are fixme'd under
 * app.config.ts. This config builds the app and serves it with vite preview, which registers
 * the real SW, over the same published `content/` root the app suite reads: `pnpm build` runs
 * scripts/stage-dist.ts, which puts content/ where `__CONTENT_BASE__` points in a build, and
 * emits the permalink shells over it. Nothing is staged here, because the build already does
 * it; a second `rm -rf app/dist/content` in this file would only race the one in the build.
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
    command: 'pnpm build && pnpm exec vite preview app --port 5223 --strictPort',
    url: `${BASE_URL}/app`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
