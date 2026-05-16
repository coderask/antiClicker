---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: completed
stopped_at: Phase 06 complete — v1.0 milestone SHIPPED
last_updated: "2026-05-15T23:36:37.055Z"
last_activity: 2026-05-15 -- All 28 plans done; verify-spoof + scope overlay + orphan sweep + packaging; 98 unit + 18 e2e tests green
progress:
  total_phases: 7
  completed_phases: 4
  total_plans: 31
  completed_plans: 20
  percent: 65
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** One click on a map = a Chrome window that *is* at that location.
**Current focus:** MILESTONE COMPLETE — v1.0 shipped; all 6 phases done; installers in dist/

## Current Position

Phase: 06 (verification-package) — COMPLETE
Plan: 5 of 5
Status: milestone-complete — v1 shipped
Last activity: 2026-05-15 -- All 28 plans done; verify-spoof + scope overlay + orphan sweep + packaging; 98 unit + 18 e2e tests green

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 28
- Phase 0 plans: 7 (1 deferred-artifact-only, 6 fully autonomous)
- Total execution time: ~8.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00 | 7 | ~6h | ~50min |
| 01 | 3 | ~55min | ~18min |
| 02 | 3 | ~45min | ~15min |
| 03 | 4 | ~90min | ~22min |
| 04 | 4 | ~9min | ~2min |
| 05 | 5 | ~18min | ~3.5min |
| 06 | 6 | ~55min | ~9min |

**Recent Trend:**

- Last 6 plans: 06-01 (schema+sweep), 06-02 (IPC), 06-03 (renderer), 06-04 (icons), 06-05 (tests+packaging)
- Trend: Phase 6 completed in ~55min total (5 plans, 98 tests, 3 installer artifacts)

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
- Phase 3: playwright + playwright-core must be explicitly included in externalizeDepsPlugin's include list — they are devDependencies, not auto-externalized.
- Phase 3: onInstanceClosed uses callback+unsubscribe pattern (not async-iterable) — matches React useEffect cleanup return signature exactly.
- Phase 4: MapLibre maxZoom capped at 14 — EOX S2cloudless tiles only exist to zoom 14.
- Phase 4: flyToTrigger counter pattern — state object { latitude, longitude, counter } where counter increment signals re-submit even for same coordinates.
- Phase 4: onPinChangeRef pattern — map click/dragend listeners read from ref rather than re-subscribing.
- Phase 4: vitest workspace split — separate node (unit/main/cli) and renderer (happy-dom/React) projects.
- Phase 4: zod v4 uses `z.number({ error: '...' })` not `z.number({ invalid_type_error: '...' })`.
- Phase 5: Optimistic setGeo update — drag immediately updates state; IPC fires; failure reverts.
- Phase 5: Map<InstanceId, RunningInstance> with immutable copy-on-write.
- Phase 5: Callback refs in MapLibre event handlers — onMarkerDragRef pattern.
- Phase 6: pid.txt sentinel uses Electron main process PID; sweep deletes dir if that PID is gone.
- Phase 6: sweepOrphanedProfiles extracted to sweep.ts with injectable killFn for unit testability.
- Phase 6: page.evaluate geolocation call uses cast-via-unknown to bypass Node tsconfig DOM lib.
- Phase 6: asarUnpack for playwright/.local-browsers — Chromium must be outside asar for OS to spawn.
- Phase 6: electron-builder cross-compiles Windows NSIS from macOS (no Wine).

### Pending Todos

- (none — milestone complete)

### Blockers/Concerns

None. Milestone complete.

## Quick Tasks Completed

| Date       | Slug                | Summary                                                          |
|------------|---------------------|------------------------------------------------------------------|
| 2026-05-16 | bolder-pin-color    | Accent swapped from amber `#f5a524` → hot magenta `#ff2d92` for satellite-imagery contrast |
| 2026-05-16 | place-search        | Floating Nominatim-backed search bar (Cmd/Ctrl-K) — geocodes place names to coords |

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-15T23:36:37.051Z
Stopped at: Phase 06 complete — v1.0 milestone SHIPPED
Resume file: None
