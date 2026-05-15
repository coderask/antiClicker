# Requirements: AntiClicker

**Defined:** 2026-05-14
**Core Value:** One click on a map = a Chrome window that *is* at that location.

## v1 Requirements

Requirements for initial release. Each maps to a roadmap phase.

### Foundation

- [ ] **FND-01**: Electron 35 desktop app launches with secure defaults (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`)
- [ ] **FND-02**: Renderer is served from `http://localhost:<port>` (NOT `file://`) so Google Maps referrer restrictions work in both dev and packaged builds
- [ ] **FND-03**: App settings (Google Maps API key, last pin coords) persist via `electron-store` outside version control
- [ ] **FND-04**: Build produces a runnable `.dmg` for macOS (Windows/Linux deferred)

### Launcher Core

- [ ] **LCH-01**: User can launch a Chrome instance at a specified lat/lng pair (validated server-side: −90 ≤ lat ≤ 90, −180 ≤ lng ≤ 180)
- [ ] **LCH-02**: Launched Chrome reports the specified coordinates when a page calls `navigator.geolocation.getCurrentPosition()` (no permission prompt appears)
- [ ] **LCH-03**: Geolocation override survives cross-origin navigation (context-scoped, not page-scoped)
- [ ] **LCH-04**: Each launched Chrome uses its own ephemeral `--user-data-dir` (no profile bleed between instances)
- [ ] **LCH-05**: Each launched Chrome uses an ephemeral `--remote-debugging-port=0` (no port-9222 collisions when launching multiple instances)
- [ ] **LCH-06**: User can launch at least 5 Chrome instances at different pinned locations concurrently without collisions
- [ ] **LCH-07**: When a launched Chrome is closed (by user or crash), its profile dir is cleaned up automatically (`browser.on('disconnected')`)
- [ ] **LCH-08**: User can update a running instance's coordinates without relaunching (live `context.setGeolocation`)

### Map UI

- [ ] **MAP-01**: User sees a satellite-view map on app launch (MapLibre GL JS 5 + EOX S2cloudless tiles by default; no API key required)
- [ ] **MAP-02**: User can drag a pin to any location on the map; current lat/lng is displayed in a readable form (e.g., "37.7749, −122.4194")
- [ ] **MAP-03**: User can enter lat/lng manually (decimal format) and the map pans to that pin
- [ ] **MAP-04**: User can paste a Google Maps URL (e.g., `https://www.google.com/maps/@37.77,-122.41,15z`) and the app extracts coords + pans the pin
- [ ] **MAP-05**: User can paste a Google Maps API key in settings; when present, the basemap swaps to Google Maps JS API satellite tiles
- [ ] **MAP-06**: Map performance is smooth (pin drag uses `dragend`, not `drag`; no per-frame IPC traffic)

### Multi-Instance UX

- [ ] **MIX-01**: User sees a sidebar listing all currently running Chrome instances (id, coords, close button)
- [ ] **MIX-02**: Each running instance has a distinct colored pin rendered on the map at its launch coords
- [ ] **MIX-03**: Clicking an instance row pans the map to that instance's pin
- [ ] **MIX-04**: User can close a running instance from the sidebar (terminates Chrome, cleans up profile dir, removes pin)
- [ ] **MIX-05**: User can re-target a running instance's coordinates to the current pin position (calls live `setGeolocation`)
- [ ] **MIX-06**: A bounded in-memory list of recent pins (last N=10) is shown for quick re-use within a session; clears on app quit (no persistence)

### Verification & Scope Communication

- [ ] **VRF-01**: User can click a "Verify spoof" button that opens browserleaks.com/geo, /ip, and /timezone in a launched Chrome (so the user can see exactly which signals are spoofed and which leak)
- [ ] **VRF-02**: An in-app verification panel shows the result of `navigator.geolocation.getCurrentPosition()` round-tripped from the launched Chrome via CDP `Runtime.evaluate`
- [ ] **VRF-03**: On first run, the user sees a one-time overlay explaining the scope: "Coordinates only — your IP, timezone, and language are unchanged"

### Reliability & Error Handling

- [ ] **REL-01**: If Chrome/Chromium is not installed locally, the app offers to use the bundled Playwright Chromium fallback
- [ ] **REL-02**: If the Google Maps API key is invalid or referrer-blocked, the app falls back to the default MapLibre basemap and surfaces a clear error in settings
- [ ] **REL-03**: On app quit, the app sweeps all running Chromes (or warns the user) and deletes all `anticlicker-profile-*` temp dirs
- [ ] **REL-04**: On app startup, the app sweeps orphaned `anticlicker-profile-*` dirs whose owning PID is no longer alive
- [ ] **REL-05**: IPC payloads from renderer→main are validated with zod (lat/lng bounds, instance IDs) before any CDP call

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Polish

- **POL-01**: Keyboard shortcuts (Cmd+L launch, Cmd+drag fine-pin movement)
- **POL-02**: DMS coordinate format support (37°46'29.6"N 122°25'10.0"W)
- **POL-03**: Per-instance bookmark / persistent pin history (with explicit opt-in for persistence)

### Additional Sensor Overrides

- **SEN-01**: Timezone override via CDP `Emulation.setTimezoneOverride`
- **SEN-02**: Locale override via CDP `Emulation.setLocaleOverride`
- **SEN-03**: Accept-Language header override

### Cross-Platform

- **XPL-01**: Windows build (`.exe` installer)
- **XPL-02**: Linux build (AppImage / .deb)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile app (iOS/Android) | Desktop-only by design — different threat model, different APIs for geolocation override |
| IP / VPN spoofing | Different problem space (network layer); user must combine AntiClicker with a separate VPN if they want IP spoofing too |
| Browser extension form factor | Extensions cannot spawn isolated Chrome processes — wrong primitive for this product |
| Persistent saved-locations / pin history | v1 keeps state ephemeral on purpose; persistent locations create privacy considerations the v1 scope doesn't handle |
| Movement simulation (drift, walking, driving paths) | Out of v1 surface; defer to v2 if there's demand. Static coords only |
| Full browser fingerprint customization | Anti-detect-browser territory; AntiClicker is a focused geolocation tool, not a fingerprint suite |
| Real-time multi-user sharing of pins | No collaboration features; v1 is single-user, local-only |
| Bot scripting / automation framework on top of launched Chromes | AntiClicker launches Chromes for human use; if you want to script, use Playwright directly |
| Cloud sync of settings | Local-only by design (keeps Maps API key off the network) |

## Traceability

Which phases cover which requirements. Filled by roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 0 | Pending |
| FND-02 | Phase 0 | Pending |
| FND-03 | Phase 0 | Pending |
| FND-04 | Phase 6 | Pending |
| LCH-01 | Phase 1 | Pending |
| LCH-02 | Phase 1 | Pending |
| LCH-03 | Phase 1 | Pending |
| LCH-04 | Phase 2 | Pending |
| LCH-05 | Phase 2 | Pending |
| LCH-06 | Phase 2 | Pending |
| LCH-07 | Phase 2 | Pending |
| LCH-08 | Phase 2 | Pending |
| MAP-01 | Phase 4 | Pending |
| MAP-02 | Phase 4 | Pending |
| MAP-03 | Phase 4 | Pending |
| MAP-04 | Phase 4 | Pending |
| MAP-05 | Phase 4 | Pending |
| MAP-06 | Phase 4 | Pending |
| MIX-01 | Phase 5 | Pending |
| MIX-02 | Phase 5 | Pending |
| MIX-03 | Phase 5 | Pending |
| MIX-04 | Phase 5 | Pending |
| MIX-05 | Phase 5 | Pending |
| MIX-06 | Phase 5 | Pending |
| VRF-01 | Phase 6 | Pending |
| VRF-02 | Phase 6 | Pending |
| VRF-03 | Phase 6 | Pending |
| REL-01 | Phase 6 | Pending |
| REL-02 | Phase 4 | Pending |
| REL-03 | Phase 6 | Pending |
| REL-04 | Phase 6 | Pending |
| REL-05 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after initial definition*
