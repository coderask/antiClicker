// tests/unit/config-store.test.ts
//
// FND-03 schema unit test. Imports ONLY the pure zod ConfigSchema — not the
// app-dependent runtime helpers that depend on Electron's app.getPath() and
// would throw outside the Electron context. The full app-context persistence
// proof lives in plan 00-06's Playwright e2e.
//
// Phase 7: extended for recentPins, favorites, and NamedCoordsSchema.

import { describe, it, expect } from 'vitest';
import { ConfigSchema, NamedCoordsSchema } from '../../src/main/config-store.js';

describe('ConfigSchema', () => {
  it('parses an empty object into all defaults', () => {
    const parsed = ConfigSchema.parse({});
    expect(parsed.launchCount).toBe(0);
    expect(parsed.googleMapsApiKey).toBeNull();
    expect(parsed.firstRunSeen).toBe(false);
    // Phase 7 defaults
    expect(parsed.recentPins).toEqual([]);
    expect(parsed.favorites).toEqual([]);
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

  // Phase 7: recentPins tests

  it('parses recentPins with valid entries', () => {
    const parsed = ConfigSchema.parse({
      recentPins: [
        { latitude: 35.6762, longitude: 139.6503, timestamp: 1000 },
        { latitude: -33.8688, longitude: 151.2093, timestamp: 2000 },
      ],
    });
    expect(parsed.recentPins).toHaveLength(2);
    expect(parsed.recentPins[0].latitude).toBe(35.6762);
  });

  it('rejects recentPins with out-of-range latitude', () => {
    const result = ConfigSchema.safeParse({
      recentPins: [{ latitude: 91, longitude: 0, timestamp: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects recentPins with out-of-range longitude', () => {
    const result = ConfigSchema.safeParse({
      recentPins: [{ latitude: 0, longitude: 181, timestamp: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects recentPins with missing timestamp', () => {
    const result = ConfigSchema.safeParse({
      recentPins: [{ latitude: 0, longitude: 0 }],
    });
    expect(result.success).toBe(false);
  });

  // Phase 7: favorites tests

  it('parses favorites with valid NamedCoords entries', () => {
    const parsed = ConfigSchema.parse({
      favorites: [
        { id: 'abc', name: 'Tokyo', latitude: 35.6762, longitude: 139.6503, createdAt: 1000 },
      ],
    });
    expect(parsed.favorites).toHaveLength(1);
    expect(parsed.favorites[0].name).toBe('Tokyo');
  });

  it('rejects favorites with missing required fields', () => {
    const result = ConfigSchema.safeParse({
      favorites: [
        { id: 'abc', latitude: 35, longitude: 139 }, // missing name + createdAt
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects favorites with out-of-range latitude', () => {
    const result = ConfigSchema.safeParse({
      favorites: [{ id: 'x', name: 'X', latitude: -91, longitude: 0, createdAt: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('NamedCoordsSchema', () => {
  it('accepts a valid NamedCoords object', () => {
    const parsed = NamedCoordsSchema.parse({
      id: 'abc123',
      name: 'My Location',
      latitude: 37.7749,
      longitude: -122.4194,
      createdAt: 1716000000000,
    });
    expect(parsed.id).toBe('abc123');
    expect(parsed.name).toBe('My Location');
  });

  it('rejects latitude outside [-90, 90]', () => {
    const result = NamedCoordsSchema.safeParse({
      id: 'x', name: 'X', latitude: 100, longitude: 0, createdAt: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects longitude outside [-180, 180]', () => {
    const result = NamedCoordsSchema.safeParse({
      id: 'x', name: 'X', latitude: 0, longitude: -200, createdAt: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing id field', () => {
    const result = NamedCoordsSchema.safeParse({
      name: 'X', latitude: 0, longitude: 0, createdAt: 0,
    });
    expect(result.success).toBe(false);
  });
});
