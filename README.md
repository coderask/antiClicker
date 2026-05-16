# AntiClicker

**Pin-to-Geolocation Chrome Launcher** — drop a pin anywhere on a satellite map and launch a Chrome window whose GPS coordinates are set to that location. No DevTools required.

> **Scope:** Coordinates only. AntiClicker overrides the `navigator.geolocation` API in launched Chrome instances. Your IP address, timezone, and browser language are unchanged.

![AntiClicker screenshot](docs/screenshot.png)
*(Add a screenshot to `docs/screenshot.png` after installing)*

---

## Download

| Platform | File | Notes |
|----------|------|-------|
| macOS (Apple Silicon) | `AntiClicker-0.0.5-arm64.dmg` | Ad-hoc signed |
| macOS (Intel) | `AntiClicker-0.0.5.dmg` | Ad-hoc signed |
| Windows 10/11 | `AntiClicker Setup 0.0.5.exe` | Unsigned |

Download from [Releases](../../releases).

### macOS (ad-hoc signed — Gatekeeper warning is expected)

1. Download `AntiClicker-0.0.5-arm64.dmg` (Apple Silicon) or `AntiClicker-0.0.5.dmg` (Intel) from the latest release.
2. Open the DMG, drag `AntiClicker.app` to the Applications shortcut, eject the disk image.
3. First launch will fail with "AntiClicker can't be opened because Apple cannot check it for malicious software." This is expected — the app is ad-hoc signed, not notarized. To approve it:
   - Open **System Settings → Privacy & Security**
   - Scroll down to the message: "AntiClicker was blocked to protect your Mac"
   - Click **"Open Anyway"**
   - macOS will prompt you again — click **"Open"** in the confirmation dialog
4. The app opens. The first-run scope overlay appears; read it and click "Got it."
5. You're in. Future launches double-click as normal.

> Why ad-hoc signing and not notarization? Notarization requires a $99/year Apple Developer membership. v0.0.5 is the ad-hoc-signed compromise: works, but you click through one warning the first time.

### Windows (SmartScreen)

1. Download `AntiClicker Setup 0.0.5.exe`.
2. Run it. SmartScreen blocks unrecognized publishers — click **More info** then **Run anyway**.
3. The app installs to `%LOCALAPPDATA%\Programs\AntiClicker` by default.

---

## Optional: enable Google Maps satellite (better zoom)

By default AntiClicker uses Esri World Imagery (free, no API key, but maxes out around zoom 17). For building-level satellite imagery and zoom up to 21+, you can plug in a Google Maps API key.

### Get a key
1. Open https://console.cloud.google.com — sign in or create a project
2. **APIs & Services → Library** — search for and enable **Maps JavaScript API**
3. **Billing** — link a billing account (required, but Google gives a $200/month free credit; personal use is well under that — ~28k map loads/month free)
4. **APIs & Services → Credentials → Create credentials → API key**
5. Click the new key and add **Application restrictions → HTTP referrers** with `http://localhost/*` and `http://127.0.0.1/*`
6. (Strongly recommended) **APIs & Services → Quotas** — cap the Maps JavaScript API at 1000 requests/day for personal use

### Use the key — two paths
**Option A (recommended): paste it into the app.**
Click the ⚙ settings cog in the bottom bar, paste the key, press Save. The app stores it in electron-store (OS user-data dir, never committed). The map immediately switches to Google Maps.

**Option B (for development): .env.local at the repo root.**
Copy `.env.template` to `.env.local`, fill in `GOOGLE_MAPS_API_KEY=AIza...`, run `npm run dev`. Main reads the file on startup and writes the key into electron-store. After this, you can delete `.env.local` — the key persists in user-data. (Note: this only works for dev builds; packaged app users should use Option A.)

### Verifying it took effect
- The bottom-bar indicator badge will switch from "Esri (free)" to "Google Maps"
- Zoom past 17 — you should see street labels and individual buildings rendered
- The key never leaves your machine. AntiClicker doesn't telemetry or sync.

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
npm run test:unit   # Unit + component tests (110+ tests)
npm run test:e2e    # Electron + CLI + launcher integration (18 tests)
npm test            # Full suite
```

---

## Configuration

On first launch, AntiClicker creates a config file at:
- macOS: `~/Library/Application Support/AntiClicker/config.json`
- Windows: `%APPDATA%\AntiClicker\config.json`

**Optional: Google Maps API key**

By default, AntiClicker uses Esri World Imagery (free, no API key). To enable higher-resolution Google Maps satellite tiles, see the [Optional: enable Google Maps satellite](#optional-enable-google-maps-satellite-better-zoom) section above. The key is stored only in the local config file — never in source code.

---

## Disclaimer

AntiClicker is a developer tool for testing location-aware features. It only overrides GPS coordinates — not your IP, VPN status, timezone, or any other browser fingerprint signal. Use it responsibly and in accordance with the terms of service of any website you visit.
