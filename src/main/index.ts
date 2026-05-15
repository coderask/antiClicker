// src/main/index.ts
//
// Electron main-process entry point — the load-bearing security boundary for
// the whole app. Every renderer in AntiClicker (Phase 0 placeholder, Phase 4
// map UI, the spoofed Chrome instances do NOT come through here) is born
// inside the BrowserWindow constructed below.
//
// FND-01 (security): the four webPreferences flags below are written
// explicitly even though Electron 35 already defaults three of them safely.
// Reason: they are greppable. A reviewer searching for `sandbox: true` in
// `src/` should find exactly one match — here — and trust that the
// invariant holds. The electron-vite scaffold ships with `sandbox: false`;
// we flip it (see 00-RESEARCH.md Pattern 2 / Anti-Patterns).
//
// FND-02 (HTTP-only): the renderer is NEVER served over the local-file URL
// scheme. In dev, electron-vite injects `ELECTRON_RENDERER_URL` (already
// http://). In packaged builds, we delegate to `startRendererServer()`
// (00-03) which binds an ephemeral 127.0.0.1 port. The forbidden
// BrowserWindow load-from-disk API is not called anywhere in this module
// — by construction.
//
// Wave-2 forward imports: `./renderer-server.js` lands in 00-03 and
// `./config-store.js` lands in 00-04. Both contracts are documented in the
// plan's <interfaces> block. Until those plans complete, this file does not
// type-check end-to-end; that is expected (wave 2 acceptance gate).

import { app, BrowserWindow } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { is } from '@electron-toolkit/utils';
import { startRendererServer, stopRendererServer } from './renderer-server.js';
import { initConfigStore } from './config-store.js';
import { registerIpc, closeLauncherIfAny } from './ipc.js';
import { sweepOrphanedProfiles } from './sweep.js';

// Re-export for tests that import from this module
export { sweepOrphanedProfiles };

// ESM has no __dirname global — derive it from import.meta.url.
const __dirname = dirname(fileURLToPath(import.meta.url));


async function createWindow(): Promise<void> {
  // Dev vs packaged URL switch — both branches yield an http(s):// URL so
  // FND-02 holds in either mode. Never falls through to the disk-load API.
  const rendererUrl =
    is.dev && process.env['ELECTRON_RENDERER_URL']
      ? process.env['ELECTRON_RENDERER_URL']
      : await startRendererServer();

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // shown on ready-to-show to avoid white-flash on slow paints
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true, // FND-01 — explicit (default since Electron 12)
      nodeIntegration: false, // FND-01 — explicit (default since Electron 5)
      sandbox: true,          // FND-01 — explicit; overrides electron-vite scaffold default
      webSecurity: true,      // belt-and-suspenders; default true, written for greppability
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  // Always loadURL — never the disk-load alternative (see FND-02 /
  // 00-RESEARCH.md Pitfall 4).
  await mainWindow.loadURL(rendererUrl);
}

app.whenReady().then(async () => {
  // Sweep orphaned profile dirs from prior crashes before launching anything.
  sweepOrphanedProfiles();

  // Initialize the persistent settings slot before any IPC handler can read
  // from it — ordering matters: registerIpc binds handlers that may call
  // getStore() on the first invoke.
  initConfigStore();
  registerIpc();
  await createWindow();

  // macOS dock-click / re-activate convention: re-open a window when the
  // app is reactivated with no windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

// Standard cross-platform lifecycle: quit on all-windows-closed except on
// macOS, where apps idle in the dock until Cmd-Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Cleanup the renderer HTTP server and any running launcher instances before the
// app exits (00-RESEARCH.md Pitfall 6 — leaking the listening socket across hot
// reloads in dev wedges the next launch). `before-quit` fires once even on
// multi-window quits. closeLauncherIfAny() is a no-op if no launcher was created.
app.on('before-quit', async () => {
  await stopRendererServer();
  await closeLauncherIfAny();
});

// Defense in depth: deny any window.open() from the renderer. Phase 0 has no
// legitimate use for popups; Phase 4 (map UI) likewise won't. If a future
// plan needs an external link, route it through shell.openExternal in main.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
