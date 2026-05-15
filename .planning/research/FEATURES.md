# Feature Research

**Domain:** Desktop geolocation-spoofing Chrome launcher (pin-to-coords, CDP-driven, single-machine dev/QA tool)
**Researched:** 2026-05-14
**Confidence:** HIGH (well-trodden domain — DevTools Sensors, Playwright/Puppeteer geolocation APIs, browser extensions, anti-detect browsers all overlap; Chrome's `Emulation.setGeolocationOverride` is documented and stable)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete and people churn back to DevTools Sensors or `--user-data-dir` shell scripts.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive map with draggable pin | Core promise of the product — "drop a pin = set location." DevTools Sensors lacks this; it's the whole reason to use AntiClicker. | MEDIUM | Google Maps JS API (key required); satellite view default per PROJECT.md. Drag handler streams lat/lng to a state store. |
| Satellite view as default tile layer | PROJECT.md explicit requirement; users picking a visually-identifiable spot want the visual context. | LOW | One config flag on the Maps instance (`mapTypeId: 'satellite'`). |
| Lat/lng displayed numerically and copyable | Users want to verify, paste into bug reports, share with teammates. | LOW | Live-update display under the map; one-click copy button. |
| Manual lat/lng entry → map jumps to pin | Reverse lookup: paste coords from a bug report or DevTools and put the pin there. | LOW | Two number inputs + a "go" button; calls `map.panTo()` + `setMarkerPosition()`. Mirrors DevTools custom-location entry. |
| One-click "Launch Chrome here" action | The product's hero action. Must be visually obvious (big button, not a menu). | MEDIUM | Spawns Chrome subprocess with `--user-data-dir` + Puppeteer/Playwright wiring `setGeolocationOverride`. |
| Geolocation override works for `navigator.geolocation.getCurrentPosition()` | Bare minimum for the spoof to be useful. PROJECT.md active requirement. | LOW | CDP `Emulation.setGeolocationOverride` once per page; auto-grant geolocation permission via `Browser.grantPermissions`. |
| Permission auto-grant for geolocation | If Chrome shows the "Allow location access?" prompt every time, users will think the spoof is broken. | LOW | `BrowserContext.grantPermissions(['geolocation'], { origin })` or CDP equivalent. Critical — easy to miss, ruins UX. |
| Multiple instances at different pins without collision | PROJECT.md active requirement. Anti-detect browsers and Playwright contexts both support this; users will expect it. | MEDIUM | Distinct `--user-data-dir` per launched window; track child processes in a registry. |
| Verification: "Test on browserleaks.com / mylocation.org" button | PROJECT.md active requirement. Users have no other way to know if the spoof actually took effect. | LOW | Button opens a known test URL inside the launched Chrome (not the system browser). |
| Visible "this Chrome is spoofed" indicator | Easy to lose track of which window is which. Anti-detect browsers all do this (window title, badge). | LOW | Set window title prefix or open a small extension/page injected via Puppeteer that shows the active spoofed coords. |
| Graceful shutdown of launched Chrome windows | If the app crashes and leaves orphaned Chrome processes with locked user-data-dirs, users hate it. | MEDIUM | Track child PIDs, clean up `user-data-dir` temp folders on exit, handle SIGINT. |
| Visual feedback on Chrome launch (loading state, success/failure) | A 3–5 second silent gap after clicking "Launch" feels broken. | LOW | Spinner + status text driven by Puppeteer/Playwright connection promise. |
| Reasonable error messages when Chrome isn't installed or launch fails | macOS users may not have Chrome at the expected path; Playwright may need a bundled Chromium fallback. | LOW | Detect install paths; surface "Install Chrome or use bundled Chromium" with a clickable fix. |
| Settings/config screen for Google Maps API key | PROJECT.md constraint: don't hard-code, store in local config outside VCS. | LOW | One settings panel; persists to `~/Library/Application Support/AntiClicker/config.json` (macOS-appropriate path). |

### Differentiators (Competitive Advantage)

Features that set the product apart from DevTools Sensors, Location Guard, and anti-detect browsers. These align with the Core Value: *one click on a map = a Chrome window that is at that location.*

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Live coordinate update — drag the pin AFTER launch, coords update in the running Chrome | Massive differentiator: DevTools Sensors only updates while DevTools is open; Location Guard needs a refresh; Playwright needs code. AntiClicker would feel "alive." | MEDIUM | Hold the CDP session open; on pin drag, send a new `Emulation.setGeolocationOverride` to the live page. Watch out: only affects the active page; tab navigation needs re-application via `page.evaluateOnNewDocument` style hook. |
| Visual satellite-view pin placement (vs typing coordinates) | The "drop pin = location" metaphor is genuinely faster than DevTools Sensors' dropdown or coordinate entry. Mirrors mobile location-spoofer apps (iToolab AnyGo, etc.) but for desktop dev work. | LOW (given Maps) | The Maps SDK does the heavy lifting. |
| Per-window pin (multi-instance with independent locations) | PROJECT.md requirement, but worth highlighting: you can have a Chrome at Tokyo and another at São Paulo side-by-side, drag each pin independently. Anti-detect browsers do this but charge for it. | MEDIUM | Map UI shows multiple pins, each colored/labeled with its Chrome window. State store keyed by window ID. |
| In-app verification panel (no need to open browserleaks manually) | Show the spoofed coords + a "Verify" button that opens browserleaks.com **inside** the launched Chrome and surfaces the result back to the AntiClicker UI if possible. | MEDIUM | The "round-trip" check — query `navigator.geolocation` via CDP `Runtime.evaluate` and display the result in the launcher UI. Strong proof for skeptical users. |
| Keyboard shortcuts (Cmd+L to launch, Cmd+drag for fine pin, etc.) | Power-user QA people want this. DevTools Sensors has no shortcuts; Playwright is code-only. | LOW | Electron/Tauri globalShortcut or in-window key handlers. |
| Recently-used pin coordinates (in-memory only, not persisted) | Threads the needle: PROJECT.md defers persistent history, but an in-memory "last 5 pins this session" list is huge UX value with no storage. | LOW | Push to a bounded array on launch; clear on app quit. NOT the same as persistent history. |
| Coordinate format flexibility (decimal degrees, DMS, paste-from-Google-Maps URL) | Users will copy coords from Google Maps search bar (often `lat,lng` in a URL), bug reports (DMS sometimes), or DevTools (decimal). | LOW | Single input that auto-detects format; reverse-tested via parsers like a small `parseLatLng()` util. |
| Pre-flight: detect if Chrome is already running and warn about CDP conflicts | New users get confused when CDP-controlled Chrome interferes with their personal Chrome session (port/user-data-dir collisions). | LOW | Check for running `Google Chrome.app` processes that share the default user-data-dir; warn before launching. |
| Click-to-recenter map on launched Chrome's pin | Power flow: user has many windows, clicks one in a sidebar, map flies to its pin. Mirrors anti-detect browsers' "focus profile" UX. | LOW | Sidebar list of active windows; click → `map.panTo()`. |
| Bundled Chromium fallback when system Chrome is missing | Removes the "install Chrome first" friction; Playwright already ships Chromium binaries. | LOW (Playwright) | Use Playwright's bundled Chromium when Chrome isn't found. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create scope creep, security risk, or fight the v1 thesis. **All PROJECT.md "Out of Scope" items are preserved here with the original reasoning.**

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Mobile app version** | Devs want it on the go; existing GPS spoofers (iToolab, etc.) are mobile. | PROJECT.md: "keep scope tight." Mobile geolocation spoofing requires root/jailbreak or Apple Developer profile shenanigans — completely different problem space. | Defer indefinitely; v1 is web/desktop only. |
| **IP / VPN spoofing** | Users see geo-restricted content fail because IP doesn't match the spoofed lat/lng; assume one tool should do both. | PROJECT.md: "network-level spoofing is a different problem and out of scope." Implementing this responsibly requires a VPN backend (legal, infra, cost). | Document the limitation prominently in onboarding; recommend pairing with their own VPN/proxy. |
| **Timezone / locale / language spoofing** | Sites like Google use `Accept-Language` and timezone to localize content; mismatched signals make spoofing detectable. Anti-detect browsers (Kameleo, Multilogin, GoLogin) all do this. | PROJECT.md: "pure coordinate override only; can be added later." Timezone override via CDP `Emulation.setTimezoneOverride` is one line — but locale chains touch headers, `navigator.language`, `Intl.*`, system fonts — full surface is anti-detect-browser territory, not v1. | Defer to a future version; v1 is the geolocation primitive. |
| **Browser-extension form factor** | "Why not just a Chrome extension?" Easier install, no automation needed. | PROJECT.md: "v1 is a standalone desktop app that drives Chrome via automation, not an extension." Extensions can't override geolocation at the sensor level reliably — Location Guard intercepts the JS API, but advanced fingerprinting (Sensor APIs, etc.) can detect the patch. CDP-driven override is the authoritative path. | Document why the desktop app exists; eventually a complementary extension could surface launcher actions, but it's not v1. |
| **Persistent pin history / saved locations** | Mobile spoofers (iToolab AnyGo, Syncios) heavily feature this; users will ask. | PROJECT.md: "nice-to-have, defer." Persistence brings storage location, sync, naming, search, deletion, import/export — meaningful surface area. | In-memory recent list only for v1 (see Differentiators). Persistence can come post-validation. |
| **Accuracy radius / movement simulation (drift, walking paths)** | Some QA workflows need to simulate a moving user (GPS routes); Chrome's `accuracy` parameter dangles the temptation; ChromeGeolocationSpoof GitHub project does routes. | PROJECT.md: "static coordinates only for v1." Movement simulation needs a path editor, speed control, timing engine — a whole UX, not a feature. | Static coords for v1. Document this as a v2 candidate if users ask. The `accuracy` param can default to a sensible value (e.g., 20m) without exposing it as UI. |
| Full fingerprint customization (Canvas, WebGL, AudioContext, fonts, screen resolution) | Anti-detect browser users will ask; sites like Tinder/Bumble actively fingerprint. | This is what anti-detect browsers (GoLogin, Multilogin, Kameleo) charge $50-200/mo for. Massive surface, ongoing maintenance against fingerprint detection arms race. v1 is a geolocation tool, not an anti-detect browser. | Stay focused. Recommend Kameleo/Multilogin if users want anti-detect; AntiClicker complements them by being free and pin-driven for the geolocation slice. |
| Cloud sync of pins / profiles across machines | Anti-detect browsers offer it; obvious "what if I want this at work and home?" | Requires backend, auth, security model, terms of service. Out of scope for a personal/dev tool. | Local-only config; users can sync via their own dotfiles if desired. |
| Bot / automation scripting inside launched Chrome | Directory is named `antiClicker` — users will assume click-recording or replay. | Conflates the geolocation primitive with browser automation. The launched Chrome is just Chrome — users can attach their own Puppeteer to it via the open debug port if they need that. | Document the open CDP port (if exposed) so power users can attach their own tools. Don't build the automation UI. |
| In-app proxy/VPN configuration UI | "If you can't do VPN, at least let me configure my SOCKS proxy in the UI." | Adds proxy auth, error handling, leak detection — non-trivial. Chrome already supports `--proxy-server`; passing user-supplied flags is doable but easy to do badly. | Allow a pass-through "extra Chrome flags" advanced setting in config (power-user escape hatch), but no first-class proxy UI in v1. |
| Reverse-IP-to-location auto-pin | "Put the pin where my IP currently is." | Sounds free, but requires an IP-geolocation API (cost, rate limits, privacy implications). | User can manually drop the pin; that's the core flow anyway. |
| Sharing pins via URL / deep linking | "Send a friend this exact spoofed location." | Requires URL scheme handler registration, OS-level integration, and the spoof itself requires the recipient to also have AntiClicker — limited utility. | Copy lat/lng → paste into any Maps URL works fine. |

## Feature Dependencies

```
Map UI with pin (Google Maps API + draggable marker)
    ├──requires──> Maps API key configuration (settings screen)
    └──enables──> Manual lat/lng entry → map (uses same marker state)
                       └──enables──> Coordinate format flexibility (paste from Maps URL, etc.)

Chrome launch action
    ├──requires──> Puppeteer/Playwright integration
    │                  ├──requires──> Chrome executable detection OR bundled Chromium
    │                  └──requires──> CDP session management
    │                                      └──enables──> Live coordinate update on drag
    ├──requires──> --user-data-dir management (temp dir creation + cleanup)
    │                  └──enables──> Multi-instance (each window gets a unique dir)
    ├──requires──> Permission auto-grant (browserContext.grantPermissions geolocation)
    └──requires──> Geolocation override (CDP Emulation.setGeolocationOverride)
                       └──enables──> Verification button (test on browserleaks via CDP eval)

Multi-instance support
    ├──requires──> Chrome launch action (single-instance must work first)
    ├──requires──> Per-window state (window registry keyed by ID)
    └──enables──> Per-window pin on map UI
                       └──enables──> Click-to-recenter on a window's pin

Live coordinate update (drag-after-launch)
    ├──requires──> Persistent CDP session per launched window
    └──conflicts──> Naive "launch and forget" model — must keep handles alive

Graceful shutdown
    ├──requires──> Process registry (track child PIDs)
    └──requires──> Temp user-data-dir cleanup logic

In-memory recent pins
    └──enhances──> Map UI (quick re-drop without re-typing)
```

### Dependency Notes

- **Live coordinate update requires persistent CDP session:** This is the single biggest architectural choice. If we close the CDP connection after launch, drag-to-update is impossible. Keep the Puppeteer/Playwright `Browser` and `Page` handles alive in the AntiClicker process for the window's lifetime.
- **Permission auto-grant must happen before any `getCurrentPosition()` call, ideally at context creation:** Otherwise the first request shows the prompt; subsequent calls work. Easy to miss in testing because devs habitually click "Allow."
- **Multi-instance requires unique `--user-data-dir` per launch:** Two Chrome instances sharing the same user-data-dir will crash or behave erratically. Generate temp dirs (`os.tmpdir()/anticlicker-<uuid>`) and clean up on close.
- **Verification button uses the running CDP session, not a new connection:** Run `navigator.geolocation.getCurrentPosition` via `Runtime.evaluate` to prove the override is live; surface result back to the launcher UI for the "round-trip" check.
- **Coordinate format flexibility enhances manual entry:** Users will paste from Google Maps URLs (`?q=lat,lng`), so the input must parse multiple formats — but this is a thin polish layer, not a blocker.
- **Anti-feature conflict — IP spoofing and geolocation spoofing:** A mismatched IP (real) + spoofed coords (fake) is **detectable** by sites that cross-reference. We're not solving this; document it.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept ("does dropping a pin and launching Chrome feel as magical as the pitch?").

- [ ] **Map UI with satellite view + draggable pin** — without this, no product
- [ ] **Lat/lng numeric display + manual entry** — verification and reverse lookup
- [ ] **Maps API key config screen** — required by Maps SDK
- [ ] **"Launch Chrome here" button** — the hero action
- [ ] **Chrome launches with `--user-data-dir` + CDP geolocation override** — the load-bearing primitive
- [ ] **Auto-grant geolocation permission** — without this the spoof "feels broken"
- [ ] **Multiple instances at different pins** — PROJECT.md active requirement
- [ ] **Verification button (open browserleaks.com / mylocation.org in launched Chrome)** — PROJECT.md active requirement; proves the spoof works
- [ ] **Graceful shutdown** — clean up temp user-data-dirs and child processes on app exit
- [ ] **Reasonable error states** — Chrome not installed, port in use, etc.

### Add After Validation (v1.x)

Features to add once core is working and we have feedback that the primitive is useful.

- [ ] **Live coordinate update on pin drag (after launch)** — biggest differentiator; defer only if CDP session management proves fragile in v1
- [ ] **In-memory recent pins list** — quality-of-life once users start using it daily
- [ ] **Per-window pin visualization on map** — once multi-instance gets heavy use
- [ ] **Click-to-recenter on active window's pin** — sidebar-driven flow
- [ ] **Coordinate format flexibility (paste from Maps URL, DMS, etc.)** — friction reducer
- [ ] **In-app verification panel (round-trip CDP eval)** — stronger proof than "open browserleaks manually"
- [ ] **Bundled Chromium fallback** — onboarding friction reducer
- [ ] **Keyboard shortcuts** — power-user polish

### Future Consideration (v2+)

Features to defer until product-market fit is established and core feedback is in.

- [ ] **Persistent saved locations / pin history** — PROJECT.md defers; introduces storage surface area
- [ ] **Timezone spoofing** — PROJECT.md out-of-scope but one-line CDP call; could be a "v2" toggle
- [ ] **Movement simulation / route playback** — PROJECT.md out-of-scope; meaningful new UX
- [ ] **Accuracy radius UI** — currently set to a sensible default invisibly; expose later if QA asks
- [ ] **Complementary Chrome extension** — surface launcher actions in-browser
- [ ] **Pin sharing / export** — only if collaboration use case emerges

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Map with draggable pin + satellite view | HIGH | MEDIUM | P1 |
| Lat/lng display + manual entry | HIGH | LOW | P1 |
| "Launch Chrome here" with CDP override | HIGH | MEDIUM | P1 |
| Geolocation permission auto-grant | HIGH | LOW | P1 |
| Multi-instance with unique user-data-dirs | HIGH | MEDIUM | P1 |
| Verification button (open browserleaks) | HIGH | LOW | P1 |
| Graceful shutdown / cleanup | HIGH | MEDIUM | P1 |
| API key config screen | HIGH | LOW | P1 |
| Live coordinate update on drag | HIGH | MEDIUM | P2 |
| Per-window pin visualization | HIGH | LOW | P2 |
| In-memory recent pins | MEDIUM | LOW | P2 |
| Coordinate format flexibility | MEDIUM | LOW | P2 |
| Click-to-recenter on pin | MEDIUM | LOW | P2 |
| In-app verification panel (CDP round-trip) | HIGH | MEDIUM | P2 |
| Keyboard shortcuts | MEDIUM | LOW | P2 |
| Bundled Chromium fallback | MEDIUM | LOW | P2 |
| Persistent pin history | MEDIUM | MEDIUM | P3 |
| Timezone spoofing | MEDIUM | LOW | P3 (anti-feature for v1) |
| Movement simulation | LOW | HIGH | P3 (anti-feature for v1) |
| IP / VPN spoofing | LOW | HIGH | P3 (explicit anti-feature) |
| Full fingerprint customization | LOW | HIGH | P3 (explicit anti-feature) |
| Mobile app | LOW | HIGH | P3 (explicit anti-feature) |

**Priority key:**
- P1: Must have for launch (MVP)
- P2: Should have, add when possible (v1.x)
- P3: Nice to have, future consideration (v2+) or deliberate anti-feature

## Competitor Feature Analysis

| Feature | Chrome DevTools Sensors | Location Guard (extension) | Playwright/Puppeteer (code) | Anti-Detect Browsers (GoLogin/Multilogin/Kameleo) | BrowserStack | **AntiClicker** |
|---------|-------------------------|---------------------------|----------------------------|----------------------------------------------------|--------------|-----------------|
| Map-based pin UI | NO — dropdown + numeric entry only | YES — fixed-location feature has a map | NO — code only | Partial — coords entry in profile creation, not always map-based | YES — country/city dropdown | **YES — primary UX, satellite view** |
| Drop-and-drag pin | NO | Limited | NO | NO | NO | **YES — core differentiator** |
| Live update without browser restart | YES (while DevTools open in that tab) | Requires page reload | YES (programmatic) | YES (in-profile change requires restart usually) | YES (per session) | **YES — drag pin = live override (P2)** |
| Multi-instance / multi-profile | NO (per-tab, manual) | One config per browser | YES (browser contexts) | YES — flagship feature | YES (sessions) | **YES — P1 requirement** |
| Profile isolation (user-data-dir) | N/A | N/A | YES (contexts) | YES (encrypted profiles) | YES (cloud devices) | **YES — temp user-data-dir per launch** |
| Saved/favorite locations | YES (custom presets) | Limited | N/A | Per-profile | YES (recent test history) | **NO for v1** — in-memory recent pins in v1.x |
| Verification of spoof | Manual (open browserleaks) | Status icon indicator | None built-in | Built-in fingerprint check | Test report integration | **YES — verification button (P1), round-trip panel (P2)** |
| Timezone / locale spoof | YES (separate Sensors fields) | NO | YES (separate options) | YES — flagship | YES | **NO (explicit anti-feature for v1)** |
| IP spoofing | NO | NO | NO (proxy supported separately) | NO (proxy supported separately) | YES (IP geolocation tier) | **NO (explicit anti-feature)** |
| Fingerprint surface (Canvas/WebGL/etc.) | Some via Sensors | NO | Programmatic | YES — flagship | Some | **NO (anti-feature)** |
| Form factor | Built into Chrome | Browser extension | Library / code | Standalone branded browser | Cloud SaaS | **Standalone desktop app driving Chrome** |
| Cost | Free | Free | Free | $30–$200/mo | Paid tiers | **Free, local-only** |
| Target user | Web dev | Privacy-conscious user | QA automation | Account managers / scraping ops | Enterprise QA | **Dev / QA wanting fast manual geo testing** |

**The strategic gap:** DevTools Sensors is built into Chrome but UX-poor (dropdown, per-tab, tied to DevTools window staying open). Location Guard is for privacy, not dev work. Playwright is code-only. Anti-detect browsers are paid, heavy, and built for an account-management use case orthogonal to "I just want to test what my site looks like from Berlin." AntiClicker fits the gap: **pin-driven, fast, free, multi-window, no-code, geolocation-only.**

## Sources

- [Chrome DevTools Sensors panel docs](https://developer.chrome.com/docs/devtools/sensors)
- [Chrome DevTools custom locations](https://developer.chrome.com/docs/devtools/settings/locations)
- [Microsoft Edge geolocation override docs](https://learn.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/device-mode/geolocation)
- [Location Guard V3 (location-guard.com)](https://www.location-guard.com/)
- [Location Guard GitHub (chatziko/location-guard)](https://github.com/chatziko/location-guard)
- [Spoof Geolocation Chrome extension](https://chromewebstore.google.com/detail/spoof-geolocation/ihdobppgelceaoeojmhpmbnaljhhmhlc)
- [ChromeGeolocationSpoof (route simulation)](https://github.com/shacharmo/ChromeGeolocationSpoof)
- [Playwright geolocation/emulation docs](https://playwright.dev/docs/emulation)
- [Playwright Configuration / `use` options](https://playwright.dev/docs/test-use-options)
- [Puppeteer Page.setGeolocation() API](https://pptr.dev/api/puppeteer.page.setgeolocation)
- [BrowserStack IP geolocation testing](https://www.browserstack.com/docs/ip-geolocation)
- [BrowserStack Live geolocation change](https://www.browserstack.com/docs/live/device-settings/change-location)
- [GoLogin anti-detect browser](https://gologin.com/)
- [Multilogin / GoLogin comparison (oxylabs)](https://oxylabs.io/blog/gologin-vs-multilogin)
- [Kameleo anti-detect browser overview](https://kameleo.io/)
- [BrowserLeaks Geolocation test](https://browserleaks.com/geo)
- [Chromium user-data-dir docs](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/user_data_dir.md)
- [Chromium "Creating and Using Profiles"](https://www.chromium.org/developers/creating-and-using-profiles/)
- [iToolab AnyGo (location history / favorites reference)](https://itoolab.com/gps-location-changer/)
- [Syncios Location Changer](https://www.syncios.com/location-changer/)

---
*Feature research for: desktop geolocation-spoofing Chrome launcher (pin-to-coords)*
*Researched: 2026-05-14*
