# Phase 03 Research — Electron IPC for Launcher Integration

## Problem statement

Phase 2 delivered a `createLauncher()` factory that manages N concurrent isolated Chromium
instances. Phase 3 must bring that factory into Electron's main process and expose its API to
the renderer through a narrow, typed, zod-validated contextBridge surface.

## Key IPC Patterns

### ipcMain.handle (request-response: renderer → main)

`ipcMain.handle(channel, handler)` registers an async handler for `ipcRenderer.invoke()` calls.
The handler receives the event object plus any arguments the renderer passed. It returns a
Promise whose resolved value is serialized (structured clone) back to the renderer.

```ts
ipcMain.handle('launcher:launch', async (_event, payload: unknown) => {
  const coords = ZodCoordsSchema.parse(payload);   // throws ZodError on bad input
  return launcher.launch(coords);                  // returns Instance (serializable)
});
```

Key facts:
- Handlers registered with `handle` are invoke channels — one-shot request/response.
- Zod validation belongs here, at the IPC boundary, before any launcher call.
- `ZodError` thrown from a handler is serialized by Electron and re-thrown on the renderer side.
- If an unhandled error escapes the handler, the renderer's `invoke()` promise rejects.

### webContents.send (push: main → renderer)

For events that originate in main and need to reach the renderer (e.g., `instance-closed`
fired by the launcher), use `webContents.send(channel, ...args)`.

```ts
launcher.on('instance-closed', (id) => {
  BrowserWindow.getAllWindows()[0]?.webContents.send('launcher:instance-closed', id);
});
```

On the renderer side, the preload subscribes with `ipcRenderer.on()` and exposes a callback
registration function (the subscription pattern):

```ts
onInstanceClosed: (cb) => {
  const listener = (_e: IpcRendererEvent, id: string) => cb(id);
  ipcRenderer.on('launcher:instance-closed', listener);
  return () => ipcRenderer.removeListener('launcher:instance-closed', listener);
},
```

The caller gets an unsubscribe function — React can return it from `useEffect`.

### contextBridge surface extension

The existing Phase 0 surface has two methods. Phase 3 adds four invoke methods and one
subscription. The pattern is:

1. Define `api` object in preload with the full surface.
2. Export `type Api = typeof api` — this is the narrowest possible type (no over-exposure).
3. The ambient `src/preload/index.d.ts` re-exports `Api` to declare `Window.api`.
4. Renderer code sees the type-safe `window.api` at compile time.

### Zod-at-the-boundary

All renderer→main payloads cross a trust boundary (even contextIsolation is not a
security guarantee against compromised renderers). The pattern is to treat every IPC
payload as `unknown` and parse it through a Zod schema before use:

```ts
ipcMain.handle(IpcChannels.LauncherLaunch, async (_e, payload: unknown) => {
  const coords = ZodCoordsSchema.parse(payload);
  return launcher.launch(coords);
});
```

The launcher itself also validates with ZodCoordsSchema (defense-in-depth). If the launcher
were replaced with a stub in tests, the IPC layer would still reject out-of-range inputs.

### Singleton lifecycle

The launcher is a module-scope singleton in `src/main/ipc.ts`:

```ts
let _launcher: Launcher | null = null;
function getLauncher(): Launcher {
  if (!_launcher) _launcher = createLauncher();
  return _launcher;
}
export function closeLauncherIfAny(): Promise<void> {
  return _launcher ? _launcher.closeAll() : Promise.resolve();
}
```

This pattern:
- Avoids top-level await (Electron's main process can import ipc.ts before `app.whenReady`).
- Allows `closeLauncherIfAny()` to be a no-op if the launcher was never initialized.
- The `instance-closed` event listener is wired inside `registerIpc()` after the singleton
  is created, so it registers exactly once.

### Async subscription vs async-iterable

Two patterns exist for push events:
- **Callback registration** (chosen): simpler, matches React's `useEffect` return signature
  (return the unsubscribe fn). No overhead from iterator bookkeeping.
- **Async iterable**: more ergonomic for complex sequences, but requires a queue and
  backpressure handling. Overkill for a single event type.

The callback pattern is the right call here.

## Phase 2 Launcher API Contract

Phase 3 consumes (does not modify) `src/launcher/index.ts`:

| Method | Signature | Notes |
|--------|-----------|-------|
| `launch` | `(opts: LaunchOptions) => Promise<Instance>` | opts include lat/lng/accuracy/headless |
| `setGeo` | `(id: InstanceId, coords: Coords) => Promise<void>` | live update without relaunch |
| `close` | `(id: InstanceId) => Promise<void>` | fires `instance-closed` event |
| `closeAll` | `() => Promise<void>` | for app quit cleanup |
| `list` | `() => Instance[]` | synchronous snapshot |
| `on` | `('instance-closed', (id) => void) => void` | push event registration |

`Instance` is a serializable POJO `{ id, coords, userDataDir }` — safe to pass through IPC.

## IPC Channel Plan

All channel constants live in `src/shared/ipc-channels.ts`:

| Constant | Value | Direction |
|----------|-------|-----------|
| `LauncherLaunch` | `'launcher:launch'` | renderer → main (invoke) |
| `LauncherSetGeo` | `'launcher:set-geo'` | renderer → main (invoke) |
| `LauncherClose` | `'launcher:close'` | renderer → main (invoke) |
| `LauncherList` | `'launcher:list'` | renderer → main (invoke) |
| `LauncherInstanceClosed` | `'launcher:instance-closed'` | main → renderer (push) |

## Zod Schema Composition

The four invoke channels use these schemas:

```ts
// launch: { latitude, longitude, accuracy? }
ZodCoordsSchema  // already in src/shared/coords-schema.ts

// setGeo: { id, coords: ZodCoordsSchema }
z.object({ id: z.string(), coords: ZodCoordsSchema })

// close: { id }
z.object({ id: z.string() })

// list: no payload
```

## Test Strategy

### Unit tests (vitest, no Electron)
- Test the schema shapes in isolation: import the composite schemas (exported from ipc.ts or
  re-derived in the test), run `.safeParse()` on valid and invalid inputs.
- 4 cases: valid launch, lat out of range, lon wrong type, missing id on close.
- No need to start Electron — schemas are pure Node.

### E2E tests (Playwright `_electron.launch`)
- Build the app first (`npm run build`).
- Launch with `_electron.launch`, get `firstWindow`.
- Click the "Launch at Tokyo" button, wait for `data-testid="live-instances"` to show `"1"`.
- Evaluate `window.api.list()` in the renderer to get the instance array.
- Call `window.api.close(id)` via evaluate, wait for count to return to `"0"`.

## Risk Items

1. **`instance-closed` fan-out:** `BrowserWindow.getAllWindows()[0]` may be undefined if the
   Electron window is closed before the spawned Chrome. Guard with optional chaining.
2. **Serialization of `Instance`:** The `Instance` shape is a plain object; `userDataDir` is
   a string. No Playwright objects sneak through.
3. **ZodError serialization:** Electron structured-clone serializes ZodError as a generic
   object. The renderer should catch and display it — not assume a ZodError instance.
4. **Preload unit tests:** `tests/unit/preload-api.test.ts` currently asserts `Api` has
   exactly 2 keys. After Phase 3 the Api has 7. The test must be updated.
