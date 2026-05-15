// src/preload/index.ts
//
// FND-01 invariant #4: contextBridge preload exposes ONLY a narrow typed API
// surface — no raw ipcRenderer, no require, no electronAPI passthrough. The
// renderer's `window.api` has exactly two methods, both backed by typed
// IpcChannels constants from the shared module.

import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels.js';

const api = {
  ping: (): Promise<'pong'> => ipcRenderer.invoke(IpcChannels.Ping),
  getLaunchCount: (): Promise<number> =>
    ipcRenderer.invoke(IpcChannels.ConfigGetLaunchCount),
} as const;

export type Api = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  throw new Error(
    'contextIsolation is off — refusing to expose api without isolation',
  );
}
