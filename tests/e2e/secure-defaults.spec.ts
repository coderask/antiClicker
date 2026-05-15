// FND-01 — secure webPreferences round-trip via Playwright Electron.
// Launches the BUILT app (out/main/index.js) so the production main entry
// is exercised — not the electron-vite dev server.

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('FND-01: webContents has secure webPreferences', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
  });
  const window = await app.firstWindow();

  await expect(window.locator('[data-testid="ping"]')).toHaveText('pong', {
    timeout: 10000,
  });

  const prefs = await app.evaluate(async ({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  );

  expect(prefs?.contextIsolation).toBe(true);
  expect(prefs?.nodeIntegration).toBe(false);
  expect(prefs?.sandbox).toBe(true);

  await app.close();
});
