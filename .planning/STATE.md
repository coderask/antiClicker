---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: phase-complete
stopped_at: Phase 05 verification complete; ready to plan Phase 06 (Verification + Polish + Package)
last_updated: "2026-05-15T23:20:00.000Z"
last_activity: 2026-05-15 -- Phase 05 complete (5/5 plans, Multi-Instance UX + Live Update green)
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 26
  completed_plans: 23
  percent: 88
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-14)

**Core value:** One click on a map = a Chrome window that *is* at that location.
**Current focus:** Phase 05 complete — Multi-Instance UX shipped; sidebar, colored pins, live setGeo, recent pins all working

## Current Position

Phase: 05 (multi-instance-ux) — COMPLETE
Plan: 5 of 5
Status: Phase 05 verification passed — all success criteria met
Last activity: 2026-05-15 -- All 5 plans done; Sidebar, multi-pin MapView, RecentPins, ring-buffer utility; 118 tests green

Progress: [█████████░] 88%

## Performance Metrics

**Velocity:**

- Total plans completed: 23
- Phase 0 plans: 7 (1 deferred-artifact-only, 6 fully autonomous)
- Total execution time: ~7.8 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 00 | 7 | ~6h | ~50min |
| 01 | 3 | ~55min | ~18min |
| 02 | 3 | ~45min | ~15min |
| 03 | 4 | ~90min | ~22min |
| 04 | 4 | ~9min | ~2min |
| 05 | 5 | ~18min | ~3.5min |

**Recent Trend:**

- Last 5 plans: 04-04 (tests), 05-01 (state model), 05-02 (Sidebar), 05-03 (MapView), 05-04/05 (RecentPins + tests)
- Trend: accelerating; Phase 5 completed in ~18min total (5 plans, 118 tests, full multi-instance UX)

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
- Phase 5: Optimistic setGeo update — drag immediately updates state; IPC fires; failure reverts — instant visual feedback without blocking UX.
- Phase 5: Map<InstanceId, RunningInstance> with immutable copy-on-write — React won't re-render on in-place mutation, always create new Map(prev).
- Phase 5: Callback refs in MapLibre event handlers — onMarkerDragRef pattern ensures dragend always calls current handler version without re-attaching.
- Phase 5: SC#3 (drag → CDP live update) verified at launcher integration level, not e2e level — Phase 2 integration tests already prove CDP round-trip; Phase 5 e2e focuses on UI state changes.

### Pending Todos

- (none — Google Cloud Console setup is no longer required; v1 ships MapLibre + EOX, no API key path)

### Blockers/Concerns

None for Phase 6. Carry-forward research flags:

- Phase 6: Bundled-Chromium packaging via `extraResources` + macOS Gatekeeper handling for spawned Chromium child
- Phase 6: First-run scope overlay ("Coordinates only — your IP, timezone, and language are unchanged")
- Phase 6: electron-builder cross-compile macOS .dmg + Windows NSIS .exe

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-05-15
Stopped at: Phase 05 Multi-Instance UX complete; ready to plan Phase 06
Resume file: None
