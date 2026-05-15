# Plan 02-01 Summary — Launcher Module

**Phase:** 02-multi-instance-launcher
**Plan:** 01
**Requirements:** LCH-04, LCH-05, LCH-06, LCH-07, LCH-08
**Wave:** 1
**Completed:** 2026-05-15

## What Was Built

`src/launcher/` — a reusable module that wraps Playwright's `launchPersistentContext` into a high-level Launcher API with per-instance profile isolation, live geolocation updates, and event-driven cleanup.

Two commits:
1. `feat(02-01): launcher module — Registry + createLauncher factory + shared CoordsSchema`
2. (Test back-door added with 02-03's integration tests for clean encapsulation.)

## Public Interface

```ts
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

The Instance snapshot contains `id`, `coords`, and `userDataDir` only. The raw `BrowserContext` is intentionally NOT exposed on the public type — keeping the launcher a closed module. A test-only `_testContext(id)` accessor lets integration tests open pages on a running instance without leaking that to production callers (Phase 3 IPC).

## Files

- `src/shared/coords-schema.ts` — `ZodCoordsSchema` (lat ∈ [-90,90], lng ∈ [-180,180], optional positive accuracy). Single source of truth for coordinate validation, reused across CLI, launcher, and (Phase 3) IPC.
- `src/launcher/index.ts` — `createLauncher()` factory + public types. 174 lines.
- `src/launcher/registry.ts` — `Registry` class. Pure logic, no Playwright. Used by the factory; exposed only via the public Launcher API methods.

## Key Decisions

1. **Constructor-time grant of geolocation + permissions** — Phase 1's canonical pattern (`launchPersistentContext({ geolocation, permissions: ['geolocation'] })`) closes Pitfalls 1, 2, and 3 atomically. The launcher uses the exact same shape per instance.
2. **Profile isolation via `mkdtemp`** — every `launch()` call gets its own `os.tmpdir()/anticlicker-profile-<random>` directory; the random suffix is the only thing distinguishing two launches.
3. **No manual port management** — Playwright handles CDP internally. Pitfall 8 (port collisions) is a non-issue because the launcher never passes `--remote-debugging-port`. Tests verify this with a 10-rapid-relaunch loop.
4. **Best-effort cleanup** — `context.on('close', ...)` triggers `rmSync(userDataDir, { recursive: true, force: true })` inside a try/catch. Cleanup never throws (Windows can hold profile locks briefly).
5. **Listener errors swallowed** — `on('instance-closed', handler)` wraps each handler in try/catch so a buggy listener doesn't crash the launcher event loop.
