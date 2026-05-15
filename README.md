# AntiClicker

**Pin-to-Geolocation Chrome Launcher** — drop a pin anywhere on a satellite map and launch a Chrome window whose GPS coordinates are set to that location. No DevTools required.

> **Scope:** Coordinates only. AntiClicker overrides the `navigator.geolocation` API in launched Chrome instances. Your IP address, timezone, and browser language are unchanged.

![AntiClicker screenshot](docs/screenshot.png)
*(Add a screenshot to `docs/screenshot.png` after installing)*

---

## Download

| Platform | File | Size |
|----------|------|------|
| macOS (Apple Silicon) | `AntiClicker-0.0.1-arm64.dmg` | ~117 MB |
| macOS (Intel) | `AntiClicker-0.0.1.dmg` | ~121 MB |
| Windows 10/11 | `AntiClicker Setup 0.0.1.exe` | ~94 MB |

Download from [Releases](../../releases).

### Security Warnings (Expected)

Both installers are **unsigned** for v1. You will see a platform warning on first install:

**macOS (Gatekeeper):**
1. Double-click the `.dmg` to open it.
2. Drag `AntiClicker.app` to your Applications folder.
3. Right-click `AntiClicker.app` in Applications and choose **Open**.
4. Click **Open** in the Gatekeeper dialog. After this, it opens normally.

**Windows (SmartScreen):**
1. Run the NSIS installer (`AntiClicker Setup 0.0.1.exe`).
2. If SmartScreen blocks it, click **More info** then **Run anyway**.
3. The app installs to `%LOCALAPPDATA%\Programs\AntiClicker` by default.

---

## Quick Start

1. **Install** the app (see Download above).
2. **Launch** AntiClicker.
3. On first run, read and dismiss the scope overlay — it explains what is and is not spoofed.
4. **Drop a pin**: click anywhere on the satellite map to set the target location.
5. **Launch Chrome**: click "Launch here" in the bottom bar. A Chrome window opens spoofed to that location.
6. **Verify**: click the "Verify" button next to the instance in the right sidebar to confirm the reported coordinates match the pin.
7. **Multiple instances**: drop another pin and click "Launch here" again — each instance is isolated with its own profile.
8. **Live update**: drag an instance's marker on the map to push new coordinates to the running Chrome without relaunching.

---

## How It Works

AntiClicker uses [Playwright's](https://playwright.dev) `launchPersistentContext` with the `geolocation` option set to your pin coordinates. This calls the Chrome DevTools Protocol `Emulation.setGeolocationOverride` command, which overrides what `navigator.geolocation.getCurrentPosition()` reports — exactly the same as doing it manually in DevTools, but automated.

Each Chrome instance:
- Gets its own isolated profile directory (`os.tmpdir()/anticlicker-profile-*`)
- Has geolocation permissions pre-granted (no browser permission prompt)
- Can be live-updated via `context.setGeolocation()` without relaunching
- Is cleaned up on app quit; orphaned dirs from crashes are swept on next startup

---

## Build from Source

**Prerequisites:** Node.js 22+, npm 10+

```bash
git clone https://github.com/your-org/anticlicker.git
cd anticlicker
npm install
npx playwright install chromium
npm run dev        # open the app in dev mode
```

**Package locally:**

```bash
npm run package            # builds .dmg (arm64 + x64) and .exe
npm run package:mac        # macOS only
npm run package:win        # Windows only (cross-compiled from macOS, no Wine needed)
```

Artifacts appear in `dist/`.

**Run tests:**

```bash
npm run typecheck   # TypeScript type check
npm run test:unit   # Unit + component tests (98 tests)
npm run test:e2e    # Electron + CLI + launcher integration (18 tests)
npm test            # Full suite
```

---

## Configuration

On first launch, AntiClicker creates a config file at:
- macOS: `~/Library/Application Support/AntiClicker/config.json`
- Windows: `%APPDATA%\AntiClicker\config.json`

**Optional: Google Maps API key**

By default, AntiClicker uses free [EOX S2cloudless](https://s2maps.eu/) satellite tiles (no API key required). To use Google Maps satellite tiles (higher resolution, Street View available):

1. Get a Maps JavaScript API key from [Google Cloud Console](https://console.cloud.google.com/google/maps-apis).
2. Add it to the settings panel in the app.
3. The key is stored only in the local config file — never in the source code.

---

## Disclaimer

AntiClicker is a developer tool for testing location-aware features. It only overrides GPS coordinates — not your IP, VPN status, timezone, or any other browser fingerprint signal. Use it responsibly and in accordance with the terms of service of any website you visit.
