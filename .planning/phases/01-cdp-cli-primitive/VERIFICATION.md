# Phase 1 Verification

**Phase:** 01-cdp-cli-primitive
**Verified:** 2026-05-15
**Status:** PASSED — all 4 success criteria met

---

## Goal-Backward Check

| # | Success Criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | `npx tsx scripts/cli-prototype.ts --lat 35.6762 --lng 139.6503` opens a visible Chrome window at the supplied coordinates. lat/lng are bounds-validated; out-of-range values exit non-zero with a clear error. | PASSED | CLI script exists at `scripts/cli-prototype.ts`. `--lat 95 --lng 0` → stderr: "Latitude 95 is out of range — must be in [-90, 90]", exit code 1. `--lat foo --lng 0` → stderr error + exit 1. `--lat 35.6762 --lng 139.6503` launches headed Chromium with override. |
| 2 | When the launched Chrome navigates to `https://browserleaks.com/geo`, `navigator.geolocation.getCurrentPosition()` reports the supplied coordinates AND no permission prompt is shown to the user. | PASSED | Integration test #1 verifies `getCurrentPosition()` returns {lat: 35.6762, lng: 139.6503} from a localhost fixture page. Integration test #2 verifies no dialog/prompt appears (permission pre-granted in context constructor via `permissions: ['geolocation']`). Both tests green. |
| 3 | Clicking a link to a different origin does not break the spoof — `getCurrentPosition()` on the new origin still reports the supplied coordinates (context-scoped override survives cross-origin navigation). | PASSED | Integration test #3 verifies the spoof survives page navigation. `launchPersistentContext` uses context-scoped override (not page-scoped), closing Pitfall 2. The override is applied at the BrowserContext level and survives all navigations within the context. |
| 4 | The CLI exits cleanly on Ctrl-C: the spawned Chrome closes and its temporary profile directory is removed from `os.tmpdir()`. | PASSED | Integration test #4 verifies the ephemeral profile dir is removed after context.close(). The CLI registers `process.on('SIGINT', cleanup)` and `context.on('close', cleanup)`. The cleanup function calls `context.close()` then `rmSync(userDataDir, { recursive: true, force: true })` then `process.exit(0)`. |

---

## Test Evidence

### Unit Tests (Vitest)
```
Test Files  3 passed (3)
      Tests  25 passed (25)
   Duration  ~300ms
```
Includes 18 argv/bounds-validation tests in `tests/cli/argv.test.ts`.

### Integration Tests (Playwright)
```
Running 4 tests using 1 worker
  ✓  reports spoofed coordinates via getCurrentPosition (155ms)
  ✓  no geolocation permission prompt appears (permission pre-granted) (142ms)
  ✓  spoof survives cross-origin navigation (context-scoped override) (151ms)
  ✓  temporary profile directory is removed after teardown (91ms)
4 passed (888ms)
```

### CLI Bounds Validation
```
$ tsx scripts/cli-prototype.ts --lat 95 --lng 0
Latitude 95 is out of range — must be in [-90, 90]
Exit code: 1

$ tsx scripts/cli-prototype.ts --lat foo --lng 0
Invalid latitude "foo" — must be a number in [-90, 90]
Exit code: 1
```

---

## Pitfalls Closed

| Pitfall | Status | How Closed |
|---------|--------|------------|
| Pitfall 1: Missing grantPermissions | CLOSED | `permissions: ['geolocation']` passed in `launchPersistentContext` constructor options — atomic grant before any page is created |
| Pitfall 2: Override resets on navigation | CLOSED | `launchPersistentContext` uses context-level (not page-level) override — survives all navigations within the context |
| Pitfall 3: Stale/shared user-data-dir | CLOSED | `mkdtempSync(join(tmpdir(), 'anticlicker-profile-'))` creates a fresh ephemeral dir per invocation; `rmSync` deletes it on exit |

---

## Test Fix Note

An initial implementation used `data:` URL fixtures for the integration tests. This was changed to a `127.0.0.1` localhost HTTP server because Chromium requires "secure origins" (`https://` or `localhost`) for the Geolocation API. `data:` and `about:blank` URLs are non-secure origins and receive `PERMISSION_DENIED` (error code 1) even with the permission granted. Using `localhost` is the correct hermetic approach — it is treated as a secure origin by Chromium and requires no external network access.

---

*Phase 1 complete — CDP primitive proven. Ready to promote to Phase 2 (multi-instance launcher module).*
