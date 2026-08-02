/**
 * The production smoke (AC-DEP-2..6): runs prod-smoke.spec.ts against the LIVE origin from
 * app/src/site.ts. No webServer block on purpose: a smoke that can fall back to a local server
 * is a smoke that can pass while production is down.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'prod-smoke.spec.ts',

  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: [['list']],
  timeout: 60000,

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
