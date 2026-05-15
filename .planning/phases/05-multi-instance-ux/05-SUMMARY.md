---
phase: 05-multi-instance-ux
plan: all
subsystem: renderer-ui
tags:
  - multi-instance
  - sidebar
  - maplibre
  - react-state
  - ring-buffer
  - ipc
dependency_graph:
  requires:
    - 04-map-ui
    - 02-multi-instance-launcher
    - 03-electron-shell-ipc
  provides:
    - Sidebar with instance rows + close + focus
    - MapView N colored draggable markers
    - setGeo live-update via marker drag
    - RecentPins ring-buffer panel
  affects:
    - src/renderer/src/App.tsx
    - src/renderer/src/map/MapView.tsx
tech_stack:
  added:
    - pushBounded ring-buffer utility (pure TypeScript, no deps)
  patterns:
    - Optimistic IPC update with revert on failure
    - Map<id, instance> React state with immutable copy-on-write
    - Per-marker ref captured in closure (closure-safe instance ID)
    - Callback refs to avoid stale closures in MapLibre event handlers
key_files:
  created:
    - src/renderer/src/Sidebar.tsx
    - src/renderer/src/RecentPins.tsx
    - src/renderer/src/utils/ringBuffer.ts
    - tests/unit/ringBuffer.test.ts
    - tests/renderer/Sidebar.test.tsx
    - tests/e2e/multi-instance-flow.spec.ts
    - .planning/phases/05-multi-instance-ux/05-RESEARCH.md
    - .planning/phases/05-multi-instance-ux/05-01-PLAN.md
    - .planning/phases/05-multi-instance-ux/05-02-PLAN.md
    - .planning/phases/05-multi-instance-ux/05-03-PLAN.md
    - .planning/phases/05-multi-instance-ux/05-04-PLAN.md
    - .planning/phases/05-multi-instance-ux/05-05-PLAN.md
  modified:
    - src/renderer/src/App.tsx
    - src/renderer/src/map/MapView.tsx
decisions:
  - "Optimistic setGeo update: drag immediately updates state; IPC fires; failure reverts — provides instant visual feedback without blocking UX"
  - "8-color COLORS palette: COLORS[instances.size % 8] at launch time — predictable assignment, no config needed"
  - "Map<InstanceId, RunningInstance> with immutable copy-on-write: React won't re-render on in-place mutation, always create new Map(prev)"
  - "Callback refs in MapLibre event handlers: onPinChangeRef + onMarkerDragRef pattern ensures dragend always calls the current handler version"
  - "SC#3 (drag → CDP live update) verified at launcher integration level not e2e level — Phase 5 e2e focuses on UI state changes; CDP round-trip already proven in Phase 2"
metrics:
  duration: "~18 minutes"
  completed: "2026-05-15"
  plans_completed: 5
  tests_added: 16
  files_created: 6
  files_modified: 2
---

# Phase 5: Multi-Instance UX + Live Update Summary

**One-liner:** Multi-instance sidebar with colored MapLibre markers, per-marker drag → live setGeo IPC, and a session-only recent-pins ring buffer surfacing the Phase 2 launcher in the UI.

## What Was Built

### New Components

**`src/renderer/src/Sidebar.tsx`** — Right-docked panel (280px) listing running Chrome instances. Each row shows a colored dot, truncated ID, coords, and a close button. Active row has background tint, left-border color, and `data-testid="instance-row-active"`. Close button calls `stopPropagation()` to avoid triggering focus.

**`src/renderer/src/RecentPins.tsx`** — Recent-pins section at the bottom of the sidebar. Shows the last 10 launched coords in reverse order (newest first). Clicking a row sets the draft pin + flies the map there without auto-launching. Data persists only in React state — cleared on app quit.

**`src/renderer/src/utils/ringBuffer.ts`** — Pure utility: `pushBounded<T>(arr, item, max): T[]`. Returns a new array with item appended, capped at max by removing the oldest entries from the front.

### Extended Components

**`src/renderer/src/App.tsx`** — Refactored from single-pin model to:
- `instances: Map<InstanceId, RunningInstance>` — running Chrome instances
- `draftPin: PinCoords | null` — un-launched click (replaces single `pin`)
- `activeId: InstanceId | null` — focused instance
- `recentPins: PinCoords[]` — ring buffer of last 10 launched coords
- `handleSetGeo`: optimistic update + IPC + revert on failure
- `handleClose`: IPC close + local cleanup fallback
- `handleFocusInstance`: setActiveId + flyTo
- `onInstanceClosed` subscription: removes from Map, clears activeId if closed
- Layout: flex-row (map + sidebar) inside flex-column

**`src/renderer/src/map/MapView.tsx`** — Extended to support N instance markers:
- New `InstanceMarkerInfo` type + optional `instances`, `activeId`, `onMarkerDrag` props
- `instanceMarkersRef: Map<string, Marker>` — tracks per-instance markers
- Diff logic: remove stale markers, update existing (position + active styling), add new
- `dragend` closure captures instanceId safely
- Active marker: `scale(1.3)` + bright white border
- Full cleanup on unmount (all instance markers + draft marker)

## Test Coverage

| File | Tests | Coverage |
|------|-------|---------|
| `tests/unit/ringBuffer.test.ts` | 9 | pushBounded: append, cap, oldest-removal, max=0/1, immutability, objects |
| `tests/renderer/Sidebar.test.tsx` | 6 | empty state, 3 rows, active testid, click → onFocus, close → onClose, no propagation |
| `tests/e2e/multi-instance-flow.spec.ts` | 1 (multi-step) | SC#1 (2 rows), SC#2 (focus active), SC#4 (close→1 row), SC#5 (recent pins) |

**Full suite: 89 unit + 14 launcher + 15 e2e = 118 tests, all green.**

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All UI state is wired to real IPC calls.

## Threat Flags

None. No new network endpoints, auth paths, or trust-boundary changes. All IPC passes through the existing frozen preload surface (7 methods, unchanged).

## Self-Check: PASSED

Files created/exist:
- src/renderer/src/Sidebar.tsx: FOUND
- src/renderer/src/RecentPins.tsx: FOUND
- src/renderer/src/utils/ringBuffer.ts: FOUND
- tests/unit/ringBuffer.test.ts: FOUND
- tests/renderer/Sidebar.test.tsx: FOUND
- tests/e2e/multi-instance-flow.spec.ts: FOUND

Commits: cc95c2d, 5e18d5f, 301ecd4, 3eb1332, 6f96a16, 8842b6d
