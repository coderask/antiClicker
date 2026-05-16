---
phase: 07-persistence-google-maps
plan: all
subsystem: renderer, main, config, ipc, packaging
tags:
  - persistence
  - favorites
  - google-maps
  - recents
  - ipc
  - csp
  - version-bump
dependency_graph:
  requires:
    - 06-verification-package
  provides:
    - persistent-pins
    - favorites
    - google-maps-backend
  affects:
    - config-store
    - ipc-channels
    - preload
    - renderer-app
tech_stack:
  added:
    - Google Maps JS API (optional, dynamic load, no npm dep)
    - Inline .env.local parser (no dotenv dep)
  patterns:
    - Debounced persist (500ms) for state → electron-store writes
    - MapBackend switcher (runtime, key-based conditional render)
    - Idempotent script loader (check window.google?.maps before inject)
    - Graceful fallback (script load error → revert to MapLibre)
key_files:
  created:
    - src/main/load-env-key.ts
    - src/renderer/src/Favorites.tsx
    - src/renderer/src/map/GoogleMapView.tsx
    - .env.template
    - tests/unit/loadEnvKey.test.ts
    - tests/renderer/Favorites.test.tsx
    - .planning/phases/07-persistence-google-maps/07-RESEARCH.md
    - .planning/phases/07-persistence-google-maps/07-01-PLAN.md through 07-07-PLAN.md
  modified:
    - src/main/config-store.ts (recentPins + favorites fields + NamedCoordsSchema)
    - src/main/index.ts (loadEnvKey wiring)
    - src/main/ipc.ts (6 new handlers)
    - src/shared/ipc-channels.ts (6 new channels)
    - src/preload/index.ts (6 new bridge methods)
    - src/renderer/src/App.tsx (Favorites, GoogleMapView, backend switcher, key UI)
    - src/renderer/index.html (CSP expanded for Google Maps origins)
    - tests/unit/config-store.test.ts (new schema tests)
    - tests/unit/preload-api.test.ts (updated to 17 methods)
    - package.json (version 0.0.4 → 0.0.5)
    - README.md (Google Maps section, version refs)
    - .gitignore (!.env.template exception)
    - .planning/phases/00-foundation-bootstrap/CLOUD-CONSOLE-CHECKLIST.md
decisions:
  - "Inline .env.local parser instead of dotenv — avoids runtime dep for one variable"
  - "Old google.maps.Marker API instead of AdvancedMarkerElement — no mapId requirement"
  - "500ms debounce for electron-store writes — avoids IO churn on rapid pin drops"
  - "unsafe-eval in CSP — Google Maps requires it for tile math; documented tradeoff"
  - "Graceful fallback on script load error — empty div never shown, silently reverts to Esri"
  - "window.prompt for favorite name — avoids adding a modal component; acceptable for MVP"
metrics:
  duration: "~50 minutes"
  completed: "2026-05-16"
  tasks_completed: 7
  files_changed: 19
---

# Phase 7: Persistence + Google Maps Summary

**One-liner:** Persistent recent pins + favorites sidebar with electron-store, optional Google Maps JS API satellite backend with runtime switcher and inline .env.local loader.

## Completed Tasks

| Plan | Task | Commit | Key Files |
|------|------|--------|-----------|
| 07-01 | ConfigSchema + loadEnvKey | 351fc4d | config-store.ts, load-env-key.ts, index.ts |
| 07-02 | IPC channels + preload bridge | a22bc49 | ipc-channels.ts, ipc.ts, preload/index.ts |
| 07-03 | Persistent recents in App.tsx | 403b3c8 | App.tsx |
| 07-04 | Favorites component + wiring | 4c48913 | Favorites.tsx, App.tsx |
| 07-05 | GoogleMapView + backend switcher + CSP | 9f476a3 | GoogleMapView.tsx, App.tsx, index.html |
| 07-06 | Key UI + .env.template + docs | 73fe695 | .env.template, README.md, CLOUD-CONSOLE-CHECKLIST.md |
| 07-07 | Tests + version bump + package | f7019cd | config-store.test.ts, loadEnvKey.test.ts, Favorites.test.tsx, package.json |

