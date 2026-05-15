# Plan 00-01 Summary — Repo Scaffold + Wave 0 Test Infrastructure

**Phase:** 00-foundation-bootstrap
**Plan:** 01
**Requirements:** FND-01, FND-02, FND-03 (groundwork only; assertions land in 00-06)
**Wave:** 1
**Completed:** 2026-05-15

## What Was Built

The complete electron-vite three-process scaffold described in 00-RESEARCH.md, with every dependency pinned to the versions verified there. Three atomic commits:

1. `chore(00-01): scaffold package.json, tsconfig family, and .gitignore` — manifest with `"type": "module"`, electron 35.7.5, Playwright 1.60.x, MapLibre GL JS 5.x, Vitest, zod, electron-store; three tsconfigs (root references, node-side for main/preload, DOM-side for renderer); `.gitignore` excludes `node_modules/`, `out/`, `.electron-store/`, and any local secrets.
2. `chore(00-01): add electron-vite config and empty src/ tree` — `electron.vite.config.ts` declares the three build targets (`main`, `preload`, `renderer`); `src/main/`, `src/preload/`, `src/renderer/`, `src/shared/` placeholder dirs; `src/renderer/index.html` with strict CSP meta tag.
3. `test(00-01): add Wave 0 test infrastructure (configs + stub specs)` — `vitest.config.ts`, `playwright.config.ts`, and four stub spec files for FND-01/02/03 e2e tests + the preload-api unit test. Stubs reference the invariants they will eventually assert but contain no real assertions (Plan 00-06 fills them in).

## Files Created

- `package.json`, `package-lock.json`
- `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`
- `electron.vite.config.ts`
- `.gitignore`
- `vitest.config.ts`, `playwright.config.ts`
- `src/main/.gitkeep`, `src/preload/.gitkeep`, `src/shared/.gitkeep`
- `src/renderer/index.html`
- `tests/e2e/secure-defaults.spec.ts` (stub)
- `tests/e2e/http-protocol.spec.ts` (stub)
- `tests/e2e/persistence.spec.ts` (stub)
- `tests/unit/preload-api.test.ts` (stub)

## Verification

- `npm install` ran during execution and produced `package-lock.json` (4469 lines).
- Three commits made, one per task, with the `00-01` plan tag in each subject line.
- No source code beyond config + stubs — the load-bearing main/preload/renderer code lands in 00-02 through 00-05.

## Decisions / Pitfalls Honored

- Pinned exact versions per 00-RESEARCH.md to avoid future major-version breakage on Electron/Playwright pair.
- Stubs deliberately empty so Wave 2/3 plans can rely on the file paths existing without test interference.
- Renderer `index.html` includes strict CSP meta — 00-RESEARCH.md flagged that Maps API requires explicit CSP allowance later (Phase 4).

## Handoff to Wave 2

Wave 2 plans (00-02, 00-03, 00-04) can now build in parallel:
- 00-02 writes `src/main/index.ts`, `src/main/ipc.ts`, `src/shared/*` against the pinned electron 35 API.
- 00-03 writes `src/main/renderer-server.ts` (the FND-02 HTTP server).
- 00-04 writes `src/main/config-store.ts` (FND-03 electron-store wrapper).
