# Roadmap: AntiClicker — Pin-to-Geolocation Chrome Launcher

## Overview

AntiClicker is a single-purpose desktop tool whose load-bearing primitive is one CDP call — `Emulation.setGeolocationOverride` paired with `Browser.grantPermissions(['geolocation'])` — everything else is plumbing. The roadmap reflects that: the CDP spoof is proven in a CLI before any UI exists (Phases 0–2), then promoted into an Electron shell with a frozen IPC contract (Phase 3), then surfaced behind a satellite map with a draggable pin (Phase 4), then made multi-instance and live-updating (Phase 5), then verified, hardened, and packaged into a macOS `.dmg` (Phase 6). The journey is "CDP first, UI later" — a working map calling a broken launcher is more demoralizing than a working CLI without a map.

## Phases

**Phase Numbering:**
- Integer phases (0, 1, 2, 3, 4, 5, 6): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked INSERTED)

- [x] **Phase 0: Foundation / Bootstrap** - Secure Electron 35 shell, localhost-served renderer, electron-store config slot
- [x] **Phase 1: CDP Geolocation Primitive (CLI)** - Prove the spoof in a standalone CLI before any shell or map work
- [x] **Phase 2: Multi-Instance Launcher Module** - Parallel isolated Chromes via ephemeral profiles + ports + live setGeolocation
- [ ] **Phase 3: Electron Shell + IPC** - Move launcher into main; freeze contextBridge IPC contract via placeholder UI
- [ ] **Phase 4: Map UI** - MapLibre + EOX satellite default, Google Maps opt-in, draggable pin, manual entry, paste-from-URL
- [ ] **Phase 5: Multi-Instance UX + Live Update** - Sidebar, per-instance colored pins, live setGeolocation on pin drag
- [ ] **Phase 6: Verification + Polish + Package** - Verify-spoof flow, scope overlay, bundled-Chromium fallback, cleanup, .dmg build

## Phase Details

