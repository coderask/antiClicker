---
slug: place-search
type: quick
created: 2026-05-16
status: in-progress
---

# Quick: Search bar — geocode place names to coords

## Problem
The map only accepts a click-to-drop or numeric-coordinate entry. For specific
targets (e.g., "Interactive Learning Pavilion @ UCSB") the user has to find
the location in Google Maps, copy a URL, and paste. Slow and breaks flow.

## Solution
A floating search bar (top-center) with debounced autocomplete. Backed by
**Nominatim** (OpenStreetMap) via the main process — free, no API key, global
POI coverage including university buildings.

## Architecture
- **Main process** holds the geocoder. Nominatim TOS requires a User-Agent
  header identifying the app, which renderer fetch can't set; main can.
- **IPC channel** `geocode:search` — payload `{ query: string }`, response
  `Array<{ name, detail, latitude, longitude }>` (max 6 results).
- **Renderer** has `<Search />`: top-center input, 300ms debounce, dropdown
  with name + secondary text, click to fly + set draft pin, Esc/click-out to
  close, Cmd/Ctrl+K to focus (small power-user touch).
- **CSP**: no changes (main does the fetch).

## Files
**New**
- `src/main/geocoder.ts` — Nominatim fetch + parse + types
- `src/renderer/src/Search.tsx` — search component
- `tests/unit/geocoder.test.ts` — mocked-fetch unit tests

**Modified**
- `src/shared/ipc-channels.ts` — `GeocodeSearch` channel
- `src/main/ipc.ts` — handler with zod payload validation
- `src/preload/index.ts` — `geocodeSearch(query)` method
- `tests/unit/preload-api.test.ts` — add new method to fakeApi (18 total now)
- `src/renderer/src/App.tsx` — mount `<Search />` and wire onSelect

## Verification
- `npm run typecheck` clean
- `npm run test:unit` green (135 + new geocoder tests)
- Manual: type "Interactive Learning Pavilion UCSB" → result appears → click
  → map flies, pin drops. Test against the live Nominatim API.

## Tradeoffs
- Nominatim is rate-limited (1 req/sec per IP). Personal-use, not an issue.
  We debounce 300ms client-side, so even hammering keys produces <4 req/sec.
- Quality is excellent for general POIs (cafés, parks, monuments) and good
  for university buildings if OSM has them annotated. For obscure private
  addresses you'd still need to paste a Google Maps URL — that path remains.
- No Google Places fallback in this commit. Easy to add later inside the
  same IPC handler: `if (apiKey) goGoogle() else goNominatim()`.
