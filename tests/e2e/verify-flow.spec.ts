// tests/e2e/verify-flow.spec.ts
//
// Phase 6 end-to-end: verify-spoof flow.
//
// Flow:
//   1. Launch the app
//   2. Set a draft pin via coord input
//   3. Click "Launch here" → wait for instance row
//   4. Click the verify-{id} button on the sidebar row
//   5. Assert verify-result-{id} appears showing "match" (green indicator)
//
// The verify flow calls navigator.geolocation.getCurrentPosition inside the
// launched Chrome. Since we spoof the coords at launch, this should match.
// Uses headless Chromium via Playwright's bundled browser.
//
// Timeout: 120s — Chrome launch can be slow on first run.

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('Phase 6: launch → verify spoof → match result appears in sidebar', async () => {
  test.setTimeout(120_000);

  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
  });

  try {
    const window = await app.firstWindow();

    // Wait for app ready
    await expect(window.locator('[data-testid="ping"]')).toHaveText('pong', {
      timeout: 15_000,
    });

    // Dismiss scope overlay if shown (first run)
    const overlay = window.locator('[data-testid="scope-overlay"]');
    if (await overlay.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await window.locator('[data-testid="scope-overlay-dismiss"]').click();
      await expect(overlay).not.toBeVisible({ timeout: 5_000 });
    }

    // Enter Tokyo coordinates via the coord input form to set the draft pin
    await window.locator('[data-testid="lat-input"]').fill('35.6762');
    await window.locator('[data-testid="lng-input"]').fill('139.6503');
    await window.locator('[data-testid="coord-submit"]').click();

    // Wait for launch button to be enabled
    await expect(window.locator('[data-testid="launch-here-button"]')).toBeEnabled({
      timeout: 5_000,
    });

    // Launch Chrome at Tokyo
    await window.locator('[data-testid="launch-here-button"]').click();

    // Wait for live-instances counter to reach 1
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText('1', {
      timeout: 60_000,
    });

    // Find the instance row in the sidebar
    const instanceRow = window.locator(
      '[data-testid="instance-row"], [data-testid="instance-row-active"]',
    ).first();
    await expect(instanceRow).toBeVisible({ timeout: 5_000 });

    // Get the instance ID from the verify button's data-testid
    // The button is data-testid="verify-{id}"
    const verifyButton = window.locator('[data-testid^="verify-"]').first();
    await expect(verifyButton).toBeVisible({ timeout: 5_000 });

    const verifyTestId = await verifyButton.getAttribute('data-testid');
    const instanceId = verifyTestId?.replace('verify-', '') ?? '';
    expect(instanceId).toBeTruthy();

    // Click verify
    await verifyButton.click();

    // Wait for result to appear
    const resultLocator = window.locator(`[data-testid="verify-result-${instanceId}"]`);
    await expect(resultLocator).toBeVisible({ timeout: 30_000 });

    // Assert the result shows "match" (green indicator)
    await expect(resultLocator).toContainText('match', { timeout: 5_000 });
  } finally {
    await app.close();
  }
});
