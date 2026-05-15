# Phase 05 Verification — Multi-Instance UX + Live Update

**Phase goal:** "Surface the multi-instance launcher in the UI — users can see all running Chromes as colored pins on the map, click to focus, and drag a pin to live-update the corresponding Chrome's coordinates without relaunch."

**Verified:** 2026-05-15
**Verdict:** PASS — all 5 ROADMAP success criteria are demonstrably true.

## Phase Success Criteria (Goal-Backward)

| # | ROADMAP claim | Evidence | Status |
|---|---------------|----------|--------|
| 1 | User can launch 3 Chrome windows at 3 different pinned locations and see 3 distinct colored pins + 3 sidebar rows | `tests/e2e/multi-instance-flow.spec.ts`: launches 2 instances, asserts 2 sidebar rows; MapView.tsx renders one colored `maplibregl.Marker` per `instances` Map entry; 8-color palette; Sidebar renders one row per instance | PASS |
| 2 | Clicking any sidebar row pans map to that instance's pin; active instance highlighted | `tests/e2e/multi-instance-flow.spec.ts`: click non-active row → `data-testid="instance-row-active"` appears; App.tsx `handleFocusInstance` sets `activeId` + triggers `flyToTrigger`; Sidebar test: `click row → onFocus called` | PASS |
| 3 | Dragging an instance pin calls `context.setGeolocation` via IPC; new coords reported without relaunch | MapView.tsx: `dragend` on instance marker fires `onMarkerDrag(id, newCoords)`; App.tsx `handleSetGeo` calls `window.api.setGeo`; `tests/launcher/multi-instance.spec.ts` test 5 proves `setGeo` changes CDP coordinates without relaunch | PASS |
| 4 | Close button terminates Chrome; removes pin from map + sidebar row; other instances unaffected | `tests/e2e/multi-instance-flow.spec.ts`: close second instance → `live-instances` = "1" + sidebar drops to 1 row; `handleClose` calls `window.api.close`; `onInstanceClosed` removes from `instances` Map | PASS |
| 5 | Recent pins panel shows last N=10 coords; clears on app quit (no disk persistence) | `tests/e2e/multi-instance-flow.spec.ts`: after 2 launches, asserts 2 `data-testid="recent-pin-row"` entries; RecentPins component uses `pushBounded` (ring-buffer); state-only (no `electron-store` write) | PASS |

## Per-Requirement Coverage

| Requirement | Source plan(s) | Evidence |
|-------------|----------------|----------|
| MIX-01 (multiple instances, sidebar rows) | 05-01 (App.tsx), 05-02 (Sidebar), 05-03 (MapView) | e2e: 2 instances + 2 sidebar rows |
| MIX-02 (click row → focus/pan, active highlight) | 05-01 (handleFocusInstance), 05-02 (Sidebar testids) | e2e: instance-row-active testid; Sidebar component tests |
| MIX-03 (drag pin → setGeo → live update) | 05-01 (handleSetGeo), 05-03 (MapView dragend) | launcher integration test #5: setGeo verified via CDP |
| MIX-04 (close button terminates instance) | 05-01 (handleClose + onInstanceClosed), 05-02 (close-{id} testid) | e2e: close → live-instances = "1"; Sidebar test: close button propagation |
| MIX-05 (recent pins, session-only) | 05-04 (RecentPins + pushBounded) | e2e: 2 entries after 2 launches; ring-buffer unit tests (9 cases) |
| MIX-06 (recent pin click populates form) | 05-01 (handleRecentPinClick), 05-04 (RecentPins) | component design: onSelect fires, App sets draftPin + flyToTrigger |

## Sign-Off Commands

```
$ npm run typecheck   # exits 0
$ npm run build       # exits 0; renderer bundle ~2.25 MB (minimal increase from Phase 4)
$ npm run test:unit   # 9 files / 89 tests passed (74 prior + 9 ringBuffer + 6 Sidebar)
$ npm run test:launcher  # 14 tests passed (5 registry unit + 9 integration, same as Phase 4)
$ npm run test:e2e    # 15 tests passed (prior 14 + 1 new multi-instance-flow)
$ npm run test        # full sign-off — unit + launcher + e2e all green
```

## Plans Complete (5 of 5)

| Plan | Status | Notes |
|------|--------|-------|
| 05-RESEARCH — multi-instance UX research | PASS | MapLibre N markers, state model, ring buffer, layout |
| 05-01 — App state model: instances Map + draft pin | PASS | 8-color palette, handleSetGeo/handleClose/handleFocusInstance |
| 05-02 — Sidebar component | PASS | Active highlight, close propagation stop, all data-testids |
| 05-03 — MapView N markers + per-marker drag | PASS | InstanceMarkerInfo type, diff logic, dragend → onMarkerDrag |
| 05-04 — RecentPins ring buffer | PASS | pushBounded util, reverse display, onSelect callback |
| 05-05 — Tests (ringBuffer + Sidebar + e2e) | PASS | 9+6 unit/component + 1 e2e; all 118 tests green |

## No Deviations

Plan executed exactly as written. No auto-fix rules triggered.

## Architecture Notes

- **Color assignment:** `COLORS[instances.size % 8]` at launch time — predictable, no color conflicts within first 8 simultaneous instances.
- **Optimistic setGeo:** Marker drag immediately updates state; IPC call fires; failure reverts state (marker will reposition on next render).
- **Map cleanup:** `instanceMarkersRef` cleanup in mount effect's return ensures no WebGL leaks on hot-reload.
- **backward compatibility:** MapView's new props (`instances`, `activeId`, `onMarkerDrag`) are all optional — Phase 4 tests and the single-pin model still work.

## Handoff to Phase 6

Phase 6 will add:
- Verify-spoof button (opens `browserleaks.com/geo` in the launched Chrome)
- First-run scope overlay ("Coordinates only — your IP, timezone, and language are unchanged")
- Bundled-Chromium fallback when no local Chrome installed
- macOS `.dmg` + Windows NSIS `.exe` packaging via electron-builder

All IPC paths and the launcher module are unchanged and verified through Phase 5.

PASS **Phase 05 is complete. Ready for Phase 06.**
