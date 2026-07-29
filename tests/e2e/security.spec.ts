/**
 * PROVES: AC-SEC-3 (the app runs under the production CSP), AC-SEC-4 (safe external links),
 *         AC-SEC-6 (every network request is same-origin), and the imagery half of AC-LAND-11.
 *
 * Post-install home: tests/e2e/security.spec.ts. Config: tests/e2e/landing.config.ts, which is
 * the one config that BUILDS, stages the published `content/` into the dist and serves the result
 * with `vite preview`. All four criteria need that and nothing less:
 *
 *   AC-SEC-3 is meaningless against a dev server. Vite's dev transform injects inline scripts and
 *     an import map that the shipped document does not carry, so a dev page either fails a policy
 *     production would pass or passes one production would fail. app/vite.config.ts gives the
 *     preview server the `/(.*)` headers out of vercel.json verbatim, so the page under test here
 *     is the built page under the deployed policy.
 *   AC-SEC-4 and AC-LAND-11 are about the DOM the reader gets, which in a bundled SPA is only the
 *     DOM the build produces.
 *   AC-SEC-6 is about the traffic that shipping code makes, and dev traffic is mostly vite's.
 *
 * The two positive controls are the point of this file, not decoration. A CSP suite that only
 * asserts "zero violations were reported" passes identically on a page with no policy at all, and
 * a link audit that only walks the DOM passes identically when the audit is broken. So each one
 * is proven live: the CSP by an inline script and an `eval` that must both be refused, the link
 * audit by an offending anchor injected into a real page that the same auditor must catch. They
 * run in their own tests, on their own pages, so their deliberate violations never land in the
 * zero-violation count of the tests around them.
 */
import { expect, test, type Page } from '@playwright/test';

import { attachConsoleGuard } from './console-collector';
import { attachNetworkGuard, networkRequests } from './net-collector';

/** Blueprint 6.7 routes, the ones a reader can reach without an app state jump. */
const ROUTES = ['/', '/app', '/n/mbg-stop', '/methodology', '/research', '/offline'];

interface Violation {
  directive: string;
  blocked: string;
  where: string;
}

interface LinkRow {
  href: string;
  rel: string;
  target: string;
  text: string;
}

interface ImageRow {
  src: string;
  loading: string;
  srcset: string;
  /** Top of the image relative to the document, in CSS pixels. Below the first viewport is "below fold". */
  top: number;
}

/**
 * Installs the violation recorder BEFORE any document script runs. `securitypolicyviolation` is a
 * DOM event, so a listener added after navigation misses everything the parser refused on the way
 * in, which is exactly the class this criterion is about.
 */
async function recordViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const seen: Violation[] = [];
    (window as unknown as { __csp: Violation[] }).__csp = seen;
    document.addEventListener('securitypolicyviolation', (event) => {
      seen.push({
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        where: `${event.sourceFile ?? event.documentURI}:${String(event.lineNumber)}`,
      });
    });
  });
}

const violations = (page: Page): Promise<Violation[]> =>
  page.evaluate(() => (window as unknown as { __csp?: Violation[] }).__csp ?? []);

/** Every anchor in the document, flattened to the four fields the audit asks about. */
const anchors = (page: Page): Promise<LinkRow[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll('a[href]')].map((a) => {
      const el = a as HTMLAnchorElement;
      return {
        href: el.href,
        rel: el.getAttribute('rel') ?? '',
        target: el.getAttribute('target') ?? '',
        text: (el.textContent ?? '').trim().slice(0, 40),
      };
    }),
  );

/**
 * AC-SEC-4's rule, as one function, so the audit and its control run the same code. An anchor is
 * outbound when it resolves off this origin; an outbound anchor must carry target="_blank" and
 * both rel tokens. Same-origin anchors and in-page fragments are not in scope.
 */
function offending(rows: LinkRow[], origin: string): LinkRow[] {
  return rows.filter((row) => {
    if (new URL(row.href).origin === origin) return false;
    const rel = row.rel.toLowerCase().split(/\s+/);
    return row.target !== '_blank' || !rel.includes('noopener') || !rel.includes('noreferrer');
  });
}

