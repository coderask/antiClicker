# Phase 06 Research — Verification + Polish + Package

**Date:** 2026-05-15
**Phase:** 06 (Verification + Polish + Package)

---

## 1. electron-builder: macOS .dmg + Windows NSIS from macOS

### Cross-compile support
electron-builder DOES support building Windows NSIS installers from macOS without Wine.
The NSIS tool is bundled in the `app-builder-bin` package (a native binary shipped with
electron-builder). No Wine, no Windows VM needed for creating the unsigned installer.

### Key config (package.json `build` section)
```json
{
  "appId": "com.anticlicker.app",
  "productName": "AntiClicker",
  "directories": { "output": "dist" },
  "files": ["out/**/*", "package.json"],
  "asar": true,
  "asarUnpack": ["**/playwright/.local-browsers/**", "**/node_modules/playwright-core/.local-browsers/**"],
  "mac": {
    "category": "public.app-category.developer-tools",
    "icon": "build/icon.png",
    "target": [{"target": "dmg", "arch": ["arm64", "x64"]}],
    "identity": null
  },
  "win": {
    "icon": "build/icon.png",
    "target": [{"target": "nsis", "arch": ["x64"]}]
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true
  }
}
```

### CRITICAL: `main` entry
`package.json` `"main": "./out/main/index.js"` already set — electron-builder uses this.
Do NOT point at `src/main/index.ts`.

### Icon requirements
- `build/icon.png` — 512x512 PNG (minimum 256x256)
- electron-builder auto-converts PNG → ICNS for macOS, ICO for Windows
- No separate ICNS or ICO file needed if PNG is provided
- electron-builder will warn if PNG < 512x512 for macOS

### Signing
- macOS: `identity: null` disables notarization. Gatekeeper will show "app from unidentified developer" warning. Users must right-click → Open the first time.
- Windows: no `win.sign` key = unsigned. SmartScreen will show warning for unknown publishers.

---

## 2. asar and Playwright Chromium Binaries

### The problem
Playwright's bundled Chromium lives in `node_modules/playwright/.local-browsers/` (or
`node_modules/playwright-core/.local-browsers/`). These are actual binary executables.
Electron's asar archive cannot store executables that need to be spawned as child processes —
the OS cannot exec a file inside an asar archive.

### Solution: asarUnpack
```json
"asarUnpack": [
  "**/playwright/.local-browsers/**",
  "**/playwright-core/.local-browsers/**"
]
```
This copies matching paths out of the asar archive into `app.asar.unpacked/` alongside it.
Playwright's own `executablePath()` resolution handles the `.local-browsers` path correctly
regardless of whether the directory is inside asar or in asar.unpacked.

### Verification
After packaging, check that `dist/mac-arm64/AntiClicker.app/Contents/Resources/app.asar.unpacked/node_modules/playwright/` (or playwright-core) contains the chromium directory.

### Runtime path for packaged app
In production, `process.resourcesPath` resolves to the `Resources/` directory inside the app bundle. Playwright internally uses `__dirname` relative paths from its own module, which correctly resolves to the unpacked location when asar is used correctly.

---

## 3. Orphan Profile Dir Sweep

### Pattern
On startup, walk `os.tmpdir()` with `readdir()`, filter for `anticlicker-profile-*` dirs.
For each, check for a `pid.txt` sentinel file written at launch time.
Use `process.kill(pid, 0)` — throws ESRCH if PID is dead, returns undefined if alive.
Delete dirs whose PID is dead (orphaned from crash).

### PID sentinel write
```typescript
await writeFile(join(userDataDir, 'pid.txt'), String(process.pid))
```
Note: `process.pid` in the Electron main process is the Electron PID. When the app crashes,
this PID will be absent from the OS process table, making the dir orphaned.

---

## 4. First-Run Scope Overlay

### electron-store integration
Add `firstRunSeen: z.boolean().default(false)` to ConfigSchema.
New IPC channel `config:mark-first-run-seen` sets `store.set('firstRunSeen', true)`.

