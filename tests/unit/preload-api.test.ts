// preload API shape — filled in by plan 00-06
// Asserts the preload exposes only the narrow typed window.api surface and does NOT
// expose raw ipcRenderer (FND-01 success criterion #4). Wave 0 stub: skipped until
// 00-06 wires in the real assertions against src/preload/index.ts.

import { describe, expect, it } from 'vitest';

describe('preload API shape', () => {
  it.skip('exposes only the narrow typed window.api surface (no raw ipcRenderer)', () => {
    // Will be implemented by plan 00-06.
    void expect;
  });
});
