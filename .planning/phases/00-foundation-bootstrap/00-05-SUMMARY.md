# Plan 00-05 Summary — Preload Bridge + Verification UI

**Phase:** 00-foundation-bootstrap
**Plan:** 05
**Requirements:** FND-01 (contextBridge narrow surface), FND-02 (protocol observable), FND-03 (launchCount observable)
**Wave:** 3
**Completed:** 2026-05-15

## What Was Built

The renderer-side glue that closes the Phase 0 loop: a narrow `contextBridge` preload exposing exactly two methods, a typed `window.api` ambient declaration, the React entry point, and a verification UI with three `data-testid` readouts that plan 00-06's e2e suite will assert against.

Three atomic commits:
1. `feat(00-05): add narrow contextBridge preload (window.api with 2 methods)` — `src/preload/index.ts` + `src/preload/index.d.ts`. Uses typed `IpcChannels.Ping` / `IpcChannels.ConfigGetLaunchCount` constants from the shared module. Throws at boot if `process.contextIsolated` is false. No `electronAPI` passthrough.
2. `feat(00-05): add React entry point (main.tsx) and Vite env.d.ts` — minimal React entry with `StrictMode`.
3. `feat(00-05): add Phase 0 verification UI + wire tsconfig project refs` — `src/renderer/src/App.tsx` with the three readouts, plus the tsconfig project-reference fix described below.

## window.api Surface (Exact Contract)

```ts
type Api = {
  ping: () => Promise<'pong'>;
  getLaunchCount: () => Promise<number>;
};
```

Two methods. Zero extras. `grep -cE "ipcRenderer.invoke" src/preload/index.ts` returns exactly 2 — Phase 0 minimality is enforced and greppable.

## DOM Contract for the FND e2e Tests

Inside the `<dl>` in `App.tsx`, three `<dd>` elements expose the load-bearing readouts:

| `data-testid` | Source | What 00-06 asserts |
|---------------|--------|-------------------|
| `protocol` | `window.location.protocol` | FND-02: must equal `"http:"` (never `"file:"`) |
| `ping` | `await window.api.ping()` | smoke proof: must equal `"pong"` |
| `launch-count` | `await window.api.getLaunchCount()` | FND-03: must increment by 1 across two `_electron.launch()` invocations |

## Build Verification

```
$ npm run build
✓ tsc --noEmit (project references — node + web)
✓ electron-vite build
  out/main/index.js          5.25 kB
  out/preload/index.mjs      0.48 kB
  out/renderer/index.html    0.39 kB
  out/renderer/assets/*.js   556.93 kB
```

The full Phase 0 stack compiles end-to-end. Three build targets emitted matching the dev/packaged expectations from 00-02 (the main entry loads `out/preload/index.mjs` — note the `.mjs` extension that electron-vite produces because `package.json` declares `"type": "module"`).

## Deviations from 00-RESEARCH.md Patterns 5 & 6

Two follow-on fixes to the 00-01 scaffold were needed to get the full stack to compile:

1. **Project references in `tsconfig.json`.** The original empty `"files": []` left `tsc --noEmit` (the no-arg invocation in the `build` script) with nothing to check and emitting `TS18002`. I added `references` to the two sub-configs and added `composite: true` to each. Functional behavior unchanged; `tsc --noEmit` now walks both projects.

2. **`tsconfig.web.json` includes `src/preload/index.d.ts`.** Without it, `App.tsx`'s `window.api.ping()` typecheck fails (`TS2339: Property 'api' does not exist on type 'Window'`). The preload's ambient global type declaration must be visible to the renderer's TS project.

3. **Removed the cross-tier `AppConfig` re-export from `src/shared/types.ts`.** The renderer never consumes `AppConfig` (it only reads `launchCount` via `window.api.getLaunchCount(): Promise<number>`), so the re-export forced the renderer's project to import from `src/main` for no benefit. Removing it preserves the main/renderer firewall.

These are all configuration-side fixes — no Pattern 5 or Pattern 6 code-shape deviations.

## Handoff

Wave 4 (plan 00-06) can now fill in the four test stubs from 00-01:
- `tests/e2e/secure-defaults.spec.ts` will use Playwright's `_electron.launch()` + `webContents.getWebPreferences()` to assert FND-01 invariants and to query `window.api`'s shape.
- `tests/e2e/http-protocol.spec.ts` will assert `[data-testid="protocol"]` contains `"http:"` against a built (packaged-mode) app.
- `tests/e2e/persistence.spec.ts` will launch twice and assert the `[data-testid="launch-count"]` delta is 1.
- `tests/unit/preload-api.test.ts` will type-check that `window.api` has exactly the two expected methods.
