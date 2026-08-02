/**
 * PROVES: AC-DEP-2, AC-DEP-3, AC-DEP-4, AC-DEP-5, AC-DEP-6. The production smoke, run against
 * the LIVE deployment, never a local server.
 *
 *   pnpm exec playwright test --config tests/e2e/prod-smoke.config.ts
 *
 * The target origin is app/src/site.ts's SITE_URL, imported rather than restated, so the suite
 * always tests the origin the build stamped into its own og tags and QR payloads. Everything
 * here asserts what a reader's browser actually receives over the network: no dist reads, no
 * dev servers, no mocks.
 */
import { expect, test } from '@playwright/test';
import { SITE_URL } from '../../app/src/site';

test.describe('production smoke', () => {
  test('landing serves with the H1 and the CSP (AC-DEP-2, AC-DEP-6)', async ({ page }) => {
    const response = await page.goto(`${SITE_URL}/`);
    expect(response?.status()).toBe(200);
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp, 'AC-SEC-3 CSP must be live in production').toContain("default-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toContainText('Most people see the peak.');
  });

  test('the app renders the feed from published content (AC-DEP-2)', async ({ page }) => {
    // A fresh browser boots into onboarding, which is correct behaviour and not the thing this
    // test measures. Marking the device onboarded is a real reader preference (the same key the
    // app writes), not a mock of the content path.
    await page.addInitScript(() => {
      localStorage.setItem('mth:onboarded', '1');
    });
    await page.goto(`${SITE_URL}/app`);
    // mbg-stop is the id-pack hero and the app boots in English, so the EN display headline is
    // the one on screen.
    await expect(page.getByText('Stop MBG Permanently', { exact: false }).first()).toBeVisible({
      timeout: 20000,
    });
  });

  test('permalink og tags parse (AC-DEP-2)', async ({ page }) => {
    const response = await page.goto(`${SITE_URL}/n/mbg-stop`);
    expect(response?.status()).toBe(200);
    const og = async (property: string): Promise<string> =>
      (await page.locator(`meta[property="${property}"]`).getAttribute('content')) ?? '';
    expect(await og('og:title')).not.toBe('');
    expect(await og('og:description'), 'the frozen counts template').toMatch(/missing|unsourced|hidden/);
    const image = await og('og:image');
    expect(image.startsWith(SITE_URL), `og:image must be absolute on the deployed origin, got ${image}`).toBe(true);
    const fetched = await page.request.get(image);
    expect(fetched.status(), 'the og image itself must serve').toBe(200);
  });

  test('share target resolves a known URL (AC-DEP-2)', async ({ page }) => {
    const known = 'https://www.tribunnews.com/nasional/7844542';
    await page.goto(`${SITE_URL}/share?url=${encodeURIComponent(known)}`);
    await expect(page.getByTestId('share-decision')).toBeVisible({ timeout: 20000 });
  });

  test('manifest serves with the relative share_target (AC-DEP-2)', async ({ request }) => {
    const response = await request.get(`${SITE_URL}/manifest.webmanifest`);
    expect(response.status()).toBe(200);
    const manifest = (await response.json()) as {
      share_target?: { action?: string };
      icons?: Array<{ src: string }>;
    };
    expect(manifest.share_target?.action, 'the action stays RELATIVE (research Section 4 pitfall)').toBe('/share');
    expect(manifest.icons?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  test('service worker registers on the live origin (AC-DEP-2)', async ({ page }) => {
    await page.goto(`${SITE_URL}/app`);
    const registered = await page.waitForFunction(
      async () => (await navigator.serviceWorker.getRegistrations()).length > 0,
      undefined,
      { timeout: 30000 },
    );
    expect(await registered.jsonValue()).toBe(true);
  });

  test('every 6.7 route answers 200 (AC-DEP-3)', async ({ request }) => {
    for (const route of ['/', '/app', '/research', '/methodology', '/n/mbg-stop', '/share', '/offline']) {
      const response = await request.get(`${SITE_URL}${route}`);
      expect(response.status(), `${route} must serve`).toBe(200);
    }
    const missing = await request.get(`${SITE_URL}/n/does-not-exist`);
    // Permalink shells are real files; an unknown id falls to the SPA shell, whose router 404s
    // client-side. The HTTP layer answering 200 with the shell is the platform's contract.
    expect([200, 404]).toContain(missing.status());
  });

  test('robots and sitemap (AC-DEP-4)', async ({ request }) => {
    const robots = await request.get(`${SITE_URL}/robots.txt`);
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('Allow: /');
    const sitemap = await request.get(`${SITE_URL}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
    const xml = await sitemap.text();
    for (const path of ['/', '/methodology', '/n/mbg-stop', '/n/tariffs-pay']) {
      expect(xml, `sitemap lists ${path}`).toContain(`${SITE_URL}${path}`);
    }
  });

  test('icons serve and parse (AC-DEP-5)', async ({ request }) => {
    for (const icon of ['icon-192.png', 'icon-512.png', 'maskable-192.png', 'maskable-512.png']) {
      const response = await request.get(`${SITE_URL}/icons/${icon}`);
      expect(response.status(), `${icon} must serve`).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
      expect((await response.body()).subarray(1, 4).toString(), `${icon} must be a real PNG`).toBe('PNG');
    }
  });

  test('immutable and revalidating cache headers split correctly (AC-DEP-6, AC-PERF-7)', async ({ page, request }) => {
    await page.goto(`${SITE_URL}/`);
    const hashed = await page.evaluate(() => {
      const script = document.querySelector<HTMLScriptElement>('script[src*="/assets/"]');
      return script?.src ?? '';
    });
    expect(hashed, 'the landing must load a hashed chunk').not.toBe('');
    const chunk = await request.get(hashed);
    expect(chunk.headers()['cache-control']).toContain('immutable');
    const og = await request.get(`${SITE_URL}/assets/og/mbg-stop.jpg`);
    expect(og.headers()['cache-control'], 'stable-name imagery must NOT claim immutability').not.toContain('immutable');
  });
});
