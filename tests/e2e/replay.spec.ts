/**
 * PROVES: the replay console and the publish handoff of docs/replay-protocol.md.
 *
 * Four claims, each the protocol's own words:
 *   1. The console replays the RECORDED run: the honest disclosure stays visible, and a
 *      narrative whose ledger carries a real block shows that block's reason line.
 *   2. The published state carries a QR image (the cross-device door).
 *   3. Publishing posts {type:'published'} on BroadcastChannel mth-updates (the same-machine
 *      door), observed by a listener in the test page, not inferred.
 *   4. The QR door works without any broadcast: /n/{id}?published=1 shows the update badge.
 *
 * Runs under research.config.ts, which serves the built app with published content, the same
 * bytes production serves. Reduced motion is on in that config, so the console renders its
 * completed timeline instantly and these tests read the finished state rather than racing a
 * typewriter.
 */
import { expect, test } from '@playwright/test';

test.describe('the replay console', () => {
  test('replays the recorded run under the honest disclosure, blocks included', async ({ page }) => {
    await page.goto('/research');
    // usaid-deficit's ledger carries two real round-2 blocks, so its replay must show one.
    await page.locator('[data-testid="research-row"][data-narrative="usaid-deficit"]').getByTestId('replay-run-row').click();
    await expect(page.getByTestId('replay-console')).toBeVisible();
    await expect(page.getByTestId('replay-disclosure')).toContainText('run-2026-07-29');
    await expect(page.getByTestId('replay-disclosure')).toContainText('compressed');
    await expect(page.getByTestId('replay-console')).toContainText('claude-fable-5');
    await expect(
      page.getByTestId('replay-console').locator('[data-kind="block"]').first(),
      'the real A10/A11 block rounds are part of the record and must replay',
    ).toBeVisible();
    await expect(page.getByTestId('replay-published')).toBeVisible();
  });

  test('the published state carries the QR door', async ({ page }) => {
    await page.goto('/research');
    await page.locator('[data-testid="research-row"][data-narrative="mbg-stop"]').getByTestId('replay-run-row').click();
    const published = page.getByTestId('replay-published');
    await expect(published).toBeVisible();
    await expect(
      published.locator('svg, img'),
      'the QR is the cross-device channel; a static host cannot push',
    ).toBeVisible();
    await expect(published).toContainText(/[0-9a-f]{12}/);
  });

  test('publishing posts on mth-updates, observed rather than inferred', async ({ page }) => {
    await page.goto('/research');
    const heard = page.evaluate(
      () =>
        new Promise<{ type: string; narrative_id: string }>((resolvePromise) => {
          new BroadcastChannel('mth-updates').onmessage = (event) => {
            resolvePromise(event.data as { type: string; narrative_id: string });
          };
        }),
    );
    await page.locator('[data-testid="research-row"][data-narrative="ppn-panic"]').getByTestId('replay-run-row').click();
    await expect(page.getByTestId('replay-published')).toBeVisible();
    const message = await heard;
    expect(message.type).toBe('published');
    expect(message.narrative_id).toBe('ppn-panic');
  });

  test('the QR door: /n/{id}?published=1 shows the update badge with no broadcast', async ({ page }) => {
    await page.goto('/n/mbg-stop?published=1');
    await expect(page.getByTestId('updated-badge').first()).toBeVisible({ timeout: 15000 });
    // The QR door lands ON the autopsy, and per the protocol opening the autopsy CONSUMES the
    // update: the badge stays for this visit (in-memory), while storage is cleared so the feed
    // does not keep badging a dissection the reader has already seen.
    const persisted = await page.evaluate(() => localStorage.getItem('mth:updated') ?? '');
    expect(persisted, 'opening the autopsy consumes the persisted update').not.toContain('mbg-stop');
    await expect(page.getByTestId('updated-badge').first(), 'but the badge survives the visit').toBeVisible();
  });
});
