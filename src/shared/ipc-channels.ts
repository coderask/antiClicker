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
// the launcher channels.

export const IpcChannels = {
  Ping: 'ping',
  ConfigGetLaunchCount: 'config:get-launch-count',
} as const;

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels];
