// src/main/ipc.ts
//
// IPC bootstrap — every main-side IPC handler for AntiClicker is registered here.
// `registerIpc()` is called exactly once from `app.whenReady()` in index.ts,
// after `initConfigStore()` so that handlers may safely call `getStore()`.
//
// Phase 0 surface: two handlers tied to FND verification (Ping, ConfigGetLaunchCount).
// Phase 3 surface: four launcher handlers + instance-closed push bridge.
//
// Zod-at-the-boundary: every renderer→main payload is typed as `unknown` and
// parsed through a Zod schema before any launcher call. This ensures that a
// compromised or hacked renderer can never inject out-of-range coordinates or
// missing fields into the launcher. The launcher also validates via ZodCoordsSchema
// internally (defense-in-depth).
//
// Exported schemas (LaunchPayloadSchema, SetGeoPayloadSchema, ClosePayloadSchema)
// are tested in isolation by tests/unit/ipc-validation.test.ts without starting Electron.

import { ipcMain, BrowserWindow } from 'electron';
import { z } from 'zod';
import { getStore } from './config-store.js';
import { IpcChannels } from '../shared/ipc-channels.js';
import { ZodCoordsSchema } from '../shared/coords-schema.js';
import { createLauncher } from '../launcher/index.js';
import type { Launcher } from '../launcher/index.js';
import type { PingResponse, LaunchCount } from '../shared/types.js';

// ---------------------------------------------------------------------------
// Exported Zod schemas (tested in isolation by tests/unit/ipc-validation.test.ts)
// ---------------------------------------------------------------------------

/** Schema for launcher:launch payload — same shape as ZodCoordsSchema. */
export const LaunchPayloadSchema = ZodCoordsSchema;

/** Schema for launcher:set-geo payload — id + coords pair. */
export const SetGeoPayloadSchema = z.object({
  id: z.string(),
  coords: ZodCoordsSchema,
});

/** Schema for launcher:close payload — single id. */
export const ClosePayloadSchema = z.object({
  id: z.string(),
});

// ---------------------------------------------------------------------------
// Launcher singleton
// ---------------------------------------------------------------------------

let _launcher: Launcher | null = null;

/** Get-or-create the module-scope launcher singleton. */
function getLauncher(): Launcher {
  if (!_launcher) {
    _launcher = createLauncher();
  }
  return _launcher;
}

/**
 * Close all running launcher instances. Called from app.before-quit.
 * Safe to call even if the launcher was never initialized.
 */
export async function closeLauncherIfAny(): Promise<void> {
  if (_launcher) {
    await _launcher.closeAll();
  }
}

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

export function registerIpc(): void {
  // ------------------------------------------------------------------
  // Phase 0 handlers (FND verification — keep unchanged)
  // ------------------------------------------------------------------

  // FND-01 round-trip: preload's `window.api.ping()` invokes this channel
  // and asserts the response is the literal 'pong'. If contextIsolation,
  // sandbox, or the preload bridge is broken, this round trip fails.
  ipcMain.handle(IpcChannels.Ping, (): PingResponse => 'pong');

  // FND-03 persistence proof: returns the launchCount that was incremented
  // by initConfigStore() on this boot. The e2e test launches the app twice
  // and asserts count2 === count1 + 1.
  ipcMain.handle(IpcChannels.ConfigGetLaunchCount, (): LaunchCount => {
    const store = getStore();
    return store.get('launchCount');
  });

  // ------------------------------------------------------------------
  // Phase 3 handlers (launcher IPC, all payloads validated via Zod)
  // ------------------------------------------------------------------

  // Launch a new Chromium instance at the given coordinates.
  // Payload: { latitude, longitude, accuracy? }
  // Returns: Instance { id, coords, userDataDir }
  ipcMain.handle(IpcChannels.LauncherLaunch, async (_e, payload: unknown) => {
    const coords = LaunchPayloadSchema.parse(payload);
    return getLauncher().launch(coords);
  });

  // Push new coordinates to a running instance (no relaunch).
  // Payload: { id: string, coords: { latitude, longitude, accuracy? } }
  ipcMain.handle(IpcChannels.LauncherSetGeo, async (_e, payload: unknown) => {
    const { id, coords } = SetGeoPayloadSchema.parse(payload);
    return getLauncher().setGeo(id, coords);
  });

  // Close a single running instance by id.
  // Payload: { id: string }
  ipcMain.handle(IpcChannels.LauncherClose, async (_e, payload: unknown) => {
    const { id } = ClosePayloadSchema.parse(payload);
    return getLauncher().close(id);
  });

  // Return a snapshot list of all running instances (synchronous).
  // No payload.
  ipcMain.handle(IpcChannels.LauncherList, () => {
    return getLauncher().list();
  });

  // ------------------------------------------------------------------
  // Push bridge: launcher → renderer
  // Wire after all handlers are registered. The listener is added once
  // per registerIpc() call, which is called exactly once per app lifecycle.
  // ------------------------------------------------------------------
  getLauncher().on('instance-closed', (id) => {
    // Send to the first (and only) Electron window. Optional chaining guards
    // against the race where the Electron window is closed before a spawned
    // Chrome exits.
    BrowserWindow.getAllWindows()[0]?.webContents.send(
      IpcChannels.LauncherInstanceClosed,
      id,
    );
  });
}
