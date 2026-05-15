// tests/unit/config-store.test.ts
//
// FND-03 schema unit test. Imports ONLY the pure zod ConfigSchema — not the
// app-dependent runtime helpers that depend on Electron's app.getPath() and
// would throw outside the Electron context. The full app-context persistence
// proof lives in plan 00-06's Playwright e2e.

import { describe, it, expect } from 'vitest';
import { ConfigSchema } from '../../src/main/config-store.js';

describe('ConfigSchema', () => {
  it('parses an empty object into all defaults', () => {
    const parsed = ConfigSchema.parse({});
    expect(parsed.launchCount).toBe(0);
    expect(parsed.googleMapsApiKey).toBeNull();
  });

  it('rejects a negative launchCount', () => {
    const result = ConfigSchema.safeParse({ launchCount: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-string googleMapsApiKey', () => {
    const result = ConfigSchema.safeParse({ googleMapsApiKey: 42 });
    expect(result.success).toBe(false);
  });

  it('accepts a valid filled config', () => {
    const parsed = ConfigSchema.parse({
      launchCount: 5,
      googleMapsApiKey: 'AIza...',
    });
    expect(parsed.launchCount).toBe(5);
    expect(parsed.googleMapsApiKey).toBe('AIza...');
  });
});
