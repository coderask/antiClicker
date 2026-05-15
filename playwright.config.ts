// playwright.config.ts
// Wave 0 Electron e2e config. Single "electron" project; specs use `_electron.launch()`
// from @playwright/test against out/main/index.js (built in plan 00-05). Traces retained
// only on failure to keep test-results/ small in CI.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'electron',
      testDir: 'tests/e2e',
    },
  ],
});
