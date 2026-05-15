# Project Research Summary

**Project:** AntiClicker — Pin-to-Geolocation Chrome Launcher
**Domain:** Desktop tool — interactive satellite map + Chrome process launcher with CDP-driven geolocation override
**Researched:** 2026-05-14
**Confidence:** HIGH

## Executive Summary

AntiClicker is a single-purpose desktop app whose load-bearing primitive is one CDP call: `Emulation.setGeolocationOverride`, paired with `Browser.grantPermissions(['geolocation'])`. Everything else — map UI, pin drag, multi-instance management — is plumbing around that pair. The expert pattern for products in this shape is a **3-process architecture** (renderer for the map, main for automation, N spawned Chromes each with its own `--user-data-dir`), with **Playwright** as the automation library because its context-level `geolocation` + `permissions` options handle both load-bearing CDP calls atomically and survive cross-origin navigation.

The recommended stack is **Electron 35 + Playwright 1.60 + MapLibre GL JS 5 + Vite 6 + TypeScript 5.7**, with Google Maps JS API as an opt-in upgrade when the user supplies a key. Electron wins over Tauri here because the renderer needs to run real Chromium (Google Maps + WebGL satellite tiles render with full parity); Playwright wins over Puppeteer because it auto-pairs the permission grant with the geolocation override and supports live updates via `context.setGeolocation()`. The map default is MapLibre + free EOX S2cloudless satellite tiles so the app works on first run with no API key.

The risk profile is dominated by two silent-failure modes that look identical to "spoof working" until you check carefully: (1) **forgetting to grant the geolocation permission** — the override exists, the page asks `getCurrentPosition`, gets `PERMISSION_DENIED`, and silently falls back to IP geolocation, so the user sees their real location and blames everything else; (2) **loading the map from `file://` in a packaged Electron build** — referrer-restricted Google Maps keys return `RefererNotAllowedMapError` and the map turns gray, even though dev (which uses Vite's `http://localhost`) worked fine. Both are preventable on day one by (a) using Playwright's context-level geolocation+permissions API, and (b) serving the renderer from a local HTTP server. Multi-instance adds two more must-haves: **unique `--user-data-dir` per launch** and **ephemeral `--remote-debugging-port=0`** to avoid 9222 collisions where the second launch silently drives the first window.

## Key Findings

### Recommended Stack

The expert path for a 2026 desktop tool that needs to drive a separate, visible Chrome with sensor overrides is Electron-for-shell + Playwright-for-automation. Electron's renderer is real Chromium (matches the spoofed Chrome's rendering parity, especially for Google Maps satellite WebGL); Playwright is the only mainstream automation library where geolocation is a first-class context option that auto-handles the paired `Browser.grantPermissions` call — the single most-missed step in this domain. MapLibre + free EOX tiles delivers a "works out of the box" satellite map with no API key, with Google Maps JS API as a drop-in upgrade when the user pastes a key. See `STACK.md` for the full alternatives matrix.

**Core technologies:**
- **Electron 35** — desktop shell; renderer is real Chromium so Maps + WebGL satellite tiles render identically to spawned Chrome
- **Playwright 1.60** — drives the spawned Chrome; `newContext({ geolocation, permissions: ['geolocation'] })` atomically does both load-bearing CDP calls; `context.setGeolocation()` supports live pin-drag updates
- **MapLibre GL JS 5** + EOX S2cloudless tiles — free, no-API-key satellite basemap; Google Maps JS API layered on when the user supplies a key
- **Node 22 LTS, TypeScript 5.7, Vite 6, electron-vite 4** — standard 2026 Electron toolchain
- **electron-store 10, zod 3** — config persistence (API key outside VCS per PROJECT.md) and IPC payload validation

**Avoid:** Puppeteer (no `permissions` in context options — easier to forget the grant), Selenium (no CDP), Mapbox GL JS v2+ (non-OSS license), Tauri 2.9 for v1 (WKWebView Google Maps quirks on macOS), `file://` loading of the renderer in packaged builds.

### Expected Features