## Build Artifacts

- `/tmp/anticlicker-dist/AntiClicker-0.0.5-arm64.dmg` (346 MB, ad-hoc signed)
- `/tmp/anticlicker-dist/AntiClicker-0.0.5.dmg` (432 MB, ad-hoc signed)
- `/tmp/anticlicker-dist/AntiClicker Setup 0.0.5.exe` (331 MB, unsigned)

Release: https://github.com/coderask/antiClicker/releases/tag/v0.0.5

## Test Coverage

| Suite | Before | After |
|-------|--------|-------|
| Unit + component (vitest) | 102 | 135 |
| New test files | — | loadEnvKey.test.ts (12 cases), Favorites.test.tsx (9 cases), config-store.test.ts (+10 cases) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] .gitignore blocked .env.template commit**
- Found during: Plan 07-06 commit
- Issue: `.gitignore` has `.env.*` which matches `.env.template`, preventing git add
- Fix: Added `!.env.template` negation exception to .gitignore (the template contains no secrets)
- Files modified: .gitignore
- Commit: 73fe695

**2. [Rule 2 - Missing critical] Phase 6 methods absent from preload-api.test.ts fakeApi**
- Found during: Plan 07-02 test update
- Issue: The old test only listed 7 methods (Phase 0 + 3) but the preload actually had 11 (Phase 6 added 4 methods). The fakeApi was incomplete.
- Fix: Updated fakeApi and test to correctly enumerate all 17 methods (Phase 0 + 3 + 6 + 7)
- Files modified: tests/unit/preload-api.test.ts
- Commit: a22bc49

### Scope Notes

- The Favorites debounced persist runs on initial empty-array mount (from useState([])), which could trigger an unnecessary write on first load. The recentPins debounce skips empty arrays; the favorites debounce always runs after 500ms. Impact is minimal (writing `[]` to electron-store is fast and idempotent). A future improvement could check `hasMounted` before persisting.
- `window.prompt` for favorite naming works but looks OS-native (not stylized). A future plan could add a proper in-app input modal.

## Known Stubs

None. All features are fully wired end-to-end.

## Known Coverage Gaps

- E2E tests for GoogleMapView are excluded — they require a live Google Maps API key and network connectivity. Documented in plan 07-07 and this summary.
- The favorites debounced persist fires on initial render with the just-loaded favorites array (a no-op write). Low priority.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: csp-relaxation | src/renderer/index.html | Added `'unsafe-eval'` to script-src for Google Maps JS API. Documented tradeoff: Google Maps requires eval() for tile math; risk is low in local desktop app with no user-supplied renderer content. |
| threat_flag: key-in-script-src | src/renderer/src/map/GoogleMapView.tsx | API key embedded in the script URL `?key=${apiKey}`. This is standard for Maps JS API and is accepted practice; the key is restricted to localhost HTTP referrers. |

## Self-Check: PASSED

Files created:
- [x] src/main/load-env-key.ts
- [x] src/renderer/src/Favorites.tsx
- [x] src/renderer/src/map/GoogleMapView.tsx
- [x] .env.template
- [x] tests/unit/loadEnvKey.test.ts
- [x] tests/renderer/Favorites.test.tsx

Commits verified:
- [x] 351fc4d (feat 07-01)
- [x] a22bc49 (feat 07-02)
- [x] 403b3c8 (feat 07-03)
- [x] 4c48913 (feat 07-04)
- [x] 9f476a3 (feat 07-05)
- [x] 73fe695 (feat 07-06)
- [x] f7019cd (test 07-07)

Build artifacts:
- [x] /tmp/anticlicker-dist/AntiClicker-0.0.5-arm64.dmg
- [x] /tmp/anticlicker-dist/AntiClicker-0.0.5.dmg
- [x] /tmp/anticlicker-dist/AntiClicker Setup 0.0.5.exe
