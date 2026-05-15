# Phase 00 Verification — foundation-bootstrap

**Phase goal:** "Electron 35 desktop shell launches with secure defaults and a renderer served over HTTP (not file://), with persistent settings storage in place."

**Verified:** 2026-05-15
**Verdict:** ✅ PASS — all four success criteria from ROADMAP.md are demonstrably true.

## Phase Success Criteria (Goal-Backward)

| # | ROADMAP claim | Evidence | Status |
|---|---------------|----------|--------|
| 1 | webPreferences have `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` | `tests/e2e/secure-defaults.spec.ts` asserts all three via `webContents.getLastWebPreferences()` against the built app | ✅ |
| 2 | Renderer loaded over `http://`, never `file://` | `tests/e2e/http-protocol.spec.ts` asserts `window.url().startsWith('http://')` AND DOM `[data-testid="protocol"]` === `"http:"` | ✅ |
| 3 | electron-store writes persist across relaunch | `tests/e2e/persistence.spec.ts` launches twice with `--user-data-dir=<tmpdir>` and asserts `count2 === count1 + 1` | ✅ |
| 4 | contextBridge preload exposes only a narrow typed API surface (no raw ipcRenderer, no require) | `src/preload/index.ts`: single `contextBridge.exposeInMainWorld('api', api)` call exposing exactly two methods; `! grep -q electronAPI src/preload/`; `tests/unit/preload-api.test.ts` asserts `keyof Api` shape | ✅ |

## Per-Requirement Coverage

| Requirement | Source plan(s) | Evidence |
|-------------|----------------|----------|
| FND-01 (secure webPreferences + narrow preload) | 00-02 (main), 00-05 (preload), 00-06 (e2e) | secure-defaults.spec.ts green |
| FND-02 (HTTP, never file://) | 00-03 (HTTP server), 00-02 (main URL switch), 00-06 (e2e) | http-protocol.spec.ts green |
| FND-03 (electron-store persistence) | 00-04 (config-store), 00-02 (initConfigStore on whenReady), 00-06 (e2e) | persistence.spec.ts green |

## Sign-Off Commands

```
$ npm run typecheck   # exits 0 (composite project refs walk node + web)
$ npm run build       # exits 0 (three bundles emitted: main/index.js, preload/index.js, renderer/)
$ npm run test:unit   # 2 files / 7 tests passed
$ npm run test:e2e    # 3 tests passed (after fresh build)
$ npm run test        # full sign-off — unit + e2e all green
```

## Plans Complete (7 of 7)

| Plan | Status | Notes |
|------|--------|-------|
| 00-01 — Scaffold + Wave 0 test infra | ✅ | 3 commits; pinned versions; stub specs in place |
| 00-02 — Main entry + IPC bootstrap | ✅ | 3 commits; FND-01 invariants greppable in code |
| 00-03 — HTTP renderer server | ✅ | 1 commit; 127.0.0.1 loopback only, ephemeral port, path-traversal + host-header guards |
| 00-04 — electron-store + zod | ✅ | 2 commits; 2-field schema, launchCount incremented per init, 4 unit tests |
| 00-05 — Preload bridge + verification UI | ✅ | 3 commits + tsconfig project-ref fix; 3 data-testid hooks |
| 00-06 — FND e2e + preload unit + test:e2e build chain | ✅ | 4 commits incl. preload→CJS fix; FND-01/02/03 all green |
| 00-07 — Cloud Console checklist | ⚠ Deferred-artifact | Non-autonomous. Artifact at `CLOUD-CONSOLE-CHECKLIST.md` records the four required steps; user must check each `[ ]` before Phase 4 plan-phase. |

## Known Open Items Carried to Phase 4 Gate

- `.planning/phases/00-foundation-bootstrap/CLOUD-CONSOLE-CHECKLIST.md` must have all four checkboxes ticked + confirmation date filled before Phase 4 (Maps UI) plan-phase begins. Pitfall 4 (referrer restriction) and Pitfall 5 (billing surprise) from `research/PITFALLS.md` are not yet mitigated until those four manual steps are done.

## Phase 0 Build Artifacts

- `out/main/index.js` — 5.25 kB
- `out/preload/index.js` — 0.50 kB (CJS, sandbox-compatible)
- `out/renderer/index.html` + `out/renderer/assets/index-H__asT5p.js` — 556.93 kB (React + StrictMode)

## Goal-Backward Verdict

The phase goal is "Electron 35 desktop shell launches with secure defaults and a renderer served over HTTP (not file://), with persistent settings storage in place." Each clause of that sentence has a direct, automated assertion in the test suite that passes against the BUILT app (not dev mode). The phase delivers exactly what it promised.

✅ **Phase 00 is complete. Ready for Phase 01.**
