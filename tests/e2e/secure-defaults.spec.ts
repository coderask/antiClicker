// FND-01 — filled in by plan 00-06
// Asserts the Electron BrowserWindow boots with secure webPreferences:
//   { contextIsolation: true, nodeIntegration: false, sandbox: true }
// Wave 0 stub: skipped until 00-06 wires in the real e2e launch + assertion.

import { _electron as electron, expect, test } from '@playwright/test';

test.skip('FND-01: BrowserWindow has secure webPreferences (contextIsolation, !nodeIntegration, sandbox)', async () => {
  // Will be implemented by plan 00-06.
  // Reference electron so the import is not flagged as unused by linters.
  void electron;
  void expect;
});