### React overlay
Full-viewport modal rendered in `App.tsx` (or `ScopeOverlay.tsx` as a component).
Z-index: 1000. Shown only when `firstRunSeen === false`.
Single button "Got it" fires the IPC channel, then hides the overlay locally.
`data-testid="scope-overlay"` on the container, `data-testid="scope-overlay-dismiss"` on the button.

---

## 5. Chromium-Missing Error Surface

### Detection
Playwright throws `Error: browserType.launchPersistentContext: Executable doesn't exist` (or
similar) when the bundled Chromium is not installed.
Catch this specific error string in the IPC launch handler and rethrow with a clean message:
```
"Chromium not found. Run: npx playwright install chromium"
```
The renderer already shows `launchError` in `data-testid="launch-error"` — this message will
display there.

---

## 6. verify-spoof IPC

### evaluate approach
Playwright BrowserContext exposes `pages()` — the array of currently open pages.
For a freshly launched instance, `pages()[0]` is the default about:blank/new-tab page.
We navigate it to a data: URL containing a small script, or we use `page.evaluate()`:
```typescript
const page = context.pages()[0] ?? await context.newPage()
const result = await page.evaluate(() =>
  new Promise<GeolocationCoordinates>((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p.coords),
      reject,
      { enableHighAccuracy: false }
    )
  )
)
```
Then compare `result.latitude` ≈ expected.latitude (within accuracy tolerance).

### LauncherVerifySpoof IPC channel
- Payload: `{ id: string }`
- Returns: `{ reported: { lat, lng }, expected: { lat, lng }, match: boolean }`
- Match condition: `Math.abs(reported.lat - expected.lat) < 0.001 && Math.abs(reported.lng - expected.lng) < 0.001`

### LauncherOpenVerificationUrls IPC channel
- Payload: `{ id: string }`
- Opens `https://browserleaks.com/geo` on pages()[0]
- Opens new pages for `/ip` and `/timezone` paths on browserleaks

---

## 7. afterPack Hook (optional)

Not needed for v1. The `asarUnpack` handles Playwright binaries.
An afterPack hook would be used to:
- Move additional resources
- Patch plist files
- Run notarization scripts

For v1 (unsigned), skip the afterPack hook.

---

## 8. Known Gotchas

1. **electron-builder 26.x + electron 35**: Compatible. electron-builder ≥25 supports Electron 30+.
2. **arm64 + x64 fat DMG**: Building both arches from macOS ARM host works for the DMG.
   The x64 Electron binary is downloaded during the build.
3. **Windows NSIS installer name**: electron-builder names the file based on `productName` + version.
   Expected: `AntiClicker Setup 0.0.1.exe` (with spaces) or `AntiClicker-Setup-0.0.1.exe`.
   The actual name is `AntiClicker Setup 0.0.1.exe` by default.
4. **Playwright install in packaged app**: The bundled Chromium is NOT auto-installed on user machines.
   The app must either bundle the browser via `asarUnpack` OR call `npx playwright install chromium`
   as a first-run step. For v1, we bundle via asarUnpack (the `node_modules` are included).
   This makes the installer large (~250 MB) but self-contained.
5. **`files` array in build config**: Must include `node_modules/playwright*` if bundling browsers.
   Default `files: ["out/**/*"]` will miss `node_modules`. Change to include playwright:
   ```json
   "files": ["out/**/*", "package.json", "node_modules/playwright/**", "node_modules/playwright-core/**"]
   ```
   Or use `extraResources` to include the browser binaries separately.

---

## 9. Build Size Estimation

| Component | Approx. Size |
|-----------|-------------|
| Electron framework | ~120 MB |
| Playwright bundled Chromium | ~120 MB |
| App source (out/) | ~5 MB |
| node_modules (rest) | ~20 MB |
| **Total installer** | **~265 MB** |

This is large but typical for Electron apps that bundle a browser. Document in README.
