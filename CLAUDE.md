<!-- GSD:project-start source:PROJECT.md -->
## Project

**AntiClicker — Pin-to-Geolocation Chrome Launcher**

A desktop tool that lets you drop a pin anywhere on a Google Maps (satellite view) interface and launches a fresh Chrome instance whose geolocation sensor reports the coordinates of that pin. You move the pin, you move where Chrome thinks it is — instantly, with no manual DevTools fiddling.

**Core Value:** **One click on a map = a Chrome window that *is* at that location.** Spoofing geolocation should feel as direct as dragging a marker; everything else (browser flags, sensor overrides, profile isolation) happens invisibly underneath.

### Constraints

- **Tech stack**: Must drive a real Chrome (or Chromium) instance — no headless-only build, since the user expects a "simple chrome instance" they can interact with.
- **Platform**: macOS first (user's environment is Darwin); Windows/Linux can follow if the automation library is cross-platform (Playwright/Puppeteer are).
- **Dependencies**: Google Maps JavaScript API (requires user-supplied API key); Chrome must be installed locally (or bundled Chromium via Playwright).
- **Security**: Don't hard-code API keys; store them in a local config file outside version control.
- **Performance**: Map should feel snappy (no lag when dragging the pin); Chrome launch should complete in < 5s.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Executive Recommendation (one-line)
## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Electron** | `35.x` (stable; `36.x` available, `34.x` LTS-ish) | Desktop shell — hosts the map UI and orchestrates child Chrome processes | Renderer is real Chromium → Google Maps JS API and WebGL satellite tiles render identically to the spoofed Chrome we launch. Mature `child_process`/`spawn` story for launching external Chrome. Single-runtime debugging (Chromium DevTools everywhere). Confidence: HIGH |
| **Node.js** | `22.x` LTS (or `24.x` current) | Main-process runtime for Electron + Playwright | Required by Electron 35 (Node 22 LTS embedded); also Playwright 1.60's recommended runtime. Confidence: HIGH |
| **TypeScript** | `5.7.x` (or current 5.x) | Type safety across IPC, automation, map state | Catches CDP method name typos, lat/lng struct mismatches, Playwright option shapes. Industry default for Electron in 2026. Confidence: HIGH |
| **Playwright** | `1.60.x` (latest at research date) | Drive the spawned Chrome instance; set geolocation override | Native `geolocation` context option auto-handles the permission grant (a known CDP gotcha — see PITFALLS). `context.setGeolocation()` lets us push new coordinates without relaunching. Bundles Chromium so the app works even if the user has no Chrome installed. Cross-platform. Confidence: HIGH |
| **MapLibre GL JS** | `5.x` (current major) | Map UI with satellite layer + draggable pin marker | MIT-licensed, no API key required, WebGL renderer handles satellite + 3D zoom, can consume Google Maps tiles as a raster source when the user supplies a key. Confidence: HIGH |
| **Vite** | `6.x` | Renderer build tool | Fast dev server, native TS/ESM, the de facto Electron renderer bundler in 2026. Confidence: HIGH |
| **electron-vite** | `4.x` | Wires Vite into Electron's main + preload + renderer | Standard scaffold; handles the three-process build out of the box. Confidence: MEDIUM (verify exact minor against npm at install time) |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@maplibre/maplibre-gl-js` | `5.x` | Map renderer (see above) | Always — the map UI core |
| `electron-builder` | `25.x` | Packaging / DMG / app signing | When you want a distributable; not needed for `electron .` dev runs |
| `electron-store` | `10.x` | Persist Google Maps API key + last pin location to local config | Required by PROJECT.md "store API key outside VCS" constraint |
| `zod` | `3.x` | Validate IPC payloads (renderer → main) | Whenever lat/lng leaves the renderer; cheap insurance against malformed coordinates crashing the launcher |
| `puppeteer-core` | `25.x` | **Fallback only** — if Playwright proves heavyweight for the single-purpose launch | Do NOT install by default; listed for the comparison row |
| `chrome-launcher` | `2.x` | **Fallback only** — bare-bones spawn-Chrome utility used by Lighthouse | Only if both Playwright and Puppeteer are deemed too large; loses the convenient geolocation context API |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| `electron` CLI | Run the app in dev | `electron .` after `electron-vite build` |
| Playwright Inspector | Debug the spawned Chrome session live | Run with `PWDEBUG=1` to step through CDP commands |
| Chrome DevTools | Verify the spoof on the spawned instance | Open `chrome://settings/content/location` on the spoofed window to sanity-check |
| `eslint` + `@typescript-eslint` | Lint | Use `electron-vite`'s default config as the starting point |
| `tsx` | Run TS scripts directly | Useful for one-off CDP experiments without a full Electron build |
## Installation
# Core runtime
# Renderer state + persistence
# Dev / build
# Install Playwright's bundled Chromium (required step — Playwright doesn't ship it via npm)
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Electron 35** | **Tauri 2.9** | If bundle size (sub-10 MB vs ~100 MB) or RAM idle (~40 MB vs ~250 MB) is a hard requirement. Cost: macOS renderer becomes WKWebView, which has more Google-Maps-JS-API rendering quirks; you also need Rust toolchain familiarity. For a personal/dev tool (per PROJECT.md), Electron's ergonomics win. |
| **Playwright** | **Puppeteer 25** | If you specifically need Chrome-only and want 15–20% faster automation throughput. Not relevant here: we launch one Chrome window per pin, not a scraping farm. |
| **Playwright** | **Raw CDP via `chrome-remote-interface`** | If you want to ship without the ~100 MB Playwright dependency. You then have to implement `Browser.grantPermissions` + `Emulation.setGeolocationOverride` + reconnect logic yourself — re-inventing what Playwright wraps. Not worth it for v1. |
| **Playwright (CDP transport)** | **Playwright (WebDriver BiDi transport)** | When WebKit / Firefox parity matters more than feature completeness. BiDi `emulation.setGeolocationOverride` shipped in Firefox 139+; WebKit still pending as of May 2026. For Chrome-only spoofing, CDP transport is mature and lossless. |
| **MapLibre GL JS 5** | **Google Maps JS API (direct)** | When the user has already supplied an API key and wants the exact Google satellite tile aesthetic / Street View integration. Plan: support both — start with MapLibre + free EOX tiles, swap to Google Maps when a key is present. |
| **MapLibre GL JS 5** | **Leaflet 2.0** | If you want ~42 KB gzipped vs ~290 KB and only need raster satellite + a single draggable marker. Viable backup if MapLibre proves over-engineered for a single-pin UI; downside is no WebGL 3D tilt for a satellite "fly-in" feel. |
| **MapLibre GL JS 5** | **Mapbox GL JS** | Never for this project: Mapbox v2+ requires an account/access token and has a non-OSS license — defeats the no-API-key-default requirement. |
| **EOX S2cloudless tiles** | **MapTiler satellite** | If the user is willing to sign up for a free MapTiler key (100k loads/month) for higher resolution. Document as an option but don't make it the default. |
| **Vite 6 + electron-vite** | **Webpack via Electron Forge** | Only if integrating with a pre-existing webpack-heavy codebase. Vite is faster and more current in 2026. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Selenium / WebDriver Classic** | Older synchronous wire protocol, no native geolocation context API, requires a separate `chromedriver` binary, no first-class CDP. The 2026 SOTA for browser automation is Playwright/Puppeteer | **Playwright 1.60** |
| **Playwright WebDriver BiDi transport (today)** | `emulation.setGeolocationOverride` reset-behaviour spec was just updated (W3C BiDi PR #1026, May 2026) and WebKit hasn't implemented it. CDP transport is more stable for Chrome-only use right now | Playwright with default CDP transport (set explicitly via `chromium.launchPersistentContext`) |
| **Headless Chrome / Puppeteer headless mode** | PROJECT.md explicitly requires a visible, user-interactive Chrome window | Launch headed: `playwright.chromium.launch({ headless: false })` |
| **Electron 42-alpha / 43-alpha** | Pre-release — geolocation/permission internals occasionally regress. Stay on stable | **Electron 35 stable** |
| **Tauri 1.x** | EOL'd by Tauri 2.0 stable; missing mobile + new permissions model | **Tauri 2.9** (only if choosing the Tauri path at all) |
| **Mapbox GL JS v2+** | Non-OSS license post-v2 fork; requires Mapbox account token even for "free" usage | **MapLibre GL JS 5** (the community fork that kept the BSD license) |
| **Google Maps JS API as the only map source** | Per-load billing kicks in after 10k loads/month (Essentials tier) since March 2025 pricing change; user-supplied key requirement adds friction to first-run UX | **MapLibre default, Google Maps opt-in when key provided** |
| **Hard-coded API keys in source** | Project constraint explicitly forbids | **`electron-store` in the OS user-data dir** (`~/Library/Application Support/AntiClicker/config.json` on macOS) |
| **Launching the user's installed Chrome via `open -a "Google Chrome"`** | macOS reuses existing Chrome process by default — CDP attach is racy, and the user's real profile leaks in | **Playwright's bundled Chromium with `launchPersistentContext({ userDataDir: <per-pin-temp-dir> })`** (satisfies the "multiple Chrome instances without colliding" requirement) |
## Stack Patterns by Variant
- Mount Google Maps JS API satellite layer as the basemap (richest tile data, Street View available)
- Persist the key via `electron-store`
- Still keep MapLibre + EOX tiles as the fallback when the key is invalid/quota'd
- MapLibre GL JS with EOX `s2cloudless-2020_3857` raster source
- Surface a "Add Maps API key for higher-res satellite" affordance in settings
- Add `better-sqlite3` (synchronous, fast, perfect for Electron main process)
- Don't reach for a "real" DB — this is a single-user local app
- Migrate to Tauri 2.9 + the same Playwright integration (Playwright is runtime-agnostic, just needs Node)
- Accept the WKWebView/Google-Maps quirk tradeoff documented above
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `electron@35` | `node@22 LTS` (embedded) | Electron 35 embeds Node 22; your build tools should target the same |
| `playwright@1.60` | `node@22+` | Playwright dropped Node 18 support in 1.59 |
| `playwright@1.60` | Chrome / Chromium 136+ | The bundled Chromium ships with Playwright; do not mix with arbitrary system Chrome versions for the spoofed instance |
| `maplibre-gl@5` | Modern evergreen browsers; Electron 30+ renderer | WebGL2 required; Electron 35's Chromium 136 satisfies this |
| `electron-vite@4` | `vite@6`, `electron@33+` | The 4.x line is the one that matches Vite 6 |
| `electron-builder@25` | `electron@30+` | Older builder lines have broken notarization on macOS Sonoma+ |
| Playwright's bundled Chromium | macOS 12+ / Windows 10+ / Linux glibc 2.31+ | Matches what we need; macOS first per PROJECT.md |
## Key API Snippets (what the load-bearing code looks like)
## Sources
- [Playwright npm — version 1.60.0, May 2026](https://www.npmjs.com/package/playwright) — verified current version (HIGH)
- [Playwright Emulation docs — geolocation context option](https://playwright.dev/docs/emulation) — verified `geolocation` + `permissions` API shape (HIGH)
- [Playwright BrowserContext API — `setGeolocation`](https://playwright.dev/docs/api/class-browsercontext) — verified live-update method (HIGH)
- [Puppeteer GitHub releases — v24.43 / v25.0 May 2026](https://github.com/puppeteer/puppeteer/releases) — verified current versions (HIGH)
- [Chrome DevTools Protocol — Emulation domain](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/) — verified `setGeolocationOverride` parameters & permission requirement (HIGH)
- [Electron Releases](https://releases.electronjs.org/) — verified v35 stable / v42 alpha cadence May 2026 (HIGH)
- [Tauri 2.0 stable release blog](https://v2.tauri.app/blog/tauri-20/) and [Webview Versions](https://v2.tauri.app/reference/webview-versions/) — verified Tauri 2.9, WKWebView on macOS (HIGH)
- [MapLibre GL JS — satellite map example with EOX tiles](https://maplibre.org/maplibre-gl-js/docs/examples/display-a-satellite-map/) — verified no-API-key satellite source (HIGH)
- [WebDriver BiDi modules — emulation.setGeolocationOverride (MDN)](https://developer.mozilla.org/en-US/docs/Web/WebDriver/Reference/BiDi/Modules) and [Bugzilla 1954992](https://bugzilla.mozilla.org/show_bug.cgi?id=1954992) — verified Firefox 139+ support, WebKit pending (HIGH)
- [Google Maps Platform pricing — March 2025 SKU restructure](https://mapsplatform.google.com/pricing/) — verified 10k Essentials free events (MEDIUM — pricing pages change)
- [Felt — 7 free map APIs vs Google Maps](https://felt.com/blog/7-free-map-apis-compared-to-google-maps) — MapTiler / OpenFreeMap context (MEDIUM)
- [BrowserStack — Playwright vs Puppeteer 2026](https://www.browserstack.com/guide/playwright-vs-puppeteer) — synthesis on geolocation handling (MEDIUM)
- [Tauri vs Electron 2026 comparison](https://www.dolthub.com/blog/2025-11-13-electron-vs-tauri/) — bundle/RAM tradeoffs (MEDIUM)
- [PkgPulse — Mapbox vs Leaflet vs MapLibre 2026](https://www.pkgpulse.com/guides/mapbox-vs-leaflet-vs-maplibre-interactive-maps-2026) — Leaflet vs MapLibre tradeoffs (MEDIUM)
- [Tauri shell plugin / sidecar docs](https://v2.tauri.app/develop/sidecar/) — verified Tauri-path child-process API if we switched shells (HIGH)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
