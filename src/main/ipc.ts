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
import { getStore, NamedCoordsSchema } from './config-store.js';
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

/** Schema for verify-spoof and open-verification-urls payloads — single id. */
export const VerifyPayloadSchema = z.object({
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
    try {
      return await getLauncher().launch(coords);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface actionable error if Playwright's bundled Chromium is missing
      if (/executable doesn't exist|chromium/i.test(msg)) {
        throw new Error('Chromium not found. Run: npx playwright install chromium');
      }
      throw err;
    }
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
  // Phase 6 handlers — verification + first-run
  // ------------------------------------------------------------------

  // Return whether the user has seen the first-run scope overlay.
  ipcMain.handle(IpcChannels.ConfigGetFirstRunSeen, (): boolean => {
    return getStore().get('firstRunSeen');
  });

  // Persist that the user has dismissed the first-run scope overlay.
  ipcMain.handle(IpcChannels.ConfigMarkFirstRunSeen, (): void => {
    getStore().set('firstRunSeen', true);
  });

  // Verify that a running instance's spoofed geolocation matches the expected coords.
  // Returns { reported: {lat, lng}, expected: {lat, lng}, match: boolean }
  ipcMain.handle(IpcChannels.LauncherVerifySpoof, async (_e, payload: unknown) => {
    const { id } = VerifyPayloadSchema.parse(payload);
    const launcher = getLauncher();
    const context = launcher.getContext(id);
    const instances = launcher.list();
    const instance = instances.find((i) => i.id === id);
    if (!instance) throw new Error(`Instance "${id}" not found`);

    const expectedLat = instance.coords.latitude;
    const expectedLng = instance.coords.longitude;

    // Get or open a page in the instance's context
    const pages = context.pages();
    const page = pages.length > 0 ? pages[0] : await context.newPage();

    // Evaluate geolocation in the spoofed Chrome.
    // The page.evaluate callback runs inside Chromium (DOM APIs available).
    // Cast to unknown first to bypass the Node tsconfig's missing DOM lib.
    type GeoResult = { lat: number; lng: number };
    const reported = (await page.evaluate(() => {
      return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as unknown as { geolocation: { getCurrentPosition: (ok: (p: any) => void, err: (e: any) => void, opts: any) => void } })
          .geolocation.getCurrentPosition(
            (pos: { coords: { latitude: number; longitude: number } }) =>
              resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            (e: { message: string }) => reject(new Error(e.message)),
            { enableHighAccuracy: false, timeout: 5000 },
          );
      });
    })) as GeoResult;

    const match =
      Math.abs(reported.lat - expectedLat) < 0.001 &&
      Math.abs(reported.lng - expectedLng) < 0.001;

    return {
      reported,
      expected: { lat: expectedLat, lng: expectedLng },
      match,
    };
  });

  // Open browserleaks verification URLs in the launched Chrome.
  ipcMain.handle(IpcChannels.LauncherOpenVerificationUrls, async (_e, payload: unknown) => {
    const { id } = VerifyPayloadSchema.parse(payload);
    const context = getLauncher().getContext(id);

    const pages = context.pages();
    const firstPage = pages.length > 0 ? pages[0] : await context.newPage();

    // Navigate existing tab to geo verification
    void firstPage.goto('https://browserleaks.com/geo').catch(() => undefined);

    // Open new tabs for IP and timezone
    const ipPage = await context.newPage();
    void ipPage.goto('https://browserleaks.com/ip').catch(() => undefined);

    const tzPage = await context.newPage();
    void tzPage.goto('https://browserleaks.com/timezone').catch(() => undefined);
  });

  // ------------------------------------------------------------------
  // Phase 7 handlers — persistence + Google Maps API key
  // ------------------------------------------------------------------

  // Inline schemas for the array payloads (mirrors ConfigSchema fields)
  const RecentPinArraySchema = z.array(
    z.object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      timestamp: z.number(),
    }),
  );
  const FavoritesArraySchema = z.array(NamedCoordsSchema);

  ipcMain.handle(IpcChannels.ConfigGetRecentPins, () => {
    return getStore().get('recentPins') ?? [];
  });

  ipcMain.handle(IpcChannels.ConfigSetRecentPins, (_e, payload: unknown) => {
    const pins = RecentPinArraySchema.parse(payload);
    getStore().set('recentPins', pins);
  });

  ipcMain.handle(IpcChannels.ConfigGetFavorites, () => {
    return getStore().get('favorites') ?? [];
  });

  ipcMain.handle(IpcChannels.ConfigSetFavorites, (_e, payload: unknown) => {
    const favs = FavoritesArraySchema.parse(payload);
    getStore().set('favorites', favs);
  });

  ipcMain.handle(IpcChannels.ConfigGetMapsApiKey, () => {
    return getStore().get('googleMapsApiKey') ?? null;
  });

  ipcMain.handle(IpcChannels.ConfigSetMapsApiKey, (_e, payload: unknown) => {
    // Accept string or null; never log the key value
    const key = z.string().nullable().parse(payload);
    getStore().set('googleMapsApiKey', key);
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
