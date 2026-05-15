// FND-03 — electron-store launchCount persists across relaunches.
// Hermetic: each test run uses a fresh tmpdir as the userData dir,
// passed via the Chromium --user-data-dir CLI flag to both launches.
// Assertion is delta-based (count2 == count1 + 1), not absolute.

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

test('FND-03: electron-store launchCount persists across relaunches', async () => {
  const userDataDir = await mkdtemp(join(tmpdir(), 'anticlicker-e2e-'));
  const launchOptions = {
    args: [
      join(process.cwd(), 'out/main/index.js'),
      `--user-data-dir=${userDataDir}`,
    ],
  };

  // First launch — observe initial launchCount.
  const app1 = await electron.launch(launchOptions);
  const win1 = await app1.firstWindow();
  await expect(win1.locator('[data-testid="launch-count"]')).not.toHaveText('…', {
    timeout: 10000,
  });
  const count1Text = await win1.locator('[data-testid="launch-count"]').textContent();
  const count1 = Number(count1Text);
  expect(Number.isFinite(count1)).toBe(true);
  await app1.close();

  // Second launch — same userData dir, same options.
  const app2 = await electron.launch(launchOptions);
  const win2 = await app2.firstWindow();
  await expect(win2.locator('[data-testid="launch-count"]')).not.toHaveText('…', {
    timeout: 10000,
  });
  const count2 = Number(await win2.locator('[data-testid="launch-count"]').textContent());
  await app2.close();

  expect(count2).toBe(count1 + 1);
});
