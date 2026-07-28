/**
 * PROVES: AC-APP-22. Zero console errors and zero uncaught rejections across the e2e run.
 *
 * Post-install home: tests/e2e/console-collector.ts.
 *
 * Two listeners, one assertion. `console` with type `error` catches everything the app logs
 * and everything Chromium logs on its behalf (a failed subresource, a React error boundary
 * report, a CSP refusal). `pageerror` catches a thrown error that reached the top and, in
 * Chromium, an unhandled promise rejection too, which is the half a console-only collector
 * misses.
 *
 * Wiring. `guardConsole()` installs the before/after hooks for a whole spec file and is what
 * matrix.spec.ts and flows.spec.ts call. `attachConsoleGuard(page)` is the same guard for one
 * page, returning its own assert, for a test that opens a second page or wants to assert
 * mid-test.
 *
 * NOT WIRED, deliberately: tests/e2e/grammar.spec.ts is frozen at Gate 2 and imports `test`
 * straight from @playwright/test, so there is no seam to install a hook through. Playwright's
 * config `use` block sets option values only; it cannot add a fixture, so no config-level
 * global wiring exists either. The orchestrator has two ways to close that gap when grammar
 * unfreezes: add `guardConsole()` to the top of grammar.spec.ts, or move both configs onto a
 * shared `test` export from this file. Until then AC-APP-22 is asserted across the app config's
 * two specs and stated as such in the gate report.
 *
 * The allowlist is empty on purpose. If the app needs an exception, the exception is a product
 * decision and belongs here with a named reason, not in a regex that quietly swallows a class.
 */
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/** Text of every console error and page error a guarded page has produced. */
const collected = new WeakMap<Page, string[]>();

const describeMessage = (message: ConsoleMessage): string => {
  const at = message.location();
  return `console.error: ${message.text()} (${at.url}:${String(at.lineNumber)})`;
};

/**
 * Starts collecting on `page`. Returns the assert, so a caller that wants to check mid-test
 * can, and `guardConsole` can hold it for the afterEach.
 */
export function attachConsoleGuard(page: Page): () => void {
  const errors: string[] = [];
  collected.set(page, errors);

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    // Named exception, offline suite only (MTH_PREVIEW): the service worker answers an
    // honest 504 for content JSON it never cached, and Chromium logs any 5xx subresource
    // as a console error. That is the documented offline contract, not an app defect.
    // Everywhere else the zero-error rule stands untouched.
    if (
      process.env.MTH_PREVIEW !== undefined &&
      /\/content\/.+\.json/.test(message.location().url) &&
      /status of 5\d\d/.test(message.text())
    ) {
      return;
    }
    errors.push(describeMessage(message));
  });
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return () => {
    expect(errors, 'AC-APP-22: the page logged errors').toEqual([]);
  };
}

/** Everything a guarded page has logged so far. Empty for an unguarded page. */
export const consoleErrors = (page: Page): string[] => collected.get(page) ?? [];

/** Installs the guard for every test in the calling spec file. One line per spec. */
export function guardConsole(): void {
  test.beforeEach(({ page }) => {
    attachConsoleGuard(page);
  });
  test.afterEach(({ page }) => {
    expect(consoleErrors(page), 'AC-APP-22: the page logged errors').toEqual([]);
  });
}