The competitive landscape is DevTools Sensors (no map, per-tab, tied to DevTools window), Location Guard (privacy extension, not dev work), Playwright (code-only), and anti-detect browsers (paid $30–200/mo, anti-detect-superset). The strategic gap AntiClicker fills: **pin-driven, free, multi-window, no-code, geolocation-only.** See `FEATURES.md`.

**Must have (table stakes — MVP):**
- Satellite-view map with draggable pin + live numeric lat/lng readout
- Manual lat/lng entry → map jumps to pin
- One-click "Launch Chrome here" hero action
- Permission auto-grant (so no prompt ever appears in the spawned Chrome)
- Multi-instance with distinct `--user-data-dir` and distinct CDP ports per launch
- Verification button (open browserleaks.com/geo + /ip + /timezone in launched Chrome)
- Graceful shutdown — temp profile dirs cleaned, no orphan Chromes
- Settings screen for Google Maps API key, persisted via `electron-store`
- Reasonable error states (Chrome not installed, port collision, invalid key)

**Should have (differentiators — v1.x):**
- **Live coordinate update on pin drag after launch** — biggest moat; `context.setGeolocation()` on the live page, no relaunch
- Per-window pin visualization (multiple colored pins on map, one per running Chrome)
- In-memory recent pins list (no persistence — bounded array, cleared on quit)
- Coordinate format flexibility (paste from Google Maps URL, DMS, decimal)
- In-app verification panel — CDP `Runtime.evaluate` of `navigator.geolocation` round-tripped back to launcher UI
- Bundled Chromium fallback when system Chrome is missing (Playwright already ships it)
- Keyboard shortcuts (Cmd+L launch, Cmd+drag fine-pin)

**Defer (v2+ / explicit anti-features per PROJECT.md):**
- Persistent saved locations / pin history
- Timezone, locale, language spoofing (one-line CDP call each, but explicitly scoped out of v1)
- Movement simulation / route playback
- IP / VPN spoofing (different problem space; document the limitation)
- Browser-extension form factor; mobile app
- Full fingerprint customization (anti-detect-browser territory)

### Architecture Approach

The system is structurally three processes: a **renderer** (React + MapLibre/Google Maps + zustand state, no Node access), a **main** (owns Playwright, Instance Registry, Config Store, Profile Dir Manager), and **N spawned Chromes** (each with its own `userDataDir`, its own CDP WebSocket, its own geolocation override). The renderer never touches Playwright; all automation goes through a narrow `contextBridge`-exposed IPC surface (`launch`, `setGeo`, `close`, `list`). State authority: pin coords live in the renderer; running-instance state lives in main's in-memory `Map<id, Instance>` and is mirrored to the renderer via IPC events. Profile dirs are ephemeral (`mkdtemp` under `os.tmpdir()`), cleaned on `browser.on('disconnected')`. See `ARCHITECTURE.md`.

**Major components:**
1. **Renderer (Map UI + State)** — MapLibre satellite map, draggable marker, instance list sidebar, coord display; pure UI, no Node
2. **Preload Bridge** — `contextBridge.exposeInMainWorld('api', { launch, setGeo, close, list, onInstanceClosed })`; the only renderer↔main contract
3. **Launcher Service (main)** — wraps Playwright; sequences `allocateProfileDir → launch → grantPermissions → setGeolocation → goto`; exposes live `setGeo` for pin-drag updates
4. **Instance Registry (main)** — in-memory `Map<id, {browser, context, page, profileDir, coords}>`; self-evicts on `disconnected`, deletes profile dir, emits `instance-closed` IPC event
5. **Profile Dir Manager (main)** — `mkdtemp(os.tmpdir()/anticlicker-profile-*)` allocation + recursive cleanup
6. **Config Store (main)** — `electron-store` for Maps API key, defaults, last pin

### Critical Pitfalls

The top blockers, all silent-failure modes that look like the spoof is working until you verify on browserleaks.com:

1. **Missing `grantPermissions` paired with `setGeolocationOverride`** — page calls `getCurrentPosition`, gets `PERMISSION_DENIED`, silently falls back to IP geolocation. **Avoid:** always create Playwright context with `{ geolocation, permissions: ['geolocation'] }` together; never call one without the other.
2. **Override applied at page-target level instead of browser-context level** — survives one navigation, dies on cross-origin link. **Avoid:** use `context.setGeolocation()` (context-scoped) or re-apply on `Target.targetCreated`. Order operations: launch → grantPermissions → setGeolocation → goto.
3. **Loading the renderer from `file://` in packaged Electron with a referrer-restricted Maps key** — `RefererNotAllowedMapError`, gray map. Works in dev (Vite's localhost), breaks in production. **Avoid:** serve the renderer from a local HTTP server (`http://localhost:<random-port>`) in both dev and packaged builds; restrict the Maps key to `localhost/*`.
4. **Shared / hardcoded `--user-data-dir` and hardcoded `--remote-debugging-port=9222`** — second launch hits SingletonLock or silently drives the first window. **Avoid:** `mkdtemp` per launch + `--remote-debugging-port=0` (ephemeral; read actual port from `<userDataDir>/DevToolsActivePort`).
5. **Electron with `nodeIntegration: true` or `contextIsolation: false`** — remote Maps SDK script gains shell access. **Avoid:** keep Electron 12+ defaults; expose only a narrow API via `contextBridge`; never expose `ipcRenderer` raw.
6. **Scope-communication failure — "coords only, not full locale"** — users complain Netflix still serves their real country. **Avoid:** first-run overlay; verification button opens /geo + /ip + /timezone so the user sees the full picture.
7. **Google Maps billing surprise from satellite SKU** — satellite tiles burn the free tier faster; an embedded/leaked key with no quota cap runs up bills. **Avoid:** QPD quota cap + budget alert before first commit; default to MapLibre + EOX, only use Google Maps when user supplies their own keyed account.

See `PITFALLS.md` for the full eight pitfalls plus the "Looks Done But Isn't" verification checklist.

## Implications for Roadmap

Suggested phase structure. The non-obvious move is **Phase 1 has no UI** — the CDP spoof must be proven in isolation before any shell scaffolding is written. A working map calling a broken launcher is more demoralizing than a working CLI without a map.

### Phase 0: Bootstrap & Shell Scaffold
**Rationale:** Two pitfalls (file://-referrer breakage, Electron security defaults) must be designed-in from line one. Also: Google Cloud quota cap takes 30 seconds and prevents billing surprises forever. None of this is feature work but skipping any of it is unrecoverable later.
**Delivers:**
- Electron 35 + electron-vite 4 + TS 5.7 + Vite 6 skeleton with secure `webPreferences` (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, narrow `contextBridge` preload)
- Local HTTP server inside Electron main serving the renderer at `http://localhost:<port>` (NOT `loadFile()`)
- Google Cloud Console: Maps JS API enabled, QPD quota cap set, budget alert at $5/$20/$50
- `electron-store` wired for config; no API key yet, but the slot exists
- Empty `shared/types.ts` and `shared/ipc-channels.ts`
**Avoids pitfalls:** 4 (file://), 5 (billing), 6 (Electron security defaults)

### Phase 1: CDP Geolocation Primitive (CLI, no UI)
**Rationale:** This is the load-bearing primitive. Prove it in <100 lines of standalone TS before adding any shell, IPC, or map. Validates the Playwright choice and the `permission + geolocation + navigation` ordering end-to-end. Single-best risk-retiring move.
**Delivers:**
- `scripts/cli-prototype.ts` taking `--lat`, `--lng` args
- Spawns Chrome via Playwright with ephemeral `userDataDir`
- Applies context-level `geolocation` + `permissions: ['geolocation']` atomically
- Opens browserleaks.com/geo and confirms reported coords match input
- **Verification:** no permission prompt appears; correct coords reported; navigating to a different origin keeps the spoof
**Avoids pitfalls:** 1 (missing grantPermissions), 2 (page-scoped override dying on navigation), 3 (stale user-data-dir)

### Phase 2: Multi-Instance Launcher Module (still no UI)
**Rationale:** Multi-instance is a PROJECT.md hard requirement, and the failure modes (port collision, SingletonLock, profile-dir bleed) are unrelated to UI work. Crystallizes the `launcher/` module that main/ will later import. Validate isolation (cookies set in one don't appear in another) before adding any shell.
**Delivers:**
- `src/main/launcher/` module: `profile-dir.ts` (mkdtemp + cleanup), `geo-override.ts` (paired grant+set), `playwright-driver.ts`
- N parallel launches with distinct `userDataDir` and distinct ephemeral `--remote-debugging-port=0` ports (read from `DevToolsActivePort`)
- `browser.on('disconnected')` → cleanup profile dir + remove from registry
- Live `setGeolocation` on an existing context (validates the pin-drag-after-launch path)
**Avoids pitfalls:** 3 (multi-instance profile bleed / SingletonLock), 8 (port 9222 collisions)

### Phase 3: Electron Shell + IPC (placeholder UI)
**Rationale:** Move the proven `launcher/` module into `main/`. Define and freeze the IPC surface before any map work — the renderer's contract with main shouldn't churn just because map polish lands. Use a one-button "Launch at hardcoded coords" UI to validate the IPC plumbing end-to-end.
**Delivers:**
- `main/ipc.ts` with `launch`, `set-geo`, `close`, `list` handlers
- Preload exposes `window.api` via `contextBridge`
- `shared/types.ts` (Instance, Coords, LaunchOptions) imported by both sides
- zod-validated IPC payloads (lat/lng bounds-checked in main before CDP call)
- Renderer can drive a launch with a button click; main returns instanceId; renderer subscribes to `instance-closed`
**Avoids pitfalls:** 6 (security) reinforced; lat/lng validation prevents the "trust pin coords from frontend" trap

### Phase 4: Map UI with Pin (MapLibre default, Google Maps opt-in)
**Rationale:** Now that the launcher works through IPC, wire up the actual UX. MapLibre default means the app works on first run with no key. Google Maps support is a second path that activates when the user pastes a key into settings.
**Delivers:**
- MapLibre GL JS 5 + EOX S2cloudless satellite source as default basemap
- Draggable marker, `dragend` event → zustand pin store → coord display
- Manual lat/lng input that auto-detects format (decimal, DMS, paste-from-Maps-URL)
- Settings panel: Maps API key entry, persisted via `electron-store`
- When key present: swap basemap to Google Maps JS API satellite layer
- "Launch Chrome here" button calls `window.api.launch(currentPin)`
**Uses stack elements:** MapLibre GL JS 5, electron-store, zustand
**Avoids pitfalls:** 7 (default to MapLibre means most users never hit Google Maps quota at all)

### Phase 5: Multi-Instance UX + Live Update
**Rationale:** Main already supports multi-instance from Phase 2; this phase surfaces it. Live pin-drag-update is the headline differentiator — defer it only if the CDP session keep-alive turns out to be fragile (it shouldn't, but the order lets us ship without it if needed).
**Delivers:**
- Instance list sidebar (one row per running Chrome, with coords + close button)
- Per-window colored pin on map; click row → `map.panTo(pin)`
- "Send pin to instance X" action: re-uses live CDP session via `context.setGeolocation`
- Optional: drag-after-launch live update (pin drag → `window.api.setGeo(activeInstanceId, coords)`) debounced to `dragend` (per the performance trap)
- In-memory recent-pins bounded list (clears on quit)
**Avoids pitfalls:** "Re-rendering map on every pin drag" performance trap (use `dragend`, not `drag`)

### Phase 6: Verification + Polish
**Rationale:** Verification is a PROJECT.md hard requirement. The scope-communication issue (Pitfall 7) belongs here because users only encounter it once they're actually using the spoof. Cleanup-on-quit, error states, and bundled-Chromium fallback are quality-of-life that matters for a v1 ship but doesn't gate validation of the core thesis.
**Delivers:**
- "Verify spoof" button opens browserleaks.com/geo *and* /ip *and* /timezone in launched Chrome
- First-run overlay scoping the tool: "coordinates only — your IP, timezone, language are unchanged"
- In-app verification panel (CDP `Runtime.evaluate` of `navigator.geolocation`, result surfaced in launcher UI)
- App-quit handler: sweep all running Chromes (or warn user), delete profile dirs
- Startup sweep: orphaned `anticlicker-profile-*` dirs whose owning PID is dead → delete
- Friendly error states: Chrome not installed → offer bundled Chromium; invalid API key → re-open settings; port collision → already prevented by Phase 2, but surface a generic launch-failure path
- Keyboard shortcuts (Cmd+L, Cmd+Q semantics around running Chromes)
**Avoids pitfalls:** 7 (scope communication), and final cleanup of all "Looks Done But Isn't" checklist items

### Phase Ordering Rationale

- **CDP first, UI later.** Phase 1 is a CLI script with no shell because the CDP override is the load-bearing primitive — if it doesn't work, the project doesn't exist, and proving it without UI distractions is the fastest path to that signal.
- **Multi-instance before shell.** Phases 1 and 2 together isolate the *algorithmic* problems (permission pairing, port allocation, profile lifecycle) from the *integration* problems (IPC, security, packaging).
- **IPC contract before map.** Phase 3 freezes the renderer↔main interface using a placeholder UI. This means Phase 4's map work doesn't churn the IPC surface every time the UX evolves.
- **MapLibre before Google Maps.** Defaulting to MapLibre + EOX tiles means the app works on first run with no key, which reduces onboarding friction, sidesteps the satellite-billing pitfall for most users, and makes the Google Maps key a clean opt-in code path rather than a launch blocker.
- **Multi-instance UX before verification polish.** The Verify-spoof feature is more credible when there's already a multi-window flow — users can verify each instance independently.
- **Phase 0 cannot be skipped.** Three pitfalls (file://, Electron security defaults, billing quota) are unrecoverable if missed and trivial if not — they belong in the very first commit.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Worth a quick research pass to verify Playwright 1.60's exact API shape for `launchPersistentContext` vs `newContext` against bundled Chromium 136 — the API has shifted between minors and the difference matters for whether the geolocation option lives on the persistent context or a derived one.
- **Phase 4:** Light research on MapLibre 5's raster source attribution requirements (EOX requires attribution per their ToS) and on the cleanest pattern for hot-swapping the basemap between MapLibre and Google Maps JS API in the same renderer without a full reload.
- **Phase 6:** Worth verifying which `Emulation.*` overrides (timezone, locale) are stable enough to *mention* as v2 candidates without committing to them.

Phases with standard patterns (skip dedicated research):
- **Phase 0:** Standard Electron 35 + electron-vite + secure-defaults scaffold — well-documented.
- **Phase 2:** Multi-instance Playwright with `launchPersistentContext` per instance is a documented pattern; ARCHITECTURE.md already captures the load-bearing details.
- **Phase 3:** `contextBridge`/`ipcMain.handle` is the canonical Electron IPC pattern — no research needed.
- **Phase 5:** State management with zustand + IPC mirroring is a standard pattern.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versions verified against npm and release pages; capability claims (Playwright geolocation context option, MapLibre EOX integration, Electron Chromium parity) cross-checked against official docs |
| Features | HIGH | Well-trodden domain — DevTools Sensors, Playwright/Puppeteer geolocation, Location Guard, anti-detect browsers all documented; clear competitive landscape with an identifiable gap |
| Architecture | HIGH | 3-process Electron pattern is canonical; per-`userDataDir` per-CDP-connection isolation pattern is the only correct model and is documented across Puppeteer/Playwright issue trackers |
| Pitfalls | HIGH | Core mechanics (CDP permission pairing, override scope, port collision, file:// referrer) verified against authoritative sources (CDP docs, Playwright/Puppeteer GitHub issues, Google Issue Tracker) |

**Overall confidence:** HIGH

### Gaps to Address

- **Bundled-Chromium-in-packaged-build packaging:** STACK.md notes that Playwright doesn't ship Chromium via npm — production builds need either `extraResources` bundling with `PLAYWRIGHT_BROWSERS_PATH` redirect or a documented post-install step. This is a Phase 6 packaging decision and should be validated empirically before the first `dmg` build.
- **Google Maps key restriction strategy:** The `localhost/*` referrer pattern works in principle but should be validated with an actual key against the packaged build (not just dev). Defer to Phase 4 verification step.
- **macOS notarization for the spawned-Chrome flow:** Code signing the Electron app is standard; whether the Playwright-bundled Chromium binary needs its own signing for Gatekeeper happiness when invoked as a child process is unverified. Phase 6 packaging concern.
- **Live `setGeolocation` survival across `window.open`:** ARCHITECTURE.md asserts context-level override survives navigation; whether it survives child windows created via `window.open` from a spoofed origin should be verified in Phase 5 with the "Looks Done But Isn't" multi-tab check.
- **PROJECT.md "Key Decisions" are all marked Pending:** This research recommends concrete answers (Electron > Tauri, Playwright > Puppeteer, MapLibre default + Google Maps opt-in). The roadmapper should close out these decisions with rationale references to this summary.

## Sources

### Primary (HIGH confidence)
- Chrome DevTools Protocol — Emulation domain (`setGeolocationOverride` reference)
- Chrome DevTools Protocol — Browser domain (`grantPermissions` / `setPermission`)
- Playwright official docs — Emulation guide, BrowserContext API (`geolocation`, `permissions`, `setGeolocation`)
- Playwright npm — version 1.60 verification
- Puppeteer docs — `Page.setGeolocation()`, browser-launching configuration
- Electron official docs — Process Model, IPC, contextBridge, Security tutorial, Context Isolation
- Electron releases — v35 stable, v42 alpha cadence
- MapLibre GL JS — satellite-map example with EOX tiles (no-API-key satellite source)
- Google Maps Platform docs — security best practices, usage and billing, error messages (RefererNotAllowedMapError)
- Tauri v2 docs — Capabilities, Permissions, Webview Versions, sidecar/external binaries
- Chromium docs — user-data-dir, profile creation
- W3C WebDriver BiDi modules — `emulation.setGeolocationOverride` (Firefox 139+)
- BrowserLeaks — geo / IP / timezone / WebRTC test pages (used as verification surfaces)

### Secondary (MEDIUM confidence)
- Playwright issues #18242, #22554, #1289 — confirmed permission/spoof bug reports
- Puppeteer issues #5442, #4860, #921, #3225, #13581, #3373 — user-data-dir and permission-grant gotchas
- Google Issue Tracker #124858510, #35828931 — file:// referrer restriction (open for years)
- electron/electron #23506 — defaults change for `nodeIntegration` / `contextIsolation`
- tauri-apps/tauri #7501 — v1→v2 allowlist migration error
- BrowserStack — Playwright vs Puppeteer 2026 synthesis
- Dolthub — Tauri vs Electron 2026 bundle/RAM tradeoffs
- PkgPulse — Mapbox vs Leaflet vs MapLibre 2026
- Felt — 7 free map APIs vs Google Maps (MapTiler / OpenFreeMap context)
- Tim Deschryver — Using Geolocation in Playwright tests
- Fingerprint.com — How to Detect Location Spoofing
- Castle.io — Detecting browser timezone via JavaScript

### Tertiary (LOW confidence — needs validation during implementation)
- Google Maps Platform pricing tier details (pricing pages change; revisit in Phase 0 Cloud Console setup)
- Exact `electron-vite@4` minor version compatibility with `electron@35` (verify against npm at install time)
- Code-signing requirements for Playwright's bundled Chromium when spawned as child process from a notarized Electron app on macOS 15+ (verify empirically in Phase 6)

---
*Research completed: 2026-05-14*
*Ready for roadmap: yes*
