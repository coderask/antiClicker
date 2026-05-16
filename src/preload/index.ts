// src/preload/index.ts
//
// FND-01 invariant #4: contextBridge preload exposes ONLY a narrow typed API
// surface — no raw ipcRenderer, no require, no electronAPI passthrough.
//
// Phase 0 surface: ping, getLaunchCount
// Phase 3 surface: launch, setGeo, close, list, onInstanceClosed
// Phase 6 surface: verifySpoof, openVerificationUrls, markFirstRunSeen, getFirstRunSeen
// Phase 7 surface: getRecentPins, setRecentPins, getFavorites, setFavorites, getMapsApiKey, setMapsApiKey
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

  // Phase 6 — verification + first-run
  /** Return whether the user has seen the first-run scope overlay. */
  getFirstRunSeen: (): Promise<boolean> =>
    ipcRenderer.invoke(IpcChannels.ConfigGetFirstRunSeen),

  /** Persist that the user has dismissed the first-run scope overlay. */
  markFirstRunSeen: (): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ConfigMarkFirstRunSeen),

  /**
   * Verify that a running instance's geolocation matches the expected coords.
   * Returns { reported: {lat, lng}, expected: {lat, lng}, match: boolean }.
   */
  verifySpoof: (
    id: string,
  ): Promise<{
    reported: { lat: number; lng: number };
    expected: { lat: number; lng: number };
    match: boolean;
  }> => ipcRenderer.invoke(IpcChannels.LauncherVerifySpoof, { id }),

  /** Open browserleaks.com geo/ip/timezone tabs in the launched Chrome. */
  openVerificationUrls: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.LauncherOpenVerificationUrls, { id }),

  // Phase 7 — persistence + Maps API key
  /** Load the persisted recent pins ring buffer. */
  getRecentPins: (): Promise<Array<{ latitude: number; longitude: number; timestamp: number }>> =>
    ipcRenderer.invoke(IpcChannels.ConfigGetRecentPins),

  /** Persist the recent pins ring buffer. */
  setRecentPins: (pins: Array<{ latitude: number; longitude: number; timestamp: number }>): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ConfigSetRecentPins, pins),

  /** Load the persisted favorites list. */
  getFavorites: (): Promise<Array<{ id: string; name: string; latitude: number; longitude: number; createdAt: number }>> =>
    ipcRenderer.invoke(IpcChannels.ConfigGetFavorites),

  /** Persist the favorites list. */
  setFavorites: (favs: Array<{ id: string; name: string; latitude: number; longitude: number; createdAt: number }>): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ConfigSetFavorites, favs),

  /** Get the stored Google Maps API key (or null if not set). */
  getMapsApiKey: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.ConfigGetMapsApiKey),

  /** Set or clear the Google Maps API key (null to clear). */
  setMapsApiKey: (key: string | null): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ConfigSetMapsApiKey, key),
} as const;

export type Api = typeof api;

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api);
} else {
  throw new Error(
    'contextIsolation is off — refusing to expose api without isolation',
  );
}
