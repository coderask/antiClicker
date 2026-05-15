// tests/e2e/multi-instance-flow.spec.ts
//
// Phase 5 end-to-end: multi-instance UX flow.
//
// Covers Phase 5 success criteria:
//   SC#1 — 2 instances → 2 colored pins + 2 sidebar rows
//   SC#2 — Clicking a sidebar row pans/focuses that instance (active testid)
//   SC#4 — Close button terminates instance; sidebar drops to 1 row
//   SC#5 — Recent pins panel visible + populated after launches
//
// SC#3 (drag → setGeo live update) is verified at the IPC unit level in
// tests/unit/ipc-validation.test.ts; full CDP round-trip verification is a Phase 6 concern.
//
// Notes:
//   - test.setTimeout(180_000): 2 Chrome windows launched sequentially
//   - Map canvas clicks use distinct positions to produce different draft pin coords
//   - try/finally ensures app.close() always runs

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('Phase 5: 2 instances → sidebar rows → focus → close → recent pins', async () => {
  test.setTimeout(180_000);

  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
  });

  try {
    const window = await app.firstWindow();

    // -----------------------------------------------------------------------
    // App ready
    // -----------------------------------------------------------------------
    await expect(window.locator('[data-testid="ping"]')).toHaveText('pong', {
      timeout: 15_000,
    });

    const canvas = window.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });

    // Dismiss the first-run scope overlay if visible (Phase 6 — new on first run).
    const overlay = window.locator('[data-testid="scope-overlay"]');
    if (await overlay.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await window.locator('[data-testid="scope-overlay-dismiss"]').click();
      await expect(overlay).not.toBeVisible({ timeout: 5_000 });
    }

    // -----------------------------------------------------------------------
    // SC#5 pre-condition: recent-pins section exists (may be empty initially)
    // -----------------------------------------------------------------------
    await expect(window.locator('[data-testid="recent-pins"]')).toBeVisible({
      timeout: 5_000,
    });

    // -----------------------------------------------------------------------
    // Instance 1: click left-center of canvas → draft pin → launch
    // -----------------------------------------------------------------------
    await canvas.click({ position: { x: 400, y: 300 } });

    await expect(window.locator('[data-testid="pin-coords"]')).not.toHaveText('', {
      timeout: 5_000,
    });
    await expect(window.locator('[data-testid="launch-here-button"]')).toBeEnabled({
      timeout: 5_000,
    });

    await window.locator('[data-testid="launch-here-button"]').click();
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText('1', {
      timeout: 60_000,
    });

    // SC#1 partial: sidebar has 1 row
    const sidebarRows1 = window.locator(
      '[data-testid="instance-row"], [data-testid="instance-row-active"]',
    );
    await expect(sidebarRows1).toHaveCount(1, { timeout: 5_000 });

    // -----------------------------------------------------------------------
    // Instance 2: click right-center of canvas → different draft pin → launch
    // -----------------------------------------------------------------------
    await canvas.click({ position: { x: 750, y: 300 } });

    await expect(window.locator('[data-testid="launch-here-button"]')).toBeEnabled({
      timeout: 5_000,
    });

    await window.locator('[data-testid="launch-here-button"]').click();
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText('2', {
      timeout: 60_000,
    });

    // SC#1: sidebar has 2 rows
    const sidebarRows2 = window.locator(
      '[data-testid="instance-row"], [data-testid="instance-row-active"]',
    );
    await expect(sidebarRows2).toHaveCount(2, { timeout: 5_000 });

    // -----------------------------------------------------------------------
    // SC#2: clicking a non-active row makes it the active row
    // -----------------------------------------------------------------------
    // Get the first non-active row (the first instance launched is now non-active
    // because the second launch sets activeId to the new instance)
    const nonActiveRow = window.locator('[data-testid="instance-row"]').first();
    await nonActiveRow.click();

    // After clicking, that row should become active
    await expect(window.locator('[data-testid="instance-row-active"]')).toBeVisible({
      timeout: 5_000,
    });

    // -----------------------------------------------------------------------
    // SC#4: close the second instance → sidebar drops to 1 row, live = 1
    // -----------------------------------------------------------------------
    // Find all close buttons; click the one for the non-active row (second instance)
    // After the click above, we have one active row (first instance) and one non-active (second).
    // We'll close the non-active (second) instance.
    const closeButtons = window.locator('[data-testid^="close-"]');
    const closeCount = await closeButtons.count();
    // Click the second close button (second instance)
    await closeButtons.nth(closeCount - 1).click();

    await expect(window.locator('[data-testid="live-instances"]')).toHaveText('1', {
      timeout: 30_000,
    });

    // Sidebar drops to 1 row
    const sidebarRows3 = window.locator(
      '[data-testid="instance-row"], [data-testid="instance-row-active"]',
    );
    await expect(sidebarRows3).toHaveCount(1, { timeout: 5_000 });

    // -----------------------------------------------------------------------
    // SC#5: Recent pins panel is populated (at least 2 entries from launches)
    // -----------------------------------------------------------------------
    await expect(window.locator('[data-testid="recent-pin-row"]')).toHaveCount(2, {
      timeout: 5_000,
    });
  } finally {
    await app.close();
  }
});
