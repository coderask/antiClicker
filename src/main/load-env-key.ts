// src/main/load-env-key.ts
//
// Inline .env.local parser — reads GOOGLE_MAPS_API_KEY without pulling in
// dotenv as a runtime dependency. One regex, one function.
//
// Returns null gracefully when:
//   - .env.local does not exist (packaged builds, fresh dev checkouts)
//   - .env.local exists but GOOGLE_MAPS_API_KEY is not set
//
// Security: the returned key is never logged or included in error messages.
// It is only written to electron-store by the caller (main/index.ts).

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnvKey(projectRoot: string): string | null {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) return null;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = /^GOOGLE_MAPS_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (m) return m[1].replace(/^["']|["']$/g, ''); // strip optional surrounding quotes
  }
  return null;
}
