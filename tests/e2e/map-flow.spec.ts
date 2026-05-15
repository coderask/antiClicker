// tests/e2e/map-flow.spec.ts
//
// Phase 4 end-to-end: verifies the full Map UI flow.
//
// Flow:
//   1. Launch the built Electron app.
//   2. Wait for the app to be ready (ping = "pong").
//   3. Assert pin-coords is empty and launch-here-button is disabled.
//   4. Click on the map canvas to drop a pin.
//   5. Assert pin-coords updates to a non-empty value.
//   6. Assert launch-here-button becomes enabled.
//   7. Click launch-here-button.
//   8. Assert live-instances reaches "1".
//   9. Close the app.
//
// Notes:
//   - test.setTimeout is set to 120s: map load + tile fetch + Chrome launch all take time.
//   - The map canvas click uses a fixed position within the canvas; the exact coordinates
//     returned depend on the viewport and map projection but must be non-empty.
//   - The spawned Chrome window is visible during this test — this is expected.

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('Phase 4: map renders → click drops pin → launch-here → live-instances increments', async () => {
  test.setTimeout(120_000);

  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
  });

  try {
    const window = await app.firstWindow();

    // Wait for the app to be fully ready (Phase 0 round-trip passes).
    await expect(window.locator('[data-testid="ping"]')).toHaveText('pong', {
      timeout: 15_000,
    });

    // pin-coords should be empty initially (no pin dropped).
    await expect(window.locator('[data-testid="pin-coords"]')).toHaveText('', {
      timeout: 5_000,
    });

    // launch-here-button should be disabled (no pin set).
    await expect(window.locator('[data-testid="launch-here-button"]')).toBeDisabled({
      timeout: 5_000,
    });

    // Wait for the map canvas to appear (MapLibre renders a <canvas> element).
    const canvas = window.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 20_000 });

    // Click the map canvas to drop a pin. Position (600, 400) is center-ish;
    // exact coords don't matter — we just need any valid map click to register.
    await canvas.click({ position: { x: 600, y: 400 } });

    // pin-coords readout should now show a non-empty value.
    await expect(window.locator('[data-testid="pin-coords"]')).not.toHaveText('', {
      timeout: 5_000,
    });

    // launch-here-button should now be enabled.
    await expect(window.locator('[data-testid="launch-here-button"]')).toBeEnabled({
      timeout: 5_000,
    });

    // Click the launch-here button to launch a spoofed Chrome instance.
    await window.locator('[data-testid="launch-here-button"]').click();

    // live-instances counter should increment to 1.
    await expect(window.locator('[data-testid="live-instances"]')).toHaveText('1', {
      timeout: 30_000,
    });
  } finally {
    await app.close();
  }
});
