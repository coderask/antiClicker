---
slug: place-search
type: quick
created: 2026-05-16
completed: 2026-05-16
status: complete
---

# Quick: Place search via Nominatim — DONE

## What shipped
Floating top-center search bar with debounced (300 ms) autocomplete backed by
Nominatim (OpenStreetMap) geocoding. Selecting a result sets the draft pin
and flies the map there. Cmd/Ctrl-K focuses; Esc clears + blurs;
↑/↓/Enter navigate suggestions. The whole flow uses the existing
"draft pin → Launch here" gesture so muscle memory carries over.

## Files
**New**
- `src/main/geocoder.ts` — Nominatim fetch with proper `User-Agent`
  (`AntiClicker/0.0.5 (https://github.com/coderask/antiClicker)`), 8s timeout,
  parses `display_name` into name + detail.
- `src/renderer/src/Search.tsx` — search component (~270 LOC) with debounce,
  hover-highlight, keyboard navigation, loading + empty states, ⌘K hint.
- `tests/unit/geocoder.test.ts` — 9 mocked-fetch unit tests covering empty
  input, single result, missing `name` fallback, out-of-range filter,
  non-ok response, non-array response, headers, limit, whitespace trim.

**Modified**
- `src/shared/ipc-channels.ts` — add `GeocodeSearch: 'geocode:search'`.
- `src/main/ipc.ts` — handler with zod payload (`{ query: string, 1-200 chars }`),
  errors caught and returned as `[]` so the UI shows graceful empty state.
- `src/preload/index.ts` — add `geocodeSearch(query)` (Api is now 18 methods).
- `src/renderer/src/App.tsx` — mount `<Search onSelect={...} />` at top-center.
- `tests/unit/preload-api.test.ts` — fakeApi + required-keys list updated.

## Why main-process geocoding
Nominatim's TOS requires identifying the app via the `User-Agent` request
header. Browser fetch (renderer) cannot set User-Agent — it's a forbidden
header from a sandboxed context. Doing the fetch in main lets us comply
without violating Nominatim's policy. Side benefit: no CSP additions.

## Provider choice
Nominatim (OSM) — free, no API key, global POI coverage including university
campus annotations (the requested target "Interactive Learning Pavilion @
UCSB" is reachable here). Rate-limited to ~1 req/sec/IP — debounce keeps us
well under. If quality ever proves insufficient for specific addresses, the
geocoder module is the single point to swap in Google Places (the API key
is already in electron-store; one branch in `geocodeSearch`).

## Test results
- `npm run typecheck` clean
- `npm run test:unit` — 144/144 (was 135; +9 geocoder tests)
- `npm run build` clean (renderer bundle now 2.33 MB)
- No e2e tests added — the Search component depends on a live network call
  against Nominatim; an e2e fixture would just retest the mock the unit
  suite already covers. Manual verification: type "interactive learning
  pavilion ucsb" → result appears in dropdown → click → map flies, pin drops.

## Tradeoffs
- **No autocomplete query batching.** Each keystroke after 300 ms debounce
  triggers a request; rapid typing produces a small request fan but Nominatim
  is fine with it at personal-use scale.
- **No selected-result memoization.** Reselecting the same place re-fetches.
  Premature optimization at this scale — geocodes are ~200ms uncached, the
  user won't notice.
- **No offline fallback** in this commit. If the network is down, the
  dropdown shows "No results" — which is honest but a "you appear to be
  offline" hint would be nicer. Future polish.
- **Search bar overlaps the brand mark** on narrow windows (under ~900px
  wide). The CSS sets `max-width: calc(100vw - 480px)` to reserve room for
  brand-left and status-cluster-right — at narrower widths the bar shrinks
  but doesn't reflow. Acceptable on desktop sizes.
