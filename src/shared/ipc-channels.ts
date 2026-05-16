// src/shared/ipc-channels.ts
//
// Single source of truth for IPC channel names. Every channel string used by
// main (ipc.ts) and preload (00-05) MUST come from this object — passing a
// raw string anywhere is a typo waiting to happen, and a typo'd channel is a
// silent no-op (ipcMain.handle never fires; the renderer awaits forever).
//
// `as const` pins the string literals at the type level so `IpcChannel`
// resolves to the union `'ping' | 'config:get-launch-count'` rather than
// `string` — that turns a typo into a compile error.
//
// Phase 0 keeps the surface intentionally minimal: every channel is attack
// surface, so we only register what FND verification demands. Phase 3 adds
// the launcher channels below.

export const IpcChannels = {
  // Phase 0 — foundation verification
  Ping: 'ping',
  ConfigGetLaunchCount: 'config:get-launch-count',
  // Phase 3 — launcher IPC (renderer → main invoke channels)
  LauncherLaunch: 'launcher:launch',
  LauncherSetGeo: 'launcher:set-geo',
  LauncherClose: 'launcher:close',
  LauncherList: 'launcher:list',
  // Phase 3 — launcher IPC (main → renderer push channel)
  LauncherInstanceClosed: 'launcher:instance-closed',
  // Phase 6 — verification + first-run
  ConfigGetFirstRunSeen: 'config:get-first-run-seen',
  ConfigMarkFirstRunSeen: 'config:mark-first-run-seen',
  LauncherVerifySpoof: 'launcher:verify-spoof',
  LauncherOpenVerificationUrls: 'launcher:open-verification-urls',
  // Phase 7 — persistence + Google Maps
  ConfigGetRecentPins: 'config:get-recent-pins',
  ConfigSetRecentPins: 'config:set-recent-pins',
  ConfigGetFavorites: 'config:get-favorites',
  ConfigSetFavorites: 'config:set-favorites',
  ConfigGetMapsApiKey: 'config:get-maps-api-key',
  ConfigSetMapsApiKey: 'config:set-maps-api-key',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
