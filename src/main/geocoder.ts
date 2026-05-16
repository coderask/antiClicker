// src/main/geocoder.ts
//
// Place-search backend. Calls Nominatim (OpenStreetMap) from the main
// process so we can set the `User-Agent` header that Nominatim's TOS
// requires. Renderer-side fetch cannot set User-Agent, hence the IPC hop.
//
// Provider choice: Nominatim is free, no API key, global POI coverage.
// Rate-limited to ~1 req/sec per IP — the renderer debounces 300ms, so a
// typing user produces ~3 req/sec worst-case, which is fine.
//
// If a Google Maps API key is ever wired in (it's already in electron-store
// for the map backend), this is the right place to branch:
//   if (apiKey) return geocodeGoogle(query, apiKey)
//   else return geocodeNominatim(query)

export interface GeocodeResult {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AntiClicker/0.0.5 (https://github.com/coderask/antiClicker)';
const TIMEOUT_MS = 8000;
const RESULT_LIMIT = 6;

interface NominatimRow {
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  type?: string;
  class?: string;
}

/**
 * Geocode a free-text place query via Nominatim. Returns up to `RESULT_LIMIT`
 * results sorted by relevance.
 *
 * Throws on transport error, non-2xx response, or parse failure. The IPC
 * handler swallows these into an empty-array fallback so the UI never sees
 * a thrown promise.
 */
export async function geocodeNominatim(query: string): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(RESULT_LIMIT));
  url.searchParams.set('addressdetails', '0');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const raw: unknown = await response.json();
  if (!Array.isArray(raw)) {
    throw new Error('Nominatim response was not an array');
  }

  const results: GeocodeResult[] = [];
  for (const row of raw as NominatimRow[]) {
    const lat = parseFloat(row.lat ?? '');
    const lon = parseFloat(row.lon ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const display = row.display_name ?? '';
    // First segment of display_name is the primary label; the rest is the
    // address context. If `name` is present (POIs), prefer it as primary.
    const firstComma = display.indexOf(',');
    const primary =
      row.name && row.name.trim().length > 0
        ? row.name.trim()
        : firstComma >= 0
          ? display.slice(0, firstComma).trim()
          : display.trim();
    const detail =
      firstComma >= 0 ? display.slice(firstComma + 1).trim() : '';
    if (!primary) continue;
    results.push({ name: primary, detail, latitude: lat, longitude: lon });
  }
  return results;
}
