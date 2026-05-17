// src/main/geocoder.ts
//
// Place-search backend. Supports two providers:
//
//   1. Google Places API (New) — used when a googleMapsApiKey is configured.
//      Endpoint: https://places.googleapis.com/v1/places:searchText
//      Requires "Places API (New)" enabled in Google Cloud Console (separate
//      from "Maps JavaScript API"). Cost: ~$0.017/request, $200/month credit
//      → roughly 11 700 free searches/month, ~$2.83/1000 sessions.
//
//   2. Nominatim (OpenStreetMap) — free fallback; no key required.
//      Called from the main process so we can set the User-Agent header
//      (Nominatim TOS requires it; renderer-side fetch cannot set it).
//
// Provider selection: the top-level `geocode()` export branches on whether
// an API key is passed. If Google Places returns a non-200 or an empty
// result list, it falls back to Nominatim automatically.

export interface GeocodeResult {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 8000;
const RESULT_LIMIT = 6;

// ---------------------------------------------------------------------------
// Top-level dispatcher (called by ipc.ts)
// ---------------------------------------------------------------------------

/**
 * Geocode a free-text query. If `apiKey` is non-empty, tries Google Places
 * first; falls back to Nominatim on throw or empty result set.
 */
export async function geocode(
  query: string,
  options: { apiKey?: string | null } = {},
): Promise<GeocodeResult[]> {
  const key = options.apiKey?.trim() ?? '';
  if (key) {
    try {
      const results = await geocodeGoogle(query, key);
      if (results.length > 0) return results;
      // zero results — fall through to Nominatim
    } catch {
      // non-200, network error, parse failure — fall through
    }
  }
  return geocodeNominatim(query);
}

// ---------------------------------------------------------------------------
// Google Places (New) provider
// ---------------------------------------------------------------------------

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchText';

interface PlacesRow {
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

interface PlacesResponse {
  places?: PlacesRow[];
}

/**
 * Geocode via Google Places Text Search (New API).
 * Throws on non-200 or network error so the caller can fall back.
 */
export async function geocodeGoogle(
  query: string,
  apiKey: string,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(PLACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify({
        textQuery: trimmed,
        languageCode: 'en',
        maxResultCount: RESULT_LIMIT,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(`Google Places returned ${response.status}`);
  }

  const raw = (await response.json()) as PlacesResponse;
  const rows: PlacesRow[] = raw.places ?? [];

  const results: GeocodeResult[] = [];
  for (const row of rows) {
    const lat = row.location?.latitude;
    const lon = row.location?.longitude;
    if (lat === undefined || lon === undefined) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const name = row.displayName?.text?.trim() ?? '';
    const detail = row.formattedAddress?.trim() ?? '';
    if (!name) continue;

    results.push({ name, detail, latitude: lat, longitude: lon });
  }
  return results.slice(0, RESULT_LIMIT);
}

// ---------------------------------------------------------------------------
// Nominatim (OpenStreetMap) provider
// ---------------------------------------------------------------------------

const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'AntiClicker/0.0.6 (https://github.com/coderask/antiClicker)';

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
