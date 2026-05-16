// preload API shape — type-level + fake-implementation runtime test.
// Imports the Api TYPE only (no electron runtime) so vitest can run this
// in pure Node. The full FND-01 round-trip is asserted by the e2e in
// tests/e2e/secure-defaults.spec.ts.
//
// Phase 3: Api now has 7 methods (was 2 in Phase 0).
// Phase 6: 4 more methods added (verifySpoof, openVerificationUrls, markFirstRunSeen, getFirstRunSeen).
// Phase 7: 6 more methods added (getRecentPins, setRecentPins, getFavorites, setFavorites, getMapsApiKey, setMapsApiKey).
// Quick (place-search): geocodeSearch.

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
  // Phase 6
  getFirstRunSeen: async () => false,
  markFirstRunSeen: async () => undefined,
  verifySpoof: async (_id) => ({ reported: { lat: 0, lng: 0 }, expected: { lat: 0, lng: 0 }, match: true }),
  openVerificationUrls: async (_id) => undefined,
  // Phase 7
  getRecentPins: async () => [],
  setRecentPins: async (_pins) => undefined,
  getFavorites: async () => [],
  setFavorites: async (_favs) => undefined,
  getMapsApiKey: async () => null,
  setMapsApiKey: async (_key) => undefined,
  // Quick (place-search)
  geocodeSearch: async (_q) => [],
};

describe('Preload Api', () => {
  it('exposes all required methods (Phase 0 + 3 + 6 + 7 + place-search = 18 total)', () => {
    const required: (keyof Api)[] = [
      // Phase 0
      'ping',
      'getLaunchCount',
      // Phase 3
      'launch',
      'setGeo',
      'close',
      'list',
      'onInstanceClosed',
      // Phase 6
      'getFirstRunSeen',
      'markFirstRunSeen',
      'verifySpoof',
      'openVerificationUrls',
      // Phase 7
      'getRecentPins',
      'setRecentPins',
      'getFavorites',
      'setFavorites',
      'getMapsApiKey',
      'setMapsApiKey',
      // Quick (place-search)
      'geocodeSearch',
    ];
    expect(required.length).toBe(18);
    for (const key of required) {
      expect(typeof fakeApi[key]).toBe('function');
    }
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

  it('getRecentPins returns a Promise of array', async () => {
    const result = await fakeApi.getRecentPins();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getFavorites returns a Promise of array', async () => {
    const result = await fakeApi.getFavorites();
    expect(Array.isArray(result)).toBe(true);
  });

  it('getMapsApiKey returns a Promise of string or null', async () => {
    const result = await fakeApi.getMapsApiKey();
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('verifySpoof returns reported, expected, and match', async () => {
    const result = await fakeApi.verifySpoof('test-id');
    expect(typeof result.match).toBe('boolean');
    expect(typeof result.reported.lat).toBe('number');
    expect(typeof result.expected.lat).toBe('number');
  });
});
