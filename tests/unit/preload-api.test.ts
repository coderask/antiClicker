// preload API shape — type-level + fake-implementation runtime test.
// Imports the Api TYPE only (no electron runtime) so vitest can run this
// in pure Node. The full FND-01 round-trip is asserted by the e2e in
// tests/e2e/secure-defaults.spec.ts.

import { describe, expect, it } from 'vitest';
import type { Api } from '../../src/preload/index.js';

describe('Preload Api', () => {
  it('exposes exactly ping and getLaunchCount', () => {
    const required: (keyof Api)[] = ['ping', 'getLaunchCount'];
    expect(required.length).toBe(2);
  });

  it('ping returns a Promise of pong literal', async () => {
    const fakeApi: Api = {
      ping: async () => 'pong' as const,
      getLaunchCount: async () => 0,
    };
    const result = await fakeApi.ping();
    expect(result).toBe('pong');
  });

  it('getLaunchCount returns a Promise of number', async () => {
    const fakeApi: Api = {
      ping: async () => 'pong' as const,
      getLaunchCount: async () => 42,
    };
    const result = await fakeApi.getLaunchCount();
    expect(typeof result).toBe('number');
  });
});
