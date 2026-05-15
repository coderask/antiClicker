---
phase: 03-electron-shell-ipc
plan: 02
subsystem: preload
tags: [preload, contextbridge, ipc]
dependency_graph:
  requires: [src/shared/ipc-channels.ts (extended), src/main/ipc.ts (handlers registered)]
  provides: [src/preload/index.ts (widened Api), window.api with 7 methods]
  affects: [renderer (window.api type), tests/unit/preload-api.test.ts]
tech_stack:
  added: []
  patterns: [push-event subscription returning unsubscribe fn, contextBridge surface extension]
key_files:
  created: []
  modified:
    - src/preload/index.ts
decisions:
  - onInstanceClosed returns unsubscribe fn (not async-iterable) — matches React useEffect cleanup signature exactly
  - Api type inferred from api object via typeof — index.d.ts unchanged, auto-widens
  - Exact method count: 7 (ping, getLaunchCount, launch, setGeo, close, list, onInstanceClosed)
metrics:
  duration: 5m
  completed: 2026-05-15
---

# Phase 3 Plan 02: contextBridge Preload Extension Summary

**One-liner:** Preload contextBridge extended to expose 4 launcher invoke methods + 1 push subscription (onInstanceClosed) alongside the 2 existing Phase 0 methods.

## What Was Built

Rewrote `src/preload/index.ts` to expose 7 methods via `contextBridge.exposeInMainWorld('api', api)`:
- `ping`, `getLaunchCount` — unchanged from Phase 0
- `launch(coords)` → `ipcRenderer.invoke(LauncherLaunch, coords)`
- `setGeo(id, coords)` → `ipcRenderer.invoke(LauncherSetGeo, { id, coords })`
- `close(id)` → `ipcRenderer.invoke(LauncherClose, { id })`
- `list()` → `ipcRenderer.invoke(LauncherList)`
- `onInstanceClosed(cb)` → registers `ipcRenderer.on` listener, returns unsubscribe fn

The `Api` type is still inferred via `typeof api`, so `src/preload/index.d.ts` needed no changes — it automatically exposes the widened type to the renderer.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
- `src/preload/index.ts` exports 7-method Api
- `index.d.ts` unchanged — still imports Api from ./index via typeof
- `npm run typecheck` exits 0 (both tsconfig.node.json and tsconfig.web.json)
