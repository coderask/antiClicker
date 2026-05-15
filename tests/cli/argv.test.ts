/**
 * tests/cli/argv.test.ts
 *
 * Vitest unit tests for parseCliArgs — the argv parsing and bounds validation
 * function exported from scripts/cli-prototype.ts.
 *
 * These tests are purely Node-side: no browser is launched.
 * Run with: npx vitest run tests/cli/argv.test.ts
 */

import { describe, it, expect } from 'vitest';
import { parseCliArgs } from '../../scripts/cli-prototype.js';

describe('parseCliArgs — valid inputs', () => {
  it('parses valid Tokyo coordinates', () => {
    const result = parseCliArgs(['--lat', '35.6762', '--lng', '139.6503']);
    expect(result).toEqual({ lat: 35.6762, lng: 139.6503 });
  });

  it('parses zero coordinates (Null Island)', () => {
    const result = parseCliArgs(['--lat', '0', '--lng', '0']);
    expect(result).toEqual({ lat: 0, lng: 0 });
  });

  it('parses positive boundary values (lat=90, lng=180)', () => {
    const result = parseCliArgs(['--lat', '90', '--lng', '180']);
    expect(result).toEqual({ lat: 90, lng: 180 });
  });

  it('parses negative boundary values (lat=-90, lng=-180)', () => {
    const result = parseCliArgs(['--lat', '-90', '--lng', '-180']);
    expect(result).toEqual({ lat: -90, lng: -180 });
  });

  it('parses negative latitude (e.g., Sydney)', () => {
    const result = parseCliArgs(['--lat', '-33.8688', '--lng', '151.2093']);
    expect(result.lat).toBeCloseTo(-33.8688);
    expect(result.lng).toBeCloseTo(151.2093);
  });

  it('parses high-precision coordinates', () => {
    const result = parseCliArgs(['--lat', '51.507351', '--lng', '-0.127758']);
    expect(result).toEqual({ lat: 51.507351, lng: -0.127758 });
  });
});

describe('parseCliArgs — missing arguments', () => {
  it('throws when --lat is missing', () => {
    expect(() => parseCliArgs(['--lng', '139.6503'])).toThrow(/lat/i);
  });

  it('throws when --lng is missing', () => {
    expect(() => parseCliArgs(['--lat', '35.6762'])).toThrow(/lng/i);
  });

  it('throws when both arguments are missing', () => {
    expect(() => parseCliArgs([])).toThrow();
  });
});

describe('parseCliArgs — non-numeric values', () => {
  it('throws for non-numeric latitude', () => {
    expect(() => parseCliArgs(['--lat', 'foo', '--lng', '0'])).toThrow();
  });

  it('throws for non-numeric longitude', () => {
    expect(() => parseCliArgs(['--lat', '0', '--lng', 'bar'])).toThrow();
  });

  it('throws for empty string latitude', () => {
    expect(() => parseCliArgs(['--lat', '', '--lng', '0'])).toThrow();
  });
});

describe('parseCliArgs — out-of-range latitude', () => {
  it('throws when latitude exceeds 90 (e.g., 91)', () => {
    expect(() => parseCliArgs(['--lat', '91', '--lng', '0'])).toThrow(/90/);
  });

  it('throws when latitude is below -90 (e.g., -91)', () => {
    expect(() => parseCliArgs(['--lat', '-91', '--lng', '0'])).toThrow();
  });

  it('throws for extreme latitude (e.g., 180)', () => {
    expect(() => parseCliArgs(['--lat', '180', '--lng', '0'])).toThrow();
  });
});

describe('parseCliArgs — out-of-range longitude', () => {
  it('throws when longitude exceeds 180 (e.g., 181)', () => {
    expect(() => parseCliArgs(['--lat', '0', '--lng', '181'])).toThrow(/180/);
  });

  it('throws when longitude is below -180 (e.g., -181)', () => {
    expect(() => parseCliArgs(['--lat', '0', '--lng', '-181'])).toThrow();
  });

  it('throws for extreme longitude (e.g., 360)', () => {
    expect(() => parseCliArgs(['--lat', '0', '--lng', '360'])).toThrow();
  });
});
