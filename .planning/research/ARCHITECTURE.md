# Architecture Research

**Domain:** Desktop geolocation-spoofing tool (map UI + Chrome automation)
**Researched:** 2026-05-14
**Confidence:** HIGH for CDP/Puppeteer/Playwright patterns; MEDIUM for Electron-vs-Tauri framing (project hasn't finalized shell choice)

## Standard Architecture

This tool is structurally a **3-process system**: a UI process running a map, a controller process driving browser automation, and N spawned Chrome processes that are the spoof targets. The controller is the load-bearing piece — everything else is plumbing around it.

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                      DESKTOP APP (Electron / Tauri)                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Renderer / UI Process                         │ │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │ │
│  │  │  Google Maps   │  │  Pin / Coord   │  │  Instance List │    │ │
│  │  │   (satellite)  │  │     State      │  │   (running)    │    │ │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘    │ │
│  │          │                   │                    │             │ │
│  │          └───────────────────┴────────────────────┘             │ │
│  │                              │                                   │ │
│  │                       (preload bridge)                           │ │
│  └──────────────────────────────┼───────────────────────────────────┘ │
│                                 │ IPC (invoke/handle)                 │
│  ┌──────────────────────────────┴───────────────────────────────────┐ │
│  │                       Main / Core Process                         │ │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────┐ │ │
│  │  │ Instance        │  │  Launcher        │  │  Config / Key   │ │ │
│  │  │ Registry        │  │  Service         │  │  Store          │ │ │
│  │  │ (Map<id,inst>)  │  │  (Puppeteer/PW)  │  │  (Maps API key) │ │ │
│  │  └────────┬────────┘  └────────┬─────────┘  └─────────────────┘ │ │
│  │           │                    │                                  │ │
│  └───────────┼────────────────────┼──────────────────────────────────┘ │
└──────────────┼────────────────────┼──────────────────────────────────────┘
               │                    │
               │   spawn + CDP attach (one connection per browser)
               ▼                    ▼
   ┌────────────────────┐  ┌────────────────────┐  ┌────────────────────┐
   │  Chrome Instance A │  │  Chrome Instance B │  │  Chrome Instance C │
   │  ────────────────  │  │  ────────────────  │  │  ────────────────  │
   │  user-data-dir: /A │  │  user-data-dir: /B │  │  user-data-dir: /C │
   │  CDP session       │  │  CDP session       │  │  CDP session       │
   │  geo: (lat₁, lng₁) │  │  geo: (lat₂, lng₂) │  │  geo: (lat₃, lng₃) │
   └────────────────────┘  └────────────────────┘  └────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Map UI** | Render Google Maps satellite tile layer; expose draggable pin; emit `(lat, lng)` on drag end | React + `@react-google-maps/api` or vanilla Maps JS API, running in renderer |
| **Pin State** | Authoritative client-side store of current pin coords + selected instance | Zustand / Redux / signals — small, in-memory only |
| **Instance List** | Display currently-spawned Chrome instances; per-instance "send pin here" / "close" actions | UI component subscribed to Instance Registry over IPC |
| **IPC Bridge (preload)** | Expose a typed, minimal API (`launch`, `setGeo`, `close`, `list`) on `window.api` via `contextBridge` | Electron preload script; Tauri `invoke` commands |
| **Launcher Service** | Spawn fresh Chrome with isolated `--user-data-dir`; attach CDP; grant permission; set geolocation; return instance handle | Puppeteer `puppeteer.launch()` or Playwright `chromium.launch()` in main process |
| **Instance Registry** | In-memory `Map<instanceId, { browser, context, page, profileDir, coords }>`; lifecycle hooks (`disconnected` → cleanup) | Plain JS object in main process; survives no restarts (v1) |
| **Config / Key Store** | Persist Maps API key, default zoom, last pin (optional) | `electron-store` / Tauri `tauri-plugin-store`; outside VCS |
| **Profile Dir Manager** | Allocate, name, and clean up `user-data-dir` directories on disk | Wrapper around `fs.mkdtemp` in OS temp dir; cleanup on `quit` |

The **UI process never touches Puppeteer or spawned Chromes**. All automation lives in main. This is the same separation Electron itself enforces for security and is also the model that Tauri (Rust core + JS UI + Node sidecar) maps onto cleanly.

## Recommended Project Structure

Mono-repo single-package layout (no need to split until v2):

```
antiClicker/
├── src/
│   ├── main/                       # main / core process (Node)
│   │   ├── index.ts                # app entry: create window, wire IPC
│   │   ├── ipc.ts                  # ipcMain.handle('launch', ...) etc.
│   │   ├── launcher/
│   │   │   ├── index.ts            # public Launcher API (launch/setGeo/close)
│   │   │   ├── puppeteer-driver.ts # Puppeteer impl
│   │   │   ├── profile-dir.ts      # mkdtemp + cleanup
│   │   │   └── geo-override.ts     # grantPermissions + setGeolocation
│   │   ├── registry.ts             # Map<id, Instance>; disconnect handlers
│   │   └── config.ts               # API key, defaults (electron-store)
│   ├── preload/
│   │   └── index.ts                # contextBridge.exposeInMainWorld('api', ...)
│   ├── renderer/                   # UI (React)
│   │   ├── App.tsx
│   │   ├── Map.tsx                 # Google Maps + pin
│   │   ├── InstanceList.tsx        # list + per-row controls
│   │   ├── state.ts                # zustand store (pin coords, instances)
│   │   └── api.ts                  # thin typed wrapper around window.api
│   └── shared/
│       ├── types.ts                # Instance, Coords, LaunchOptions
│       └── ipc-channels.ts         # 'launch' | 'set-geo' | 'close' | ...
├── scripts/
│   └── cli-prototype.ts            # standalone CDP launcher — see "Build Order"
├── electron.vite.config.ts         # or vite.config.ts for Tauri
├── package.json
└── .planning/                      # GSD planning artifacts
```

### Structure Rationale

- **`main/launcher/` is its own folder, not a single file:** the launcher is the load-bearing component and will accumulate sub-modules (driver, profile dir, geo override). Treating it as a domain from day one prevents a future "extract this" refactor.
- **`shared/`:** types and IPC channel names are imported by both `main/` and `renderer/`. Keeping them in one place is the only way to keep IPC type-safe without code duplication.
- **`scripts/cli-prototype.ts`:** a standalone Node script that does the full spawn + override flow with no UI. It exists to validate the load-bearing primitive *before* any Electron/Tauri scaffolding is written. See Build Order below.
- **No `services/` or `controllers/` folders:** premature for v1. The launcher *is* the only service.

## Architectural Patterns

### Pattern 1: Main Process owns ALL automation

**What:** Puppeteer/Playwright is imported and called only from the main process. The renderer never sees a browser handle, only opaque `instanceId` strings.

**When to use:** Always for this project. Both Electron's security model (renderers shouldn't have `nodeIntegration`) and Tauri's architecture (renderer is just a WebView) make this not optional.

