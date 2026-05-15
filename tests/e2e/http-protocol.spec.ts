// FND-02 — filled in by plan 00-06
// Asserts the renderer is loaded over http:// in both dev and packaged builds (never
// file://). Concretely: window.url() starts with "http://" and window.location.protocol
// is "http:". Wave 0 stub: skipped until 00-06 wires in the real e2e launch + assertion.

import { _electron as electron, expect, test } from '@playwright/test';

test.skip('FND-02: renderer served over http:// (not file://)', async () => {
  // Will be implemented by plan 00-06.
  void electron;
  void expect;
});
