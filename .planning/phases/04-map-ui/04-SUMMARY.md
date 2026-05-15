---
phase: 04-map-ui
plan: 04
subsystem: ui
tags: [maplibre, maplibre-gl, eox, satellite, react, typescript, vitest, playwright, csp]

requires:
  - phase: 03-electron-shell-ipc
    provides: "window.api IPC surface (launch, setGeo, close, list, onInstanceClosed); Electron shell with localhost renderer"

provides:
  - "MapView.tsx: MapLibre GL JS 5 controlled map component with EOX S2cloudless satellite tiles (no API key)"
  - "Draggable pin: click-to-drop + drag-to-move with lat/lng readout (data-testid=pin-coords)"
  - "CoordInput.tsx: lat/lng form with zod v4 validation + Google Maps URL paste detection"
  - "parseMapsUrl.ts: pure-regex parser for 6 Google Maps URL patterns"
  - "launch-here-button wired to window.api.launch; live-instances counter remains functional"
  - "CSP updated for EOX tiles + MapLibre blob: workers + unsafe-inline styles"

affects:
  - phase-05-multi-instance-ux (MapView will need per-instance colored pins; App.tsx pin state model extends to array)
  - phase-06-verify-polish-package (MapLibre bundle size ~2.2 MB; CSP baseline set)

tech-stack:
  added:
    - "maplibre-gl@5.24.0 (runtime — MapLibre GL JS 5, WebGL satellite map)"
    - "@testing-library/react (devDep — React component testing)"
    - "@testing-library/user-event (devDep)"
    - "@testing-library/jest-dom (devDep — DOM matchers)"
    - "happy-dom (devDep — fast DOM emulation for vitest component tests)"
  patterns:
    - "MapView as a controlled React component: pin + onPinChange props; map.remove() in useEffect cleanup"
    - "flyToTrigger counter pattern: stable counter increment in useState triggers useEffect without stale closures"
    - "onPinChangeRef pattern: useRef to hold latest callback so event listeners stay current without re-attaching"
    - "vitest workspace project split: node project for unit/main/cli, happy-dom project for renderer components"

key-files:
  created:
    - "src/renderer/src/map/MapView.tsx"
    - "src/renderer/src/CoordInput.tsx"
    - "src/renderer/src/utils/parseMapsUrl.ts"
    - "tests/unit/parseMapsUrl.test.ts"
    - "tests/renderer/CoordInput.test.tsx"
    - "tests/renderer/setup.ts"
    - "tests/e2e/map-flow.spec.ts"
    - ".planning/phases/04-map-ui/04-RESEARCH.md"
    - ".planning/phases/04-map-ui/04-01-PLAN.md"
    - ".planning/phases/04-map-ui/04-02-PLAN.md"
    - ".planning/phases/04-map-ui/04-03-PLAN.md"
    - ".planning/phases/04-map-ui/04-04-PLAN.md"
    - ".planning/phases/04-map-ui/VERIFICATION.md"
  modified:
    - "src/renderer/src/App.tsx"
    - "src/renderer/src/main.tsx"
    - "src/renderer/index.html"
    - "electron.vite.config.ts"
    - "vitest.config.ts"
    - "tests/e2e/launch-flow.spec.ts"
    - "package.json"

key-decisions:
  - "MapLibre maxZoom capped at 14: EOX S2cloudless tiles only go to zoom 14; higher zoom shows blank tiles"
  - "flyToTrigger counter pattern: prop-driven flyTo uses a { latitude, longitude, counter } object; counter increment is the change signal so re-submitting the same coords still fires flyTo"
  - "onPinChangeRef pattern: event handlers inside useEffect read from a ref rather than re-subscribing on every render — avoids stale closure bugs with click/dragend handlers"
  - "vitest workspace split: separate node/renderer projects to avoid happy-dom contaminating the node-only main/preload tests"
  - "Phase 3 e2e updated to Phase 4 UI: launch-flow.spec.ts now uses coord form + launch-here-button instead of removed launch-button"

requirements-completed: [MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, REL-02]

duration: 9min
completed: 2026-05-15
---

# Phase 4: Map UI Summary

**MapLibre GL JS 5 satellite map with EOX S2cloudless tiles, click-to-drop draggable pin, coord form with Google Maps URL parsing, and single-click Chrome launch at pin coordinates**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-15T22:46:21Z
- **Completed:** 2026-05-15T22:55:37Z
- **Tasks:** 4 plans, ~12 implementation tasks
- **Files modified:** 14 files created, 7 files modified

## Accomplishments