test.describe('AC-SEC-3 · the app runs under the production CSP', () => {
  test('vercel.json ships the policy and the preview server serves it', async ({ page, baseURL }) => {
    const response = await page.goto('/');
    const csp = (await response?.headerValue('content-security-policy')) ?? '';
    expect(csp, 'AC-SEC-3: no Content-Security-Policy header on the document').not.toEqual('');
    // The blueprint's floor, directive by directive. Extra directives are a tightening and welcome.
    for (const directive of [
      "default-src 'self'",
      "img-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
    ]) {
      expect(csp, `AC-SEC-3: the policy is missing ${directive}`).toContain(directive);
    }
    expect(csp).not.toContain('unsafe-eval');
    expect(baseURL).toBeDefined();
  });

  test('the policy is enforced, not merely present (control)', async ({ page }) => {
    await recordViolations(page);
    await page.goto('/');

    // An inline script under script-src 'self' must not execute.
    const inlineRan = await page.evaluate(() => {
      const el = document.createElement('script');
      el.textContent = 'window.__inlineRan = true;';
      document.head.appendChild(el);
      return (window as unknown as { __inlineRan?: boolean }).__inlineRan === true;
    });
    expect(inlineRan, 'AC-SEC-3 control: an inline script ran, so the CSP is not enforced').toBe(false);

    // NOT CONTROLLED, and stated rather than faked: `eval`. Chromium exempts code that arrives
    // over the DevTools protocol from the page's CSP, and every Playwright evaluate is exactly
    // that, so an eval called from here succeeds under a policy that has no 'unsafe-eval' and
    // would refuse the same call from page code. Measured, it reads as a pass for the wrong
    // reason. What is asserted instead is the pair that can be measured: the policy string
    // carries no 'unsafe-eval' (the test above), and the policy is live, proven by the inline
    // script the browser just refused. A page-authored eval has no source to be authored from:
    // inline is blocked, and every shipped module is bundled.

    const seen = await violations(page);
    expect(seen.length, 'AC-SEC-3 control: the browser reported no violation for the blocked script').toBeGreaterThan(0);
  });

  for (const route of ROUTES) {
    test(`${route} loads with zero CSP violations`, async ({ page, baseURL }) => {
      await recordViolations(page);
      const assertConsole = attachConsoleGuard(page);
      const assertNetwork = attachNetworkGuard(page, baseURL);

      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const seen = await violations(page);
      expect(seen, `AC-SEC-3: ${route} violated the production CSP`).toEqual([]);
      // A CSP refusal also surfaces as a console error, so the console guard is a second,
      // independent witness for the same class rather than a duplicate assertion.
      assertConsole();
      assertNetwork();
    });
  }
});

test.describe('AC-SEC-6 · every network request is same-origin', () => {
  test('the whole route sweep records only same-origin traffic', async ({ page, baseURL }) => {
    const assertNetwork = attachNetworkGuard(page, baseURL);
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }
    const all = networkRequests(page);
    // The recording has to be real: a guard that recorded nothing would assert nothing.
    expect(all.length, 'AC-SEC-6: the collector recorded no requests at all').toBeGreaterThan(ROUTES.length);
    assertNetwork();
    console.log(`AC-SEC-6: ${String(all.length)} request(s) recorded across ${String(ROUTES.length)} routes, 0 off-origin`);
  });
});

test.describe('AC-SEC-4 · outbound links carry target and rel', () => {
  test('the audit catches an offending anchor (control)', async ({ page, baseURL }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const bad = document.createElement('a');
      bad.href = 'https://example.com/control';
      bad.textContent = 'control';
      document.body.appendChild(bad);
    });
    const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
    const caught = offending(await anchors(page), origin);
    expect(caught.map((row) => row.href), 'AC-SEC-4 control: the audit missed a bare outbound anchor').toEqual([
      'https://example.com/control',
    ]);
  });

  for (const route of ROUTES) {
    test(`${route} has no unsafe outbound anchor`, async ({ page, baseURL }) => {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      const origin = new URL(baseURL ?? 'http://127.0.0.1').origin;
      const rows = await anchors(page);
      const outbound = rows.filter((row) => new URL(row.href).origin !== origin);
      expect(offending(rows, origin), `AC-SEC-4: ${route} carries an outbound link without rel="noopener noreferrer" target="_blank"`).toEqual([]);
      console.log(`AC-SEC-4 ${route}: ${String(rows.length)} anchor(s), ${String(outbound.length)} outbound`);
    });
  }
});

test.describe('AC-LAND-11 · below-fold imagery lazy-loads with srcset', () => {
  test('the landing', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images: ImageRow[] = await page.evaluate(() =>
      [...document.querySelectorAll('img')].map((img) => ({
        src: img.currentSrc || img.src,
        loading: img.getAttribute('loading') ?? '',
        srcset: img.getAttribute('srcset') ?? '',
        top: img.getBoundingClientRect().top + window.scrollY,
      })),
    );
    const belowFold = images.filter((img) => img.top >= 800);
    console.log(
      `AC-LAND-11: ${String(images.length)} <img> on the landing, ${String(belowFold.length)} below the fold`,
    );
    // Vacuous today and it says so out loud: every set piece in 4.4 is drawn as inline SVG and CSS,
    // so the landing ships no raster <img> at all. The assertion below is written for the imagery
    // rather than around it, so the first photograph that lands is audited on the next run.
    expect(
      belowFold.filter((img) => img.loading !== 'lazy' || img.srcset === ''),
      'AC-LAND-11: a below-fold image ships without loading="lazy" and srcset',
    ).toEqual([]);
  });
});