**Trade-offs:**
- Pro: secure by default — renderer can't leak filesystem access, can't be tricked into spawning rogue Chromes
- Pro: clean isolation — swap Puppeteer for Playwright without touching UI
- Con: every action is a round-trip over IPC; lat/lng updates while *dragging* could be chatty. Mitigate by only sending on `dragend`, not on every `mousemove`.

**Example:**
```typescript
// main/ipc.ts
import { ipcMain } from 'electron';
import { launcher } from './launcher';

ipcMain.handle('launch', async (_evt, opts: LaunchOptions) => {
  const inst = await launcher.launch(opts);
  return { id: inst.id, coords: inst.coords };  // never return browser/page
});

ipcMain.handle('set-geo', async (_evt, id: string, coords: Coords) => {
  await launcher.setGeo(id, coords);
});
```

```typescript
// preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('api', {
  launch: (opts) => ipcRenderer.invoke('launch', opts),
  setGeo: (id, coords) => ipcRenderer.invoke('set-geo', id, coords),
  close:  (id) => ipcRenderer.invoke('close', id),
  list:   () => ipcRenderer.invoke('list'),
  onInstanceClosed: (cb) => ipcRenderer.on('instance-closed', (_e, id) => cb(id)),
});
```

### Pattern 2: Override geolocation BEFORE first navigation, then mutate

