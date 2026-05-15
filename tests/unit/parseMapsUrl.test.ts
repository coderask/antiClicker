// tests/unit/parseMapsUrl.test.ts
//
// Phase 4: unit tests for the Google Maps URL parser.
// Covers all 6 supported URL formats, malformed inputs, and bounds validation.

import { describe, it, expect } from 'vitest';
import { parseMapsUrl } from '../../src/renderer/src/utils/parseMapsUrl.js';

describe('parseMapsUrl', () => {
  // -----------------------------------------------------------------------
  // Format 1: /maps/@lat,lng,zoomz
  // -----------------------------------------------------------------------
  it('parses /maps/@lat,lng,zoomz format (Tokyo)', () => {
    const result = parseMapsUrl('https://www.google.com/maps/@35.6762,139.6503,15z');
    expect(result).toEqual({ latitude: 35.6762, longitude: 139.6503 });
  });

  // -----------------------------------------------------------------------
  // Format 2: /maps/@lat,lng,zoom.decimalz/data=...
  // -----------------------------------------------------------------------
  it('parses /maps/@lat,lng,zoom.zz/data=... format (decimal zoom + data segment)', () => {
    const result = parseMapsUrl(
      'https://www.google.com/maps/@35.6762,139.6503,15.5z/data=!3m1!1e3',
    );
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(35.6762, 4);
    expect(result!.longitude).toBeCloseTo(139.6503, 4);
  });

  // -----------------------------------------------------------------------
  // Format 3: /maps/place/Name/@lat,lng,zoomz
  // -----------------------------------------------------------------------
  it('parses /maps/place/Name/@lat,lng place URL', () => {
    const result = parseMapsUrl(
      'https://www.google.com/maps/place/Tokyo/@35.6762,139.6503,15z',
    );
    expect(result).toEqual({ latitude: 35.6762, longitude: 139.6503 });
  });

  // -----------------------------------------------------------------------
  // Format 4: maps.google.com/?q=lat,lng
  // -----------------------------------------------------------------------
  it('parses maps.google.com/?q=lat,lng', () => {
    const result = parseMapsUrl('https://maps.google.com/?q=35.6762,139.6503');
    expect(result).toEqual({ latitude: 35.6762, longitude: 139.6503 });
  });

  // -----------------------------------------------------------------------
  // Format 5: /maps?q=lat,lng&z=12
  // -----------------------------------------------------------------------
  it('parses /maps?q=lat,lng&z=12', () => {
    const result = parseMapsUrl(
      'https://www.google.com/maps?q=35.6762,139.6503&z=12',
    );
    expect(result).toEqual({ latitude: 35.6762, longitude: 139.6503 });
  });

  // -----------------------------------------------------------------------
  // Format 6: /maps?ll=lat,lng
  // -----------------------------------------------------------------------
  it('parses /maps?ll=lat,lng', () => {
    const result = parseMapsUrl(
      'https://www.google.com/maps?ll=35.6762,139.6503',
    );
    expect(result).toEqual({ latitude: 35.6762, longitude: 139.6503 });
  });

  // -----------------------------------------------------------------------
  // Negative coordinates (San Francisco)
  // -----------------------------------------------------------------------
  it('parses negative longitude (San Francisco)', () => {
    const result = parseMapsUrl(
      'https://www.google.com/maps/@37.7749,-122.4194,13z',
    );
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(37.7749, 4);
    expect(result!.longitude).toBeCloseTo(-122.4194, 4);
  });

  // -----------------------------------------------------------------------
  // Negative coordinates in q= param (Sydney)
  // -----------------------------------------------------------------------
  it('parses negative lat in ?q= param (Sydney)', () => {
    const result = parseMapsUrl(
      'https://www.google.com/maps?q=-33.8688,151.2093',
    );
    expect(result).not.toBeNull();
    expect(result!.latitude).toBeCloseTo(-33.8688, 4);
    expect(result!.longitude).toBeCloseTo(151.2093, 4);
  });

  // -----------------------------------------------------------------------
  // Non-Google Maps URL → null
  // -----------------------------------------------------------------------
  it('returns null for a non-Google Maps URL', () => {
    expect(parseMapsUrl('https://www.example.com/maps/@35.6762,139.6503,15z')).toBeNull();
    expect(parseMapsUrl('https://www.bing.com/maps?q=35.6762,139.6503')).toBeNull();
    expect(parseMapsUrl('https://maps.apple.com/?q=35.6762,139.6503')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Google Maps URL with no parseable coordinates → null
  // -----------------------------------------------------------------------
  it('returns null for Google Maps URL with no coords', () => {
    expect(parseMapsUrl('https://www.google.com/maps')).toBeNull();
    expect(parseMapsUrl('https://maps.google.com/')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Latitude out of WGS-84 bounds → null
  // -----------------------------------------------------------------------
  it('returns null when latitude > 90', () => {
    const result = parseMapsUrl('https://www.google.com/maps/@91,0,15z');
    expect(result).toBeNull();
  });

  it('returns null when latitude < -90', () => {
    const result = parseMapsUrl('https://www.google.com/maps/@-91,0,15z');
    expect(result).toBeNull();
  });

  // -----------------------------------------------------------------------
  // Empty / non-string inputs → null
  // -----------------------------------------------------------------------
  it('returns null for empty string', () => {
    expect(parseMapsUrl('')).toBeNull();
  });

  it('returns null for a plain string with no URL structure', () => {
    expect(parseMapsUrl('hello world')).toBeNull();
  });
});
