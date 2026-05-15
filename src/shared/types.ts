// src/shared/types.ts
//
// Shared type surface imported by main (ipc.ts handlers), preload (00-05
// contextBridge), and renderer. Keeping these in `src/shared/` (aliased to
// `@shared` in electron.vite.config.ts) lets every tier import the same
// definitions without creating a circular reference between main and preload.
//
// `AppConfig` is re-exported via `import type` so this module stays a pure
// type-only module — no runtime import of `./config-store.js` is emitted,
// which means preload (sandboxed, no Node) can safely import from here.
//
// Forward reference: `../main/config-store.js` lands in plan 00-04. Until
// that file exists, this re-export resolves only at type-check time; the
// runtime bundle has no reference to it. Once 00-04 lands, `tsc --noEmit`
// will type-check end-to-end.

import type { AppConfig } from '../main/config-store.js';

export type { AppConfig };

/** IPC: `window.api.ping()` resolves to the literal string `'pong'`. */
export type PingResponse = 'pong';

/** IPC: `window.api.getLaunchCount()` resolves to the persisted launch count. */
export type LaunchCount = number;
