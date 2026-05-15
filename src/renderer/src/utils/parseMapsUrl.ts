// src/renderer/src/utils/parseMapsUrl.ts
//
// Parse a Google Maps URL into { latitude, longitude }.
// Returns null if the URL is not a recognised Google Maps URL or has no parseable coordinates.
//
// Supported formats:
//   https://www.google.com/maps/@lat,lng,15z
//   https://www.google.com/maps/@lat,lng,15.5z/data=...
//   https://www.google.com/maps/place/Name/@lat,lng,15z
//   https://maps.google.com/?q=lat,lng
//   https://www.google.com/maps?q=lat,lng&z=12
//   https://www.google.com/maps?ll=lat,lng
//
// No external libraries used.

export interface ParsedCoords {
  latitude: number;
  longitude: number;
}

/**
 * Attempt to parse lat/lng from a Google Maps URL.
 * @returns Parsed coords or null if unrecognised / out-of-bounds.
 */
export function parseMapsUrl(url: string): ParsedCoords | null {
  if (!url || typeof url !== 'string') return null;

  // Guard: must be a Google Maps URL
  const urlLower = url.toLowerCase();
  if (
    !urlLower.includes('google.com/maps') &&
    !urlLower.includes('maps.google.com')
  ) {
    return null;
  }

  let latitude: number | null = null;
  let longitude: number | null = null;

  // -----------------------------------------------------------------------
  // Pattern 1: @lat,lng in the path — handles all /maps/@..., /maps/place/.../@... forms.
  // Regex: @ followed by signed decimal, comma, signed decimal.
  // -----------------------------------------------------------------------
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    latitude = parseFloat(atMatch[1]!);
    longitude = parseFloat(atMatch[2]!);
  }

  // -----------------------------------------------------------------------
  // Pattern 2: query param q=lat,lng or ll=lat,lng
  // Only attempt if pattern 1 didn't match.
  // -----------------------------------------------------------------------
  if (latitude === null || longitude === null) {
    const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if (qMatch) {
      latitude = parseFloat(qMatch[1]!);
      longitude = parseFloat(qMatch[2]!);
    }
  }

  if (latitude === null || longitude === null) return null;
  if (isNaN(latitude) || isNaN(longitude)) return null;

  // WGS-84 bounds validation
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;

  return { latitude, longitude };
}
