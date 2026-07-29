/**
 * PROVES: AC-SEC-6. The e2e run records every network request and every one is same-origin.
 *
 * Post-install home: tests/e2e/net-collector.ts. The shape is console-collector.ts's on purpose:
 * `guardNetwork()` installs the before/after hooks for a whole spec file, `attachNetworkGuard`
 * is the same guard for one page when a test opens a second one or wants to assert mid-test.
 *
 * The claim under test is the privacy claim the product makes out loud: nothing about a reader
 * leaves this origin, because there is nothing to leave it to. No analytics, no font CDN, no
 * embed, no telemetry. That claim is only worth what a recording of the actual traffic says, so
 * this listens to `request` (every attempt, including one that fails, which is the one a
 * response-only listener would miss) and keeps the full URL of anything that is not same-origin.
 *
 * Same-origin is measured against the suite's `baseURL`, not against `page.url()`: at the moment
 * the first request fires the page is still about:blank, and a guard that compares against the
 * document's own origin would call the first navigation cross-origin and everything after it
 * fine, which is precisely backwards.
 *
 * Non-network schemes are not requests to anywhere. `data:` is bytes already in the document,
 * `blob:` is bytes the page itself made (the Nuance Card export, the constellation download), and
 * `about:`/`chrome-error:` are the browser talking to itself. They are recorded in the count and
 * excluded from the origin rule, because there is no third party at the other end of any of them.
 *
 * The allowlist is empty and has no mechanism to be non-empty. If Matterhorn ever needs a
 * third-party call, that is a product decision that contradicts a published claim, and it belongs
 * in the blueprint before it belongs here.
 */
import { expect, test, type Page, type Request } from '@playwright/test';

const LOCAL_SCHEME = /^(?:data|blob|about|chrome-error|filesystem):/;

interface Recorded {
  /** Every request URL the page attempted, in order, same-origin or not. */
  all: string[];
  /** The subset that left the origin. AC-SEC-6 asserts this is empty. */
  foreign: string[];
}

const collected = new WeakMap<Page, Recorded>();

/** Starts recording on `page`. Returns the assert, so a caller can also check mid-test. */
export function attachNetworkGuard(page: Page, baseURL: string | undefined): () => void {
  const record: Recorded = { all: [], foreign: [] };
  collected.set(page, record);
  const origin = baseURL === undefined ? undefined : new URL(baseURL).origin;

  page.on('request', (request: Request) => {
    const url = request.url();
    record.all.push(url);
    if (LOCAL_SCHEME.test(url)) return;
    if (origin !== undefined && new URL(url).origin === origin) return;
    record.foreign.push(`${request.method()} ${url} (${request.resourceType()})`);
  });

  return () => {
    expect(record.foreign, 'AC-SEC-6: the page made a request off this origin').toEqual([]);
  };
}

/** Everything a guarded page has requested so far. Empty for an unguarded page. */
export const networkRequests = (page: Page): string[] => collected.get(page)?.all ?? [];
export const foreignRequests = (page: Page): string[] => collected.get(page)?.foreign ?? [];

/** Installs the guard for every test in the calling spec file. One line per spec. */
export function guardNetwork(): void {
  test.beforeEach(({ page, baseURL }) => {
    attachNetworkGuard(page, baseURL);
  });
  test.afterEach(({ page }) => {
    expect(foreignRequests(page), 'AC-SEC-6: the page made a request off this origin').toEqual([]);
  });
}
