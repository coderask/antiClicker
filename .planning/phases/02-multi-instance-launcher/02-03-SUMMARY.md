# Plan 02-03 Summary — Launcher Integration Tests

**Phase:** 02-multi-instance-launcher
**Plan:** 03
**Requirements:** LCH-04, LCH-05, LCH-06, LCH-07, LCH-08 (verified end-to-end)
**Wave:** 3
**Completed:** 2026-05-15

## What Was Built

`tests/launcher/multi-instance.spec.ts` — 5 Playwright integration tests under the new `launcher` project in `playwright.config.ts`. Each test maps directly to one of Phase 2's success criteria.

## Test Output

```
$ npx playwright test --project=launcher
✓ 5 parallel instances each report their own coordinates (702ms)
✓ profiles are isolated: cookies in A invisible in B (260ms)
✓ 10 rapid launch/close cycles never collide on port (793ms)
✓ closing an instance fires instance-closed and removes profile dir (281ms)
✓ setGeo updates a running instance without relaunch (165ms)
5 passed (2.7s)
```

## Mapping to ROADMAP Phase 2 Success Criteria

| # | Criterion | Test |
|---|-----------|------|
| 1 | 5 parallel instances, no coord cross-contamination | "5 parallel instances each report their own coordinates" |
| 2 | Profile isolation (cookies) | "profiles are isolated: cookies in A invisible in B" |
| 3 | No port collision across rapid relaunches | "10 rapid launch/close cycles never collide on port" |
| 4 | `context.on('close')` cleanup + 'instance-closed' event | "closing an instance fires instance-closed and removes profile dir" |
| 5 | Live `setGeo` without relaunch | "setGeo updates a running instance without relaunch" |

## Test-Only API Addition

To open pages on running instances from tests without exposing `BrowserContext` to production callers, the launcher gained one extra method **outside** the public `Launcher` interface:

```ts
// On the returned object only — typed via a Launcher & { _testContext: ... } intersection.
_testContext(id: InstanceId): BrowserContext
```

The naming convention (`_test` prefix) makes the intent obvious to reviewers, and the test cast (`createLauncher() as TestableLauncher`) is the only place the back-door is named. Phase 3's IPC will not import this method.

## Configuration

`playwright.config.ts` now has three projects: `electron`, `cli`, `launcher`. The `launcher` project has its own 120s timeout per test (the rapid-relaunch test does 10 cycles × ~5s of cold-start each).

`package.json`'s `test:launcher` script runs the launcher unit tests + the new spec. The canonical `npm run test` chain now exercises all four test surfaces.
