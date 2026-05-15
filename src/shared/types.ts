// src/shared/types.ts
//
// Shared IPC payload types — imported by main (ipc.ts handlers) and preload.
// Kept pure-type-only so preload (sandboxed, no Node) can safely import.
//
// AppConfig is the runtime concern of main's config-store.ts only and is
// not re-exported here — that avoids forcing the renderer's tsconfig to
// reach into src/main (the renderer never sees the persisted shape; it
// only reads `launchCount` via the typed window.api.getLaunchCount()).

/** IPC: `window.api.ping()` resolves to the literal string `'pong'`. */
export type PingResponse = 'pong';

/** IPC: `window.api.getLaunchCount()` resolves to the persisted launch count. */
export type LaunchCount = number;
