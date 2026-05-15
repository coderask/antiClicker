# Phase 02 Verification — multi-instance-launcher

**Phase goal:** "Extract the proven CDP primitive into a reusable `launcher/` module that supports N concurrent isolated Chrome instances with live coordinate updates — still no UI, validated via tests."

**Verified:** 2026-05-15
**Verdict:** ✅ PASS — all 5 ROADMAP success criteria are demonstrably true.

## Phase Success Criteria (Goal-Backward)

| # | ROADMAP claim | Evidence | Status |
|---|---------------|----------|--------|
| 1 | 5 instances in parallel, no cross-contamination | `tests/launcher/multi-instance.spec.ts` "5 parallel instances each report their own coordinates" | ✅ |
| 2 | Profile isolation (distinct userDataDirs, cookie boundaries) | "profiles are isolated: cookies in A invisible in B" + assertion `a.userDataDir !== b.userDataDir` | ✅ |
| 3 | Ephemeral port; 10 rapid relaunches never collide | "10 rapid launch/close cycles never collide on port" | ✅ |
| 4 | Close fires cleanup + `instance-closed` event | "closing an instance fires instance-closed and removes profile dir" (asserts event fired, registry empty, dir removed) | ✅ |
| 5 | `setGeo` updates coords without relaunch | "setGeo updates a running instance without relaunch" (round-trips fixture page, before/after coords differ) | ✅ |

## Per-Requirement Coverage

| Requirement | Source plan(s) | Evidence |
|-------------|----------------|----------|
| LCH-04 (multi-instance) | 02-01 launcher module, 02-03 parallel test | 5-instance test green |
| LCH-05 (profile isolation) | 02-01 `mkdtemp` per instance, 02-03 cookie test | isolation test green |
| LCH-06 (port stability) | 02-01 no manual `--remote-debugging-port`, 02-03 rapid-relaunch test | rapid test green |
| LCH-07 (cleanup) | 02-01 `context.on('close')` handler, 02-03 close-event test | close test green |
| LCH-08 (live setGeo) | 02-01 `setGeo()` method, 02-03 setGeo test | setGeo test green |

## Sign-Off Commands

```
$ npm run typecheck    # exits 0
$ npm run test:unit    # 4 files / 39 tests passed
$ npm run test:launcher # 5 launcher integration tests passed (after vitest registry suite)
$ npm run test         # full sign-off — unit + launcher + e2e
```

## Plans Complete (3 of 3)

| Plan | Status | Notes |
|------|--------|-------|
| 02-01 — Launcher module | ✅ | Registry + createLauncher factory + shared CoordsSchema; public API closed (BrowserContext not exposed) |
| 02-02 — Registry unit tests + shared fixture | ✅ | 14 registry tests; `startGeoFixtureServer` helper reusable by Phase 3 |
| 02-03 — Integration tests | ✅ | 5 specs map 1:1 to success criteria; uses `_testContext` back-door |

## Cross-Platform Notes

- `mkdtemp(join(tmpdir(), 'anticlicker-profile-'))` resolves to `/var/folders/.../T/` on macOS and `%TEMP%\` on Windows — both work without code changes.
- `rmSync(dir, { recursive: true, force: true })` is wrapped in try/catch because Windows occasionally holds profile locks briefly after the context closes.
- Tests use `headless: true` to avoid spawning visible windows during CI runs; production callers (Phase 3) will leave `headless` unset (defaults to `false`).

## Handoff to Phase 3

Phase 3 will import `createLauncher` from `src/launcher/` into Electron's main process and expose its API (`launch`, `setGeo`, `close`, `list` + the `instance-closed` event) through the contextBridge IPC surface. The launcher module is final; Phase 3 should not modify `src/launcher/` except to fix bugs surfaced by the IPC layer.

✅ **Phase 02 is complete. Ready for Phase 03.**
