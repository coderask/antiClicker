// src/launcher/index.ts
//
// Phase 2 Multi-Instance Launcher Module — public API.
//
// createLauncher() returns a Launcher that can manage N concurrent isolated
// Chromium instances, each with its own ephemeral profile directory and
// geolocation override. Live coordinate updates (setGeo) and event-driven
// cleanup (on('instance-closed')) are supported.
//
// Design notes (see .planning/phases/02-multi-instance-launcher/02-RESEARCH.md):
//   - Pitfall 1 closed: permissions: ['geolocation'] in constructor (atomic grant)
//   - Pitfall 2 closed: launchPersistentContext (context-scoped override)
//   - Pitfall 3 closed: unique tmpdir per instance, deleted on close
//   - Pitfall 8 non-issue: Playwright manages CDP port internally; no --remote-debugging-port
//   - Cleanup is best-effort: close handler never throws

import { rmSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';
import { ZodCoordsSchema } from '../shared/coords-schema.js';
import { Registry } from './registry.js';

// ---------------------------------------------------------------------------
// Public types (re-exported for callers)
// ---------------------------------------------------------------------------

export type { Coords } from '../shared/coords-schema.js';

/** Opaque short identifier for a launched instance (first 8 hex chars of a UUID). */
export type InstanceId = string;

/** Options for launching a new instance. headless defaults to false (production). */
export type LaunchOptions = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  /** Override headless mode. Set true in tests to suppress visible windows. */
  headless?: boolean;
};

/** Public snapshot of a running instance — does NOT expose the BrowserContext. */
export type Instance = {
  id: InstanceId;
  coords: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  userDataDir: string;
};

/** Launcher interface — returned by createLauncher(). */
export interface Launcher {
  /** Launch a new Chromium instance at the given coordinates. */
  launch(opts: LaunchOptions): Promise<Instance>;
  /** Push new coordinates to a running instance (no relaunch). */
  setGeo(id: InstanceId, coords: { latitude: number; longitude: number; accuracy?: number }): Promise<void>;
  /** Close a single instance (fires 'instance-closed' event). */
  close(id: InstanceId): Promise<void>;
  /** Close all running instances in parallel. */
  closeAll(): Promise<void>;
  /** Return a snapshot list of all running instances. */
  list(): Instance[];
  /** Subscribe to lifecycle events. */
  on(event: 'instance-closed', handler: (id: InstanceId) => void): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a new Launcher instance. Each Launcher maintains its own registry;
 * launchers are independent of each other.
 */
export function createLauncher(): Launcher {
  const registry = new Registry();
  const listeners = new Map<string, Array<(id: InstanceId) => void>>();

  function emit(event: 'instance-closed', id: InstanceId): void {
    const handlers = listeners.get(event) ?? [];
    for (const h of handlers) {
      try { h(id); } catch { /* listener errors must not crash the launcher */ }
    }
  }

  return {
    async launch(opts: LaunchOptions): Promise<Instance> {
      // Validate coordinates before any OS or Playwright calls
      const parsed = ZodCoordsSchema.parse({
        latitude: opts.latitude,
        longitude: opts.longitude,
        accuracy: opts.accuracy,
      });

      const id: InstanceId = randomUUID().replace(/-/g, '').slice(0, 8);
      const userDataDir = await mkdtemp(join(tmpdir(), 'anticlicker-profile-'));

      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: opts.headless ?? false,
        geolocation: {
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          accuracy: parsed.accuracy ?? 50,
        },
        permissions: ['geolocation'],
        args: ['--no-first-run', '--no-default-browser-check'],
      });

      const entry = {
        id,
        context,
        userDataDir,
        coords: parsed,
      };

      registry.add(entry);

      // Wire close event for automatic cleanup
      context.on('close', () => {
        registry.remove(id);
        try {
          rmSync(userDataDir, { recursive: true, force: true });
        } catch {
          // Best-effort — dir may already be gone or locked (Windows)
        }
        emit('instance-closed', id);
      });

      return {
        id,
        coords: { ...parsed },
        userDataDir,
      };
    },

    async setGeo(id: InstanceId, coords: { latitude: number; longitude: number; accuracy?: number }): Promise<void> {
      const parsed = ZodCoordsSchema.parse(coords);
      const entry = registry.getOrThrow(id);
      await entry.context.setGeolocation({
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        accuracy: parsed.accuracy ?? 50,
      });
      registry.updateCoords(id, parsed);
    },

    async close(id: InstanceId): Promise<void> {
      const entry = registry.getOrThrow(id);
      // context.close() triggers the 'close' event handler above,
      // which handles registry removal, dir cleanup, and event emission.
      await entry.context.close();
    },

    async closeAll(): Promise<void> {
      const entries = Array.from(registry.entries());
      // Use allSettled so one failure doesn't block others
      await Promise.allSettled(entries.map((e) => e.context.close()));
    },

    list(): Instance[] {
      return registry.list();
    },

    on(event: 'instance-closed', handler: (id: InstanceId) => void): void {
      const existing = listeners.get(event) ?? [];
      existing.push(handler);
      listeners.set(event, existing);
    },
  };
}
