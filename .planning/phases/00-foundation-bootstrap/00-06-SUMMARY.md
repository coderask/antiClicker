# Plan 00-06 Summary — FND e2e + Preload Unit Tests

**Phase:** 00-foundation-bootstrap
**Plan:** 06
**Requirements:** FND-01, FND-02, FND-03 (verified by automated tests)
**Wave:** 4
**Completed:** 2026-05-15

## What Was Built

Four atomic commits:
1. `test(00-06): fill FND-01 + FND-02 e2e specs against built main`
2. `test(00-06): fill FND-03 persistence e2e with hermetic userData dir`
3. `test(00-06): preload Api shape test + wire test:e2e to build first`
4. `fix(00-06): preload to CJS for sandbox compat + use getLastWebPreferences` (build/runtime fixes uncovered by the e2e run)

## Assertion Strategies

| Spec | FND | Strategy (1 line) |
|------|-----|-------------------|
| `tests/e2e/secure-defaults.spec.ts` | FND-01 | Launch built app, await `[data-testid="ping"]` text `"pong"` (proves preload + IPC), then `app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences())` and assert `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`. |
| `tests/e2e/http-protocol.spec.ts` | FND-02 | `window.url()` starts with `http://` and never `file://`; renderer's own `[data-testid="protocol"]` reads `"http:"`. |
| `tests/e2e/persistence.spec.ts` | FND-03 | Fresh tmpdir via `mkdtemp` → both `electron.launch()` calls receive `--user-data-dir=<tmpdir>` → assert `count2 === count1 + 1` (delta-based, no absolute expectation). |
| `tests/unit/preload-api.test.ts` | (type) | Type-level check that `keyof Api` has exactly two members + fake-implementation runtime assertions on the literal `'pong'` return and `number` return shapes. |

## Persistence Test userData Isolation

`mkdtemp(join(tmpdir(), 'anticlicker-e2e-'))` per test run + the Chromium CLI flag `--user-data-dir=<tmpdir>` passed in **both** `electron.launch({ args: [...] })` calls. No env-var gymnastics; no shared state between test runs.

## package.json Script Chain

```json
"test":      "npm run test:unit && npm run test:e2e",
"test:unit": "vitest run",
"test:e2e":  "npm run build && playwright test"
```

`npm run test` is the single canonical Phase 0 sign-off command — unit → build → e2e. Pitfall 7 from 00-RESEARCH.md is closed permanently: the e2e cannot run without a fresh build.

## Build/Runtime Fixes Uncovered by the e2e Run

Two issues surfaced when the first end-to-end e2e attempt failed:

1. **Sandboxed preload must be CJS.** electron-vite emitted `out/preload/index.mjs` with native `import` statements, but Electron's sandboxed-preload loader rejected it with `SyntaxError: Cannot use import statement outside a module`. The renderer console showed "Unable to load preload script" and `window.api` was undefined. Fix: added `rollupOptions.output = { format: 'cjs', entryFileNames: '[name].js' }` to the preload's electron-vite config, and updated `src/main/index.ts` to reference `../preload/index.js` instead of `../preload/index.mjs`.
2. **`webContents.getWebPreferences()` is not Electron 35's API.** It was removed in favor of `webContents.getLastWebPreferences()` (returns the last-loaded prefs). Updated the FND-01 spec accordingly.

Both fixes are necessary for `npm run test` to be a real sign-off command rather than a passive assertion that happens to compile.

## Test Output

```
Unit (vitest):
  Test Files  2 passed (2)
       Tests  7 passed (7)

e2e (playwright):
  ✓ FND-01: webContents has secure webPreferences (484ms)
  ✓ FND-02: renderer loaded over http:// (431ms)
  ✓ FND-03: electron-store launchCount persists across relaunches (833ms)
  3 passed (1.1s)
```

## Per-Task Verification Map (00-VALIDATION.md row updates)

| FND | Verification source | Status |
|-----|---------------------|--------|
| FND-01 | `tests/e2e/secure-defaults.spec.ts` — webPreferences round-trip + DOM ping smoke | ✅ green |
| FND-02 | `tests/e2e/http-protocol.spec.ts` — window.url() + [data-testid="protocol"] | ✅ green |
| FND-03 | `tests/e2e/persistence.spec.ts` — launchCount delta across two launches | ✅ green |

## Handoff

Phase 0 acceptance gate is now closed:
- `npm run typecheck` exits 0 (project references walk both node + web configs)
- `npm run build` exits 0 (three output bundles)
- `npm run test` exits 0 (7 unit + 3 e2e, all green)

Phase 1 ("CDP first") can begin with confidence that the Electron host process is correctly sandboxed, the renderer is HTTP-served, and the persistence slot is wired.
