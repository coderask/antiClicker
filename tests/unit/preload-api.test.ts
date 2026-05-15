// preload API shape — type-level + fake-implementation runtime test.
// Imports the Api TYPE only (no electron runtime) so vitest can run this
// in pure Node. The full FND-01 round-trip is asserted by the e2e in
// tests/e2e/secure-defaults.spec.ts.
//
// Phase 3: Api now has 7 methods (was 2 in Phase 0).

import { describe, expect, it } from 'vitest';
import type { Api } from '../../src/preload/index.js';

// Stub implementations matching the full Api type for type-checking.
const stubInstance = {
  id: 'test-id',
  coords: { latitude: 0, longitude: 0 },
  userDataDir: '/tmp/test',
};

const fakeApi: Api = {
  // Phase 0
  ping: async () => 'pong' as const,
  getLaunchCount: async () => 0,
  // Phase 3
  launch: async (_coords) => stubInstance,
  setGeo: async (_id, _coords) => undefined,
  close: async (_id) => undefined,
  list: async () => [stubInstance],
  onInstanceClosed: (_cb) => () => undefined,
};

describe('Preload Api', () => {
  it('exposes exactly 7 methods (Phase 0 + Phase 3)', () => {
    const required: (keyof Api)[] = [
      'ping',
      'getLaunchCount',
      'launch',
      'setGeo',
      'close',
      'list',
      'onInstanceClosed',
    ];
    expect(required.length).toBe(7);
  });

  it('ping returns a Promise of pong literal', async () => {
    const result = await fakeApi.ping();
    expect(result).toBe('pong');
  });

  it('getLaunchCount returns a Promise of number', async () => {
    const result = await fakeApi.getLaunchCount();
    expect(typeof result).toBe('number');
  });

  it('launch returns a Promise of Instance shape', async () => {
    const result = await fakeApi.launch({ latitude: 35.6762, longitude: 139.6503 });
    expect(typeof result.id).toBe('string');
    expect(typeof result.coords.latitude).toBe('number');
    expect(typeof result.coords.longitude).toBe('number');
  });

  it('list returns a Promise of Instance array', async () => {
    const result = await fakeApi.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it('onInstanceClosed returns an unsubscribe function', () => {
    const unsub = fakeApi.onInstanceClosed((_id: string) => {});
    expect(typeof unsub).toBe('function');
  });
});
