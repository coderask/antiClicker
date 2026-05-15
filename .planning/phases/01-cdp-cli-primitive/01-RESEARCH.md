# Phase 1 Research: CDP Geolocation Primitive (CLI)

**Phase:** 01-cdp-cli-primitive
**Researched:** 2026-05-15
**Status:** APPROVED — ready to implement

## Objective

Prove the geolocation spoof in a standalone CLI before any Electron UI exists. The CLI is both a proof-of-concept and the load-bearing primitive that Phases 2–5 promote into a production module.

---

## Load-Bearing API Surfaces

### 1. `playwright.chromium.launchPersistentContext` — headed launch with temp profile

```ts
import { chromium } from 'playwright';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const userDataDir = mkdtempSync(join(tmpdir(), 'anticlicker-profile-'));

const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false,
  geolocation: { latitude: lat, longitude: lng, accuracy: 10 },
  permissions: ['geolocation'],          // CRITICAL — closes Pitfall 1
  args: ['--no-first-run', '--no-default-browser-check'],
});
```

**Why `launchPersistentContext` over `newContext`:** The persistent context variant accepts a `userDataDir` which means each CLI invocation gets an isolated Chromium profile — no state bleed across sessions (Pitfall 3). It also lets us pass `geolocation` and `permissions` in the constructor options, which is the safest pattern: the override and the permission grant are applied **atomically at context creation** before any page exists, so there is no window between `launch()` and `grantPermissions()` where a page could call `getCurrentPosition()` and hit a denial.

**Key options:**
- `headless: false` — required by PROJECT.md (user must see the Chrome window)
- `geolocation` — Playwright's context-level override; survives all navigations within the context (closes Pitfall 2)
- `permissions: ['geolocation']` — grants the permission for ALL origins in the context; no per-origin `grantPermissions` call needed (closes Pitfall 1)
- `args: ['--no-first-run', '--no-default-browser-check']` — prevents Chromium welcome/default-browser prompts consuming the first navigation (Pitfall 3 mitigation)

---

### 2. `BrowserContext.grantPermissions` — explicit per-call alternative (not used in CLI)

```ts
// Only needed if you DON'T pass permissions in the constructor.
// Preferred pattern for CLI: pass permissions: ['geolocation'] at construction time.
await context.grantPermissions(['geolocation']); // no origin = all origins
```

If the `permissions` constructor option is used (our approach), this call is redundant — but it is safe to call both. The equivalent at-construction approach is preferred because it cannot race with an early page load.

**PITFALL 1 reference:** `Emulation.setGeolocationOverride` and the permission system are independent CDP surfaces. Omitting the permission grant causes either (a) a native permission prompt appearing in the launched window — breaking the silent-spoof requirement — or (b) `PERMISSION_DENIED` error + the browser falling back to IP-based geolocation, reporting the user's real location. This is the single most common integration failure (confirmed: microsoft/playwright #18242, #22554, #1289).

---

### 3. `BrowserContext.setGeolocation` — live coordinate update (used in Phase 2+)

```ts
// After the context is live, push new coords without relaunch.
await context.setGeolocation({ latitude: newLat, longitude: newLng, accuracy: 10 });
```

**Context-scoped semantics (Pitfall 2 closed):** Playwright applies the override at the browser-context level, not the page/target level. This means:
- Cross-origin navigations (clicking a link from `example.com` to `maps.google.com`) do NOT reset the override.
- New tabs opened within the same context inherit the override automatically.
- Raw CDP `Emulation.setGeolocationOverride` at the page target level does NOT have this guarantee — it dies on cross-process navigations.

Phase 1 does not call `setGeolocation` after launch (static coords). Phase 2 will use it for live pin updates.

---

### 4. Tmpdir cleanup pattern with SIGINT handler

```ts
import { rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const userDataDir = mkdtempSync(join(tmpdir(), 'anticlicker-profile-'));

let isCleaningUp = false;
async function cleanup() {
  if (isCleaningUp) return;
  isCleaningUp = true;
  try {
    await context.close();
  } catch { /* ignore — browser may already be closed */ }
  try {
    rmSync(userDataDir, { recursive: true, force: true });
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGINT', cleanup);

// Also clean up when user closes the Chrome window:
context.on('close', () => {
  if (!isCleaningUp) cleanup();
});
```

**Why `rmSync` with `force: true`:** On macOS/Linux, Chromium holds a `SingletonLock` file open during the session. Using `force: true` in `rmSync` avoids an ENOENT error if the lock file was already released by the time we delete. The `recursive: true` flag removes the entire profile directory (preventing disk bloat — each ephemeral Chromium profile is 10–100 MB).

**Guard against double-cleanup:** The `isCleaningUp` flag prevents double-fire when both SIGINT fires and the `context.on('close')` event fires in sequence. Without this guard, the process could attempt to `rmSync` an already-deleted directory, throwing an error.

---

## Bounds Validation

Per Phase 1 Success Criterion 1, lat/lng must be validated before reaching Playwright:

```ts
// latitude must be in [-90, 90]
if (lat < -90 || lat > 90) {
  process.stderr.write(`Error: latitude ${lat} is out of range [-90, 90]\n`);
  process.exit(1);
}
// longitude must be in [-180, 180]
if (lng < -180 || lng > 180) {
  process.stderr.write(`Error: longitude ${lng} is out of range [-180, 180]\n`);
  process.exit(1);
}
```

Chromium itself throws a cryptic CDP error (`InvalidArgumentError`) when coordinates are out of range — catching this early with a clear message is required by the success criteria.

---

## Argv Parsing — `node:util parseArgs`

Per project constraints, no `commander` or `yargs`. Node's built-in `parseArgs` (Node 18.3+, stable in Node 22 LTS) handles the CLI surface:

```ts
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    lat: { type: 'string' },
    lng: { type: 'string' },
  },
});

const lat = parseFloat(values.lat ?? '');
const lng = parseFloat(values.lng ?? '');

if (isNaN(lat) || isNaN(lng)) {
  process.stderr.write('Usage: tsx scripts/cli-prototype.ts --lat <lat> --lng <lng>\n');
  process.exit(1);
}
```

---

## Test Approach Summary

| Test file | What it tests | Runner |
|-----------|---------------|--------|
| `tests/cli/argv.test.ts` | Argv parsing + bounds validation (pure Node, no browser) | Vitest |
| `tests/cli/geolocation.spec.ts` | Full Playwright context: launches Chromium, verifies spoof via `data:` URL, cross-origin nav | Playwright |

**Why `data:` URLs for integration tests:** `https://browserleaks.com/geo` is a live external service — network flakiness would make tests non-hermetic. A `data:` URL serves an inline HTML document that calls `navigator.geolocation.getCurrentPosition()` and writes the result into a DOM element that Playwright can assert against. This is 100% hermetic and matches the integration test requirements.

**Cross-origin test approach:** After asserting the spoof on a first `data:` URL, navigate the same page to `about:blank` (different origin), then `page.evaluate` to call `getCurrentPosition()` again and assert the same coords. Context-scoped override must survive this navigation.

---

## Implementation Plan Summary

| Plan | File | Description |
|------|------|-------------|
| 01-01 | `scripts/cli-prototype.ts` | The CLI — launch Playwright Chromium with geo override |
| 01-02 | `tests/cli/argv.test.ts` | Vitest unit tests for argv parsing and bounds validation |
| 01-03 | `tests/cli/geolocation.spec.ts` | Playwright integration test — hermetic spoof verification |

---

*Research confidence: HIGH (all APIs verified against Playwright 1.60 docs and PITFALLS.md)*
