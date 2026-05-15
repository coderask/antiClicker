// src/launcher/registry.ts
//
// In-memory registry of active Chromium instances. Pure logic — no Playwright
// imports. Keeps a Map<InstanceId, InstanceEntry> and exposes methods for the
// launcher factory to add/remove/query entries.
//
// The public `Instance` shape (id, coords, userDataDir) never exposes the raw
// BrowserContext — callers interact with instances via the Launcher interface
// methods only.

import type { BrowserContext } from 'playwright';
import type { Coords } from '../shared/coords-schema.js';

// These types are duplicated here to avoid a circular dependency with index.ts.
// index.ts re-exports them as the canonical public API.
type InstanceId = string;
type Instance = { id: InstanceId; coords: Coords; userDataDir: string };

/** Private registry entry — includes the Playwright context (not exported). */
export interface InstanceEntry {
  id: InstanceId;
  context: BrowserContext;
  userDataDir: string;
  coords: Coords;
}

export class Registry {
  private readonly _map = new Map<InstanceId, InstanceEntry>();

  /** Add a new entry. Throws if id already exists (logic error — never reuse IDs). */
  add(entry: InstanceEntry): void {
    if (this._map.has(entry.id)) {
      throw new Error(`Registry: duplicate instance ID "${entry.id}"`);
    }
    this._map.set(entry.id, entry);
  }

  /** Return the entry for id, or undefined if not found. */
  get(id: InstanceId): InstanceEntry | undefined {
    return this._map.get(id);
  }

  /**
   * Return the entry for id, or throw an `InstanceNotFoundError` if not found.
   * Used by setGeo / close where a missing ID is always a caller error.
   */
  getOrThrow(id: InstanceId): InstanceEntry {
    const entry = this._map.get(id);
    if (!entry) {
      const err = new Error(`Instance "${id}" not found in registry`);
      err.name = 'InstanceNotFoundError';
      throw err;
    }
    return entry;
  }

  /** Remove an entry. No-op if id is not present (safe for double-remove in close handlers). */
  remove(id: InstanceId): void {
    this._map.delete(id);
  }

  /** Update the stored coords for a running instance (called after setGeo succeeds). */
  updateCoords(id: InstanceId, coords: Coords): void {
    const entry = this._map.get(id);
    if (entry) {
      entry.coords = coords;
    }
  }

  /** Return the public Instance snapshot list (no context exposed). */
  list(): Instance[] {
    return Array.from(this._map.values()).map((e) => ({
      id: e.id,
      coords: { ...e.coords },
      userDataDir: e.userDataDir,
    }));
  }

  /** Current number of registered instances. */
  size(): number {
    return this._map.size;
  }

  /** All entries as an iterable (used by closeAll). */
  entries(): IterableIterator<InstanceEntry> {
    return this._map.values();
  }
}
