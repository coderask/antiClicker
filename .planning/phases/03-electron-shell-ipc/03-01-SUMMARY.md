---
phase: 03-electron-shell-ipc
plan: 01
subsystem: main-ipc
tags: [ipc, launcher, zod, electron-main]
dependency_graph:
  requires: [src/launcher/index.ts, src/shared/coords-schema.ts, src/shared/ipc-channels.ts]
  provides: [src/main/ipc.ts (extended), src/main/index.ts (lifecycle), src/shared/ipc-channels.ts (extended)]
  affects: [renderer (via IPC channels), preload (via IpcChannels constants)]
tech_stack:
  added: [zod composite schemas for IPC payloads]
  patterns: [Zod-at-the-boundary, singleton factory, push-event bridging via BrowserWindow.webContents.send]
key_files:
  created: []
  modified:
    - src/shared/ipc-channels.ts
    - src/main/ipc.ts
    - src/main/index.ts
    - tsconfig.node.json
decisions:
  - Exported LaunchPayloadSchema/SetGeoPayloadSchema/ClosePayloadSchema from ipc.ts so unit tests can import schemas without starting Electron
  - getLauncher() lazy-initializes the singleton to avoid top-level await in module scope
  - closeLauncherIfAny() exported for index.ts lifecycle hook; no-ops if launcher never created
  - instance-closed push bridge wired inside registerIpc() to guarantee single registration
metrics:
  duration: 15m
  completed: 2026-05-15
---

# Phase 3 Plan 01: Main IPC Handlers + Launcher Singleton Summary

**One-liner:** Zod-validated launcher IPC handlers (launch/setGeo/close/list + instance-closed push bridge) wired to a module-scope singleton in Electron's main process.

## What Was Built

Extended `src/main/ipc.ts` with four new `ipcMain.handle` channels backed by `createLauncher()` singleton. All renderer→main payloads are parsed through Zod schemas before reaching the launcher. The `instance-closed` event is bridged from the launcher's event emitter to the Electron renderer via `BrowserWindow.getAllWindows()[0]?.webContents.send()`.

Extended `src/shared/ipc-channels.ts` with 5 new constants: `LauncherLaunch`, `LauncherSetGeo`, `LauncherClose`, `LauncherList`, `LauncherInstanceClosed`.

Updated `src/main/index.ts` to call `closeLauncherIfAny()` in the `before-quit` handler.

## Deviations from Plan

**1. [Rule 3 - Blocking] Added src/launcher/ to tsconfig.node.json include**
- **Found during:** Task 1 (typecheck)
- **Issue:** `src/launcher/**/*.ts` files were not included in tsconfig.node.json, causing TS6307 errors when main imported from the launcher.
- **Fix:** Added `"src/launcher/**/*.ts"` to the include array.
- **Files modified:** tsconfig.node.json
- **Commit:** e853782

## Self-Check: PASSED
- `src/main/ipc.ts` exists with all 4 launcher handlers
- `closeLauncherIfAny` exported and imported in index.ts
- `npm run typecheck` exits 0
