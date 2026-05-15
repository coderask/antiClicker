---
phase: 01-cdp-cli-primitive
plan: 03
subsystem: testing
tags: [playwright, integration-test, geolocation, hermetic, localhost]

requires:
  - phase: 01-cdp-cli-primitive
    plan: 01
    provides: chromium.launchPersistentContext with geolocation context options

provides:
  - tests/cli/geolocation.spec.ts — 4 Playwright integration tests verifying the geolocation spoof
  - playwright.config.ts updated with 'cli' project for tests/cli/*.spec.ts
  - npm test:cli script

affects: [ci-pipeline, phase-02-verification]

tech-stack:
  added: []
  patterns:
    - Localhost HTTP server as hermetic fixture (data: URLs are non-secure origins in Chromium)
    - Per-test ephemeral profile dir with try/finally teardown

key-files:
  created:
    - tests/cli/geolocation.spec.ts
  modified:
    - playwright.config.ts
    - package.json

key-decisions:
  - "Use localhost (127.0.0.1) HTTP server instead of data: URLs — Chromium requires secure origins for geolocation API; data: URLs are non-secure even with permission granted"
  - "headless: true for integration tests — visual verification is done manually; CI must not require a display"
  - "Added 'cli' Playwright project to playwright.config.ts, keeping 'electron' project for existing e2e tests"

patterns-established:
  - "Pattern: Tiny node:http inline server on 127.0.0.1 as hermetic fixture for Playwright tests that need geolocation"

requirements-completed: [LCH-02, LCH-03]

duration: 25min
completed: 2026-05-15
---

# Phase 01 Plan 03: Integration Tests Summary

**4 hermetic Playwright integration tests using a localhost HTTP fixture — verifies geolocation spoof, permission pre-grant, navigation persistence, and ephemeral profile cleanup.**

## Performance

- **Duration:** ~25 min (includes debugging the data: URL secure-origin issue)
- **Completed:** 2026-05-15
- **Tasks:** 1 task (Task 3.1)
- **Files created:** 1 (tests/cli/geolocation.spec.ts)
- **Files modified:** 2 (playwright.config.ts, package.json)

## Accomplishments

- Created `tests/cli/geolocation.spec.ts` with 4 Playwright integration tests:
  1. **Spoof verification**: `getCurrentPosition()` returns {lat: 35.6762, lng: 139.6503} from a localhost fixture
  2. **No permission prompt**: dialog event listener never fires — permission pre-granted atomically
  3. **Navigation persistence**: spoof survives page navigation within the same context (context-scoped override)
  4. **Profile cleanup**: ephemeral `anticlicker-test-*` dir exists during test, deleted after teardown
- Updated `playwright.config.ts` to add 'cli' project targeting `tests/cli/*.spec.ts`
- Added `test:cli` npm script: `vitest run tests/cli/argv.test.ts && playwright test tests/cli/geolocation.spec.ts --project=cli`
- Added `cli:demo` npm script: `tsx scripts/cli-prototype.ts --lat 35.6762 --lng 139.6503`

## Test Results

```
Running 4 tests using 1 worker
  ✓  reports spoofed coordinates via getCurrentPosition (155ms)
  ✓  no geolocation permission prompt appears (permission pre-granted) (142ms)
  ✓  spoof survives cross-origin navigation (context-scoped override) (151ms)
  ✓  temporary profile directory is removed after teardown (83ms)
4 passed (888ms)
```

## Deviations from Plan

### Auto-fixed Issue

**[Rule 1 - Bug] Switched fixture from data: URLs to localhost HTTP server**
- **Found during:** Task 3.1 (initial test run)
- **Issue:** `data:` URLs are treated as non-secure origins by Chromium. Even with `permissions: ['geolocation']` granted in the context constructor, `navigator.geolocation.getCurrentPosition()` returns `PERMISSION_DENIED` (error code 1) from `data:` and `about:blank` URLs because Chromium requires a "secure origin" (`https://` or `localhost`) for the Geolocation API.
- **Fix:** Replaced `data:` URL approach with a tiny `node:http` server bound to `127.0.0.1` on an ephemeral port. `localhost` is treated as a secure origin by Chromium.
- **Files modified:** `tests/cli/geolocation.spec.ts`
- **No commit:** Fixed before initial commit of the integration test file

## Self-Check

- [x] tests/cli/geolocation.spec.ts exists with 4 tests
- [x] All 4 tests pass: `npx playwright test tests/cli/geolocation.spec.ts --project=cli`
- [x] Tests are hermetic (localhost fixture, no external network)
- [x] Navigation persistence test explicitly validates Pitfall 2 is closed
- [x] Ephemeral profile dir deleted in test teardown