- Full-viewport satellite map rendering via MapLibre GL JS 5 with free EOX S2cloudless raster tiles (no API key, CC BY 4.0 attribution visible via MapLibre's built-in control)
- Click-to-drop and drag-to-move pin with real-time lat/lng readout; pin state lifted into App.tsx as controlled component pattern
- Coordinate input form with zod v4 validation (lat -90..90, lng -180..180), inline error display, and Google Maps URL paste detection covering 6 URL patterns
- `parseMapsUrl.ts` pure-regex parser; all 6 formats verified by 14 unit tests
- "Launch here" button wired to Phase 3 IPC (`window.api.launch`); live-instances counter and all Phase 0 testids preserved
- 7 CoordInput component tests, 14 URL parser unit tests, 1 map-flow e2e test; full test suite 74 unit + 5 launcher + 14 e2e = green

## Task Commits

1. **Plans + research** - `a92bebd` (docs: Phase 4 research + plans)
2. **Plan 04-01: MapLibre + CSP + MapView** - `352358f` (feat: MapLibre + EOX satellite basemap + CSP updates)
3. **Plan 04-02: App.tsx restructure + pin state** - `f18f543` (feat: pin drop/drag with launch-here button wired to IPC)
4. **Plan 04-03: CoordInput + parseMapsUrl** - `a31650c` (feat: coord input form + Google Maps URL parser)
5. **Plan 04-04: Tests** - `18ed4be` (test: URL parser unit + CoordInput component + map-flow e2e)

## Files Created/Modified

- `src/renderer/src/map/MapView.tsx` - MapLibre GL JS 5 controlled component: EOX satellite tiles, click-to-drop, draggable marker, flyTo support, WebGL cleanup on unmount
- `src/renderer/src/CoordInput.tsx` - Lat/lng form with zod v4 validation; Google Maps URL paste auto-populates inputs
- `src/renderer/src/utils/parseMapsUrl.ts` - Google Maps URL parser: 6 formats, WGS-84 bounds check, pure regex
- `src/renderer/src/App.tsx` - Restructured: map fills viewport, pin state lifted, Phase 0/3 testids in details footer
- `src/renderer/src/main.tsx` - Added `maplibre-gl/dist/maplibre-gl.css` import
- `src/renderer/index.html` - CSP meta tag: s2maps-tiles.eu, blob: workers, unsafe-inline styles
- `electron.vite.config.ts` - Added `optimizeDeps.include: ['maplibre-gl']` for renderer
- `vitest.config.ts` - Added renderer project (happy-dom) for component tests
- `tests/e2e/launch-flow.spec.ts` - Updated for Phase 4 UI (coord form + launch-here-button)
- `tests/unit/parseMapsUrl.test.ts` - 14 unit test cases
- `tests/renderer/CoordInput.test.tsx` - 7 component test cases
- `tests/e2e/map-flow.spec.ts` - Full map-flow e2e test

## Decisions Made

- **MapLibre maxZoom: 14** — EOX S2cloudless tiles only exist up to zoom level 14; setting higher caused blank tile fetch at zoom 15+
- **flyToTrigger counter pattern** — React state with a counter field (`{ latitude, longitude, counter }`) ensures the same coords re-submitted still triggers a `flyTo` (counter change is the signal, not coord equality)
- **onPinChangeRef pattern** — Map event listeners (click, dragend) capture a ref to the current callback rather than re-subscribing on each render; prevents stale closure bugs
- **zod v4 API** — `z.number({ error: '...' })` not `z.number({ invalid_type_error: '...' })` — v4 renamed the field

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Phase 3 e2e test used removed data-testid="launch-button"**
- **Found during:** Plan 04-04 (test creation)
- **Issue:** Phase 4's App.tsx restructure removed the old `launch-button` testid. The Phase 3 e2e test `tests/e2e/launch-flow.spec.ts` would have failed immediately.
- **Fix:** Updated test to use the coord input form (lat-input, lng-input, coord-submit) to set the Tokyo pin, then click `launch-here-button`. IPC chain validation (list(), coordinates, close()) is unchanged. The test still validates the same Phase 3 success criteria.
- **Files modified:** `tests/e2e/launch-flow.spec.ts`
- **Verification:** All 14 e2e tests pass; Phase 3 launch-flow still verifies the full IPC chain
- **Committed in:** 18ed4be (test(04-04) commit)

**2. [Rule 1 - Bug] zod v4 API: invalid_type_error → error**
- **Found during:** Plan 04-03 (CoordInput.tsx creation)
- **Issue:** `z.number({ invalid_type_error: '...' })` is a zod v3 API. Project uses zod v4.4.3 which uses `error` instead.
- **Fix:** Changed to `z.number({ error: '...' })` in CoordInput.tsx
- **Files modified:** `src/renderer/src/CoordInput.tsx`
- **Verification:** `npm run typecheck` exits 0
- **Committed in:** a31650c (feat(04-03) commit)

---

**Total deviations:** 2 auto-fixed (2x Rule 1 - Bug)
**Impact on plan:** Both fixes required for correctness. No scope creep. Phase 3 IPC contract still fully validated by the updated e2e test.

## Issues Encountered

- vitest workspace mode required `globals: true` on the renderer project separately from the root config — the root-level `globals: true` is not inherited by workspace projects in vitest 4.x. Fixed by adding it to the renderer project spec.

## User Setup Required

None — EOX S2cloudless tiles require no API key. MapLibre GL JS is bundled.

## Renderer Bundle Size

| Phase | Bundle Size | Delta |
|-------|-------------|-------|
| Phase 3 | ~0.4 MB | — |
| Phase 4 | ~2.2 MB | +1.8 MB |

The increase is MapLibre GL JS (~1.7 MB uncompressed). This is expected — MapLibre is a monolithic WebGL map library with no meaningful tree-shaking surface for its core render engine. Gzipped the renderer is ~650 kB.

## Known Stubs

None — all data paths are wired. The map renders live satellite tiles, pin state flows to the readout and launch button, and the IPC call reaches Playwright's Chromium launcher.

## Threat Flags

None — no new network endpoints, auth paths, or IPC surface added. The CSP additions are additive-permissive (allowing an external tile CDN) but do not weaken the existing Node Integration / context isolation security posture.

## Next Phase Readiness

- Phase 5 (Multi-Instance UX): MapView already supports controlled `pin` prop and `onPinChange` callback — extending to an array of `{ id, coords, color }` instances is a straightforward refactor. `window.api.list()`, `setGeo()`, and `close()` are wired and working.
- Phase 6 (Package): Renderer bundle size documented; no new native deps; CSP baseline set.

---
*Phase: 04-map-ui*
*Completed: 2026-05-15*
