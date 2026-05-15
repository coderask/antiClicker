---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: phase-complete
stopped_at: Phase 04 verification complete; ready to plan Phase 05 (Multi-Instance UX)
last_updated: "2026-05-15T23:00:00.000Z"
last_activity: 2026-05-15 -- Phase 04 complete (4/4 plans, full Map UI green)
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 21
  completed_plans: 18
  percent: 86
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** One click on a map = a Chrome window that *is* at that location.
**Current focus:** Phase 04 complete — MapLibre satellite map UI shipped; ready for Phase 05 (Multi-Instance UX)

## Current Position

Phase: 04 (map-ui) — COMPLETE
Plan: 4 of 4
Status: Phase 04 verification passed — all success criteria met
Last activity: 2026-05-15 -- All 4 plans done; MapLibre satellite map, draggable pin, coord form, Google Maps URL parser, 74 unit + 5 launcher + 14 e2e tests green

Progress: [█████████░] 86%

## Performance Metrics

**Velocity:**

- Total plans completed: 17
- Phase 0 plans: 7 (1 deferred-artifact-only, 6 fully autonomous)
- Total execution time: ~7.5 hours (with two executor stream timeouts mid-Wave-2, recovered inline)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00 | 7 | ~6h | ~50min |
| 01 | 3 | ~55min | ~18min |
| 02 | 3 | ~45min | ~15min |
| 03 | 4 | ~90min | ~22min |
| 04 | 4 | ~9min | ~2min |

**Recent Trend:**

- Last 5 plans: 03-02 (preload), 03-03 (UI), 03-04 (tests), 04-03 (coord form), 04-04 (tests)
- Trend: accelerating; Phase 4 completed in ~9min total (4 plans, MapLibre integration, full test suite green)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Pre-roadmap: Stack chosen — Electron 35 + Playwright 1.60 + MapLibre GL JS 5 + Vite 6 + TypeScript 5.7 (per research/STACK.md)
- Pre-roadmap: MapLibre + EOX S2cloudless as default basemap (no API key required); Google Maps JS API as opt-in upgrade
- Pre-roadmap: Phase order is "CDP first, UI later" — Phases 0–2 have no UI; the load-bearing primitive is proven in a CLI before any shell work
- Phase 0: Sandboxed preload must be CJS (not ESM) — electron-vite preload build forces `output.format = 'cjs'` and `entryFileNames = '[name].js'`. Main loads `../preload/index.js`, not `.mjs`.
- Phase 0: `tsconfig.json` uses project references (`composite: true`) to node + web sub-configs so the bare `tsc --noEmit` in the build script walks both.
- Phase 0: FND-01 e2e uses `webContents.getLastWebPreferences()` (Electron 35 API), not `getWebPreferences()` (removed).
- Phase 1: launchPersistentContext with geolocation+permissions in constructor options is the canonical pattern — atomic grant, context-scoped, no race window.
- Phase 1: data: and about:blank URLs are non-secure origins in Chromium — geolocation requires localhost or https://. Use 127.0.0.1 HTTP server for integration test fixtures.
- Phase 3: playwright + playwright-core must be explicitly included in externalizeDepsPlugin's include list — they are devDependencies, not auto-externalized. Bundling playwright causes chromium-bidi to be hoisted as a static ESM import that Node cannot resolve.
- Phase 3: onInstanceClosed uses callback+unsubscribe pattern (not async-iterable) — matches React useEffect cleanup return signature exactly.
- Phase 4: MapLibre maxZoom capped at 14 — EOX S2cloudless tiles only exist to zoom 14; higher zoom causes blank tiles silently.
- Phase 4: flyToTrigger counter pattern — state object { latitude, longitude, counter } where counter increment signals re-submit even for same coordinates.
- Phase 4: onPinChangeRef pattern — map click/dragend listeners read from ref rather than re-subscribing, preventing stale closure bugs.
- Phase 4: vitest workspace split — separate node (unit/main/cli) and renderer (happy-dom/React) projects to avoid environment contamination.
- Phase 4: zod v4 uses `z.number({ error: '...' })` not `z.number({ invalid_type_error: '...' })` — the field was renamed in v4.

### Pending Todos

- (none — Google Cloud Console setup is no longer required; v1 ships MapLibre + EOX, no API key path)

### Blockers/Concerns

None for Phase 5. Carry-forward research flags:

- Phase 5: MapView will need to render multiple colored pins (per-instance); current controlled pin prop needs to expand to array
- Phase 6: Bundled-Chromium packaging via `extraResources` + macOS notarization for spawned Chromium child; renderer bundle now ~2.2 MB (MapLibre)

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-15
Stopped at: Phase 04 Map UI complete; ready to plan Phase 05
Resume file: None
