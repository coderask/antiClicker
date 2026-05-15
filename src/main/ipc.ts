// src/main/ipc.ts
//
// IPC bootstrap — every main-side IPC handler for AntiClicker is registered here.
// `registerIpc()` is called exactly once from `app.whenReady()` in index.ts,
// after `initConfigStore()` so that handlers may safely call `getStore()`.
//
// Phase 0 surface is intentionally minimal: two handlers, both tied to FND
// verification. Every channel is attack surface — Phase 3 will add launcher
// channels then. Channel names come from `@shared/ipc-channels` so a typo
// becomes a compile error rather than a silent runtime hang (ipcRenderer
// .invoke waits forever on an unregistered channel).
//
// Handler contracts:
//   IpcChannels.Ping                 -> 'pong'   (round-trip smoke test)
//   IpcChannels.ConfigGetLaunchCount -> number   (persisted launch counter)

import { ipcMain } from 'electron';
import { getStore } from './config-store.js';
import { IpcChannels } from '../shared/ipc-channels.js';
import type { PingResponse, LaunchCount } from '../shared/types.js';

export function registerIpc(): void {
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
}
