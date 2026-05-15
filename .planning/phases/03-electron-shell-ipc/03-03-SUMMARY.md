---
phase: 03-electron-shell-ipc
plan: 03
subsystem: renderer
tags: [renderer, react, ui, launcher]
dependency_graph:
  requires: [src/preload/index.ts (widened Api), window.api.launch, window.api.onInstanceClosed]
  provides: [src/renderer/src/App.tsx (launch button + live-instances readout)]
  affects: [tests/e2e/launch-flow.spec.ts (data-testid selectors)]
tech_stack:
  added: []
  patterns: [useState for counter, useEffect with cleanup for push-event subscription]
key_files:
  created: []
  modified:
    - src/renderer/src/App.tsx
decisions:
  - Separate useEffect for onInstanceClosed subscription (clean separation of concerns from Phase 0 effects)
  - Math.max(0, prev - 1) guard on decrement prevents negative counts if events arrive unexpectedly
  - handleLaunch is async; onClick uses void handleLaunch() to suppress unhandled promise warning
metrics:
  duration: 10m
  completed: 2026-05-15
---

# Phase 3 Plan 03: Placeholder Launch Button + Live-Instances Readout Summary

**One-liner:** React renderer extended with a "Launch at Tokyo" button and live-instances counter wired to the contextBridge API via useState + useEffect subscription pattern.

## What Was Built

Extended `src/renderer/src/App.tsx` with:
- `liveCount: number` state (starts at 0)
- `launchError: string | null` state
- `useEffect` subscribing to `window.api.onInstanceClosed` — decrements count on each event, returns unsubscribe as cleanup
- `handleLaunch` async handler — calls `window.api.launch({latitude: 35.6762, longitude: 139.6503})`, increments count on success, sets launchError on failure
- `<button data-testid="launch-button">Launch at Tokyo (35.6762, 139.6503)</button>`
- `<dd data-testid="live-instances">{liveCount}</dd>`
- Error display: `<p data-testid="launch-error">` shown when launchError is non-null

All Phase 0 data-testid attributes (`protocol`, `ping`, `launch-count`) preserved.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED
- `button[data-testid="launch-button"]` present
- `dd[data-testid="live-instances"]` present
- Phase 0 testids preserved
- `npm run typecheck` exits 0
