---
phase: 01-cdp-cli-primitive
plan: 01
subsystem: cli
tags: [playwright, chromium, geolocation, cli, tsx]

requires:
  - phase: 00-foundation-bootstrap
    provides: toolchain (TypeScript, Vitest, Playwright), package.json with devDependencies

provides:
  - scripts/cli-prototype.ts — headed Chromium launcher with geolocation override via Playwright
  - parseCliArgs() — exported, testable argv parsing + bounds validation function
  - tsx devDependency for running TypeScript scripts directly

affects: [01-02, 01-03, 02-multi-instance]

tech-stack:
  added: [playwright (explicit devDependency), tsx@4.22.0]
  patterns:
    - launchPersistentContext with geolocation+permissions in constructor (atomic grant, Pitfall 1+2 closed)
    - ephemeral tmpdir per launch (Pitfall 3 closed)
    - exported pure function for argv parsing (enables unit testing without browser launch)

key-files:
  created:
    - scripts/cli-prototype.ts

key-decisions:
  - "Use launchPersistentContext (not launch+newContext) to ensure userDataDir isolation and context-scoped override"
  - "Pass permissions: ['geolocation'] in constructor options to close Pitfall 1 atomically"
  - "Export parseCliArgs() as a named function for testability — main() wraps it with process.exit()"
  - "Use process.on('SIGINT') + context.on('close') dual-handler pattern to ensure cleanup on both Ctrl-C and window close"

patterns-established:
  - "Pattern 1: launchPersistentContext with geolocation+permissions in constructor — the canonical Phase 1 spoof pattern"
  - "Pattern 2: isMain detection via process.argv[1] suffix check — allows the same file to be both CLI and import target"

requirements-completed: [LCH-01, LCH-02, LCH-03]

duration: 20min
completed: 2026-05-15
---

# Phase 01 Plan 01: CLI Prototype Summary

**Playwright-based headed Chromium launcher that spoofs geolocation to user-supplied lat/lng via context-level CDP override with atomic permission grant — the load-bearing primitive for AntiClicker.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-05-15
- **Tasks:** 1 task (Task 1.1)
- **Files created:** 1 (scripts/cli-prototype.ts)
- **Files modified:** 2 (package.json, package-lock.json)

## Accomplishments

- Created `scripts/cli-prototype.ts` — a 100-line TypeScript CLI that:
  - Parses `--lat` and `--lng` flags via `node:util parseArgs` (no commander)
  - Validates latitude in [-90, 90] and longitude in [-180, 180] with clear error messages
  - Creates an ephemeral Chromium profile via `mkdtempSync(join(tmpdir(), 'anticlicker-profile-'))`
  - Launches a headed Chromium instance via `chromium.launchPersistentContext` with `geolocation` and `permissions` in constructor options (Pitfalls 1+2+3 all closed)
  - Cleans up on SIGINT (Ctrl-C) and on Chrome window close
- Added `tsx` as a devDependency for direct TypeScript script execution
- Added `playwright` as an explicit devDependency (was transitive only)
- Added `cli:demo` npm script: `tsx scripts/cli-prototype.ts --lat 35.6762 --lng 139.6503`

## Pitfalls Closed

| Pitfall | How |
|---------|-----|
| Pitfall 1: Missing grantPermissions (BLOCKER) | `permissions: ['geolocation']` in `launchPersistentContext` constructor |
| Pitfall 2: Override resets on navigation (BLOCKER) | `launchPersistentContext` uses context-level override, not page-level |
| Pitfall 3: Stale user-data-dir (MAJOR) | Fresh `mkdtempSync` per invocation; `rmSync` on exit |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `scripts/cli-prototype.ts` exists
- [x] `launchPersistentContext` with `permissions: ['geolocation']` in constructor
- [x] `parseCliArgs` exported for unit testing
- [x] SIGINT handler + context.on('close') cleanup
- [x] `headless: false` set
- [x] Bounds validation: lat [-90,90], lng [-180,180]
