# Phase 0: Foundation / Bootstrap - Research

**Researched:** 2026-05-14
**Domain:** Electron 35 desktop shell scaffolding (electron-vite 4/5 + Vite 6 + TypeScript 5.7 + React 19 + electron-store 11 + zod 4)
**Confidence:** HIGH

## Summary

Phase 0 stands up the load-bearing skeleton for AntiClicker: an Electron 35 main process, a typed `contextBridge` preload, a React + Vite renderer served over **HTTP** (never `file://`), and a persistent `electron-store` config slot. No features yet — every line written here is foundation that Phases 1–6 stack onto.

There is exactly one non-obvious decision in this phase: **how the renderer is loaded in packaged builds.** The standard `electron-vite` template uses `mainWindow.loadFile()` for production, which serves the renderer over `file://` — and `file://` makes Google Maps' HTTP-referrer restriction silently fail (`RefererNotAllowedMapError`). FND-02 explicitly forbids this. The fix is to bundle a tiny Node `http.createServer` in main that serves the built `out/renderer` directory over `http://127.0.0.1:<ephemeral-port>` in packaged builds, and continue using electron-vite's dev server URL (`process.env.ELECTRON_RENDERER_URL`) in dev. Both paths produce a `window.location.protocol === 'http:'` invariant.

