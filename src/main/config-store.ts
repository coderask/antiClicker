// src/main/config-store.ts
//
// FND-03 (persistence): electron-store wrapper with a zod schema gate at the
// type boundary. Phase 0's schema is intentionally minimal — exactly two
// fields, `launchCount` (the smoke proof read by the FND-03 e2e) and
// `googleMapsApiKey` (Phase 4 slot, default null). Single source of truth is
// zod; we do NOT pass a JSON Schema to the Store constructor.
//
// Phase 7 additions:
//   - recentPins: ring buffer of last 10 launched pins (persisted across restarts)
//   - favorites: user-starred pins with names (unlimited, capped at 100)

import Store from 'electron-store';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Schemas (exported for IPC validators and tests)
// ---------------------------------------------------------------------------

export const NamedCoordsSchema = z.object({
  id: z.string(),
  name: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  createdAt: z.number(), // unix ms
});

const RecentPinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timestamp: z.number(), // unix ms
});

export const ConfigSchema = z.object({
  launchCount: z.number().int().nonnegative().default(0),
  googleMapsApiKey: z.string().nullable().default(null),
  firstRunSeen: z.boolean().default(false),
  // Phase 7: persistent ring buffer (cap at 10 in renderer)
  recentPins: z.array(RecentPinSchema).default([]),
  // Phase 7: user-starred pins (cap at 100 in renderer)
  favorites: z.array(NamedCoordsSchema).default([]),
});

export type AppConfig = z.infer<typeof ConfigSchema>;
export type NamedCoords = z.infer<typeof NamedCoordsSchema>;
export type RecentPin = z.infer<typeof RecentPinSchema>;

let store: Store<AppConfig> | null = null;

export function initConfigStore(): Store<AppConfig> {
  if (store) return store;

  store = new Store<AppConfig>({
    name: 'config',
    defaults: ConfigSchema.parse({}),
    clearInvalidConfig: true,
  });

  const parsed = ConfigSchema.safeParse(store.store);
  if (!parsed.success) {
    store.store = ConfigSchema.parse({});
  }

  store.set('launchCount', (store.get('launchCount') ?? 0) + 1);

  return store;
}

export function getStore(): Store<AppConfig> {
  if (!store) {
    throw new Error('Config store not initialized — call initConfigStore() first');
  }
  return store;
}
