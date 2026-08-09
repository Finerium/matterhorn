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
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.describe('the replay console', () => {
  test('replays the recorded run under the honest disclosure, blocks included', async ({ page }) => {
    await page.goto('/research');
    // usaid-deficit's ledger carries two real round-2 blocks, so its replay must show one.
    await page.locator('[data-testid="research-row"][data-narrative="usaid-deficit"]').getByTestId('replay-run-row').click();
    await expect(page.getByTestId('replay-console')).toBeVisible();
    await expect(page.getByTestId('replay-disclosure')).toContainText('run-2026-07-29');
    await expect(page.getByTestId('replay-disclosure')).toContainText('run-2026-08-10');
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

test.describe('the whole span, A1 to A13, with output notes', () => {
  test('every recorded narrative replays: curation lines, output notes, release lines', async ({ page }) => {
    const replay = JSON.parse(
      readFileSync(new URL('../../content/replay.json', import.meta.url), 'utf8'),
    ) as {
      narratives: Array<{
        narrative_id: string;
        run_id: string;
        events: Array<{ kind: string; role?: string; note?: { en: string; id: string }; token?: string }>;
      }>;
    };
    expect(replay.narratives.length, 'the two run logs carry eleven narratives between them').toBe(11);
    for (const run of replay.narratives) {
      const notes = run.events.filter((event) => event.note !== undefined).length;
      expect(notes, `${run.narrative_id} carries output notes for its agents`).toBeGreaterThan(0);

      await page.goto(`/research?replay=${run.narrative_id}`);
      const pane = page.getByTestId('replay-console');
      await expect(pane).toBeVisible();
      await expect(page.getByTestId('replay-disclosure')).toContainText('distillation');
      // The record decides the lines: every note in the data is a note on screen, and the span
      // runs from the Scout's curation to the Librarian's filing.
      await expect(pane.locator('[data-kind="note"]')).toHaveCount(notes);
      await expect(pane, 'the header names the run this narrative was recorded in').toContainText(
        `${run.run_id} · ${run.narrative_id}`,
      );
      await expect(pane).toContainText('A1 ·');
      await expect(pane).toContainText('A13 ·');
      if (run.events.some((event) => event.kind === 'published' && event.token !== '')) {
        await expect(page.getByTestId('replay-published')).toBeVisible();
      }
    }
  });
});
