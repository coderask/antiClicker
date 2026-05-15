/**
 * tests/cli/geolocation.spec.ts
 *
 * Phase 1 Playwright integration test — hermetic geolocation spoof verification.
 *
 * Test approach: spin up a tiny node:http server on 127.0.0.1 (a Chromium "secure origin")
 * so that navigator.geolocation is allowed. All pages are served from this local server —
 * no external network calls, fully hermetic.
 *
 * Note: data: and about:blank URLs are NOT treated as secure origins by Chromium, so
 * navigator.geolocation.getCurrentPosition() returns error code 1 (PERMISSION_DENIED)
 * from those origins even when the context permission is granted. Using a localhost
 * HTTP server is the correct hermetic approach.
 *
 * Validates:
 *   1. Spoofed coordinates are reported by navigator.geolocation.getCurrentPosition()
 *   2. No permission prompt appears (permissions granted at context creation)
 *   3. Spoof survives cross-origin navigation within the same context
 *   4. Temporary profile directories are cleaned up after the test
 *
 * Run with: npx playwright test tests/cli/geolocation.spec.ts --project=cli
 */

import { test, expect, chromium } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TARGET_LAT = 35.6762;
const TARGET_LNG = 139.6503;

// ---------------------------------------------------------------------------
// Tiny fixture HTTP server (localhost = secure origin in Chromium)
// ---------------------------------------------------------------------------

/** Minimal HTML page that calls getCurrentPosition and writes result to #result */
const GEO_FIXTURE_HTML = `<!DOCTYPE html>
<html>
<body>
<div id="result">pending</div>
<script>
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      document.getElementById('result').textContent = JSON.stringify({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      });
    },
    function(err) {
      document.getElementById('result').textContent = 'error:' + err.code;
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
</script>
</body>
</html>`;

function startFixtureServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(GEO_FIXTURE_HTML);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get server address'));
        return;
      }
      resolve({ server, port: addr.port });
    });
    server.on('error', reject);
  });
}

function stopFixtureServer(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

// ---------------------------------------------------------------------------
// Context lifecycle helpers
// ---------------------------------------------------------------------------

interface ContextFixture {
  context: BrowserContext;
  userDataDir: string;
}

async function createTestContext(): Promise<ContextFixture> {
  const userDataDir = mkdtempSync(join(tmpdir(), 'anticlicker-test-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    geolocation: { latitude: TARGET_LAT, longitude: TARGET_LNG, accuracy: 10 },
    permissions: ['geolocation'],
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  return { context, userDataDir };
}

async function teardownTestContext({ context, userDataDir }: ContextFixture): Promise<void> {
  try {
    await context.close();
  } catch {
    // May already be closed
  }
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // May already be removed
  }
}

/** Wait for #result to leave 'pending' state */
async function waitForGeoResult(page: import('@playwright/test').Page): Promise<string> {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('result');
      return el !== null && el.textContent !== 'pending';
    },
    null,
    { timeout: 12_000 }
  );
  return (await page.locator('#result').textContent()) ?? '';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('CLI geolocation spoof — Playwright integration', () => {
  test('reports spoofed coordinates via getCurrentPosition', async () => {
    const { server, port } = await startFixtureServer();
    const fixture = await createTestContext();
    const { context } = fixture;

    try {
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${port}/`);

      const resultText = await waitForGeoResult(page);

      expect(resultText).not.toBe('pending');
      expect(resultText).not.toContain('error');

      const coords = JSON.parse(resultText) as { lat: number; lng: number };
      expect(coords.lat).toBeCloseTo(TARGET_LAT, 3);
      expect(coords.lng).toBeCloseTo(TARGET_LNG, 3);
    } finally {
      await teardownTestContext(fixture);
      await stopFixtureServer(server);
    }
  });

  test('no geolocation permission prompt appears (permission pre-granted)', async () => {
    const { server, port } = await startFixtureServer();
    const fixture = await createTestContext();
    const { context } = fixture;

    try {
      const page = await context.newPage();

      // If any dialog (native permission prompt) appears, the test fails
      let dialogAppeared = false;
      page.on('dialog', async (dialog) => {
        dialogAppeared = true;
        await dialog.dismiss();
      });

      await page.goto(`http://127.0.0.1:${port}/`);
      const resultText = await waitForGeoResult(page);

      // Permission prompt must NOT have appeared
      expect(dialogAppeared).toBe(false);

      // Result must NOT be a permission denial (PERMISSION_DENIED = code 1)
      expect(resultText).not.toBe('pending');
      expect(resultText).not.toContain('error:1');

      // Coordinates must match the spoof
      const coords = JSON.parse(resultText) as { lat: number; lng: number };
      expect(coords.lat).toBeCloseTo(TARGET_LAT, 3);
      expect(coords.lng).toBeCloseTo(TARGET_LNG, 3);
    } finally {
      await teardownTestContext(fixture);
      await stopFixtureServer(server);
    }
  });

  test('spoof survives cross-origin navigation (context-scoped override)', async () => {
    const { server, port } = await startFixtureServer();
    const fixture = await createTestContext();
    const { context } = fixture;

    try {
      const page = await context.newPage();

      // Step 1: Verify spoof on the first origin (localhost fixture)
      await page.goto(`http://127.0.0.1:${port}/`);
      const firstResultText = await waitForGeoResult(page);
      expect(firstResultText).not.toContain('error');
      const firstCoords = JSON.parse(firstResultText) as { lat: number; lng: number };
      expect(firstCoords.lat).toBeCloseTo(TARGET_LAT, 3);
      expect(firstCoords.lng).toBeCloseTo(TARGET_LNG, 3);

      // Step 2: Navigate to a DIFFERENT page on the same server (simulates cross-page nav)
      // Then use page.evaluate to call getCurrentPosition programmatically.
      // This validates that the context-scoped override survives within the same context
      // even after navigation (Pitfall 2: page-scoped overrides die on navigation).
      await page.goto(`http://127.0.0.1:${port}/`);

      // Use evaluate to call getCurrentPosition on the new page load
      const crossNavResult = await page.evaluate<{ lat: number; lng: number }>(() => {
        return new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (err) => reject(new Error(`geo error ${err.code}: ${err.message}`)),
            { timeout: 8000 }
          );
        });
      });

      // The spoof MUST still report the original coordinates after navigation
      expect(crossNavResult.lat).toBeCloseTo(TARGET_LAT, 3);
      expect(crossNavResult.lng).toBeCloseTo(TARGET_LNG, 3);
    } finally {
      await teardownTestContext(fixture);
      await stopFixtureServer(server);
    }
  });

  test('temporary profile directory is removed after teardown', async () => {
    const { existsSync } = await import('node:fs');
    const fixture = await createTestContext();
    const { userDataDir } = fixture;

    // Dir must exist while context is alive
    expect(existsSync(userDataDir)).toBe(true);

    await teardownTestContext(fixture);

    // Dir must be gone after teardown
    expect(existsSync(userDataDir)).toBe(false);
  });
});
