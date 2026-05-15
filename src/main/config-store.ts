// src/main/config-store.ts
//
// FND-03 (persistence): electron-store wrapper with a zod schema gate at the
// type boundary. Phase 0's schema is intentionally minimal — exactly two
// fields, `launchCount` (the smoke proof read by the FND-03 e2e) and
// `googleMapsApiKey` (Phase 4 slot, default null). Single source of truth is
// zod; we do NOT pass a JSON Schema to the Store constructor.

import Store from 'electron-store';
import { z } from 'zod';

export const ConfigSchema = z.object({
  launchCount: z.number().int().nonnegative().default(0),
  googleMapsApiKey: z.string().nullable().default(null),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

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
