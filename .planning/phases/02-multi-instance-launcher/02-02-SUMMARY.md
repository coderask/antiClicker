# Plan 02-02 Summary — Registry Unit Tests + Shared Fixture Helper

**Phase:** 02-multi-instance-launcher
**Plan:** 02
**Requirements:** LCH-04, LCH-05 (verification surface)
**Wave:** 2
**Completed:** 2026-05-15

## What Was Built

Two test-side artifacts:

1. `tests/launcher/registry.test.ts` — 14 vitest cases against `Registry`: add/duplicate-throw, get/getOrThrow, remove (incl. no-op double-remove), updateCoords, list (returns snapshot, doesn't expose internals), size, entries. Pure logic, no browser launch.

2. `tests/launcher/fixture.ts` — shared HTTP server helper. Exports `startGeoFixtureServer(): { url, close }` plus two HTML fixtures (`GEO_FIXTURE_HTML` for `getCurrentPosition`, `COOKIE_FIXTURE_HTML` for `document.cookie` round-trip) and two page helpers (`waitForGeoResult`, `waitForCookieResult`). The localhost `http://127.0.0.1:<ephemeral>/` is required because Chromium treats `data:` and `about:blank` as non-secure origins and refuses geolocation there (rediscovered in Phase 1 — documented in 01-RESEARCH.md and 02-RESEARCH.md).

## Test Output

```
$ npm run test:unit
Test Files  4 passed (4)
     Tests  39 passed (39)
```

(39 = 7 Phase 0 + 18 Phase 1 argv + 14 Phase 2 registry. Numbers will keep climbing as later phases add tests.)

## Handoff

The fixture is reused by `tests/launcher/multi-instance.spec.ts` (plan 02-03) and will be reused by Phase 3's IPC e2e where the renderer drives the launcher through `window.api`.
