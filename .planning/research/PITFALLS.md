# Pitfalls Research

**Domain:** Chrome geolocation spoofing desktop launcher (CDP / Puppeteer / Playwright + Google Maps + Electron/Tauri)
**Researched:** 2026-05-14
**Confidence:** HIGH (core mechanics verified against Chromium DevTools Protocol docs, Playwright/Puppeteer issue trackers, and Google Maps Platform docs)

## Critical Pitfalls

### Pitfall 1: Calling `Emulation.setGeolocationOverride` without granting the geolocation permission on the target origin

**What goes wrong:**
The override is set, the page calls `navigator.geolocation.getCurrentPosition()`, and one of two things happens:
1. The browser shows the native "Allow this site to know your location?" prompt — and the test/user clicks Block, freezing the spoof permanently for that origin.
2. The error callback fires with `PERMISSION_DENIED` (code 1) and the page silently falls back to IP geolocation, reporting the user's *real* location.

The override coordinates are never consulted because permission was never granted. The override exists; the gate in front of it does not.

**Why it happens:**
`Emulation.setGeolocationOverride` and the permission system are two independent CDP surfaces. Devs reach for the obviously-named one (`setGeolocationOverride`) and assume that grants implicit permission. It does not. The same trap exists in the higher-level wrappers: Playwright's `context.setGeolocation()` and Puppeteer's `page.setGeolocation()` *also* require a separate `grantPermissions(['geolocation'])` call. The Playwright issue tracker has multiple confirmed bug reports of exactly this confusion (microsoft/playwright #18242, #22554, #1289).

**How to avoid:**
Always pair the two calls. With Playwright:
```ts
const context = await browser.newContext({
  geolocation: { latitude: 37.7749, longitude: -122.4194 },
  permissions: ['geolocation'],            // <-- mandatory
});
```
Or imperatively:
```ts
await context.grantPermissions(['geolocation'], { origin: 'https://example.com' });
await context.setGeolocation({ latitude, longitude });
```
With raw CDP, send `Browser.grantPermissions` (or the newer `Browser.setPermission`) *before* `Emulation.setGeolocationOverride`. If the launcher allows any origin (which it does — the user navigates anywhere), grant permissions with **no origin filter** so it applies to every origin in the context.

**Warning signs:**
- The launched Chrome reports the user's *real* city on browserleaks.com/geo while reporting the spoofed coords on a custom test page. (Real city = IP fallback; spoof never engaged.)
- A geolocation permission prompt appears in the launched window at all. (It should never appear — the spoof should be silent.)
- `navigator.permissions.query({name: 'geolocation'})` returns `prompt` instead of `granted` after launch.

**Phase to address:**
Phase 1 (Core spoofing primitive). This is the load-bearing mechanism; the entire product is non-functional without it. **Severity: BLOCKER.**

---

### Pitfall 2: Setting the override before a page exists / before navigation, then the override gets reset

**What goes wrong:**
The launcher calls `setGeolocationOverride` immediately after `browser.launch()` and before any page is created or navigated. By the time the user actually visits a site, either the override has been applied to the wrong target (the about:blank page that gets thrown away) or a fresh navigation has rebuilt the renderer context and dropped overrides applied to the page target instead of the browser context.

**Why it happens:**
CDP has *target-scoped* and *browser-scoped* commands. `Emulation.setGeolocationOverride` applied at the page-target level only lives for that target's lifetime; cross-process navigations (e.g. to a different origin) can re-create the target and the override silently dies. Puppeteer's `page.setGeolocation()` is page-scoped; Playwright's `context.setGeolocation()` is context-scoped (safer). Devs mix these up.

**How to avoid:**
- Use **browser context-level** geolocation (Playwright `context.setGeolocation`, or set `geolocation` in `newContext` options) so it survives navigations and new pages within the context.
- If using raw CDP, attach to *every* new target (`Target.targetCreated`) and re-apply `Emulation.setGeolocationOverride` per target. Don't rely on a one-shot call.
- Apply override **after** the first page is created (so there's a valid target) but **before** the first `goto`.

**Warning signs:**
- Spoof works on the first page load but fails after clicking a link to a different origin.
- Spoof works in the address bar tab but new tabs (`window.open`) report real location.
- `chrome.targets()` shows multiple targets with mismatched overrides.

**Phase to address:**
Phase 1 (Core spoofing primitive). **Severity: BLOCKER.**

---

### Pitfall 3: Stale or shared `user-data-dir` leaking real location, cached permissions, or hitting SingletonLock

**What goes wrong:**
Three distinct failures bundled under one cause:
1. **Stale state leak**: Reusing a `user-data-dir` from a previous session means cached `Default/Preferences`, cached HSTS, cookies, and (most damning) cached permission grants/denials from a prior origin. A site that was previously denied geolocation stays denied — silent failure of the spoof.
2. **SingletonLock collision**: Two launches pointed at the same `user-data-dir` produce `The profile appears to be in use by another Chromium process` and the second launch aborts (or, on Linux, the second instance opens a window inside the first process and ignores all CLI flags including remote-debugging-port).
3. **Permission cache poisoning**: User clicked "Block" on the geolocation prompt at some point. That decision is persisted in `Preferences` and survives across launches; `grantPermissions` from CDP overrides at runtime but if the launcher forgets to grant on the right origin (see Pitfall 1), the stored Block wins.

**Why it happens:**
Devs want "persistent profile" for convenience (logged-in sessions, bookmarks) and don't think about state leakage. Or they hardcode a single `userDataDir: './chrome-profile'` and try to launch two instances.

**How to avoid:**
- **Default: ephemeral profile per launch.** Create `userDataDir` under `os.tmpdir()` with a UUID suffix per launch; delete on exit (or on next launch, lazily). Confirmed by puppeteer/puppeteer #4860 and #921.
- **If persistent profile is wanted (v2 feature)**: assign one `user-data-dir` per *pin/profile slot*, never share across concurrent launches. Acquire an in-process lock before spawning to prevent double-launch on the same dir.
- Set `--no-first-run --no-default-browser-check` flags to avoid the "Welcome to Chrome" intro page consuming the first navigation.

**Warning signs:**
- "Profile in use" / "SingletonLock" error on launch.
- Geolocation prompt appears once and never again, even when you switch pins (cached denial).
- Real location reported only on certain origins (= cached per-origin denial).

**Phase to address:**
Phase 2 (Multi-instance / process management). **Severity: BLOCKER for multi-instance, MAJOR for single-instance.**

---

### Pitfall 4: Google Maps API key with HTTP-Referrer restriction breaks in Electron's `file://` shell

**What goes wrong:**
You restrict your Google Maps API key by HTTP-Referrer (good security practice) and ship the desktop app. The map renders gray with `RefererNotAllowedMapError` in the console, because Electron loads the renderer from `file://` (or `app://`) and either no `Referer` header is sent at all or it doesn't match any pattern you can register in the Cloud Console.

**Why it happens:**
Google's API-key HTTP-Referrer restriction only matches `http(s)://` referrers reliably. `file://` is documented as a "partially supported exotic scheme" (Google Issue Tracker #124858510 / #35828931 — open for years). Many devs paste the file path into the allow-list and assume it works.

**How to avoid:**
- **Option A (recommended for desktop)**: serve the map UI from a local HTTP server (`localhost:<random-port>`) that Electron/Tauri loads in its window. Set the API key to allow `http://localhost/*`.
- **Option B**: use an unrestricted API key with **tight quota caps** (QPD limits set in Cloud Console, see Pitfall 5) and ship it embedded in the app, accepting that any user can extract and abuse it within quota.
- **Option C**: switch to a tile provider that doesn't require referrer restrictions (Mapbox, MapTiler, OSM raster tiles) — see ARCHITECTURE.md for tradeoffs. Out of scope for v1 if Google Maps is a hard requirement.
- **Never** ship a referrer-restricted key with Electron `loadFile()`.

**Warning signs:**
- Gray map + console errors: `Google Maps JavaScript API error: RefererNotAllowedMapError`, `API keys with referer restrictions cannot be used with this API`.
- Map works in `npm run dev` (vite dev server = `http://localhost`) but breaks in packaged build (`file://`).

**Phase to address:**
Phase 0 (Project bootstrap) — bake the local-server pattern into the shell before writing map code. **Severity: BLOCKER (silent map failure in production).**

---

### Pitfall 5: Google Maps billing surprise from satellite tile usage + unrestricted key

**What goes wrong:**
The app uses satellite view (`mapTypeId: 'satellite'`), which is a higher-cost SKU than 2D roadmap tiles. The user pans/zooms a lot during normal use (this is a *map-driven* app — that's the core interaction). Combined with an unrestricted API key (necessary per Pitfall 4 for desktop shells), the monthly bill goes from $0 to "uncomfortable" fast. Worst case: the API key leaks (someone disassembles the desktop app, extracts the embedded key) and runs up bills with no quota cap set.

**Why it happens:**
Dev mode never exceeds the free tier. Production usage scales with engagement. Google Maps Platform free tier is ~$200/month credit but satellite ("Map Tiles" SKU) burns through faster than basemap; pricing tiers have been raised over time (Radar/NextBillion writeups document past surprise increases). No default quota cap exists — you have to set one.

**How to avoid:**
- **Set hard QPD (queries-per-day) caps** in Cloud Console > APIs & Services > Maps JavaScript API > Quotas. Pick a number that covers normal solo use (say, 10,000/day) so a leaked key can only do limited damage per day.
- **Cache tiles aggressively** at the shell layer if possible (note: Google ToS restricts tile caching duration — read the terms). Or: rely on the browser's HTTP cache and don't programmatically force-reload tiles.
- **Default to roadmap, offer satellite as a toggle**, unless satellite is genuinely the requested default (PROJECT.md says satellite is the default — accept the cost but cap it).
- **Set up a billing budget alert** at $5, $20, $50 thresholds — Google Cloud Billing supports this natively.
- Use **API key application restrictions** by bundle ID / app fingerprint where possible (Maps SDK for iOS/Android supports this; web JS API does not, so quota cap is the only real lever).

**Warning signs:**
- Cloud Billing dashboard shows daily charges climbing.
- Map shows "For development purposes only" watermark = exceeded free tier and no billing account attached.
- Stack Overflow / Twitter posts about your app key showing up in random places (extraction).

**Phase to address:**
Phase 0 (Bootstrap — set quota cap before first commit), Phase 2 (Production hardening). **Severity: MAJOR (cost), MINOR (functional — app keeps working).**

---

### Pitfall 6: Electron with `nodeIntegration: true` and/or `contextIsolation: false` shipping a remote-loaded map

**What goes wrong:**
The desktop shell loads `https://maps.googleapis.com/maps/api/js` into the renderer with Node integration enabled and context isolation disabled (Electron's old defaults). Any XSS in that remote script — or, more realistically, any tab the user is tricked into navigating to — gets `require('child_process').exec(...)` access. The "geolocation spoofing tool" becomes a remote-code-execution surface.

**Why it happens:**
Tutorial copy-paste. Old Electron tutorials (pre-Electron 12) enable `nodeIntegration: true` to make dev easier. Devs don't realize context isolation has been default-on since Electron 12 and they overrode it back to false. The Electron security docs themselves call this out as the #1 mistake.

**How to avoid:**
```js
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,        // default since Electron 12 — DO NOT DISABLE
    nodeIntegration: false,        // default — DO NOT ENABLE
    nodeIntegrationInWorker: false,
    nodeIntegrationInSubFrames: false,
    sandbox: true,                 // enable explicitly
    webSecurity: true,             // default — DO NOT DISABLE
    preload: path.join(__dirname, 'preload.js'),
  }
});
```
Use `contextBridge.exposeInMainWorld()` in `preload.js` to expose only a narrow API (`launchChromeAtCoords`, `listInstances`, etc.) — never expose `ipcRenderer` raw.

For **Tauri**: don't paste v1 `allowlist` examples into a v2 `tauri.conf.json` (causes "Additional properties are not allowed ('allowlist' was unexpected)" — Tauri #7501). Use the v2 capability file system in `src-tauri/capabilities/*.json`. Grant only the specific commands the frontend calls (`shell:allow-spawn` scoped to the Chrome binary path, not `shell:allow-execute` with a wildcard).

**Warning signs:**
- `nodeIntegration: true` or `contextIsolation: false` anywhere in your codebase.
- Renderer can `require('fs')` directly.
- electron-builder warnings about insecure webPreferences.
- Tauri runtime errors "permission denied for command X" or silent IPC failures (forgot capability).

**Phase to address:**
Phase 0 (Shell scaffolding). **Severity: BLOCKER (security).**

---

### Pitfall 7: Coordinate-only spoof advertised as "Chrome thinks it's there" — sensor-completeness mismatch

**What goes wrong:**
The override sets `navigator.geolocation.getCurrentPosition()` to (lat, lng) — but the same Chrome instance still reports:
- `Intl.DateTimeFormat().resolvedOptions().timeZone` = user's real timezone (e.g., `America/Los_Angeles` even though pin is in Tokyo)
- `navigator.languages` = user's real language array
- `Date().getTimezoneOffset()` = real offset
- `Accept-Language` header = real preference
- IP address = real IP (out of scope per PROJECT.md, but worth surfacing)
- WebRTC ICE candidates leak real local IPs (browserleaks/webrtc detects this)

Sophisticated sites (fraud detection, ad targeting, geo-restricted streaming) cross-check these signals and reject the spoof as inconsistent. The user thinks "geolocation = location" and is surprised when Netflix still serves them their real country's catalog.

**Why it happens:**
Naming. "Geolocation" sounds like "where the browser thinks it is, full stop." Mental model collapse: users equate the JS Geolocation API with the browser's overall locale identity. fingerprint.com and Castle.io both publish detection guides specifically about this mismatch as a spoofing tell.

**How to avoid:**
PROJECT.md correctly scopes timezone/language/IP as **Out of Scope** — keep it that way for v1. The pitfall here is **failing to communicate the scope to users.** Concrete mitigations:
- The launched-Chrome window should display a one-time **first-run overlay** explaining: "Coordinates only. Your timezone, language, and IP are unchanged. For full locale spoofing use a VPN + extension stack."
- The "Verify spoof" button (already in PROJECT.md requirements) should open **browserleaks.com/geo** *and* **browserleaks.com/ip** *and* **browserleaks.com/timezone** in tabs so the user immediately sees which signals leak.
- Document the limitation in README and the app's about/help screen.
- (v2, optional): add toggle to also override timezone via CDP `Emulation.setTimezoneOverride` and language via `--lang=` CLI flag + `Emulation.setLocaleOverride`. Cheap to add later; just out of v1 scope.

**Warning signs:**
- Users file bugs like "Netflix still shows me US content" — not a bug, but a scope-communication failure.
- App store reviews mention "doesn't actually spoof location" when they mean "doesn't spoof IP."

**Phase to address:**
Phase 3 (UX polish / verification flow). **Severity: MAJOR (user satisfaction, not technical correctness).**

---

### Pitfall 8: Remote-debugging-port collisions across concurrent launches

**What goes wrong:**
Launcher hardcodes `--remote-debugging-port=9222` (the canonical default). User pins location A, launches → works. User pins location B and launches a second instance → CDP can't bind 9222 (already taken), so either:
- Puppeteer/Playwright connects to the *first* instance's debug port and starts driving the wrong window, or
- The second launch silently fails to expose CDP, the spoof is never applied, and the second window reports real location.

**Why it happens:**
Default examples in Puppeteer/Playwright/CDP tutorials all use 9222. Multi-instance is an afterthought.

**How to avoid:**
- Use port **`0`** (`--remote-debugging-port=0`) which tells Chromium to bind an ephemeral port. Read the actual port from `<userDataDir>/DevToolsActivePort` (Chromium writes the chosen port there on startup) before connecting.
- Or: pick a random free port in the launcher (e.g., `get-port` npm package) and pass it explicitly.
- Track which port belongs to which pin in the launcher's process registry.
- Combined with Pitfall 3 (unique user-data-dir per launch), this is the standard multi-instance pattern.

**Warning signs:**
- Second launch "works" but is actually controlling the first window.
- `EADDRINUSE` errors in launcher logs.
- Closing window A also kills CDP connection to window B (you were connected to A all along).

**Phase to address:**
Phase 2 (Multi-instance). **Severity: BLOCKER for the multi-instance requirement in PROJECT.md.**

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoded Google Maps API key in source | Skip config step in v1 | Key leaks, billing abuse, must rotate later | Never for production; OK for personal-only build with quota cap set |
| Single shared `user-data-dir` across launches | Saves dir-management code | SingletonLock errors, state bleed between pins, blocks multi-instance entirely | Never — even single-instance v1 should use ephemeral dirs |
| Hardcoded `--remote-debugging-port=9222` | Matches every tutorial | Blocks multi-instance, hard to debug "wrong window" issues | Single-instance prototype day 1 only |
| Skip the `grantPermissions` call ("I'll add it later") | One less line | Silent spoof failure on every page that calls geolocation — and you'll blame the override | Never |
| Load Google Maps from `file://` directly in Electron | No local server to set up | `RefererNotAllowedMapError` in production, must restrict key by user-agent only (weaker) | Never — set up the local server on day 1 |
| Skip ephemeral profile cleanup on exit | Less code | Disk fills with stale `Default/` dirs over time (each = 50–500MB with caches) | OK if cleanup runs on next launch instead |
| Embedded API key without quota cap | "I'll set quota later" | Surprise billing if key leaks; no recovery option once charged | Never — quota cap takes 30 seconds in Cloud Console |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Google Maps JS API | Restrict key by HTTP referrer, then load in Electron `file://` | Serve UI from `http://localhost:<port>`; restrict key to `localhost/*` |
| Google Maps JS API | Use `mapTypeId: 'satellite'` without billing alerts | Set QPD quota cap + budget alert before first launch |
| Google Cloud (any) | Forget to enable Maps JavaScript API specifically (different from "Maps Platform") | Enable the exact SKU(s) you use; check by visiting the API page in Cloud Console |
| CDP `Emulation.setGeolocationOverride` | Apply at page-target level, expect it to survive navigation | Use `Browser`-level or context-level scope; re-apply on `Target.targetCreated` |
| CDP `Browser.grantPermissions` | Omit `origin` and assume it applies globally | It does apply globally when omitted — verify with `navigator.permissions.query` post-grant |
| Puppeteer `page.setGeolocation` | Skip `context.overridePermissions(['geolocation'])` | Always call both; pair them in a wrapper function |
| Playwright `context.setGeolocation` | Forget `permissions: ['geolocation']` in `newContext` | Bake into a factory function; never call `newContext` directly elsewhere |
| Chrome launch flags | Use deprecated `--enable-blink-features` syntax | Check `chrome://flags` and CDP docs against the actual installed Chrome version |
| Electron + Chrome automation | Use Electron's bundled Chromium as the *automated* target | Launch a *separate* Chrome process — Electron's renderer is not the spoof target |
| Tauri v2 | Copy v1 `allowlist` config | Use `src-tauri/capabilities/*.json` files (Tauri #7501) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-rendering map on every pin drag | Stutter while dragging | Use Google Maps `Marker` with `draggable: true` and listen to `dragend`, not `drag` (or debounce `drag` to 50ms) | Immediately, on slower machines |
| Reading lat/lng from React state on every mousemove | Map jank, dropped frames | Pin position lives in the map instance; React state updates only on `dragend` | Even on fast machines if listeners are dense |
| Bundling the full Google Maps SDK eagerly | App startup 2–3s slower | Lazy-load `@googlemaps/js-api-loader` after window paints | At cold-start, every launch |
| Spawning Chrome on UI thread | UI freezes during 1–3s launch | Spawn via `child_process` in main process; report progress to renderer via IPC | Every launch |
| Not pooling CDP connections across multi-instance | Connection setup tax per launch | Reuse `chromium.connectOverCDP()` clients keyed by port | At 3+ concurrent instances |
| Polling for pin coords instead of event-driven | Wasted CPU, sluggish updates | Subscribe to Maps `dragend` event | Always — fix from day 1 |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `nodeIntegration: true` in Electron renderer | Remote-loaded script (Maps SDK) gets shell access | Keep Electron defaults; use `contextBridge` preload pattern |
| `contextIsolation: false` | Renderer can mutate Electron internals via prototype pollution | Keep default (true since Electron 12) |
| Disable `webSecurity` to fix a CORS issue | Bypass same-origin protections everywhere | Fix CORS at the source (serve assets locally) |
| Tauri capability with `shell:allow-execute` and wildcard scope | Frontend can spawn arbitrary processes | Use `shell:allow-spawn` with explicit binary path in scope |
| Embed Google Maps API key in source committed to git | Public scraping bots find it, abuse runs up bills | `.gitignore` the config file; load from `~/.config/anticlicker/config.json` |
| Log launched Chrome's `wsEndpoint` (websocket URL) in plain console output | Anyone with stdout access controls the browser | Treat ws endpoints as secrets; redact in logs |
| Trust pin coords from frontend without bounds-checking | `lat > 90` crashes Chrome with cryptic CDP error | Validate `-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180` in main process before CDP call |
| Auto-update the desktop shell without code signing | MITM attacker swaps in malicious update | Code-sign on macOS (notarization required for Gatekeeper); sign on Windows |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No feedback during 1–3s Chrome launch | User clicks "Launch" 5 times, gets 5 Chrome windows | Disable button + show spinner; debounce launch action |
| Silent failure when API key is missing | Gray map with no explanation | Detect missing/invalid key on startup; show explicit setup screen with link to Cloud Console |
| User expects timezone/IP spoof too | "It doesn't work, Netflix still detects me" reviews | First-run overlay explicitly scoping the tool to coords only (Pitfall 7) |
| Pin coordinates shown only as `(37.7749, -122.4194)` | Users can't sanity-check the location | Also show reverse-geocoded city/country (Geocoding API call — costs money, cache) or a tiny "Tokyo, Japan" label from a free offline reverse-geocoder like `city-timezones` |
| Verify-spoof button opens just one test site | User sees one green checkmark, ships it, then a different site detects them | Open browserleaks.com/geo *and* /ip *and* /timezone so user sees the full picture |
| Closing the launcher window also kills the launched Chrome | User loses their browsing session unexpectedly | Decouple lifecycles; launcher quitting should NOT kill spawned Chromes (or warn explicitly) |
| Pin defaults to (0, 0) "Null Island" on first launch | User sees ocean, confused | Default to user's actual approximate location (one-time IP geolocation), or to a recognizable city like San Francisco |
| Drag-pin lag on satellite tiles | Pin feels glued, frustrating UX | Marker drag is decoupled from tile rendering — should be smooth even mid-tile-load; if not, use a lighter overlay |

## "Looks Done But Isn't" Checklist

- [ ] **Geolocation override:** Often missing `grantPermissions` call — verify by visiting browserleaks.com/geo in the launched window with **no** prompt appearing.
- [ ] **Multi-instance launch:** Often shares user-data-dir or port — verify by launching 2 instances at different pins simultaneously, both report their own pin's coords on browserleaks.com/geo.
- [ ] **Persistence across navigation:** Override often dies on cross-origin nav — verify by loading site A (spoof works), clicking link to site B on a different domain, spoof still works.
- [ ] **New tab / window.open:** Often the override only applies to the first tab — verify by opening a new tab in the launched Chrome, navigating to browserleaks.com/geo, spoof still works.
- [ ] **API key restriction:** Often only tested in dev — verify by running the packaged production build, map renders without watermark and without console errors.
- [ ] **Billing quota cap:** Often "I'll do it later" — verify Cloud Console > Quotas shows a finite QPD limit before first user launch.
- [ ] **Electron preload security:** Often `nodeIntegration: true` left in for "debugging" — verify by `grep -r nodeIntegration src/` returns only `false`.
- [ ] **Profile cleanup:** Often profiles accumulate — verify `~/.anticlicker/profiles/` (or wherever) is bounded after 20 launches.
- [ ] **Chrome version compatibility:** Often only tested on dev's Chrome version — verify on the oldest Chrome you intend to support; CDP commands have shipped/deprecated over versions.
- [ ] **First-run UX:** Often "works on my machine" — verify by deleting all app state and re-launching, every required setup step is discoverable.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Missing grantPermissions (Pitfall 1) | LOW | Add `permissions: ['geolocation']` to context creation; one-line fix |
| Override resets on navigation (Pitfall 2) | LOW–MEDIUM | Move from page-scoped to context-scoped API; add `Target.targetCreated` handler |
| Stale user-data-dir leaks (Pitfall 3) | MEDIUM | Switch to ephemeral dirs; existing users need a "reset profile" button |
| API key broken by referrer restriction (Pitfall 4) | MEDIUM | Stand up a local HTTP server in the shell; refactor map loader; update key restrictions |
| Billing overrun (Pitfall 5) | HIGH | Set quota cap (5 min); request Google billing waiver for first overrun (sometimes granted for small amounts); rotate key |
| Electron security holes (Pitfall 6) | HIGH | Audit all `webPreferences`; refactor IPC through `contextBridge`; possibly ship an emergency patch update |
| Scope-communication failure (Pitfall 7) | LOW | Add overlay + docs update; non-code fix |
| Port collision (Pitfall 8) | LOW | Switch to ephemeral port (`--remote-debugging-port=0`); read from `DevToolsActivePort` |
| CDP API breakage on new Chrome version | MEDIUM | Pin Chromium version via Playwright's bundled binary; or detect Chrome version and branch CDP calls |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Missing grantPermissions | Phase 1 (Core spoof) | Visit browserleaks.com/geo in launched window, no permission prompt, correct coords shown |
| 2. Override resets on navigation | Phase 1 (Core spoof) | Navigate across origins, re-test geo |
| 3. Stale user-data-dir | Phase 1 (single-instance) + Phase 2 (multi) | Launch, close, launch again — no profile-in-use error; pins don't bleed state |
| 4. file:// referrer broken | Phase 0 (Shell bootstrap) | Build packaged app, map renders without errors |
| 5. Billing surprise | Phase 0 (Cloud Console setup) + Phase 3 (polish) | Quota cap visible in Cloud Console; budget alert configured |
| 6. Electron security defaults | Phase 0 (Shell scaffolding) | Code review + grep for `nodeIntegration: true` / `contextIsolation: false` |
| 7. Scope-communication | Phase 3 (UX polish) | First-run overlay present; verify-spoof button opens all three test pages |
| 8. Port collision | Phase 2 (Multi-instance) | Launch 2 instances simultaneously, both work independently |

## Sources

**Chrome DevTools Protocol — authoritative:**
- [CDP Emulation domain](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/) — `setGeolocationOverride` reference
- [CDP Browser domain](https://chromedevtools.github.io/devtools-protocol/tot/Browser/) — `grantPermissions` / `setPermission` reference
- [Chromium issue 631464: Make it possible to control permissions in DevTools](https://bugs.chromium.org/p/chromium/issues/detail?id=631464)

**Playwright issues confirming permission/spoof bugs:**
- [microsoft/playwright #18242 — geolocation permissions not working in Chromium](https://github.com/microsoft/playwright/issues/18242)
- [microsoft/playwright #22554 — setGeolocation doesn't change location as seen from internet](https://github.com/microsoft/playwright/issues/22554)
- [microsoft/playwright #1289 — Overriding location problem](https://github.com/microsoft/playwright/issues/1289)
- [Using Geolocation in Playwright tests (Tim Deschryver)](https://timdeschryver.dev/blog/using-geolocation-in-playwright-tests)

**Puppeteer issues — user-data-dir and permissions:**
- [puppeteer/puppeteer #5442 — setGeolocation not working with permission override](https://github.com/puppeteer/puppeteer/issues/5442)
- [puppeteer/puppeteer #4860 — Profile appears in use by another Chromium process](https://github.com/puppeteer/puppeteer/issues/4860)
- [puppeteer/puppeteer #921 — userDataDir + headless = lost authorization](https://github.com/puppeteer/puppeteer/issues/921)
- [Page.setGeolocation() — Puppeteer docs](https://pptr.dev/api/puppeteer.page.setgeolocation)

**Google Maps — keys, billing, referrer:**
- [Google Maps Platform security guidance](https://developers.google.com/maps/api-security-best-practices)
- [Maps JavaScript API Usage and Billing](https://developers.google.com/maps/documentation/javascript/usage-and-billing)
- [Maps JS API Error Messages (RefererNotAllowedMapError)](https://developers.google.com/maps/documentation/javascript/error-messages)
- [Google Issue Tracker #124858510 — API key referrer issues non-http(s) and file URI schemes](https://issuetracker.google.com/issues/124858510)
- [Google Issue Tracker #35828931 — Support API key restrictions with file:// referers](https://issuetracker.google.com/issues/35828931)

**Electron security:**
- [Electron Security tutorial](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron Context Isolation tutorial](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [electron/electron #23506 — Changing defaults for nodeIntegration and contextIsolation](https://github.com/electron/electron/issues/23506)
- [Doyensec Electron Security Checklist (PDF)](https://www.doyensec.com/resources/us-17-Carettoni-Electronegativity-A-Study-Of-Electron-Security-wp.pdf)

**Tauri v2 capabilities:**
- [Tauri v2 Capabilities](https://v2.tauri.app/security/capabilities/)
- [Tauri v2 Permissions](https://v2.tauri.app/security/permissions/)
- [tauri-apps/tauri #7501 — allowlist added to tauri.config throws error (v1→v2 migration)](https://github.com/tauri-apps/tauri/issues/7501)

**Fingerprinting / scope mismatch:**
- [Fingerprint.com — How to Detect Location Spoofing](https://fingerprint.com/blog/location-spoofing-detection/)
- [Castle.io — Detect browser timezone using JavaScript](https://blog.castle.io/how-to-detect-browser-time-zone-using-javascript/)
- [BrowserLeaks — Geolocation test](https://browserleaks.com/geo)
- [BrowserLeaks — WebRTC leak test](https://browserleaks.com/webrtc)

---
*Pitfalls research for: Pin-to-Geolocation Chrome Launcher (greenfield, v1)*
*Researched: 2026-05-14*
