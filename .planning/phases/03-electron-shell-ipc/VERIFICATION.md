# Phase 03 Verification — electron-shell-ipc

**Phase goal:** "Move the proven launcher module into Electron's main process and freeze a typed, zod-validated `window.api` IPC surface, validated end-to-end with a placeholder one-button UI."

**Verified:** 2026-05-15
**Verdict:** PASS — all 4 ROADMAP success criteria are demonstrably true.

## Phase Success Criteria (Goal-Backward)

| # | ROADMAP claim | Evidence | Status |
|---|---------------|----------|--------|
| 1 | Placeholder UI with launch button; clicking it opens Chrome at hardcoded coords | `tests/e2e/launch-flow.spec.ts`: clicks `[data-testid="launch-button"]`, asserts `[data-testid="live-instances"]` reaches "1" within 30s | PASS |
| 2 | `main/ipc.ts` validates every renderer→main payload via zod before any CDP call | `tests/unit/ipc-validation.test.ts`: 11 cases; lat=95 → success=false, lng="foo" → success=false | PASS |
| 3 | `window.api` exposes exactly 4 invoke + 1 subscription + 2 Phase 0 = 7 methods, no extras | `src/preload/index.ts` api object has 7 keys; `tests/unit/preload-api.test.ts` asserts required.length===7 | PASS |
| 4 | Renderer receives `instance-closed` with correct id; live-instances decrements | `tests/e2e/launch-flow.spec.ts`: after `window.api.close(id)`, asserts live-instances returns to "0" within 15s | PASS |

## Per-Requirement Coverage

| Requirement | Source plan(s) | Evidence |
|-------------|----------------|----------|
| REL-05 (IPC surface frozen via contextBridge) | 03-01 (handlers), 03-02 (preload), 03-03 (UI), 03-04 (tests) | All 4 plans complete; e2e green |

## Sign-Off Commands

```
$ npm run typecheck   # exits 0
$ npm run test:unit   # 5 files / 53 tests passed
$ npm run test:launcher # 5 launcher integration tests passed
$ npm run test:e2e    # 4 electron + 4 cli + 5 launcher = 13 tests passed (after build)
$ npm run test        # full sign-off — unit + launcher + e2e all green
```

## Plans Complete (4 of 4)

| Plan | Status | Notes |
|------|--------|-------|
| 03-01 — Main IPC handlers + launcher singleton | PASS | 6 ipcMain.handle channels; 3 exported Zod schemas; instance-closed push bridge; tsconfig.node.json fixed |
| 03-02 — contextBridge preload extension | PASS | 7-method Api (4 invoke + 1 subscription + 2 Phase 0); index.d.ts unchanged |
| 03-03 — Placeholder launch button + live-instances readout | PASS | launch-button + live-instances testids; onInstanceClosed subscription in useEffect |
| 03-04 — Zod validation unit + launch-flow e2e | PASS | 11 unit cases; 1 e2e test; electron-vite config fix (playwright externalization) |

## Key Deviation: electron-vite playwright externalization

The build config incorrectly bundled `playwright` (a devDependency) into the main process bundle. Playwright's internal `coreBundle.js` contains lazy `require("chromium-bidi/...")` calls that, when bundled, vite hoisted to static ESM imports. Since `chromium-bidi` is not a standalone package in node_modules, all e2e tests failed immediately with `ERR_MODULE_NOT_FOUND`.

**Fix:** `externalizeDepsPlugin({ include: ['playwright', 'playwright-core'] })` in `electron.vite.config.ts`. This is the correct pattern for any Electron app that uses Playwright in the main process: Playwright must be externalized, not bundled.

## Cross-Platform Notes

- The launcher uses `os.tmpdir()` for profile directories — cross-platform.
- The IPC handlers have no OS-specific code.
- The push bridge `BrowserWindow.getAllWindows()[0]?.webContents.send()` is Electron-standard.

## Handoff to Phase 4

Phase 4 will replace `src/renderer/src/App.tsx` with a real MapLibre satellite map UI. The IPC contract (`window.api`) is now frozen — Phase 4 calls `launch()`, `setGeo()`, `close()`, `list()`, and `onInstanceClosed()` without any further changes to the preload, main/ipc.ts, or channel constants.

PASS **Phase 03 is complete. Ready for Phase 04.**
