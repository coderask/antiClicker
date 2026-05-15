// playwright.config.ts
// Multi-project Playwright config:
//   - "electron": Electron e2e tests in tests/e2e/ (use _electron.launch)
//   - "cli": Phase 1 CLI geolocation integration tests in tests/cli/ (use Playwright Chromium directly)
//   - "launcher": Phase 2 multi-instance launcher integration tests in tests/launcher/
// Traces retained only on failure to keep test-results/ small.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'electron',
      testDir: 'tests/e2e',
    },
    {
      name: 'cli',
      testDir: 'tests/cli',
      testMatch: '**/*.spec.ts',
    },
    {
      name: 'launcher',
      testDir: 'tests/launcher',
      testMatch: '**/*.spec.ts',
      // 10-rapid-relaunch test needs extra time; each launch/close cycle ~5s
      timeout: 120_000,
    },
  ],
});
