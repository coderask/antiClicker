# AntiClicker — Pin-to-Geolocation Chrome Launcher

## What This Is

A desktop tool that lets you drop a pin anywhere on a Google Maps (satellite view) interface and launches a fresh Chrome instance whose geolocation sensor reports the coordinates of that pin. You move the pin, you move where Chrome thinks it is — instantly, with no manual DevTools fiddling.

## Core Value

**One click on a map = a Chrome window that *is* at that location.** Spoofing geolocation should feel as direct as dragging a marker; everything else (browser flags, sensor overrides, profile isolation) happens invisibly underneath.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can view a Google Maps interface with satellite view as the default tile layer
- [ ] User can drop / drag / reposition a pin anywhere on the map
- [ ] Pin coordinates (lat/lng) are captured and displayed in a readable form
- [ ] App launches a fresh Chrome instance on demand (via CDP / Puppeteer / Playwright) with the pin's coordinates set as the geolocation override
- [ ] Launched Chrome instance reports the pin's coordinates when a webpage calls `navigator.geolocation.getCurrentPosition()`
- [ ] Launched Chrome instance reports the pin's coordinates to passive sensor fingerprinting (e.g., Sensor APIs where applicable)
- [ ] User can launch multiple Chrome instances at different pinned locations without them colliding (separate user-data-dirs)
- [ ] User can verify the spoof worked (e.g., a "Test on browserleaks.com / mylocation.org" button)

### Out of Scope

- Mobile app (web/desktop only for v1) — keep scope tight
- IP / VPN spoofing — geolocation sensor only; IP address remains user's real IP (network-level spoofing is a different problem and out of scope)
- Spoofing timezone, language, or other locale signals — pure coordinate override only; can be added later
- Browser-extension form factor — v1 is a standalone desktop app that drives Chrome via automation, not an extension
- Persistent pin history / saved locations — nice-to-have, defer
- Spoofing accuracy radius / movement simulation (drift, walking paths) — static coordinates only for v1

## Context

- Greenfield project — fresh directory, no prior code.
- Built for personal/dev use: testing geo-restricted content, QA, privacy experimentation, and locale-dependent UI bugs.
- Chrome already exposes geolocation override via CDP (`Emulation.setGeolocationOverride`) — this is the load-bearing API we will depend on. No browser monkey-patching needed.
- Google Maps JS API requires an API key; the user will supply one (or we surface a config step).
- The directory name (`antiClicker`) hints at use cases adjacent to bot / click-detection avoidance for legitimate testing, but the v1 surface is the geolocation-spoofing primitive itself.

## Constraints

- **Tech stack**: Must drive a real Chrome (or Chromium) instance — no headless-only build, since the user expects a "simple chrome instance" they can interact with.
- **Platform**: macOS first (user's environment is Darwin); Windows/Linux can follow if the automation library is cross-platform (Playwright/Puppeteer are).
- **Dependencies**: Google Maps JavaScript API (requires user-supplied API key); Chrome must be installed locally (or bundled Chromium via Playwright).
- **Security**: Don't hard-code API keys; store them in a local config file outside version control.
- **Performance**: Map should feel snappy (no lag when dragging the pin); Chrome launch should complete in < 5s.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Google Maps JS API with satellite view | User explicitly requested it; richest tile data for the satellite UX | — Pending |
| Drive Chrome via automation library (Puppeteer or Playwright) over CDP | `Emulation.setGeolocationOverride` is the canonical way to spoof geolocation; standard pattern | — Pending |
| Standalone desktop app (Electron or Tauri) over web app | Need to spawn local Chrome processes — browsers can't do that from a web page | — Pending |
| Coordinate override only (not IP / timezone / locale) | Keeps v1 focused on the load-bearing primitive; other signals are separate problems | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-14 after initialization*
