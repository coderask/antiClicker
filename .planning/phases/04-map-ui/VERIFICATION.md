# Phase 04 Verification — Map UI

**Phase goal:** "Replace the placeholder UI with a real satellite-view map where the user can drop, drag, and enter a pin — and launch a spoofed Chrome at that pin in one click."

**Verified:** 2026-05-15
**Verdict:** PASS — all 5 applicable ROADMAP success criteria are demonstrably true.

## Phase Success Criteria (Goal-Backward)

| # | ROADMAP claim | Evidence | Status |
|---|---------------|----------|--------|
| 1 | MapLibre GL JS 5 satellite map renders on app start using EOX S2cloudless tiles, no API key, attribution visible | `tests/e2e/map-flow.spec.ts`: waits for `<canvas>` to be visible within 20s; CSP meta in index.html allows `https://s2maps-tiles.eu`; attribution string in EOX_STYLE source spec | PASS |
| 2 | Pin can be dropped by clicking and dragged; coordinate readout (`data-testid="pin-coords"`) updates | `tests/e2e/map-flow.spec.ts`: canvas click → `pin-coords` not empty assertion (timeout 5s); MapView.tsx: `map.on('click')` + `Marker({ draggable: true })` + `dragend` handler | PASS |
| 3 | Coord input form lets user type lat/lng; invalid input shows error; valid input flies map + places pin | `tests/renderer/CoordInput.test.tsx`: 7 cases including invalid lat (error visible), valid submit (onSubmit called), negative coords; zod v4 validation in CoordInput.tsx | PASS |
| 4 | Google Maps URL paste auto-extracts coordinates | `tests/unit/parseMapsUrl.test.ts`: 14 cases covering all 6 URL patterns; `tests/renderer/CoordInput.test.tsx`: URL paste case | PASS |
| 5 | "Launch here" button calls `window.api.launch`; live-instances increments | `tests/e2e/map-flow.spec.ts`: click launch-here → live-instances reaches "1"; `tests/e2e/launch-flow.spec.ts` (updated Phase 3): coord form + launch-here → increments → close → decrements | PASS |

Note: ROADMAP success criteria 4 (Google Maps API key swap basemap) and 5 (fallback on invalid key) are explicitly deferred — the prompt scope excludes Google Maps API key integration for Phase 4.

## Per-Requirement Coverage

| Requirement | Source plan(s) | Evidence |
|-------------|----------------|----------|
| MAP-01 (MapLibre satellite map renders) | 04-01 (install + CSP + MapView) | e2e canvas visible assertion + build passes |
| MAP-02 (pin drag, coordinate readout) | 04-01 (MapView), 04-02 (App.tsx) | e2e pin-coords testid updates after click |
| MAP-03 (coord input form, validation) | 04-03 (CoordInput + wiring) | component test: invalid lat → error visible |
| MAP-04 (Google Maps URL paste) | 04-03 (parseMapsUrl), 04-04 (tests) | 14 unit tests covering all formats |
| MAP-05 (launch-here button wired to IPC) | 04-02 (App.tsx), 04-04 (e2e) | map-flow e2e + updated launch-flow e2e |
| MAP-06 (Phase 3 live-instances remains) | 04-02 (App.tsx) | launch-flow.spec.ts close → decrements to 0 |
| REL-02 (Phase 0 testids preserved) | 04-02 (App.tsx details footer) | protocol, ping, launch-count in <details> DOM |

## Sign-Off Commands

```
$ npm run typecheck   # exits 0
$ npm run build       # exits 0; renderer bundle: ~2.2 MB (expected — MapLibre ~1.7 MB)
$ npm run test:unit   # 7 files / 74 tests passed (53 prior + 14 parseMapsUrl + 7 CoordInput)
$ npm run test:launcher  # 5 launcher integration tests passed
$ npm run test:e2e    # 14 tests passed (5 electron + 4 cli + 5 launcher)
$ npm run test        # full sign-off — unit + launcher + e2e all green
```

## Plans Complete (4 of 4)

| Plan | Status | Notes |
|------|--------|-------|
| 04-01 — MapLibre + EOX satellite basemap + CSP | PASS | maplibre-gl installed; CSP meta tag added; MapView.tsx with cleanup |
| 04-02 — Pin drop/drag + launch-here button | PASS | App.tsx restructured; all Phase 0+3 testids preserved in details footer |
| 04-03 — Coord input + Google Maps URL parser | PASS | CoordInput.tsx + parseMapsUrl.ts; zod v4 validation |
| 04-04 — Unit + component + e2e tests | PASS | 14 + 7 + 1 new tests; full test suite green |

## Key Deviation: Phase 3 e2e test updated for Phase 4 UI

**Rule 1 (Bug Fix):** The Phase 3 e2e test (`tests/e2e/launch-flow.spec.ts`) used `[data-testid="launch-button"]` which no longer exists after Phase 4 replaced the placeholder UI. Updated to use the coord form (`lat-input`, `lng-input`, `coord-submit`) to set the Tokyo pin, then click `launch-here-button`. IPC chain validation (list(), coordinates, close()) is unchanged.

## Key Deviation: zod v4 API change

**Rule 1 (Bug Fix):** CoordInput.tsx initially used `z.number({ invalid_type_error: '...' })` which is a zod v3 API. The project uses zod v4.x. Updated to `z.number({ error: '...' })` which is the v4 equivalent. Typecheck confirmed the fix.

## Renderer Bundle Size Note

Phase 3 renderer bundle: ~0.4 MB
Phase 4 renderer bundle: ~2.2 MB (+1.8 MB)

The increase is entirely from `maplibre-gl` (~1.7 MB uncompressed, ~500 kB gzipped). This is expected and documented in the plan. MapLibre is a monolithic WebGL map library; no tree-shaking is possible for its core.

## Cross-Platform Notes

- MapLibre GL JS 5 is a WebGL library — runs in Electron's Chromium renderer on macOS and Windows without OS-specific code.
- EOX S2cloudless tiles are served over HTTPS from `s2maps-tiles.eu` — no local storage, cross-platform.
- All new code uses browser-standard APIs (no Node.js dependencies in the renderer).

## Handoff to Phase 5

Phase 5 will add multi-instance UX: colored pins per instance, a sidebar showing running instances, and live `setGeolocation` on drag without relaunch. The `window.api.list()`, `setGeo()`, and `close()` methods are already wired in the preload and working — Phase 5 will surface them in the UI via `MapView`'s pin system.

PASS **Phase 04 is complete. Ready for Phase 05.**
