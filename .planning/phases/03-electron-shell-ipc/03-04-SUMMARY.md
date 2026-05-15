---
phase: 03-electron-shell-ipc
plan: 04
subsystem: tests
tags: [tests, vitest, playwright, e2e, zod]
dependency_graph:
  requires: [src/main/ipc.ts (exported schemas), src/renderer/src/App.tsx (testids), out/main/index.js (built app)]
  provides: [tests/unit/ipc-validation.test.ts, tests/e2e/launch-flow.spec.ts]
  affects: [tests/unit/preload-api.test.ts (updated for 7-method Api)]
tech_stack:
  added: []
  patterns: [Zod safeParse isolation testing, Playwright _electron.launch for e2e]
key_files:
  created:
    - tests/unit/ipc-validation.test.ts
    - tests/e2e/launch-flow.spec.ts
  modified:
    - tests/unit/preload-api.test.ts
    - electron.vite.config.ts
decisions:
  - ipc-validation.test.ts imports schemas directly from src/main/ipc.ts (no Electron needed)
  - launch-flow.spec.ts uses try/finally to guarantee app.close() on failure
  - test.setTimeout(90_000) for launch-flow — bundled Chromium startup can take several seconds
  - electron.vite.config.ts: playwright + playwright-core explicitly included in externalize list
    (they are devDependencies, not externalized by default, causing chromium-bidi bundling failure)
metrics:
  duration: 30m
  completed: 2026-05-15
---

# Phase 3 Plan 04: Zod IPC Validation Unit + Electron Launch-Flow E2E Summary

**One-liner:** 11-case Zod schema unit tests (pure Node) + full IPC chain e2e test proving launch → counter → list → close → counter flow, plus a critical electron-vite config fix that un-broke all e2e tests.

## What Was Built

`tests/unit/ipc-validation.test.ts` — 11 test cases:
- `LaunchPayloadSchema`: 5 cases (valid, lat OOB, lng wrong type, accuracy positive, accuracy negative)
- `SetGeoPayloadSchema`: 3 cases (valid, coords OOB, missing id)
- `ClosePayloadSchema`: 3 cases (valid, missing id, non-string id)

`tests/e2e/launch-flow.spec.ts` — single test with 90s timeout:
1. Launch built Electron app
2. Wait for ping=pong (ready signal)
3. Assert live-instances=0
4. Click launch button
5. Assert live-instances=1 (30s timeout for Chrome startup)
6. Evaluate `window.api.list()` — assert length=1, coords approx match Tokyo
7. Evaluate `window.api.close(id)` for the instance
8. Assert live-instances=0 (event received)
9. app.close() in finally block

`tests/unit/preload-api.test.ts` — updated:
- Required key count changed from 2 to 7
- Added stub implementations for all 7 Api methods
- Added 3 new behavioral tests (launch, list, onInstanceClosed)

## Critical Deviation: electron-vite config fix

**[Rule 3 - Blocking] playwright not externalized in electron-vite build**
- **Found during:** e2e test run (all 4 tests timing out)
- **Issue:** `externalizeDepsPlugin()` only externalizes packages from `dependencies` in package.json. `playwright` is a `devDependency`. When bundled, playwright's `coreBundle.js` contains lazy `require("chromium-bidi/...")` calls which vite/rollup hoists to static ESM imports at the top of the bundle. `chromium-bidi` is not a standalone package in `node_modules`, so Node.js fails to resolve it at startup — the Electron app crashes immediately with `ERR_MODULE_NOT_FOUND`.
- **Fix:** Changed `externalizeDepsPlugin()` to `externalizeDepsPlugin({ include: ['playwright', 'playwright-core'] })` in `electron.vite.config.ts`.
- **Effect:** Main bundle dropped from 6.4 MB to 11.4 kB. All 4 e2e tests recovered.
- **Files modified:** electron.vite.config.ts
- **Commit:** 103c2d6

## Self-Check: PASSED
- `tests/unit/ipc-validation.test.ts` exists (11 cases, all pass)
- `tests/e2e/launch-flow.spec.ts` exists (1 test, passes)
- `npm run test` exits 0 (53 unit + 5 launcher + 13 e2e = 71 total assertions passing)
