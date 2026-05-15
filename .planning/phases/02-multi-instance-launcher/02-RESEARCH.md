# Phase 2 Research: Multi-Instance Launcher Module

**Phase:** 02-multi-instance-launcher
**Researched:** 2026-05-15
**Status:** APPROVED — ready to implement

## Objective

Extract the Phase 1 CDP primitive (`launchPersistentContext` + geolocation override) into a
reusable `src/launcher/` module that supports N concurrent isolated Chrome instances with live
coordinate updates. Still no UI; validated entirely via tests.

---

## API Surface

### Published Interface

```typescript
export type Coords = { latitude: number; longitude: number; accuracy?: number };
export type LaunchOptions = Coords;
export type InstanceId = string;  // short uuid4 (first 8 hex chars)

export type Instance = {
  id: InstanceId;
  coords: Coords;
  userDataDir: string;
};

export interface Launcher {
  launch(opts: LaunchOptions): Promise<Instance>;
  setGeo(id: InstanceId, coords: Coords): Promise<void>;
  close(id: InstanceId): Promise<void>;
  closeAll(): Promise<void>;
  list(): Instance[];
  on(event: 'instance-closed', handler: (id: InstanceId) => void): void;
}

export function createLauncher(): Launcher;
```

### Module Layout

```
src/launcher/
  index.ts          — re-exports public API + createLauncher factory
  instance.ts       — InstanceEntry type + launchInstance() helper
  registry.ts       — Registry class: Map<InstanceId, InstanceEntry>
src/shared/
  coords-schema.ts  — ZodCoordsSchema (reused by launcher + future IPC)
```

---

## Key Implementation Decisions

### 1. launchPersistentContext per instance — proven pattern from Phase 1

```typescript
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  geolocation: { latitude, longitude, accuracy: accuracy ?? 50 },
  permissions: ['geolocation'],
  args: ['--no-first-run', '--no-default-browser-check'],
});
```

Each call creates a fully independent Chromium process with its own profile dir. Playwright
manages CDP connectivity and port assignment internally — **no `--remote-debugging-port` flag
needed**. This satisfies ROADMAP success criterion 3 ("ephemeral port" / no EADDRINUSE):
Playwright assigns its own internal CDP port per context without exposing it to the caller, and
the process registry never stores ports at all.

**Why not `--remote-debugging-port=0`?** Playwright's `launchPersistentContext` handles
transport setup internally. Injecting `--remote-debugging-port=0` is redundant and creates
surface area (reading `DevToolsActivePort`, managing port-to-instance mapping). The Playwright
abstraction is the right layer — trust it.

### 2. Profile isolation via unique tmpdir per instance

```typescript
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const userDataDir = await mkdtemp(join(tmpdir(), 'anticlicker-profile-'));
```

- Each instance gets `os.tmpdir()/anticlicker-profile-<random>` (6-char random suffix from Node).
- No two instances share a dir, so SingletonLock collisions (Pitfall 3) are impossible.
- `node:path.join` + `node:os.tmpdir()` are cross-platform — works on macOS, Windows, Linux.

### 3. Registry pattern — Map<InstanceId, InstanceEntry>

The launcher maintains an in-memory Map keyed by a short ID (crypto.randomUUID truncated to 8
hex chars). Each entry holds the Playwright BrowserContext (private — not exposed in the
`Instance` public type), the userDataDir string, and the current coords.

```typescript
type InstanceEntry = {
  id: InstanceId;
  context: BrowserContext;
  userDataDir: string;
  coords: Coords;
};
```

The `Instance` public type omits `context` — callers never hold a Playwright reference directly.
This lets us swap the automation layer without breaking callers.

### 4. context.on('close') — cleanup handler

```typescript
context.on('close', () => {
  registry.remove(id);                        // removes from Map
  rmSync(userDataDir, { recursive: true, force: true }); // best-effort rm
  emit('instance-closed', id);               // notify listeners
});
```

**Best-effort cleanup:** Wrap `rmSync` in try/catch. An instance close must NEVER throw —
profile directory deletion is best-effort. This prevents one bad cleanup from blocking others
during `closeAll()`.

