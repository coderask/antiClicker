# Plan 00-04 Summary — electron-store + zod Persistence

**Phase:** 00-foundation-bootstrap
**Plan:** 04
**Requirements:** FND-03 (persistent settings outside version control)
**Wave:** 2
**Completed:** 2026-05-15

## What Was Built

`src/main/config-store.ts` (45 lines) — an ESM electron-store wrapper validated by a zod schema. Plus `tests/unit/config-store.test.ts` exercising the pure schema (4 cases, all green).

Two atomic commits:
1. `feat(00-04): add zod-validated electron-store wrapper`
2. `test(00-04): add ConfigSchema unit test (4 cases, defaults + rejections)`

## The Two-Field Schema (Phase 0 Minimum)

```ts
export const ConfigSchema = z.object({
  launchCount: z.number().int().nonnegative().default(0),
  googleMapsApiKey: z.string().nullable().default(null),
});
```

These are the only two fields in Phase 0. Phase 4 will extend this. `grep -cE "(z\.string|z\.number|z\.boolean)" src/main/config-store.ts` returns exactly 2 — no scope creep.

## Launch Count Increment

`initConfigStore()` increments `launchCount` on every call:

```ts
store.set('launchCount', (store.get('launchCount') ?? 0) + 1);
```

The FND-03 e2e in 00-06 calls `_electron.launch()` twice and asserts the delta is `1`, not absolute values — robust against shared userData dirs from flaky earlier runs.

## Pitfalls Honored

- **ESM gotcha:** `import Store from 'electron-store'` (default import, ESM-only as of v10+). Works because 00-01's package.json sets `"type": "module"`.
- **No dual-schema:** Zod is the single source of truth. No JSON Schema is passed to the Store constructor; instead, after construction we `safeParse(store.store)` and reset to `ConfigSchema.parse({})` if validation fails — belt + braces alongside the constructor's `clearInvalidConfig: true`.
- **App-context dependency:** `initConfigStore()` is only callable inside `app.whenReady()` because it touches `app.getPath('userData')` via the Store constructor. 00-02's main entry honors this ordering.

## What the Unit Test Does / Doesn't Cover

The test imports **only `ConfigSchema`** (the pure zod object), never the app-dependent runtime functions. Four cases:
1. Empty `{}` → defaults (`launchCount: 0`, `googleMapsApiKey: null`).
2. Negative `launchCount` → reject.
3. Numeric `googleMapsApiKey` → reject.
4. Valid filled config → accept and pass values through.

The full app-context persistence proof (counter survives an Electron relaunch) lives in plan 00-06's `tests/e2e/persistence.spec.ts`.

## Test Output

```
Test Files  1 passed | 1 skipped (2)
     Tests  4 passed | 1 skipped (5)
```

## Handoff

Wave 2 is now complete. The three forward imports from 00-02's main entry (`./renderer-server.js`, `./config-store.js`, the IPC handler module) all resolve. Wave 3 (plan 00-05) can build the preload bridge + verification UI on top of this foundation.
