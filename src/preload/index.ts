// src/preload/index.ts
//
// FND-01 invariant #4: contextBridge preload exposes ONLY a narrow typed API
// surface — no raw ipcRenderer, no require, no electronAPI passthrough. The
// renderer's `window.api` has exactly SEVEN methods, all backed by typed
// IpcChannels constants from the shared module.
//
// Phase 0 surface: ping, getLaunchCount
// Phase 3 surface: launch, setGeo, close, list, onInstanceClosed
//
// onInstanceClosed uses the push-event pattern (ipcRenderer.on + removeListener)
// instead of ipcRenderer.invoke. The returned () => void is the unsubscribe
// function — React callers return it from useEffect cleanup.

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import { IpcChannels } from '../shared/ipc-channels.js';

const api = {
  // Phase 0 — foundation verification
  ping: (): Promise<'pong'> => ipcRenderer.invoke(IpcChannels.Ping),
  getLaunchCount: (): Promise<number> =>
    ipcRenderer.invoke(IpcChannels.ConfigGetLaunchCount),

  // Phase 3 — launcher invoke methods
  /** Launch a new Chromium instance at the given coordinates. */
  launch: (coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  }): Promise<{ id: string; coords: { latitude: number; longitude: number; accuracy?: number }; userDataDir: string }> =>
    ipcRenderer.invoke(IpcChannels.LauncherLaunch, coords),

  /** Push new coordinates to a running instance (no relaunch). */
  setGeo: (
    id: string,
    coords: { latitude: number; longitude: number; accuracy?: number },
  ): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LauncherSetGeo, { id, coords }),

  /** Close a single running instance by id. */
  close: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LauncherClose, { id }),

  /** Return a snapshot list of all running instances. */
  list: (): Promise<Array<{ id: string; coords: { latitude: number; longitude: number; accuracy?: number }; userDataDir: string }>> =>
    ipcRenderer.invoke(IpcChannels.LauncherList),

  // Phase 3 — push subscription (main → renderer)
  /**
   * Subscribe to instance-closed events. The launcher fires this when a
   * Chrome window is closed (by the user or via close()). Returns an
   * unsubscribe function suitable for useEffect cleanup.
   */
  onInstanceClosed: (cb: (id: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, id: string): void => cb(id);
    ipcRenderer.on(IpcChannels.LauncherInstanceClosed, listener);
    return () =>
      ipcRenderer.removeListener(IpcChannels.LauncherInstanceClosed, listener);
  },
} as const;

export type Api = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  throw new Error(
    'contextIsolation is off — refusing to expose api without isolation',
  );
}
