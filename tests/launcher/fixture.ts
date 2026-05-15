/**
 * tests/launcher/fixture.ts
 *
 * Shared localhost HTTP fixture helpers for launcher integration tests.
 *
 * A localhost HTTP server is required because Chromium treats data: and about:blank
 * as non-secure origins, blocking navigator.geolocation.getCurrentPosition() even
 * when the context permission is granted. 127.0.0.1 is a secure context.
 *
 * Exports:
 *   GEO_FIXTURE_HTML     — calls getCurrentPosition, writes result to #result
 *   COOKIE_FIXTURE_HTML  — sets/reads document.cookie, writes to #cookie-result
 *   startGeoFixtureServer() — starts server, returns { url, close }
 *   waitForGeoResult(page)  — waits for #result to leave 'pending'
 */

import { createServer, type Server } from 'node:http';
import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// HTML fixtures
// ---------------------------------------------------------------------------

/** Geolocation fixture: calls getCurrentPosition and writes JSON to #result */
export const GEO_FIXTURE_HTML = `<!DOCTYPE html>
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

/** Cookie fixture: sets a test cookie and writes all cookies to #cookie-result */
export const COOKIE_FIXTURE_HTML = `<!DOCTYPE html>
<html>
<body>
<div id="cookie-result">pending</div>
<script>
  // Set an instance-specific cookie using a URL param as the value
  var params = new URLSearchParams(window.location.search);
  var instanceId = params.get('id') || 'unknown';
  document.cookie = 'instance=' + instanceId + '; path=/';
  // Write all cookies to the result div
  document.getElementById('cookie-result').textContent = document.cookie;
</script>
</body>
</html>`;

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export interface FixtureServer {
  /** Base URL — e.g. http://127.0.0.1:54321 */
  url: string;
  /** Stop the server and release the port. */
  close(): Promise<void>;
}

/**
 * Start the fixture HTTP server on an ephemeral port.
 * Routes:
 *   /cookie  — serves COOKIE_FIXTURE_HTML
 *   all else — serves GEO_FIXTURE_HTML
 */
export function startGeoFixtureServer(): Promise<FixtureServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((_req, res) => {
      const isCookie = _req.url?.startsWith('/cookie');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(isCookie ? COOKIE_FIXTURE_HTML : GEO_FIXTURE_HTML);
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Failed to get fixture server address'));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}`;
      resolve({
        url,
        close: () =>
          new Promise<void>((res, rej) =>
            server.close((err) => (err ? rej(err) : res())),
          ),
      });
    });

    server.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------

/** Wait for #result to leave 'pending' (geolocation call has resolved or errored). */
export async function waitForGeoResult(page: Page): Promise<string> {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('result');
      return el !== null && el.textContent !== 'pending';
    },
    null,
    { timeout: 12_000 },
  );
  return (await page.locator('#result').textContent()) ?? '';
}

/** Wait for #cookie-result to leave 'pending'. */
export async function waitForCookieResult(page: Page): Promise<string> {
  await page.waitForFunction(
    () => {
      const el = document.getElementById('cookie-result');
      return el !== null && el.textContent !== 'pending';
    },
    null,
    { timeout: 8_000 },
  );
  return (await page.locator('#cookie-result').textContent()) ?? '';
}
