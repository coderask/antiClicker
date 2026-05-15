// tests/e2e/launch-flow.spec.ts
//
// Phase 3 end-to-end: verifies the full IPC chain from renderer → main → Playwright launcher.
// Updated for Phase 4 UI: the old "launch-button" hardcoded to Tokyo is replaced by
// the MapUI's launch-here-button. This test sets the pin via the coord input form first.
//
// Flow:
//   1. Launch the built Electron app.
//   2. Wait for the app to be ready (ping = "pong").
//   3. Enter Tokyo coordinates into the coord input form and submit.
//   4. Click the "Launch here" button.
//   5. Assert live-instances counter reaches "1" (Chrome window appeared).
//   6. Call window.api.list() via evaluate — assert length=1, correct coordinates.
//   7. Call window.api.close(id) via evaluate — assert counter returns to "0".
//   8. Close the app.
//
// Notes:
//   - test.setTimeout is set to 90s because Playwright's bundled Chromium launch can
//     take several seconds the first time (binary extraction + startup).
//   - The spawned Chrome window will be visible during this test. That is expected.
//   - We use try/finally to guarantee app.close() even on failure.

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('Phase 3: set pin → launch-here button → Chrome appears → counter increments → close → counter decrements', async () => {
  test.setTimeout(90_000);

  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
  });

  try {
    const window = await app.firstWindow();

    // Wait for the app to be fully ready (Phase 0 round-trip passes).
    await expect(window.locator('[data-testid="ping"]')).toHaveText('pong', {
      timeout: 15_000,
    });

    // Live-instances counter should start at 0.
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText(
      '0',
      { timeout: 5_000 },
    );

    // Enter Tokyo coordinates via the coord input form to set the pin.
    await window.locator('[data-testid="lat-input"]').fill('35.6762');
    await window.locator('[data-testid="lng-input"]').fill('139.6503');
    await window.locator('[data-testid="coord-submit"]').click();

    // Wait for pin-coords to reflect the submitted coordinates.
    await expect(window.locator('[data-testid="pin-coords"]')).not.toHaveText('', {
      timeout: 5_000,
    });

    // Click the Launch here button.
    await window.locator('[data-testid="launch-here-button"]').click();

    // Counter should increment to 1 within 30s (Chrome launch + IPC round-trip).
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText(
      '1',
      { timeout: 30_000 },
    );

    // Verify list() returns an instance with the expected coordinates.
    const instances = await window.evaluate(() => window.api.list());
    expect(instances).toHaveLength(1);
    expect(instances[0]!.coords.latitude).toBeCloseTo(35.6762, 2);
    expect(instances[0]!.coords.longitude).toBeCloseTo(139.6503, 2);

    const instanceId = instances[0]!.id;

    // Close the instance via IPC.
    await window.evaluate((id) => window.api.close(id), instanceId);

    // Counter should return to 0.
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText(
      '0',
      { timeout: 15_000 },
    );
  } finally {
    await app.close();
  }
});
