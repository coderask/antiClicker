# Plan 00-02 Summary — Electron Main-Process Entry + IPC Bootstrap

**Phase:** 00-foundation-bootstrap
**Plan:** 02
**Requirements:** FND-01 (secure defaults)
**Wave:** 2
**Completed:** 2026-05-15

## What Was Built

The Electron main-process skeleton with the four FND-01 security invariants baked in as explicit (grep-friendly) `webPreferences` flags, the dev/packaged renderer-URL switch, IPC handler registration, the shared channel-name constants, and the shared TypeScript type surface that 00-05's preload will consume.

Three atomic commits:

1. `feat(00-02): add shared IPC channel constants and type surface` — `src/shared/ipc-channels.ts` declares the channel-name union (`Ping`, `ConfigGetLaunchCount`) via `as const` so typos become compile errors. `src/shared/types.ts` re-exports `PingResponse`, `LaunchCount`, and a forward `AppConfig` type alias.
2. `feat(00-02): add Electron main entry with FND-01 secure defaults` — `src/main/index.ts` constructs `BrowserWindow` with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`. Wires `is.dev` to choose `ELECTRON_RENDERER_URL` in dev vs `startRendererServer()` in packaged builds (forward import to 00-03). Calls `initConfigStore()` then `registerIpc()` inside `app.whenReady()` (forward import to 00-04). No `loadFile()` anywhere — by construction the renderer never gets a `file://` URL.
3. `feat(00-02): add IPC bootstrap with Phase 0 minimal handler set` — `src/main/ipc.ts` exports `registerIpc()` with exactly two handlers: a `Ping` round-trip smoke test (returns the literal `'pong'`) and `ConfigGetLaunchCount` (reads from `getStore()`).

## Files Created

- `src/main/index.ts`
- `src/main/ipc.ts`
- `src/shared/types.ts`
- `src/shared/ipc-channels.ts`

## Forward Imports (Resolved Later in Wave 2)

- `./renderer-server.js` — created by 00-03 (running next)
- `./config-store.js` — created by 00-04 (running after 00-03)

Per the plan's "Forward Stub" guidance, these unresolved imports are expected and do not block — `tsc` will succeed once 00-03 and 00-04 land.

## FND-01 Invariants Verified by Code Inspection

| Invariant | Where | Greppable Anchor |
|-----------|-------|------------------|
| `contextIsolation: true` | `src/main/index.ts` webPreferences | `contextIsolation: true` |
| `nodeIntegration: false` | `src/main/index.ts` webPreferences | `nodeIntegration: false` |
| `sandbox: true` | `src/main/index.ts` webPreferences | `sandbox: true` |
| `webSecurity: true` | `src/main/index.ts` webPreferences | `webSecurity: true` |

## Handoff

00-03 (next plan in this wave) creates `src/main/renderer-server.ts` exporting `startRendererServer(): Promise<string>`.
00-04 creates `src/main/config-store.ts` exporting `initConfigStore()` + `getStore()`.
00-05 will create `src/preload/index.ts` importing from `src/shared/ipc-channels.ts` and `src/shared/types.ts`.
