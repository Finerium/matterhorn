/**
 * Playwright configuration for the Gate 3 app suite: the state matrix (AC-APP-1) and the
 * AC-APP flows (2-14, 16-20, 22-23).
 *
 * Post-install home: tests/e2e/app.config.ts, which testDir and snapshotDir are relative to.
 *   pnpm exec playwright test --config tests/e2e/app.config.ts
 *
 * Separate from playwright.config.ts rather than a second project inside it, for one reason:
 * the surface differs. Gate 2 drives the dev-only component harness at /harness.html; this
 * gate drives the real app at /app. Two servers, two ports, two snapshot roots, and a Gate 2
 * baseline that must not move when a Gate 3 state changes.
 *
 * The server is `vite app` in plain serve mode, which is SEED MODE: `__CONTENT_BASE__` points
 * at tests/fixtures/seed over /@fs and `__MTH_DEV__` is true, so `window.__mthGoto` exists.
 * Both are the same switch the harness rides, so nothing here is a test-only code path.
 *
 * Known ceiling, stated rather than hidden: serve mode has no service worker (vite.config.ts
 * leaves VitePWA out while serving). The AC-APP-17 offline block in flows.spec.ts is fixme'd
 * against this config and runs against a built preview instead. Everything else is honest here.
 *
 * Flake budget is Gate 2's, for the same reasons its config gives: workers 1, animations
 * frozen, locale and timezone pinned, device scale 2, platform in the snapshot path.
 */
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@playwright/test';

const PORT = 5219;
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: '.',
  // wide.spec.ts is the same app at desktop width; it sets its own viewport per block.
  testMatch: ['matrix.spec.ts', 'flows.spec.ts', 'wide.spec.ts'],
  // Separate from the Gate 2 root so a state screenshot and a panel screenshot never collide.
  snapshotDir: './__screenshots__/app',
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
      maxDiffPixelRatio: 0.01,
    },
  },

  use: {
    baseURL: BASE_URL,
    viewport: { width: 402, height: 874 },
    deviceScaleFactor: 2,
    contextOptions: { reducedMotion: 'reduce' },
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],

  webServer: {
    // pnpm resolves bins from the package root only; playwright spawns with the config's
    // directory as cwd, so pin it to the repo root explicitly. Same fix as the Gate 2 config.
    cwd: fileURLToPath(new URL('../..', import.meta.url)),
    command: `pnpm exec vite app --port ${PORT}`,
    // /app rather than /: vite's SPA fallback answers it, so a 200 here proves the router
    // boots, not merely that a port is open.
    url: `${BASE_URL}/app`,
    reuseExistingServer: process.env.CI === undefined,
    timeout: 120_000,
  },
});