### Phase 0: Foundation / Bootstrap
**Goal**: Electron 35 desktop shell launches with secure defaults and a renderer served over HTTP (not file://), with persistent settings storage in place.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03
**Success Criteria** (what must be TRUE):
  1. `npm run dev` launches an Electron 35 window whose `webPreferences` have `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (verified by inspecting `process.contextIsolated` from the renderer)
  2. The renderer is loaded from `http://localhost:<port>` in both dev and packaged builds — `window.location.protocol` is `http:`, never `file:`
  3. A test write to `electron-store` persists to the OS user-data dir (e.g., `~/Library/Application Support/AntiClicker/config.json`) and survives a relaunch
  4. The contextBridge preload exposes only a narrow, typed API surface (no raw `ipcRenderer`, no `require`)
**Plans**: 7 plans
Plans:
- [x] 00-01-PLAN.md — Scaffold electron-vite project, pin versions, lay down Wave 0 test infra
- [x] 00-02-PLAN.md — Secure main process: webPreferences + dev/packaged URL switch + IPC bootstrap
- [x] 00-03-PLAN.md — Load-bearing node:http renderer server (FND-02)
- [x] 00-04-PLAN.md — electron-store + zod ConfigSchema wrapper (FND-03)
- [x] 00-05-PLAN.md — contextBridge preload + Phase 0 verification UI (FND-01 #4)
- [x] 00-06-PLAN.md — Playwright Electron e2e: secure-defaults, http-protocol, persistence
- [x] 00-07-PLAN.md — Manual Google Cloud Console quota cap + budget alerts checklist (DEFERRED — see CLOUD-CONSOLE-CHECKLIST.md; must complete before Phase 4)
**UI hint**: no

### Phase 1: CDP Geolocation Primitive (CLI)
**Goal**: Prove in a standalone CLI script that Playwright + CDP can spoof a Chrome instance's geolocation reliably, with no UI, no shell, and no IPC in the loop.
**Mode:** mvp
**Depends on**: Phase 0 (toolchain, not runtime)
**Requirements**: LCH-01, LCH-02, LCH-03
**Success Criteria** (what must be TRUE):
  1. `npx tsx scripts/cli-prototype.ts --lat 35.6762 --lng 139.6503` opens a visible Chrome window at the supplied coordinates (lat/lng are bounds-validated; out-of-range values exit non-zero with a clear error)
  2. When the launched Chrome navigates to `https://browserleaks.com/geo`, `navigator.geolocation.getCurrentPosition()` reports the supplied coordinates AND no permission prompt is shown to the user
  3. Clicking a link in the launched Chrome to a different origin (e.g., `https://www.google.com/maps`) does not break the spoof — `getCurrentPosition()` on the new origin still reports the supplied coordinates (context-scoped override survives cross-origin navigation)
  4. The CLI exits cleanly on Ctrl-C: the spawned Chrome closes and its temporary profile directory is removed from `os.tmpdir()`
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — CLI prototype: scripts/cli-prototype.ts with parseCliArgs + launchPersistentContext
- [x] 01-02-PLAN.md — Vitest unit tests: argv parsing + bounds validation (18 tests)
- [x] 01-03-PLAN.md — Playwright integration test: hermetic geolocation spoof + cleanup (4 tests)
**UI hint**: no

### Phase 2: Multi-Instance Launcher Module
**Goal**: Extract the proven CDP primitive into a reusable `launcher/` module that supports N concurrent isolated Chrome instances with live coordinate updates — still no UI, validated via tests.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: LCH-04, LCH-05, LCH-06, LCH-07, LCH-08
**Success Criteria** (what must be TRUE):
  1. A test/script can launch 5 Chrome instances in parallel at 5 different coordinates; each window reports its own coordinates on `browserleaks.com/geo` with no cross-contamination
  2. Profile isolation verified: a cookie set in instance A (e.g., via the Chrome devtools or a script) is NOT visible in instance B's cookie jar, and each instance has a distinct `--user-data-dir` under `os.tmpdir()/anticlicker-profile-*`
  3. Each instance binds an ephemeral `--remote-debugging-port=0`; the actual port is read from `<userDataDir>/DevToolsActivePort` — no two instances ever collide on port 9222, and a test that launches/closes/re-launches 10 instances back-to-back never fails on `EADDRINUSE`
  4. Closing any single launched Chrome (via the window's close button or `kill -TERM`) fires `browser.on('disconnected')` in the launcher, which deletes that instance's profile dir from disk and removes its entry from the in-memory registry
  5. Calling `launcher.setGeo(instanceId, newCoords)` on a running instance changes the value reported by `navigator.geolocation.getCurrentPosition()` on the next call without relaunching the browser
**Plans**: 3 plans
Plans:
- [x] 02-01-PLAN.md — Launcher module (`src/launcher/` + shared CoordsSchema)
- [x] 02-02-PLAN.md — Registry unit tests + shared HTTP fixture helper
- [x] 02-03-PLAN.md — Integration tests (5 specs covering all success criteria)
**UI hint**: no

### Phase 3: Electron Shell + IPC
**Goal**: Move the proven launcher module into Electron's main process and freeze a typed, zod-validated `window.api` IPC surface, validated end-to-end with a placeholder one-button UI.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: REL-05
**Success Criteria** (what must be TRUE):
  1. The renderer exposes a placeholder UI with a "Launch at hardcoded coords" button; clicking it calls `window.api.launch({lat, lng})` and a Chrome window appears, spoofed to those coordinates
  2. `main/ipc.ts` validates every renderer→main payload through zod schemas before any CDP call — sending `lat: 95` or `lng: "foo"` from a hacked renderer returns a validation error and never reaches Playwright
  3. `window.api` exposes exactly four invokable methods (`launch`, `setGeo`, `close`, `list`) and one subscription (`onInstanceClosed`); no other surface area is reachable from the renderer
  4. The renderer receives an `instance-closed` event with the correct instance ID when the user closes a launched Chrome window; the placeholder UI's instance count decrements accordingly
**Plans**: TBD
**UI hint**: yes

### Phase 4: Map UI
**Goal**: Replace the placeholder UI with a real satellite-view map where the user can drop, drag, and enter a pin — and launch a spoofed Chrome at that pin in one click.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: MAP-01, MAP-02, MAP-03, MAP-04, MAP-05, MAP-06, REL-02
**Success Criteria** (what must be TRUE):
  1. On first run with no Google Maps API key configured, the app shows a MapLibre GL JS 5 satellite map using EOX S2cloudless tiles — no key required, no console errors, attribution visible
  2. The user can drag the pin to any location on the map; the lat/lng readout updates on `dragend` (not per-frame) and is displayed in decimal form (e.g., `37.7749, -122.4194`)
  3. The user can type lat/lng into a manual entry field and the map pans+marker repositions to those coordinates; pasting a Google Maps URL like `https://www.google.com/maps/@37.77,-122.41,15z` auto-extracts the coords and pans the pin
  4. When the user pastes a valid Google Maps API key into settings, the basemap swaps to Google Maps JS API satellite tiles without a full app reload; the key persists across restarts via electron-store
  5. If the supplied Google Maps API key is invalid or returns `RefererNotAllowedMapError`, the app silently falls back to the MapLibre+EOX basemap and surfaces the error inline in the settings panel
  6. Clicking "Launch Chrome here" on the current pin opens a Chrome window spoofed to those exact coordinates (verified via the existing IPC path)
**Plans**: TBD
**UI hint**: yes

### Phase 5: Multi-Instance UX + Live Update
**Goal**: Surface the multi-instance launcher in the UI — users can see all running Chromes as colored pins on the map, click to focus, and drag a pin to live-update the corresponding Chrome's coordinates without relaunch.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: MIX-01, MIX-02, MIX-03, MIX-04, MIX-05, MIX-06
**Success Criteria** (what must be TRUE):
  1. The user can launch 3 Chrome windows at 3 different pinned locations and see 3 distinct colored pins on the map, plus 3 rows in the sidebar listing each instance's ID, coords, and a close button
  2. Clicking any instance row in the sidebar pans the map to that instance's pin; the active instance is visually highlighted in both the sidebar and on the map
  3. Dragging a pin associated with a running instance (or invoking a "Re-target to current pin" action) calls `context.setGeolocation` via IPC; on the next call to `navigator.geolocation.getCurrentPosition()` in that Chrome, the new coordinates are reported — no relaunch, no flicker
  4. Clicking the close button on an instance row terminates that Chrome (cleans its profile dir, removes its pin from the map, removes its sidebar row) without affecting the other running instances
  5. A "Recent pins" panel shows the last N=10 pin coordinates used in the current session for quick re-use; the list clears entirely when the app quits (no disk persistence)
**Plans**: TBD
**UI hint**: yes

### Phase 6: Verification + Polish + Package
**Goal**: Ship hardened, packaged installers for **both macOS (.dmg) and Windows (NSIS .exe)** that prove the spoof works, communicate its scope honestly to users, clean up after themselves, and degrade gracefully when Chrome is missing or things crash.
**Mode:** mvp
**Depends on**: Phase 5
**Requirements**: VRF-01, VRF-02, VRF-03, REL-01, REL-03, REL-04, FND-04
**Success Criteria** (what must be TRUE):
  1. Clicking the "Verify spoof" button on a running instance opens `browserleaks.com/geo`, `/ip`, and `/timezone` in that launched Chrome; the user can visually confirm that geo reflects the pin coordinates while IP and timezone show their real values (the intended, documented scope)
  2. The in-app verification panel shows the result of `navigator.geolocation.getCurrentPosition()` round-tripped via CDP `Runtime.evaluate` — the displayed lat/lng matches the pin's lat/lng to within the configured accuracy
  3. On first run, a one-time overlay appears explaining: "Coordinates only — your IP, timezone, and language are unchanged"; dismissing it persists the "seen" flag so it never appears again
  4. With no local Chrome/Chromium installed, launching offers to use Playwright's bundled Chromium fallback; choosing the fallback successfully launches a spoofed instance. (Verified on macOS by temporarily renaming `/Applications/Google Chrome.app`; on Windows by uninstalling Chrome from the test VM.)
  5. On app quit with running instances, all child Chrome processes are terminated (or the user is warned) and every `anticlicker-profile-*` directory under `os.tmpdir()` is deleted; on the next app startup, any orphaned `anticlicker-profile-*` dirs whose owning PID is no longer alive are swept on launch
  6. `npm run package` produces **two** artifacts in `dist/`:
     - `AntiClicker-<version>.dmg` (macOS, unsigned — users will see a Gatekeeper warning on first run; documented in README)
     - `AntiClicker-Setup-<version>.exe` (Windows NSIS installer, unsigned — users will see a SmartScreen warning on first run; documented in README)
     Both artifacts install cleanly and reproduce the full end-to-end flow (map renders, pin drags, Chrome launches at the pin, verification passes). The macOS `.dmg` is built natively; the Windows `.exe` is cross-compiled from macOS via electron-builder (no Wine required for NSIS targets).
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Foundation / Bootstrap | 7/7 | Complete | 2026-05-15 |
| 1. CDP Geolocation Primitive (CLI) | 3/3 | Complete | 2026-05-15 |
| 2. Multi-Instance Launcher Module | 0/TBD | Not started | - |
| 3. Electron Shell + IPC | 0/TBD | Not started | - |
| 4. Map UI | 0/TBD | Not started | - |
| 5. Multi-Instance UX + Live Update | 0/TBD | Not started | - |
| 6. Verification + Polish + Package | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-14*
*Granularity: standard | Mode: mvp | Coverage: 32/32 v1 requirements mapped*
