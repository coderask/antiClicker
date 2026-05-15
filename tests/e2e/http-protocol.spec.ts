// FND-02 — renderer loaded over http://, never file://.
// Asserts both the Playwright window.url() (the actual loaded URL) and the
// renderer's own [data-testid="protocol"] readout to catch the case where
// the URL is right but the renderer's location object disagrees.

import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('FND-02: renderer loaded over http://', async () => {
  const app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')],
  });
  const window = await app.firstWindow();

  const url = window.url();
  expect(url.startsWith('http://')).toBe(true);
  expect(url.startsWith('file://')).toBe(false);

  await expect(window.locator('[data-testid="protocol"]')).toHaveText('http:', {
    timeout: 10000,
  });

  await app.close();
});
