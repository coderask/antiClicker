// tests/unit/ipc-validation.test.ts
//
// Phase 3: IPC payload validation — pure Node / vitest.
//
// Asserts that the Zod schemas exported from src/main/ipc.ts correctly reject
// out-of-range coordinates and malformed payloads, and accept valid ones.
// No Electron runtime is required — schemas are pure zod objects.

import { describe, it, expect } from 'vitest';
import {
  LaunchPayloadSchema,
  SetGeoPayloadSchema,
  ClosePayloadSchema,
} from '../../src/main/ipc.js';

describe('LaunchPayloadSchema', () => {
  it('accepts a valid launch payload (Tokyo)', () => {
    const result = LaunchPayloadSchema.safeParse({
      latitude: 35.6762,
      longitude: 139.6503,
    });
    expect(result.success).toBe(true);
  });

  it('rejects latitude out of range (95 > 90)', () => {
    const result = LaunchPayloadSchema.safeParse({
      latitude: 95,
      longitude: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects longitude with wrong type (string "foo")', () => {
    const result = LaunchPayloadSchema.safeParse({
      latitude: 0,
      longitude: 'foo',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional accuracy field when provided', () => {
    const result = LaunchPayloadSchema.safeParse({
      latitude: 35.6762,
      longitude: 139.6503,
      accuracy: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative accuracy (must be positive)', () => {
    const result = LaunchPayloadSchema.safeParse({
      latitude: 0,
      longitude: 0,
      accuracy: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('SetGeoPayloadSchema', () => {
  it('accepts a valid setGeo payload', () => {
    const result = SetGeoPayloadSchema.safeParse({
      id: 'abc12345',
      coords: { latitude: 0, longitude: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects coords out of range (latitude 91)', () => {
    const result = SetGeoPayloadSchema.safeParse({
      id: 'abc12345',
      coords: { latitude: 91, longitude: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing id', () => {
    const result = SetGeoPayloadSchema.safeParse({
      coords: { latitude: 0, longitude: 0 },
    });
    expect(result.success).toBe(false);
  });
});

describe('ClosePayloadSchema', () => {
  it('accepts a valid close payload', () => {
    const result = ClosePayloadSchema.safeParse({ id: 'abc12345' });
    expect(result.success).toBe(true);
  });

  it('rejects missing id on close payload', () => {
    const result = ClosePayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-string id', () => {
    const result = ClosePayloadSchema.safeParse({ id: 42 });
    expect(result.success).toBe(false);
  });
});