**What:** Sequence per spawned Chrome:
1. `launch({ userDataDir, headless: false })`
2. Get default `browserContext`
3. `context.overridePermissions(originOrWildcard, ['geolocation'])`
4. `page.setGeolocation({ latitude, longitude, accuracy })` (or `context.setGeolocation`)
5. **Then** `page.goto(...)` (or just let the user navigate themselves)

For later moves (pin dragged again): call `page.setGeolocation()` on the existing page. **Do not** re-launch the browser.

**When to use:** Always. This is the canonical, documented sequence. Reversing steps 4 and 5 is the most common bug (the page reads stale/default coords on first call to `navigator.geolocation.getCurrentPosition`).

**Trade-offs:**
- `overridePermissions` is per-origin in Puppeteer's high-level API, which means if the user navigates to a different domain, the permission may not carry. Mitigation: use the raw CDP `Browser.grantPermissions` with no origin to grant globally — confirmed pattern per Puppeteer issue #3225.
- Permission-granting must happen on the **browser context**, not the page. Page-level permission-granting silently no-ops in some Puppeteer versions.

**Example:**
```typescript
// main/launcher/geo-override.ts
export async function configureGeo(
  browser: Browser,
  page: Page,
  coords: Coords,
) {
  const context = browser.defaultBrowserContext();

  // Global permission grant via raw CDP — covers all origins user visits
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.grantPermissions', {
    permissions: ['geolocation'],
    // no `origin` field = grant for all origins
  });

  await page.setGeolocation({
    latitude: coords.lat,
    longitude: coords.lng,
    accuracy: 50,
  });
}

// later, when pin moves:
export async function updateGeo(page: Page, coords: Coords) {
  await page.setGeolocation({
    latitude: coords.lat,
    longitude: coords.lng,
    accuracy: 50,
  });
}
```

### Pattern 3: One Chrome = one user-data-dir = one CDP connection

**What:** Each spawned Chrome instance gets a freshly-created, unique `--user-data-dir` (an empty directory under `os.tmpdir()`). Each has its own Puppeteer `Browser` object with its own CDP WebSocket. There is no shared state between instances at the Chromium level.

**When to use:** This is the only correct model for "multiple isolated instances." Puppeteer explicitly refuses to launch twice against the same `userDataDir` — the cache files inside it must be exclusive to one browser process. Sharing a single browser and creating multiple `BrowserContext`s is NOT equivalent isolation: the browser process is shared, so a crash takes everything down, and Chrome's privacy/state separation between incognito contexts has historically had leaks.