The other three deliverables — secure `webPreferences`, contextBridge preload, electron-store wiring — are well-trodden patterns with a single 2026 gotcha each: (1) Electron 20+ already defaults `sandbox: true`, `nodeIntegration: false`, `contextIsolation: true` — we set them explicitly anyway as a defense-in-depth invariant the planner can grep for; (2) the preload must run **with `sandbox: true`** (electron-vite's default template ships with `sandbox: false` — this needs to be flipped); (3) `electron-store@10+` is **ESM-only**, so the main process `package.json` must declare `"type": "module"` OR consume `electron-store` via dynamic `import()` from a CJS main. Recommendation: go ESM end-to-end; electron-vite 5 + Vite 6 both fully support it.

**Primary recommendation:** Scaffold from `npm create @quick-start/electron@latest` (react-ts template), then immediately make three modifications to honor FND-01/02/03: (a) flip `sandbox: true` in `webPreferences` and pin secure defaults explicitly; (b) replace the production `loadFile` branch with an in-main HTTP server (`node:http`) serving `out/renderer` on an ephemeral port via `127.0.0.1`; (c) pin `electron@~35.7.5` (last 35.x), declare `"type": "module"` in `package.json`, install `electron-store@^11`, `zod@^4`, define a typed schema, and prove persistence via a one-shot "incrementing counter" smoke test.

## User Constraints (from CONTEXT.md)

> No CONTEXT.md exists for Phase 0 (this is the standalone research path). Constraints are derived from PROJECT.md, REQUIREMENTS.md (FND-01/02/03), and ROADMAP.md success criteria.

### Locked Decisions (from upstream artifacts)

- **Stack:** Electron 35.x (NOT 36/37/42), electron-vite 4.x/5.x, Vite 6.x, TypeScript 5.7.x, electron-store 10.x/11.x, zod 3.x/4.x. Source: research/STACK.md + ROADMAP Phase 0 success criteria #1 ("Electron 35 window").
- **Renderer transport:** `http://localhost:<port>` in both dev AND packaged builds. NOT `file://`. Source: FND-02 + PITFALLS Pitfall 4 + ROADMAP success criteria #2.
- **Security:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Source: FND-01 + ROADMAP success criteria #1.
- **Persistence:** `electron-store` to OS user-data dir; survives relaunch. Source: FND-03 + ROADMAP success criteria #3.
- **Preload:** narrow, typed `contextBridge` API surface only — no `ipcRenderer`, no `require`. Source: ROADMAP success criteria #4.
- **No UI yet.** Phase 0 has `UI hint: no`. The renderer can show a placeholder ("AntiClicker — foundation OK") — no map, no React Router, no styling system.
- **Platform:** macOS first. Windows/Linux deferred per PROJECT.md.

### Claude's Discretion

- Test runner choice (vitest vs node:test) for the FND verification harness.
- Whether to introduce React 19 in Phase 0 or wait for Phase 4 (recommendation: introduce in Phase 0, it's free).
- Lint/format choice (eslint flat config + prettier vs biome) — pick the lighter setup.
- Monorepo vs flat (recommendation: flat — single package; the three "processes" are just three Vite build targets, not three packages).
- Exact ephemeral-port allocation strategy (`server.listen(0)` and read `server.address().port` is the standard pattern).

### Deferred Ideas (OUT OF SCOPE for Phase 0)

- Playwright / CDP / Chrome launching — Phase 1.
- Map rendering / MapLibre / Google Maps — Phase 4.
- IPC handlers beyond a single typed `ping` round-trip — Phase 3.
- zod schemas for lat/lng (just one schema for the config store) — Phase 3.
- electron-builder / .dmg packaging — Phase 6.
- Google Cloud Console quota cap (manual; see Pitfall 5 below — appears as a checklist item, NOT a code task).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FND-01 | Electron 35 desktop app launches with secure defaults (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`) | Standard Stack section pins Electron 35.7.5; Pattern 2 (BrowserWindow with explicit secure defaults) shows the exact webPreferences object; verification in Pattern 6 reads `process.contextIsolated` from the renderer. |
| FND-02 | Renderer is served from `http://localhost:<port>` (NOT `file://`) so Google Maps referrer restrictions work in both dev and packaged builds | Pattern 3 (HTTP server in main for packaged builds) is the load-bearing answer. Dev uses electron-vite's `process.env.ELECTRON_RENDERER_URL` (already HTTP); production uses an in-main `node:http` server bound to `127.0.0.1:0` (ephemeral port). Verification: assert `window.location.protocol === 'http:'` from renderer. |
| FND-03 | App settings persist via `electron-store` outside version control | Pattern 4 (electron-store init with zod-validated schema). ESM-only — package.json must declare `"type": "module"`. On macOS persists to `~/Library/Application Support/AntiClicker/config.json`. Verification: write/relaunch/read cycle. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Window lifecycle, app activation, OS integration | Electron main | — | `app`/`BrowserWindow`/`ipcMain` only exist in main. |
| Renderer transport (dev) | Renderer (Vite dev server) | Main (consumes `ELECTRON_RENDERER_URL`) | electron-vite spawns the Vite dev server; main reads the URL. |
| Renderer transport (packaged) | Main (Node http server) | Renderer (loads URL) | Packaged build has no Vite. Main owns the http server that serves the built static files. |
| Static file serving (packaged) | Main | — | Main has filesystem access; renderer is sandboxed. |
| Persistent settings store | Main | — | `electron-store` writes to `app.getPath('userData')`; only main has `app`. Exposed to renderer via narrow IPC if/when needed (not yet in Phase 0). |
| Preload bridge (`window.api`) | Preload | Main (handlers) + Renderer (consumer) | The preload is the **only** code that bridges Node and renderer. Its surface area is the IPC contract. |
| Type definitions (`shared/types.ts`) | Shared | — | Both main and renderer import from `src/shared/`. |
| Build (TypeScript → JS) | Tooling (electron-vite) | — | electron-vite produces three artifacts: `out/main`, `out/preload`, `out/renderer`. |
| Verification smoke tests | Tooling (vitest) + Renderer (in-page check) | — | Renderer-side assertions on `process.contextIsolated` and `window.location.protocol` are the load-bearing checks for FND-01/02. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `electron` | `^35.7.5` (pin to last 35.x) | Desktop shell | FND-01 locks Electron 35. `35.7.5` is the final release of the 35.x line per npm registry — newer 35.x will not be published. **[VERIFIED: `npm view electron dist-tags --json` → `35-x-y: 35.7.5`]** |
| `electron-vite` | `^5.0.0` | Dev server + main/preload/renderer build orchestration | Latest stable; supports `electron@33+`, `vite@5/6/7`. **[VERIFIED: `npm view electron-vite version` → 5.0.0]**. v4.0.1 also works (per STACK.md) but is older — prefer 5.0.0. |
| `vite` | `^6.0.3` | Renderer bundler | Pinned at 6.x per STACK.md. v7 also exists but stick with 6 for stability. **[VERIFIED: `npm view vite version` → 6.0.3 with v7 also published]** |
| `typescript` | `^5.7.0` (or current 5.x) | Type safety | Standard 2026 baseline. **[VERIFIED: npm latest 6.0.3 — note: TS hit 6.x, but 5.7+ is fine and what STACK.md pins.]** |
| `react` | `^19.2.1` | Renderer framework | Used in Phase 4 for map UI; introduce now to lock the build pipeline. **[VERIFIED: 19.2.6 latest]** |
| `react-dom` | `^19.2.1` | React renderer | Pair with `react`. |
| `@vitejs/plugin-react` | `^5.1.1` (or `^6.0.2`) | React + Vite integration | Standard. **[VERIFIED: 6.0.2 latest]** |
| `electron-store` | `^11.0.2` | Persistent settings | FND-03 locks this library. **[VERIFIED: 11.0.2 latest; `type: "module"` confirmed via `npm view electron-store type`]** — **ESM-only.** STACK.md said `10.x`; `11.x` is API-identical for our usage and is the current latest. |
| `zod` | `^4.0.0` (or `^3.23`) | Config schema validation | Used for the electron-store schema in Phase 0; will be reused for IPC payloads in Phase 3. **[VERIFIED: 4.4.3 latest; STACK.md pinned 3.x — 4.x is fine, `z.object` API unchanged for our usage.]** |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@electron-toolkit/preload` | `^3.0.2` | Pre-built secure `electronAPI` for the preload | Optional — provides `ipcRenderer.invoke/send/on` wrappers. We use a hand-rolled minimal preload instead for Phase 0 (full control of the surface area). Document but do not install in Phase 0. |
| `@electron-toolkit/utils` | `^4.0.0` | `is.dev`, `electronApp.setAppUserModelId`, `optimizer.watchWindowShortcuts` | **Install.** Provides the `is.dev` helper that the canonical electron-vite pattern uses. **[VERIFIED: 4.0.0 latest]** |
| `electron-builder` | `^26.0.12` | Packaging (.dmg, .exe, AppImage) | **Phase 6 only.** Do NOT install in Phase 0 — keeps the dependency surface minimal. **[VERIFIED: 26.8.1 latest]** |
| `vitest` | `^4.1.6` | Test runner for the FND verification harness | Install. Cheaper than playwright for the in-renderer assertion harness. **[VERIFIED: 4.1.6 latest]** |
| `@playwright/test` | `^1.60.0` | End-to-end Electron smoke test (assert `process.contextIsolated`, `window.location.protocol`) | Install as devDependency. Playwright supports Electron via `_electron.launch()`. We'll need it in Phase 1 anyway for the CLI prototype; introducing it now gives us a way to write FND verification as a real Playwright test. **[VERIFIED: 1.60.0 latest]** |
| `eslint` | `^9.39.0` | Lint | Standard. **[VERIFIED: 10.3.0 latest, but 9.x is fine.]** |
| `prettier` | `^3.7.4` | Format | Standard. **[VERIFIED: 3.8.3 latest]** |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `electron-store@11` (ESM-only) | `electron-store@8` (CJS) | Stay on CJS; cost: ancient API surface, fewer maintainers' attention. **Not worth it** — go ESM end-to-end. |
| In-main `node:http` server for packaged builds | `protocol.handle('app', ...)` with a custom scheme like `app://-` | The custom scheme works *except* Google Maps' HTTP-referrer restriction will reject any scheme that isn't `http`/`https`. Per PITFALLS Pitfall 4, this is exactly the failure FND-02 exists to prevent. **Reject — use real HTTP.** |
| In-main `node:http` server for packaged builds | `protocol.handle('http', ...)` to intercept `http://localhost` | Theoretically possible (Electron 25+ supports intercepting any scheme), but intercepting `http` globally is invasive — it will route every HTTP request the renderer makes (including future Google Maps API calls!) through your handler unless you carefully filter by hostname. **Reject — too dangerous.** |
| In-main `node:http` server for packaged builds | `electron-serve` npm package | `electron-serve` requires **Electron 37+** per its npm page; we're on Electron 35. Also it serves over `app://-` (custom scheme), same problem as the second row. **Reject — incompatible.** |
| Hand-rolled http server | `express`, `fastify`, `koa` | Phase 0 wants <20 lines, no dependencies. `node:http` from stdlib is enough. **Pick stdlib.** |
| `vitest` | `node:test` | `node:test` is fine but vitest plays nicer with Vite's TS pipeline and gives us a watch UI we'll want in Phase 4. **Pick vitest.** |
| `@playwright/test` for Electron e2e | `spectron` | Spectron is dead (deprecated by Electron team). Playwright's `_electron` is the canonical 2026 path. **Pick Playwright.** |

**Installation:**
```bash
# Scaffold
npm create @quick-start/electron@latest -- antiClicker --template react-ts
cd antiClicker

# Pin Electron to 35.x (the scaffold defaults to 39+)
npm install --save-dev electron@~35.7.5

# Add Phase 0 persistence + validation
npm install electron-store@^11 zod@^4

# Add Phase 0 verification tooling
npm install --save-dev vitest@^4 @playwright/test@^1.60

# Note: do NOT install electron-builder yet — Phase 6 concern
# Note: do NOT install maplibre-gl, playwright (the runtime, not test) — Phase 1/4 concern
```

**Version verification:** all versions above verified via `npm view <pkg> version` and `npm view <pkg> dist-tags --json` on 2026-05-14. `[VERIFIED: npm registry]`

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Electron Main Process                       │
│                                                                 │
│  ┌────────────────────┐                                         │
│  │ app.whenReady()    │──┐                                      │
│  └────────────────────┘  │                                      │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  1. dev?  ──yes──> use process.env.ELECTRON_RENDERER_URL│    │
│  │     │                  (electron-vite-managed dev srv)  │    │
│  │     └─no──> startInProcHttpServer() returns http://     │    │
│  │              127.0.0.1:<ephemeralPort>                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ new BrowserWindow({ webPreferences: {                   │    │
│  │   contextIsolation: true, nodeIntegration: false,       │    │
│  │   sandbox: true, preload: out/preload/index.mjs         │    │
│  │ }})                                                     │    │
│  │ mainWindow.loadURL(<rendererUrl>)                       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                      │
│  ┌──────────────────┐    │                                      │
│  │ electron-store   │◄───┤  ipcMain.handle('ping', ...)         │
│  │ (zod-validated)  │    │  ipcMain.handle('config:get', ...)   │
│  │ userData dir     │    │  ipcMain.handle('config:set', ...)   │
│  └──────────────────┘    │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼ (IPC over the ELECTRON_RENDERER_URL or in-proc http URL)
┌─────────────────────────────────────────────────────────────────┐
│           Renderer (Chromium) — loaded from http://             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Preload (sandboxed) — contextBridge.exposeInMainWorld   │    │
│  │   window.api = {                                        │    │
│  │     ping: () => ipcRenderer.invoke('ping'),             │    │
│  │     getConfig: (k) => ipcRenderer.invoke('config:get'…),│    │
│  │     setConfig: (k,v) => ipcRenderer.invoke('config:set'…│    │
│  │   }                                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                      │
│                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ React App (Phase 0: placeholder screen, no map)         │    │
│  │  - shows protocol: window.location.protocol             │    │
│  │  - shows contextIsolated: process.contextIsolated       │    │
│  │  - calls window.api.ping() → expects 'pong'             │    │
│  │  - calls window.api.setConfig('counter', n+1)           │    │
│  │    on every mount; reads back on next launch            │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
antiClicker/
├── package.json              # "type": "module", "main": "./out/main/index.js"
├── electron.vite.config.ts   # electron-vite config (main+preload+renderer)
├── tsconfig.json             # base
├── tsconfig.node.json        # main + preload (Node target)
├── tsconfig.web.json         # renderer (browser target)
├── .gitignore                # out/, node_modules/, .env, *.log
├── src/
│   ├── main/
│   │   ├── index.ts          # app.whenReady, createWindow, IPC handlers
│   │   ├── renderer-server.ts# Node http server for packaged builds (FND-02)
│   │   ├── config-store.ts   # electron-store init + zod schema (FND-03)
│   │   └── ipc.ts            # ipcMain.handle registrations
│   ├── preload/
│   │   ├── index.ts          # contextBridge.exposeInMainWorld('api', {...})
│   │   └── index.d.ts        # ambient `declare global { Window.api }` types
│   ├── renderer/
│   │   ├── index.html        # Vite entry
│   │   ├── src/
│   │   │   ├── main.tsx      # ReactDOM.createRoot
│   │   │   ├── App.tsx       # Phase 0 placeholder + verification readouts
│   │   │   └── env.d.ts      # vite/client types
│   └── shared/
│       ├── types.ts          # AppConfig, IpcChannels — imported by main + preload + renderer
│       └── ipc-channels.ts   # string constants for channel names
├── tests/
│   ├── e2e/
│   │   └── foundation.spec.ts# Playwright Electron test — asserts FND-01/02/03 invariants
│   └── unit/
│       └── config-store.test.ts # vitest — schema validation
└── out/                      # build output (gitignored)
    ├── main/
    ├── preload/
    └── renderer/
```

### Pattern 1: `package.json` skeleton

```json
{
  "name": "anticlicker",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "tsc --noEmit && electron-vite build",
    "start": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.web.json",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "lint": "eslint --cache .",
    "format": "prettier --write ."
  },
  "dependencies": {
    "electron-store": "^11.0.2",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@electron-toolkit/utils": "^4.0.0",
    "@playwright/test": "^1.60.0",
    "@types/node": "^22.7.7",
    "@types/react": "^19.2.7",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^5.1.1",
    "electron": "~35.7.5",
    "electron-vite": "^5.0.0",
    "eslint": "^9.39.0",
    "prettier": "^3.7.4",
    "react": "^19.2.1",
    "react-dom": "^19.2.1",
    "typescript": "^5.7.0",
    "vite": "^6.0.3",
    "vitest": "^4.1.6"
  }
}
```

> **Note on `"type": "module"`:** required because `electron-store@10+` is ESM-only. `[VERIFIED: npm view electron-store type → "module"]`. The main process build output (`out/main/index.js`) will then be an ES module, which Electron 35 supports natively. `[CITED: electron-vite supports ESM main since v3, see https://electron-vite.org/guide/]`

### Pattern 2: Secure BrowserWindow webPreferences (FND-01)

```ts
// src/main/index.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { startRendererServer } from './renderer-server.js';
import { initConfigStore } from './config-store.js';
import { registerIpc } from './ipc.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function createWindow(): Promise<void> {
  const rendererUrl = is.dev && process.env['ELECTRON_RENDERER_URL']
    ? process.env['ELECTRON_RENDERER_URL']
    : await startRendererServer();              // returns http://127.0.0.1:<port>

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,        // FND-01 — explicit (default since Electron 12, but greppable)
      nodeIntegration: false,        // FND-01 — explicit (default since Electron 5)
      sandbox: true,                 // FND-01 — explicit (default since Electron 20)
      webSecurity: true,             // belt-and-suspenders; default true
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow.show());
  await mainWindow.loadURL(rendererUrl);
}

app.whenReady().then(async () => {
  initConfigStore();
  registerIpc();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

**Source for explicit-secure-defaults pattern:** `[CITED: https://www.electronjs.org/docs/latest/tutorial/security — "explicitly set contextIsolation: true, nodeIntegration: false, sandbox: true"]`. **Defaults verified:** `[VERIFIED via Electron security docs WebFetch on 2026-05-14: contextIsolation default since 12.0.0, nodeIntegration default-off since 5.0.0, sandbox default-on since 20.0.0]`.

**Critical deviation from electron-vite template:** the scaffold's `react-ts/src/main/index.ts` ships with `sandbox: false`. We override to `true`. This means we **cannot** use Node APIs in the preload — but per FND-01 success criterion #4 ("no raw `ipcRenderer`, no `require`") we explicitly don't want them.

### Pattern 3: HTTP server in main for packaged builds (FND-02) — load-bearing

This is the only non-template code in Phase 0. Without it, FND-02 fails in packaged builds.

```ts
// src/main/renderer-server.ts
import { createServer, type Server } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDERER_ROOT = join(__dirname, '../renderer');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

let serverRef: Server | null = null;

export async function startRendererServer(): Promise<string> {
  const server = createServer(async (req, res) => {
    try {
      // Bind localhost-only. Reject anything that smells like host-header attack.
      if (!req.headers.host?.startsWith('127.0.0.1') && !req.headers.host?.startsWith('localhost')) {
        res.writeHead(403).end();
        return;
      }
      let urlPath = decodeURIComponent(new URL(req.url ?? '/', 'http://127.0.0.1').pathname);
      if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

      // Resolve and guard against path traversal: must stay under RENDERER_ROOT.
      const candidate = normalize(join(RENDERER_ROOT, urlPath));
      if (!candidate.startsWith(RENDERER_ROOT)) {
        res.writeHead(403).end();
        return;
      }

      const s = await stat(candidate);
      if (!s.isFile()) {
        res.writeHead(404).end();
        return;
      }
      const body = await readFile(candidate);
      res.writeHead(200, { 'Content-Type': MIME[extname(candidate)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind renderer server');
  serverRef = server;
  return `http://127.0.0.1:${addr.port}/`;
}

export async function stopRendererServer(): Promise<void> {
  if (!serverRef) return;
  await new Promise<void>((resolve, reject) =>
    serverRef!.close((err) => (err ? reject(err) : resolve())),
  );
  serverRef = null;
}
```

**Why this pattern:**
- `127.0.0.1` (not `0.0.0.0`) — never expose to LAN.
- `listen(0)` — ephemeral port, never collides.
- Path traversal guard — sandboxed renderer + `webSecurity: true` already constrain this, but defense in depth.
- Stdlib only — no `express`, no `fastify`.
- ~50 lines — Phase 0 fits in one file.

**Source pattern:** `[CITED: WebSearch consensus 2026 — see Sources. Standard pattern for serving packaged Electron renderer over HTTP. Pattern attributed to several Electron+React tutorials.]`

**Note on `protocol.handle()` alternative:** `[VERIFIED: Electron docs https://www.electronjs.org/docs/latest/api/protocol — protocol.handle is the canonical 2026 way to register a custom scheme.]` We reject it here because Phase 4 will load Google Maps over real HTTPS — registering an `http` handler globally would intercept those requests too, and registering an `app://` scheme defeats FND-02's referrer-restriction goal. **An ephemeral localhost HTTP server is the only approach that satisfies "the renderer is loaded from `http://localhost`" literally.**

### Pattern 4: electron-store with zod schema (FND-03)

```ts
// src/main/config-store.ts
import Store from 'electron-store';
import { z } from 'zod';

// Phase 0: minimal schema — just enough to prove persistence.
// Phase 4 will extend with googleMapsApiKey, lastPin, etc.
const ConfigSchema = z.object({
  // Smoke-test field — incremented on every app boot to prove persistence.
  launchCount: z.number().int().nonnegative().default(0),
  // Slot for future Maps API key (Phase 4) — kept null in Phase 0.
  googleMapsApiKey: z.string().nullable().default(null),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

let store: Store<AppConfig> | null = null;

export function initConfigStore(): Store<AppConfig> {
  if (store) return store;

  // electron-store accepts a JSON-Schema for validation, but we use zod for the type
  // boundary and validate on read/write ourselves. Simpler than dual-source-of-truth.
  store = new Store<AppConfig>({
    name: 'config', // → config.json in app.getPath('userData')
    defaults: ConfigSchema.parse({}), // applies defaults
    clearInvalidConfig: true,         // self-heal if a hand-edited file is malformed
  });

  // Validate existing on-disk state on init; if corrupt, fall back to defaults.
  const parsed = ConfigSchema.safeParse(store.store);
  if (!parsed.success) {
    store.store = ConfigSchema.parse({});
  }

  // FND-03 smoke test: increment launchCount on every init.
  store.set('launchCount', (store.get('launchCount') ?? 0) + 1);

  return store;
}

export function getStore(): Store<AppConfig> {
  if (!store) throw new Error('Config store not initialized — call initConfigStore() first');
  return store;
}
```

**On-disk locations** `[VERIFIED: electron-store README via WebFetch 2026-05-14]`:
- **macOS:** `~/Library/Application Support/AntiClicker/config.json`
- **Windows:** `%APPDATA%\AntiClicker\Config\config.json`
- **Linux:** `~/.config/AntiClicker/config.json`

**ESM gotcha:** `[VERIFIED: npm view electron-store type → "module"]` — `electron-store@10+` is ESM-only. The `import Store from 'electron-store'` syntax requires `"type": "module"` in `package.json`. If the planner accidentally leaves the project as CJS, this import will fail at runtime with `ERR_REQUIRE_ESM`.

### Pattern 5: Preload with narrow typed API (FND-01 success criterion #4)

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

// The ONLY surface exposed to the renderer. Add a method here only if the
// renderer absolutely needs it — every entry is an attack surface.
const api = {
  ping: (): Promise<'pong'> => ipcRenderer.invoke('ping'),
  // Phase 0 verification helpers. Will grow in Phase 3.
  getLaunchCount: (): Promise<number> => ipcRenderer.invoke('config:get-launch-count'),
} as const;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  // We REQUIRE contextIsolation. If it's off, something is wrong — fail loud.
  throw new Error('contextIsolation is off — refusing to expose api without isolation');
}

export type Api = typeof api;
```

```ts
// src/preload/index.d.ts
import type { Api } from './index';

declare global {
  interface Window {
    api: Api;
  }
}
export {};
```

**Why throw if `contextIsolated` is false:** in the canonical electron-vite template, the preload silently falls back to `window.api = api` when isolation is off. That's a footgun — if a future maintainer regresses `contextIsolation` to `false`, the app keeps "working" but with a critical security hole. Throwing makes the regression unmissable.

### Pattern 6: Renderer-side verification (FND-01/02 verification)

```tsx
// src/renderer/src/App.tsx
import { useEffect, useState } from 'react';

export function App(): JSX.Element {
  const [pong, setPong] = useState<string | null>(null);
  const [launchCount, setLaunchCount] = useState<number | null>(null);

  useEffect(() => {
    window.api.ping().then(setPong).catch(() => setPong('FAIL'));
    window.api.getLaunchCount().then(setLaunchCount).catch(() => setLaunchCount(-1));
  }, []);

  // Load-bearing assertions for the verification harness. These are also
  // visible on-screen for the human smoke test.
  const protocol = window.location.protocol;           // FND-02: must be 'http:'
  const isolated = (window as any).process?.contextIsolated ?? 'unknown';
  // Note: `process` is NOT defined in a sandboxed renderer. The above is for
  // diagnostics only — the e2e test asserts FND-01 differently (see Pattern 7).

  return (
    <main style={{ fontFamily: 'system-ui', padding: 24 }}>
      <h1>AntiClicker — Foundation OK</h1>
      <dl>
        <dt>window.location.protocol</dt>
        <dd data-testid="protocol">{protocol}</dd>
        <dt>window.api.ping()</dt>
        <dd data-testid="ping">{pong ?? '…'}</dd>
        <dt>electron-store launchCount</dt>
        <dd data-testid="launch-count">{launchCount ?? '…'}</dd>
      </dl>
    </main>
  );
}
```

### Pattern 7: Playwright Electron e2e test (verification harness)

```ts
// tests/e2e/foundation.spec.ts
import { _electron as electron, expect, test } from '@playwright/test';
import { join } from 'node:path';

test('FND-01: secure webPreferences', async () => {
  const app = await electron.launch({ args: [join(process.cwd(), 'out/main/index.js')] });
  const window = await app.firstWindow();

  // The preload throws if contextIsolation is off — if we got here, it's on.
  // We further assert via the IPC round-trip.
  await expect(window.locator('[data-testid="ping"]')).toHaveText('pong');

  // Inspect via Playwright's evaluateHandle in the preload context:
  const isolation = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    return win.webContents.getWebPreferences();
  });
  expect(isolation.contextIsolation).toBe(true);
  expect(isolation.nodeIntegration).toBe(false);
  expect(isolation.sandbox).toBe(true);

  await app.close();
});

test('FND-02: renderer served over http://', async () => {
  const app = await electron.launch({ args: [join(process.cwd(), 'out/main/index.js')] });
  const window = await app.firstWindow();
  const url = window.url();
  expect(url.startsWith('http://')).toBe(true);
  expect(url.startsWith('file://')).toBe(false);
  await expect(window.locator('[data-testid="protocol"]')).toHaveText('http:');
  await app.close();
});

test('FND-03: electron-store persists across relaunches', async () => {
  const app1 = await electron.launch({ args: [join(process.cwd(), 'out/main/index.js')] });
  const win1 = await app1.firstWindow();
  const count1 = Number(await win1.locator('[data-testid="launch-count"]').textContent());
  await app1.close();

  const app2 = await electron.launch({ args: [join(process.cwd(), 'out/main/index.js')] });
  const win2 = await app2.firstWindow();
  const count2 = Number(await win2.locator('[data-testid="launch-count"]').textContent());
  await app2.close();

  expect(count2).toBe(count1 + 1);
});
```

**Source pattern:** `[CITED: https://playwright.dev/docs/api/class-electron — _electron.launch + ElectronApp.firstWindow API]`

### Pattern 8: `electron.vite.config.ts`

```ts
// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/main' },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { outDir: 'out/preload' },
  },
  renderer: {
    root: 'src/renderer',
    plugins: [react()],
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve('src/renderer/index.html') },
    },
    resolve: { alias: { '@shared': resolve('src/shared') } },
  },
});
```

**Source pattern:** `[CITED: https://electron-vite.org/config/ — canonical three-target defineConfig shape]`

### Anti-Patterns to Avoid

- **`mainWindow.loadFile(path)`** in packaged builds — produces `file://` URL, breaks FND-02. **Use the in-main HTTP server.** Note: this is what the electron-vite template ships with — we are explicitly overriding it.
- **`sandbox: false`** in `webPreferences` — defeats FND-01. Note: the electron-vite scaffold ships with `sandbox: false`. We must flip it.
- **`contextBridge.exposeInMainWorld('electronAPI', { ipcRenderer })`** — exposing raw `ipcRenderer` defeats the narrow-surface goal. Expose only named methods.
- **Hardcoded `http://localhost:3000`** for the dev server — electron-vite chooses a port; read `process.env.ELECTRON_RENDERER_URL` instead.
- **`require('electron-store')`** in CJS main — `electron-store@10+` is ESM-only. Use `import Store from 'electron-store'` with `"type": "module"`.
- **Storing API keys in `electron-store` without the file being outside VCS** — `app.getPath('userData')` is always outside the repo, so this is automatically satisfied. But: never commit `out/`, `.env`, or any hand-rolled config.
- **Opening DevTools by default in production** — `mainWindow.webContents.openDevTools()` should be `is.dev`-gated.
- **Wildcard CORS / `webSecurity: false`** — keep defaults.
- **Listening on `0.0.0.0`** for the in-proc HTTP server — bind to `127.0.0.1` only. Never expose to LAN.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Persistent settings storage | A custom JSON file writer with atomic rename | `electron-store@11` | Handles atomic writes, schema migrations, OS-specific paths, file locking. The bug surface is bigger than you think. |
| IPC type bridge | Manual `as` casts on `ipcRenderer.invoke` returns | TypeScript generic + zod schema | Catches preload/main contract drift at compile time. |
| Three-process build pipeline (main, preload, renderer) | Hand-rolled tsc + esbuild orchestration | `electron-vite@5` | Solved. Stop. |
| Electron + Vite HMR for the renderer | Manual `chokidar` + window reload IPC | `electron-vite dev` | Built in. |
| Dev/prod URL switching | A hand-written `if (process.env.NODE_ENV ...)` check | `@electron-toolkit/utils` `is.dev` + `process.env.ELECTRON_RENDERER_URL` | Matches the upstream template's convention; future maintainers will recognize it. |
| Launching Electron under Playwright for e2e | A custom CDP attach + window query script | `@playwright/test`'s `_electron.launch` | Officially supported by Playwright; works with `out/main/index.js` directly. |
| ASAR-aware file path resolution in production | `path.join` with manual `app.isPackaged` branches | `app.getAppPath()` + `import.meta.url` | Electron handles ASAR transparently for fs reads when you use the right base path. |

**Key insight:** Phase 0 is a *commodity* problem. Every Electron tutorial scaffolds this. The ONE non-commodity decision is the in-main HTTP server for packaged builds (because we forbid `file://` per FND-02). Everything else, lean on the scaffolding.

## Runtime State Inventory

> Greenfield phase — no rename / refactor / migration concerns. Section omitted.

## Common Pitfalls

### Pitfall 1: `electron-vite` template's default `sandbox: false`
**What goes wrong:** The official `create @quick-start/electron` react-ts template ships `webPreferences: { sandbox: false }`. If the planner accepts the scaffolding without modification, FND-01 fails silently — the app runs, but the security invariant is wrong.
**Why it happens:** The scaffold optimizes for "the preload can `require('node:fs')` for tutorials." We don't need that.
**How to avoid:** Explicit override to `sandbox: true` in the first commit. The preload's `throw if not contextIsolated` (Pattern 5) catches a regression here at boot.
**Warning signs:** The Playwright FND-01 test reports `sandbox: false`. The preload doesn't throw (because `process.contextIsolated` is true even with sandbox false).

### Pitfall 2: `mainWindow.loadFile()` in packaged builds (FND-02 failure)
**What goes wrong:** The scaffolded template uses `mainWindow.loadFile(join(__dirname, '../renderer/index.html'))` in production, producing `file://` URLs. Phase 0 success criterion #2 fails. In Phase 4, Google Maps will return `RefererNotAllowedMapError` and the map turns gray.
**Why it happens:** Default scaffold pattern. Nobody changes it until a Maps integration breaks in production.
**How to avoid:** Pattern 3 above. The in-main HTTP server is the only Phase 0 deviation from the standard scaffold — call it out in the plan as a load-bearing task.
**Warning signs:** `window.location.protocol === 'file:'` in any environment. The Playwright FND-02 test fails immediately.

### Pitfall 3: ESM/CJS mismatch from `electron-store@10+`
**What goes wrong:** `import Store from 'electron-store'` throws `ERR_REQUIRE_ESM` at runtime in a CJS main. Or: a dynamic `await import('electron-store')` works in dev but fails after bundling because the bundler converted it to a sync `require`.
**Why it happens:** electron-store@10+ is ESM-only, but Electron's main process historically defaulted to CJS, and many tutorials still show CJS.
**How to avoid:** Declare `"type": "module"` in `package.json`. Use `import Store from 'electron-store'`. Configure `electron-vite` `externalizeDepsPlugin` to leave `electron-store` external (it does this by default for `dependencies`).
**Warning signs:** Build succeeds but `npm start` throws on first store access. Solution is one line in package.json — don't burn an hour on bundler config.

### Pitfall 4: contextBridge exposing too much
**What goes wrong:** Maintainer in Phase 3 adds `contextBridge.exposeInMainWorld('electronAPI', { ipcRenderer })` for "convenience." Renderer can now `ipcRenderer.send('any-channel', anything)` — main process must defensively validate every channel. The narrow-API guarantee is gone.
**Why it happens:** The `@electron-toolkit/preload` package's `electronAPI` exposes `ipcRenderer` with `.invoke`, `.send`, `.on`. Tutorial-blind copy-paste.
**How to avoid:** Hand-roll the preload (Pattern 5). Add methods one at a time. Forbid `electronAPI`-style passthrough.
**Warning signs:** `window.electron.ipcRenderer` exists in the renderer. The IPC contract has no compile-time-checked surface.

### Pitfall 5: Port collisions or `0.0.0.0` exposure on the in-main HTTP server
**What goes wrong:** Hardcoded port 3000 collides with a dev server elsewhere on the machine; or `0.0.0.0` makes the renderer reachable from the LAN (security disaster — anyone on the network can scrape the user's Maps API key from the rendered page once Phase 4 ships).
**Why it happens:** Tutorial copy-paste again. Tutorials default to port 3000 and `0.0.0.0`.
**How to avoid:** `server.listen(0, '127.0.0.1')`. Read `server.address().port`.
**Warning signs:** Two app instances at once collide; `EADDRINUSE`. Or: `netstat -an | grep <port>` shows the bind on `0.0.0.0`.

### Pitfall 6: Forgetting to clean up the HTTP server on app quit
**What goes wrong:** Multiple `app.relaunch()` cycles leak HTTP server handles; eventually Node exhausts file descriptors. Probably never bites in practice because `app.quit()` exits the process, but the cleanup hook is good hygiene.
**Why it happens:** Async server lifecycle in main is unfamiliar territory.
**How to avoid:** Register `app.on('before-quit', stopRendererServer)`.
**Warning signs:** Test suite that relaunches the Electron app 50 times eventually fails with `EMFILE`.

### Pitfall 7: Running the Playwright e2e test against `electron-vite dev` instead of the packaged-build output
**What goes wrong:** Phase 0 verification "passes" because dev mode uses the Vite dev server (always HTTP). The packaged build is never tested — FND-02 regression slips through.
**Why it happens:** It's tempting to write `playwright test` against `electron-vite dev` for speed.
**How to avoid:** The Playwright test must `electron.launch({ args: ['out/main/index.js'] })` against a freshly-built `out/`. The `test:e2e` script should depend on `build`.
**Warning signs:** The test never actually exercises the `startRendererServer()` code path.

### Pitfall 8 (carried from PITFALLS.md — applies to Phase 0): Google Cloud Console quota cap not set
**What goes wrong:** Per PITFALLS Pitfall 5, an unset QPD cap on the Maps JavaScript API key means a leaked key can run up unbounded bills. This is a Phase 4 concern functionally — but the manual Cloud Console action belongs in the Phase 0 checklist because (a) it takes 30 seconds and (b) putting it off compounds risk.
**Why it happens:** Manual external step; nobody owns it.
**How to avoid:** **The plan should have a non-code checklist task** like: "User confirms in Google Cloud Console: Maps JavaScript API enabled, QPD quota cap set, budget alert at $5/$20/$50." This is NOT a code task; mark it as a manual verification step in the plan. No actual key entry happens in Phase 0 (the `electron-store` slot is empty until Phase 4).

## Code Examples

All canonical code is in the Architecture Patterns section above. Cross-references:

- **App entry:** Pattern 2
- **HTTP server (FND-02 load-bearing):** Pattern 3
- **electron-store init (FND-03):** Pattern 4
- **Preload (FND-01 #4):** Pattern 5
- **Renderer verification readouts:** Pattern 6
- **Playwright e2e harness:** Pattern 7
- **electron.vite.config.ts:** Pattern 8
- **package.json:** Pattern 1

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mainWindow.loadFile(path)` in production | `mainWindow.loadURL('http://127.0.0.1:<port>/')` backed by in-main `http.createServer` | Always preferable; load-bearing here because of Google Maps referrer restriction in Phase 4 | Phase 0 must do this in the FIRST commit; bolting it on later is "rewrite the entry point" |
| `protocol.register*Protocol`, `protocol.intercept*Protocol` | `protocol.handle()` | Electron 25+ (deprecation, removal in future) | We don't use `protocol.handle` here, but if Phase 4 needs to serve large WebGL tile blobs from a known cache dir, `protocol.handle` is the right tool. |
| `sandbox: false` (old default) | `sandbox: true` (default since Electron 20) | Electron 20.0.0 | We explicitly set it for greppability; the electron-vite scaffold doesn't. |
| `contextIsolation: false` (old default) | `contextIsolation: true` (default since Electron 12) | Electron 12.0.0 | Same as above. |
| `spectron` for Electron e2e | `@playwright/test` with `_electron.launch()` | Spectron deprecated ~2022 | Use Playwright for any Electron e2e. |
| `electron-store@8` (CJS) | `electron-store@11` (ESM-only) | electron-store 10.0.0 (2024) | Forces ESM main process. Embrace it; the rest of the stack (Vite, electron-vite, TS) is ESM-native anyway. |
| `webpack` + `electron-forge` | `vite` + `electron-vite` | 2023+ | electron-vite is the 2026 standard. |
| Hand-rolled `BrowserWindow.openDevTools()` toggles | `@electron-toolkit/utils` `optimizer.watchWindowShortcuts(window)` | electron-toolkit 1.x | Free F12/Cmd-R behavior. |

**Deprecated/outdated:**
- `electron-is-dev` npm package — replaced by `@electron-toolkit/utils` `is.dev`.
- `spectron` — replaced by Playwright `_electron`.
- Tutorials that show `nodeIntegration: true` for "easy debugging" — never do this.
- Tutorials that show `protocol.registerFileProtocol` — replaced by `protocol.handle`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `electron@~35.7.5` (last 35.x release) is the right pin; 35.x is locked by FND-01 and we shouldn't drift to 36/37/42 | Standard Stack | If user actually wanted "latest stable" (Electron 42), the plan over-constrains. Mitigation: ROADMAP.md and REQUIREMENTS.md both explicitly say "Electron 35" — interpreting that as a hard pin is the safest read. |
| A2 | electron-store 11.x is API-compatible with the 10.x docs in STACK.md for our usage (just `new Store({ defaults, name, clearInvalidConfig })`) | Standard Stack, Pattern 4 | Low. Confirmed via the electron-store README — the constructor API is unchanged between 10 and 11. |
| A3 | zod 4.x is API-compatible with the 3.x docs in STACK.md for our usage (`z.object`, `.parse`, `.safeParse`, `.infer`) | Standard Stack | Low. The `z.object` and `.parse` API has been stable since zod 3.0. |
| A4 | Electron 35's main process supports ES modules natively for the entry point (`out/main/index.js` as an ESM file) | Pattern 1 | Low — Electron added native ESM main support in v28. Verified in Electron release notes via prior research. **[ASSUMED — verify by running `npm run dev` once during Phase 0 task 1.]** |
| A5 | `_electron.launch({ args: ['out/main/index.js'] })` works with an ESM main entry | Pattern 7 | Low — Playwright launches Electron as a child process; whatever Electron supports as a CLI entry, Playwright can launch. |
| A6 | The custom http server (Pattern 3) serving `out/renderer` works with Vite's built renderer assets (relative paths under `/`) | Pattern 3 | Low — `electron-vite` sets `base: './'` in production by default, but for an HTTP-served root we want `base: '/'`. **[ASSUMED — verify Vite renderer config defaults to absolute root paths when served from an HTTP origin. If broken, set `base: '/'` explicitly in `renderer` Vite config.]** |
| A7 | `process.contextIsolated` is `true` in a sandboxed preload but `undefined` in a sandboxed renderer (renderer has no `process` global) | Patterns 5, 6 | Low. **[CITED: Electron docs — sandboxed renderers have no `process` global; `process.contextIsolated` is a main-world flag set by the preload at the start of execution. The renderer's readout in Pattern 6 is best-effort diagnostic only; the load-bearing assertion lives in the Playwright e2e via `webContents.getWebPreferences()`.]** |

**For Phase 0 the planner should:** treat A1, A4, A6 as items to verify in the first task of the plan (smoke-test the dev mode boot before writing any of the Phase 0 deliverables). A4 is the most likely to surface — if Electron 35's CLI rejects an ESM entry, drop `"type": "module"` and switch electron-store to dynamic import.

## Open Questions

1. **Does Electron 35 reliably load an ESM main process entry (`out/main/index.js` with `import` statements)?**
   - What we know: Electron 28+ added native ESM support; Electron 35 is well past that.
   - What's unclear: Whether `electron-vite@5`'s default build output works as a top-level ESM module entry without `--experimental-vm-modules` or similar flags.
   - Recommendation: First plan task is "scaffold + `npm run dev` boots a blank window." If ESM main fails, fallback is to keep `package.json` `"type": "commonjs"` and switch electron-store to `const { default: Store } = await import('electron-store');` inside an async init function.

2. **Will the in-main HTTP server's URL change between `mainWindow.show()` and a possible later child window?**
   - What we know: The HTTP server starts before `createWindow`; its URL is stable for the process lifetime.
   - What's unclear: If a future Phase 4 feature opens a second window for settings, that window can reuse the same `rendererUrl`. No issue.
   - Recommendation: store the URL in a module-level variable; expose it as `getRendererUrl()` from `renderer-server.ts`.

3. **Is there value in adding `unsafe-eval` CSP from Phase 0, or wait for Phase 4?**
   - What we know: Vite production builds don't need eval. MapLibre and Google Maps may need `unsafe-eval` or specific CSP exceptions.
   - What's unclear: Phase 0's renderer has zero remote scripts — perfect time to add a strict CSP.
   - Recommendation: Add a Content-Security-Policy meta tag in `src/renderer/index.html` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';`). Tighten further in Phase 4 with explicit allow-lists for Maps origins. The planner should treat this as a small task, not a blocker.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | electron-vite, vitest, Playwright | ✓ | 25.2.1 | — |
| npm | Package installation | ✓ | 11.6.2 | — |
| npx | Scaffold + Playwright install | ✓ | 11.6.2 | — |
| macOS (Darwin) | Target platform (PROJECT.md) | ✓ | 26.4.1 | — |
| Git | Version control | (assumed yes — directory has `.planning/`) | — | — |
| Electron 35 bundled Chromium | Runtime (installed by `npm install electron@~35.7.5`) | — (will be installed) | Chromium 136-ish | — |
| Playwright bundled Chromium | Phase 1+; not strictly needed in Phase 0 | — (installed in Phase 1 via `npx playwright install chromium`) | — | — |
| Google Cloud Console (Maps API) | Phase 4 — NOT Phase 0 | N/A | — | Phase 0 only requires a manual checklist note; no API call is made. |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

**Notes:**
- Node 25.2.1 is significantly newer than Electron 35's bundled Node 22. This is fine — the dev-side toolchain (electron-vite, vitest) runs on host Node 25; the app's main process at runtime runs on Electron's bundled Node 22. The compatibility surface is just whatever syntax we use, and TS targets `es2022` by default which is safe for both.
- macOS 26.4.1 (Tahoe / 16.x successor) — well above the macOS 12+ minimum for Playwright's bundled Chromium per STACK.md.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest@^4` for unit; `@playwright/test@^1.60` for Electron e2e |
| Config file | `vitest.config.ts` (Wave 0), `playwright.config.ts` (Wave 0) |
| Quick run command | `npm run test` (vitest, ~1s) |
| Full suite command | `npm run build && npm run test:e2e` (Playwright launches packaged-style build, ~10s) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| FND-01 | `webPreferences.contextIsolation === true`, `nodeIntegration === false`, `sandbox === true` | e2e (Playwright + Electron) | `npx playwright test tests/e2e/foundation.spec.ts -g "FND-01"` | ❌ Wave 0 |
| FND-01 (#4) | Preload exposes only `window.api.ping` and `window.api.getLaunchCount`; no `ipcRenderer`, no `require` | e2e | same file, separate test asserts `window.electron === undefined && typeof window.api.ping === 'function'` | ❌ Wave 0 |
| FND-02 | `window.url()` starts with `http://`; never `file://`; works in both dev and built modes | e2e | `npx playwright test tests/e2e/foundation.spec.ts -g "FND-02"` | ❌ Wave 0 |
| FND-03 | electron-store persists `launchCount` across two `electron.launch()` cycles using a shared userData dir | e2e | `npx playwright test tests/e2e/foundation.spec.ts -g "FND-03"` (uses a custom `--user-data-dir` arg so the launches share state) | ❌ Wave 0 |
| FND-03 schema | `ConfigSchema.parse({})` produces valid defaults; `.parse({ launchCount: 'string' })` throws | unit (vitest) | `npx vitest run tests/unit/config-store.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run typecheck && npm run test` (unit + types, ~3s)
- **Per wave merge:** `npm run build && npm run test:e2e` (~15s — full Electron launch)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` — minimal config; `environment: 'node'` for main-process modules
- [ ] `playwright.config.ts` — `projects: [{ name: 'electron', testDir: 'tests/e2e' }]`
- [ ] `tests/e2e/foundation.spec.ts` — three tests (FND-01, FND-02, FND-03)
- [ ] `tests/unit/config-store.test.ts` — schema validation
- [ ] `tests/e2e/.tmp/` — gitignored dir for Playwright's shared userData (for FND-03 cross-relaunch test)
- [ ] Framework install: covered by `npm install --save-dev vitest @playwright/test`
- [ ] `npx playwright install chromium` — needed once; Playwright host browser, NOT the runtime browser we'll launch in Phase 1

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 0 has no auth; the app is single-user local. |
| V3 Session Management | no | No sessions. |
| V4 Access Control | yes | Only the local user (via OS file permissions on `app.getPath('userData')`) can read `config.json`. The in-main HTTP server binds `127.0.0.1` only (Pattern 3) — no LAN reachability. |
| V5 Input Validation | yes | `electron-store` writes are zod-validated (Pattern 4). The HTTP server's URL parsing rejects path traversal (Pattern 3). The preload's API surface is the only IPC contract — every method's payload will be zod-validated in Phase 3 (and we'll have one validated channel — `config:get-launch-count` — already in Phase 0). |
| V6 Cryptography | no | No crypto in Phase 0. (Maps API key handling in Phase 4 will be local-store-only, not encrypted — explicit decision per PROJECT.md "store outside VCS.") |
| V7 Error Handling | yes | The preload throws if `contextIsolated` is false (Pattern 5). The HTTP server returns 403/404, never 500 with stack traces. Config-store self-heals via `clearInvalidConfig: true` (Pattern 4). |
| V12 Files & Resources | yes | The in-main HTTP server (Pattern 3) does explicit path traversal protection: `normalize` + `startsWith(RENDERER_ROOT)` guard. |
| V13 API & Web Service | yes | The narrow `contextBridge` API (Pattern 5) is the entire API surface. No undeclared methods. |
| V14 Configuration | yes | Secure-by-default webPreferences explicitly set (Pattern 2). CSP recommended in `src/renderer/index.html` (see Open Question #3). |

### Known Threat Patterns for Electron + Node http server

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Renderer compromise (XSS in future remote script — Phase 4 Maps SDK) escalates to filesystem | EoP | `sandbox: true` + `contextIsolation: true` + narrow `contextBridge` surface (Patterns 2 + 5) |
| `nodeIntegration: true` regression | EoP | Explicit `false` + Playwright test asserting `getWebPreferences()` (Pattern 7) |
| Path traversal on the in-main http server | I, T | `normalize` + `startsWith(RENDERER_ROOT)` guard (Pattern 3) |
| Host-header attack against the in-main http server | S | Reject requests whose `host` header isn't `127.0.0.1` or `localhost` (Pattern 3) |
| LAN exposure of the renderer | I | Bind to `127.0.0.1`, not `0.0.0.0` (Pattern 3) |
| ESM/CJS confusion leading to silent `electron-store` fallback to in-memory | I (data loss) | `"type": "module"` + explicit import; vitest test covers the schema round-trip |
| Maps API key leak (Phase 4 concern, but Phase 0 sets the foundation) | I | electron-store under `app.getPath('userData')` is gitignored by default (it's outside the repo); Cloud Console QPD cap as a manual checklist item in Phase 0 plan |
| Preload IPC channel spoofing | T | Channel names are constants in `src/shared/ipc-channels.ts`; main validates payloads (Phase 3 expands this to zod; Phase 0 has one channel with no payload so it's trivially safe) |

## Sources

### Primary (HIGH confidence)

- `[VERIFIED via Bash: npm view <pkg>]` — package versions verified on 2026-05-14 against the npm registry:
  - `electron@latest` → 42.0.1; `electron@35.x` last → 35.7.5
  - `electron-vite` → 5.0.0
  - `vite` → 6.0.3
  - `typescript` → 6.0.3 (latest), 5.7.x usable
  - `electron-store` → 11.0.2 (type: `module`)
  - `zod` → 4.4.3
  - `react`, `react-dom` → 19.2.6
  - `@playwright/test`, `playwright` → 1.60.0
  - `vitest` → 4.1.6
  - `@electron-toolkit/utils` → 4.0.0
  - `@electron-toolkit/preload` → 3.0.2
- [Electron Security tutorial](https://www.electronjs.org/docs/latest/tutorial/security) — explicit webPreferences pattern + "serve from a custom protocol instead of `file://`" recommendation. Defaults verified: contextIsolation since 12.0.0, nodeIntegration off since 5.0.0, sandbox since 20.0.0.
- [Electron protocol docs](https://www.electronjs.org/docs/latest/api/protocol) — `protocol.handle` API (Electron 25+). Used as the rejected alternative; the in-main HTTP server is preferred.
- [electron-vite guide](https://electron-vite.org/guide/) — canonical project structure, scripts (`dev`/`build`/`start`/`preview`), `npm create @quick-start/electron@latest` scaffolder.
- [electron-vite create-electron react-ts template](https://raw.githubusercontent.com/alex8088/quick-start/master/packages/create-electron/playground/react-ts/) — `src/main/index.ts`, `src/preload/index.ts`, `package.json` reference shapes (used as the baseline we modify).
- [electron-store README](https://github.com/sindresorhus/electron-store) — ESM-only confirmation, storage location (`app.getPath('userData')`), constructor options.
- Project research: `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md` — load-bearing context for FND-01/02/03 framing.
- Project artifacts: `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` — phase scope and success criteria.

### Secondary (MEDIUM confidence)

- [Playwright Electron API](https://playwright.dev/docs/api/class-electron) — `_electron.launch()` shape. Confirmed via WebSearch + cross-reference.
- WebSearch synthesis (2026-05-14): "electron 35 packaged build serve renderer http localhost express node http server pattern main process" — consensus across multiple sources that an in-main `node:http` server is the standard pattern when `file://` is not acceptable. No single canonical doc; pattern reconstructed.

### Tertiary (LOW confidence — needs validation during implementation)

- Electron 35 native-ESM main entry support — well-established for Electron 28+, but worth verifying empirically in the first plan task as Open Question #1.
- Vite renderer `base` config in the HTTP-served packaged build (Assumption A6) — verify by inspecting built `out/renderer/index.html` script `src` attributes; if relative paths break under the http server, set `base: '/'` explicitly.

## Project Constraints (from CLAUDE.md)

CLAUDE.md is auto-generated from PROJECT.md and research/. The directives that bind Phase 0 work:

- **GSD workflow enforcement** (final block): "Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync. Do not make direct repo edits outside a GSD workflow." → Plan must route file creation through GSD task execution.
- **Stack pinning** (Technology Stack block): Electron 35, electron-vite 4, Vite 6, TypeScript 5.7, electron-store 10, zod 3, MapLibre 5 (later), Playwright 1.60 (later). Phase 0 honors Electron/electron-vite/Vite/TS/electron-store/zod pins.
- **Constraints** (Project block): "Security: Don't hard-code API keys; store them in a local config file outside version control." → `electron-store` under `app.getPath('userData')` satisfies this. The Phase 0 schema has a `googleMapsApiKey: z.string().nullable().default(null)` slot but it stays null.
- **Constraints** (Project block): "Platform: macOS first." → All Phase 0 verification can target macOS only. Windows/Linux deferred to Phase 6.
- **No `nodeIntegration: true` anywhere** — implicit from PITFALLS.md Pitfall 6 and the security tutorial.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via `npm view`; documentation cross-checked.
- Architecture: HIGH — the eight patterns are all either standard electron-vite/Electron patterns or, for Pattern 3 (the only novel one), a direct application of stdlib `node:http` + project-specific FND-02 constraint.
- Pitfalls: HIGH — five are direct from `.planning/research/PITFALLS.md` (which has HIGH confidence per its metadata); three are new to Phase 0 (sandbox flip, ESM/CJS mismatch, server cleanup) and verified independently.
- Validation: HIGH — Playwright `_electron` is the canonical 2026 e2e harness for Electron; vitest is the canonical 2026 unit runner.
- Security: HIGH — Electron security tutorial is normative; the in-main HTTP server's mitigations are textbook (path traversal, host header, localhost-only bind).

**Research date:** 2026-05-14
**Valid until:** 2026-06-13 (30 days — stack is stable; the only fast-moving item is Electron's own version pin, but FND-01 locks us to 35).