**ROADMAP criterion 4:** The close event fires whether the user closes the window, Playwright
calls `context.close()`, or the process is killed (SIGTERM). The `context.on('close')`
callback is the canonical hook.

### 5. setGeo — live coordinate update without relaunch

```typescript
async setGeo(id: InstanceId, coords: Coords): Promise<void> {
  const entry = registry.get(id);             // throws if not found
  await entry.context.setGeolocation({
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy ?? 50,
  });
  registry.updateCoords(id, coords);          // keep in-memory state in sync
}
```

`context.setGeolocation()` is context-scoped (Phase 1 research, Pitfall 2 closed). It pushes
the new override to all open pages in the context. The next call to
`navigator.geolocation.getCurrentPosition()` on any page in that context reports the new coords.

### 6. Zod validation — shared CoordsSchema

```typescript
// src/shared/coords-schema.ts
import { z } from 'zod';

export const ZodCoordsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});
```

Validate every `LaunchOptions` and `setGeo` call before reaching Playwright. A `lat: 95` or
`lng: "foo"` from any caller returns a typed ZodError — never reaches CDP. Reused by Phase 3's
IPC validation layer.

---

## Port Handling — Why No Manual Port Layer Exists

ROADMAP success criterion 3 says: "Each instance uses an ephemeral debugging port; no two
instances ever collide on port 9222." This is satisfied **automatically** by Playwright's
`launchPersistentContext` — Playwright does NOT pass `--remote-debugging-port=9222` by default.
Internally, it uses an OS-assigned ephemeral port (equivalent to `--remote-debugging-port=0`)
on its own pipe-based transport. The port is never exposed to user code.

**No manual port layer is needed or desired.** Adding one (reading `DevToolsActivePort`,
tracking ports in the registry) would be an anti-pattern — it re-implements what Playwright
already handles correctly and introduces surface area for the exact collision bugs we want to
avoid. PITFALLS.md Pitfall 8 describes the manual-port failure mode; the mitigation is to
let Playwright own the transport, which this module does.

---

## Race Conditions — Concurrent Launches

`launch()` is `async`. Multiple concurrent calls are safe:
- Each call creates its own `userDataDir` (no shared mutable state in the tmpdir creation).
- Each call creates its own `BrowserContext` (Playwright manages OS resources independently).
- The registry `Map` is updated synchronously after `await chromium.launchPersistentContext`
  completes — no partial state is visible.

**One known race:** If `close(id)` is called while `setGeo(id)` is awaiting, the entry may be
gone by the time `setGeo` calls `registry.get(id)`. Mitigation: `setGeo` throws `InstanceNotFoundError`
on missing IDs — callers should catch this as a normal "instance already closed" race.

---

## Test Project Strategy — Playwright Config

The current `playwright.config.ts` has:
```
projects: [
  { name: 'electron', testDir: 'tests/e2e' },
  { name: 'cli',      testDir: 'tests/cli', testMatch: '**/*.spec.ts' },
]
```

**Decision: add a `launcher` Playwright project** pointing at `tests/launcher/`. This is
cleaner than widening `cli` — it keeps test directories independent, allows separate timeout
config (the 10-rapid-relaunch test needs 120s), and the project name appears in test output.

```typescript
{
  name: 'launcher',
  testDir: 'tests/launcher',
  testMatch: '**/*.spec.ts',
  timeout: 120_000,   // 10 rapid relaunches can take up to 2 min total
}
```

Vitest config gains `tests/launcher/**/*.test.ts` in its `include` list (for the pure-logic
registry unit test).

---

## npm Scripts

```json
"test:launcher": "vitest run tests/launcher/registry.test.ts && playwright test --project=launcher"
```

Runs the pure unit test first (fast, no browser), then the integration specs.

---

## Implementation Plan Summary

| Plan    | Scope                                  |
|---------|----------------------------------------|
| 02-01   | `src/launcher/` module + `src/shared/coords-schema.ts` |
| 02-02   | Registry unit test + fixture server helper |
| 02-03   | Integration tests: 5-parallel, cookie-isolation, 10-rapid-relaunch, close-event, live-setGeo |

---

*Research confidence: HIGH — APIs verified against Playwright 1.60 docs and Phase 1 proven patterns*
*Researched: 2026-05-15*