**Trade-offs:**
- Pro: hardest possible isolation — different cookies, cache, localStorage, GPU process per instance
- Pro: per-instance geolocation override is trivial (it's just "the override for that browser's page")
- Con: ~150 MB RAM per instance and a noticeable disk write on launch (Chrome initializes the profile dir)
- Con: must explicitly clean up `user-data-dir` on close, or `/tmp` fills up

**Example:**
```typescript
// main/launcher/profile-dir.ts
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function allocateProfileDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'anticlicker-profile-'));
}
export async function cleanupProfileDir(dir: string) {
  await rm(dir, { recursive: true, force: true });
}

// main/launcher/puppeteer-driver.ts
import puppeteer from 'puppeteer';

export async function spawnInstance(coords: Coords) {
  const userDataDir = await allocateProfileDir();
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir,
    args: ['--no-first-run', '--no-default-browser-check'],
  });
  const [page] = await browser.pages();
  await configureGeo(browser, page, coords);

  browser.on('disconnected', () => {
    cleanupProfileDir(userDataDir);
    registry.remove(instanceId);
  });

  return { id: instanceId, browser, page, userDataDir, coords };
}
```

### Pattern 4: In-memory Registry + event-driven cleanup

**What:** A plain `Map<id, Instance>` in the main process is the source of truth for "what's running." On every `browser.on('disconnected')` (user closed the window, crash, OS killed it), the registry self-evicts, deletes the profile dir, and emits an `instance-closed` IPC event to the UI.

**When to use:** v1. The instance list does not need to survive app restarts — instances die with the parent app, by design.

**Trade-offs:**
- Pro: stateless persistence — no disk schema to migrate, no startup recovery logic
- Pro: matches user intent — "launch a Chrome at this pin" is an ephemeral action
- Con: if the user wants saved pin configurations later, that's a *different* store (config, not registry) and shouldn't be conflated

## Data Flow

### The Headline Flow: Pin Drag → Spoofed Coords

```
┌──────────────────────────────────────────────────────────────────┐
│  RENDERER PROCESS                                                 │
│                                                                   │
│  [User drags pin on satellite map]                                │
│            │                                                      │
│            │ google.maps.Marker 'dragend' event                   │
│            ▼                                                      │
│  Map.tsx: onDragEnd({lat, lng})                                   │
│            │                                                      │
│            ▼                                                      │
│  state.setPin({lat, lng})  ←─── (UI updates coord display)        │
│            │                                                      │
│  [User clicks "Launch Chrome here" OR "Send to instance N"]       │
│            │                                                      │
│            ▼                                                      │
│  window.api.launch({lat,lng})  /  window.api.setGeo(id,{lat,lng}) │
│            │                                                      │
└────────────┼─────────────────────────────────────────────────────┘
             │   ipcRenderer.invoke (over Electron IPC pipe)
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  MAIN PROCESS                                                     │
│                                                                   │
│  ipcMain.handle('launch') / ipcMain.handle('set-geo')             │
│            │                                                      │
│            ▼                                                      │
│  launcher.launch(opts)  or  launcher.setGeo(id, coords)           │
│            │                                                      │
│            ▼                                                      │
│  (if launch:) allocateProfileDir() → puppeteer.launch(...)        │
│  cdp.send('Browser.grantPermissions', ['geolocation'])            │
│            │                                                      │
│            ▼                                                      │
│  page.setGeolocation({latitude, longitude, accuracy: 50})         │
│            │                                                      │
└────────────┼─────────────────────────────────────────────────────┘
             │   CDP WebSocket frame: Emulation.setGeolocationOverride
             ▼
┌──────────────────────────────────────────────────────────────────┐
│  SPAWNED CHROME INSTANCE                                          │
│                                                                   │
│  Chromium internal: geolocation provider returns override         │
│            │                                                      │
│  [User-visited page calls navigator.geolocation.getCurrentPosition]│
│            │                                                      │
│            ▼                                                      │
│  Position { coords: {latitude: lat, longitude: lng, accuracy:50}} │
│  → resolves with spoofed value                                    │
└──────────────────────────────────────────────────────────────────┘
```

Key invariant: **the renderer's pin coords and Chrome's `Emulation.setGeolocationOverride` value are always the same number** — there is no transformation, no projection, no rounding in between (lat/lng pass through unchanged).

### State Management

State lives in **three places**, each with a different lifetime and authority:

| State | Lives In | Authority | Lifetime |
|-------|---------|-----------|----------|
| Current pin coords | Renderer (zustand store) | Renderer is the source of truth | App session |
| Running instances | Main (Instance Registry, in-memory `Map`) | Main is the source of truth; renderer mirrors via IPC events | Until instance disconnects |
| Per-instance current coords | Main (`registry[id].coords`) + Chrome's CDP override | Main is the source of truth | Until next setGeo |
| Maps API key, defaults | Main (`electron-store` JSON on disk) | Persistent | Across app launches |
| user-data-dir contents (cookies, cache) | Disk (`os.tmpdir()/anticlicker-profile-<id>/`) | Owned by Chrome process | Until instance close (cleaned up) |

The renderer doesn't try to maintain its own copy of "what coords instance X has" — that's main's job, surfaced over IPC.

### Key Data Flows

1. **Launch flow:** Renderer pin → IPC `launch` → main creates profile dir → spawns Chrome → grants permission → sets geo → returns `id` → renderer adds row to instance list.
2. **Move-existing-instance flow:** Renderer "send pin to instance X" → IPC `set-geo(id, coords)` → main calls `page.setGeolocation(...)` → next call to `navigator.geolocation.getCurrentPosition()` inside that Chrome returns new coords. No re-launch.
3. **Verification flow:** Per requirement "user can verify the spoof worked" — main process exposes a `launchWithUrl` variant or the renderer simply prefills the user-facing URL bar via Puppeteer `page.goto('https://browserleaks.com/geo')` after the override is set.
4. **Cleanup flow:** User closes the Chrome window → Puppeteer fires `'disconnected'` on `browser` → main process: remove from registry, delete profile dir, emit `instance-closed` over IPC → renderer removes row.

## Build Order Implications

The roadmap should respect that **the CDP geolocation override is the load-bearing primitive**. Everything else is UI around it. If override doesn't work reliably, no amount of map polish saves the project.

Suggested phase ordering:

1. **Phase 1 — CDP CLI Prototype (no UI):** Write `scripts/cli-prototype.ts`. Takes `--lat` and `--lng` as args, spawns Chrome with unique profile dir, sets override, opens `browserleaks.com/geo`. **Goal:** prove the load-bearing primitive in <100 lines, no shell, no IPC. Validates the Puppeteer/Playwright choice and the override sequence end-to-end. This is the single best risk-retiring move.
2. **Phase 2 — Multi-instance launcher (still no UI):** Extend the CLI to launch N instances in parallel, each with distinct coords and distinct profile dirs. Validate isolation (cookies set in one don't appear in another). Validate cleanup. This is where the `launcher/` module crystallizes.
3. **Phase 3 — Desktop shell + IPC:** Stand up Electron (or Tauri) with a placeholder UI (just a "Launch at hardcoded coords" button). Move the `launcher/` module into `main/`. Define the IPC surface (`launch`, `setGeo`, `close`, `list`). Validate that the renderer can drive launches through `contextBridge`.
4. **Phase 4 — Google Maps UI + pin:** Wire up the actual map, the draggable pin, the coord display, the API key config flow. Hook pin coords into the existing IPC `launch` call.
5. **Phase 5 — Instance list + per-instance "send pin":** Multi-instance UX. Now the UI surfaces what main already supports.
6. **Phase 6 — Verification + polish:** "Test on browserleaks" button, error states, profile-dir cleanup-on-quit, friendly error if Chrome isn't installed.

The temptation will be to start with the map (it's visual and feels like progress). **Resist.** A working map calling a broken launcher is more demoralizing than a working CLI without a map.

## Scaling Considerations

This is a personal-use desktop tool. "Scale" means *how many Chrome instances can one user run at once on one laptop?*

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1–3 instances | Default. No optimization needed. RAM cost ~500 MB. |
| 4–10 instances | Still fine on a modern laptop (16 GB RAM). Consider a UI affordance to warn user before spawning the 8th. |
| 10+ instances | Out of scope for v1. If ever needed: queue with concurrency cap; reuse browser contexts inside a single Chrome (sacrifices isolation but cheap); or move to headless. |

### Scaling Priorities

1. **First bottleneck:** RAM — each Chrome eats ~150 MB resident. The OS will swap before crashing, but the UX gets bad. **Fix:** add a soft cap (e.g., warn at 6 instances), never silently allow infinite.
2. **Second bottleneck:** `os.tmpdir()` space if profile dirs aren't cleaned up on crash. **Fix:** on app start, sweep `tmpdir()` for orphaned `anticlicker-profile-*` directories whose owning PID is dead.

## Anti-Patterns

### Anti-Pattern 1: Driving Puppeteer from the renderer process

**What people do:** Import `puppeteer` directly in the React app, "just to keep things simple."
**Why it's wrong:** Requires `nodeIntegration: true` in Electron (or unrestricted IPC in Tauri) — both are gaping security holes. Any malicious script loaded in the renderer (e.g., from the Maps tile cache, a CDN supply-chain attack, etc.) gets full filesystem access. Also breaks Tauri entirely (no Node in renderer).
**Do this instead:** Puppeteer in main. UI talks to main via a typed `contextBridge`-exposed API.

### Anti-Pattern 2: Sharing one Chrome browser with multiple BrowserContexts for "isolation"

**What people do:** `browser.createIncognitoBrowserContext()` for each pin location.
**Why it's wrong:** All contexts share one Chromium process and one CDP target tree. A crash takes them all down. More importantly: `Emulation.setGeolocationOverride` is set on a CDP *session* targeting a *page*, but Chrome's geolocation provider is shared at the browser level — historically there have been bugs where override from one context leaks to another. And requirement explicitly says "separate user-data-dirs."
**Do this instead:** One `puppeteer.launch()` per instance, each with its own `userDataDir`.

### Anti-Pattern 3: Calling `setGeolocation` after `page.goto(url)`

**What people do:** Navigate to the test page, then set geolocation, then expect `navigator.geolocation.getCurrentPosition` to return the override.
**Why it's wrong:** Many pages call `getCurrentPosition` during load. By the time you set the override, the page has already received the default (or "permission denied"). Reload would work but is ugly.
**Do this instead:** Always order operations: `launch` → `grantPermissions` → `setGeolocation` → `goto`. For subsequent moves on an already-loaded page, calling `setGeolocation` is sufficient — the next call to `getCurrentPosition` returns the new value.

### Anti-Pattern 4: Persisting the running-instance list across app restarts

**What people do:** Write the in-memory registry to `electron-store` so "instances survive a quit."
**Why it's wrong:** They don't, actually — closing the app sends `SIGTERM` to child Chrome processes (unless explicitly detached, which is its own anti-pattern). The persisted "list" then describes ghosts. The reconciliation logic to detect this is more code than the feature is worth.
**Do this instead:** Treat the registry as ephemeral. If users want to "save a pin location," persist *pin configurations* (lat/lng/label), not running instances.

### Anti-Pattern 5: Using `--user-data-dir` pointed at the user's real Chrome profile

**What people do:** Set `userDataDir: '/Users/me/Library/Application Support/Google/Chrome/Default'` to "log in as themselves."
**Why it's wrong:** Recent Chrome versions actively refuse to allow automation against the default user profile — pages fail to load, browser exits unexpectedly. Also: corrupts the user's real cookies on crash. Also: only one Chrome can hold that directory at a time, so launching while regular Chrome is open fails.
**Do this instead:** Always allocate a fresh, empty directory under `os.tmpdir()` per instance.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Maps JavaScript API | Loaded in renderer via `<script>` tag (or `@react-google-maps/api` wrapper); requires API key | Key stored in main, passed to renderer over IPC at startup. Never bake into the renderer bundle. Use HTTP-referrer-restricted key. |
| Local Chrome / Chromium binary | Spawned by Puppeteer (`puppeteer.launch()`) — uses bundled Chromium by default; can override `executablePath` to use system Chrome | Bundled is more reliable cross-machine; system Chrome is closer to what users see day-to-day. v1 should use bundled. |
| browserleaks.com / mylocation.org | Just URLs to `page.goto()` in the verification flow | No API integration; these are visual confirmations the user opens. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Renderer ↔ Main | `ipcRenderer.invoke` / `ipcMain.handle` (async request/response); `webContents.send` / `ipcRenderer.on` (main-pushed events like `instance-closed`) | All channels go through `contextBridge`; no `nodeIntegration`. Channel names live in `shared/ipc-channels.ts`. |
| Main ↔ Spawned Chrome | Chrome DevTools Protocol over WebSocket (`ws://localhost:<port>/devtools/browser/...`); managed entirely by Puppeteer | One WebSocket per spawned browser. `browser.on('disconnected')` is the only lifecycle signal we need. |
| Launcher ↔ Profile Dir Manager | Plain function calls within main | `allocateProfileDir()` returns a path string; `cleanupProfileDir(path)` is called from the `disconnected` handler. |
| Launcher ↔ Instance Registry | Plain function calls within main | Launcher writes; IPC handlers read. Registry is just a `Map`; not a class hierarchy. |

## Sources

- [Puppeteer: Page.setGeolocation() documentation](https://pptr.dev/api/puppeteer.page.setgeolocation)
- [Puppeteer issue #5442 — browserContext.setGeolocation with permission override](https://github.com/puppeteer/puppeteer/issues/5442)
- [Puppeteer issue #3225 — Giving permissions to all origins in browser context](https://github.com/puppeteer/puppeteer/issues/3225)
- [Puppeteer issue #13581 — Failed to launch with same userDataDir & different profile (concurrent)](https://github.com/puppeteer/puppeteer/issues/13581)
- [Puppeteer issue #3373 — Running multiple instances with userDataDir + profile-directory](https://github.com/GoogleChrome/puppeteer/issues/3373)
- [Puppeteer: Browser Launching and Configuration (DeepWiki)](https://deepwiki.com/puppeteer/puppeteer/5.1-browser-launching-and-configuration)
- [Browserless: How to manage cookies, sessions and the data directory for Puppeteer](https://www.browserless.io/blog/manage-sessions)
- [Playwright: BrowserContext API](https://playwright.dev/docs/api/class-browsercontext)
- [Playwright: Emulation guide](https://playwright.dev/docs/emulation)
- [Playwright: Using geolocation in tests (Tim De Schryver)](https://timdeschryver.dev/blog/using-geolocation-in-playwright-tests)
- [Playwright issue #35836 — launchPersistentContext and Chrome profiles](https://github.com/microsoft/playwright/issues/35836)
- [Chromium: Getting Started With Chrome DevTools Protocol (Aleks Lushnikov)](https://github.com/aslushnikov/getting-started-with-cdp)
- [Electron: Process Model](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Electron: Inter-Process Communication tutorial](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Electron: contextBridge API](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron: utilityProcess API](https://www.electronjs.org/docs/latest/api/utility-process)
- [Matthew Slipper: Everything You Wanted To Know About Electron Child Processes](https://www.matthewslipper.com/2019/09/22/everything-you-wanted-electron-child-process.html)
- [Cameron Nokes: Deep dive into Electron's main and renderer processes](https://cameronnokes.com/blog/deep-dive-into-electron's-main-and-renderer-processes/)
- [Tauri v2: Node.js as a sidecar](https://v2.tauri.app/learn/sidecar-nodejs/)
- [Tauri v2: Embedding External Binaries](https://v2.tauri.app/develop/sidecar/)
- [stereobooster: Tauri instead of Puppeteer or Playwright?](https://stereobooster.com/posts/tauri-instead-of-puppeteer-or-playwright/)

---
*Architecture research for: desktop geolocation-spoofing tool driving Chrome via CDP*
*Researched: 2026-05-14*
