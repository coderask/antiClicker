# Phase 7 — Research: Persistence + Google Maps Integration

## 1. Google Maps JavaScript API Integration

### Script-Loader Pattern
The Google Maps JS API is loaded dynamically via an injected `<script>` tag. The canonical pattern for 2026:

```ts
function loadGoogleMaps(apiKey: string): Promise<typeof google> {
  if (window.google?.maps) return Promise.resolve(window.google);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&loading=async`;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
```

Key points:
- `loading=async` is the new recommended loading parameter (replaces the `callback` query param)
- `libraries=marker` is required for `AdvancedMarkerElement` (new API)
- The function is idempotent: if `window.google.maps` is already defined, it resolves immediately
- Error handling: `onerror` triggers if the CDN is unreachable or the key is invalid — use to fall back to MapLibre

### Map Initialization
```ts
const map = new google.maps.Map(container, {
  center: { lat: 0, lng: 0 },
  zoom: 2,
  mapTypeId: 'hybrid',  // satellite + labels (richer than 'satellite' alone)
  mapId: 'DEMO_MAP_ID', // required for AdvancedMarkerElement
});
```

`mapTypeId: 'hybrid'` shows satellite imagery with road/place labels — the richest option for the use case.

### Marker APIs
**Old API (google.maps.Marker)** — deprecated but still works; supports `draggable: true` directly:
```ts
const marker = new google.maps.Marker({
  position: { lat, lng },
  map,
  draggable: true,
  icon: { ... },  // SVG path or URL
});
marker.addListener('dragend', () => {
  const pos = marker.getPosition()!;
  onPinChange({ latitude: pos.lat(), longitude: pos.lng() });
});
```

**New API (google.maps.marker.AdvancedMarkerElement)** — requires `mapId`, supports custom HTML/SVG:
```ts
const marker = new google.maps.marker.AdvancedMarkerElement({
  position: { lat, lng },
  map,
  content: customHtmlElement,
  gmpDraggable: true,
});
marker.addListener('dragend', () => {
  const pos = marker.position as google.maps.LatLng;
  onPinChange({ latitude: pos.lat(), longitude: pos.lng() });
});
```

Decision: Use **old Marker API** for Phase 7 (simpler, no mapId requirement, battle-tested). The `google.maps.Marker` deprecation is soft — no removal date announced as of May 2026. Can migrate to AdvancedMarkerElement in a future version.

### Billing + Quota Guidance
- Google Maps JS API bills per map load (one load = one page session)
- Free tier: $200/month credit = ~28,000 map loads/month (at $7/1000 loads)
- Personal use is well under this limit
- **Required**: Link a billing account to the Google Cloud project (even for free tier)
- **Recommended**: Set a QPD cap (e.g. 1000 req/day) and budget alerts at $5/$20/$50
- Key restriction: HTTP referrers `http://localhost/*` and `http://127.0.0.1/*` for dev builds

---

## 2. .env.local Loader Pattern

The goal is to read a single env var (`GOOGLE_MAPS_API_KEY`) from `.env.local` at app startup without pulling in `dotenv` as a runtime dependency. An inline regex parser handles this cleanly:

```ts
// src/main/load-env-key.ts
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnvKey(projectRoot: string): string | null {
  const envPath = join(projectRoot, '.env.local');
  if (!existsSync(envPath)) return null;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const m = /^GOOGLE_MAPS_API_KEY\s*=\s*(.+?)\s*$/.exec(line);
    if (m) return m[1].replace(/^["']|["']$/g, '');  // strip optional quotes
  }
  return null;
}
```

**Path resolution**: `app.isPackaged ? app.getAppPath() : process.cwd()` — for packaged builds `.env.local` would need to be inside the app bundle (impractical for production). The function returns null gracefully when the file is missing, which is always the case in production. Only the in-app paste path works for production users.

**Security note**: The key is never logged, never put in error messages, never transmitted — only written to electron-store (OS user-data dir, mode 0600 on macOS).

---

## 3. CSP Additions for Google Maps

Google Maps JS API requires several CSP relaxations. The `'unsafe-eval'` addition is the most significant — Google Maps uses `eval()` internally for tile rendering math. This is a known, documented limitation:

```
script-src 'self' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com;
connect-src 'self' https://server.arcgisonline.com https://maps.googleapis.com https://maps.gstatic.com;
img-src 'self' data: blob: https://server.arcgisonline.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://*.gstatic.com;
```

The tradeoff: `'unsafe-eval'` weakens XSS protection in the renderer. However, since AntiClicker is a local desktop app with no user-supplied content in the renderer (all dynamic content comes from controlled IPC channels validated by Zod), the XSS risk is low. The Esri (MapLibre) path continues to work with only `'self'` as the script source.

Alternative: restrict `'unsafe-eval'` to only load when Google Maps is active (not feasible — CSP is static HTML at load time). Documented as a known tradeoff.

---

## 4. Persistent State Pattern

### Load on Mount
```ts
useEffect(() => {
  window.api.getRecentPins().then(setRecentPins).catch(() => undefined);
  window.api.getFavorites().then(setFavorites).catch(() => undefined);
}, []);
```

### Save on Change with Debounce
Avoid writing electron-store on every keystroke/drag. Use a 500ms debounce in a custom hook:

```ts
function useDebouncedPersist<T>(value: T, persist: (v: T) => Promise<void>, delay = 500) {
  useEffect(() => {
    const timer = setTimeout(() => { persist(value).catch(() => undefined); }, delay);
    return () => clearTimeout(timer);
  }, [value, persist, delay]);
}
```

The debounce hook clears its timer on cleanup (React StrictMode double-invoke safe). The 500ms window means at most 2 writes/second even during rapid pin drops.

### Handle Missing-Key Gracefully
The `getRecentPins` and `getFavorites` IPC handlers return the stored array (or default empty array if the key is missing from the store). Zod `safeParse` ensures corrupt data never crashes — the handler returns `[]` on parse failure.

### Atomic Write
`electron-store` writes are atomic (rename-replace) on all platforms. No partial-write corruption risk even if the app is force-killed mid-write.

---

## 5. MapBackend Switcher Pattern

```tsx
function App() {
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  useEffect(() => {
    window.api.getMapsApiKey().then(setMapsApiKey).catch(() => undefined);
  }, []);

  // mapsApiKey===null: render MapView (MapLibre+Esri)
  // mapsApiKey is a string: render GoogleMapView
  return (
    <>
      {mapsApiKey
        ? <GoogleMapView {...sharedProps} apiKey={mapsApiKey} onFallback={() => setMapsApiKey(null)} />
        : <MapView {...sharedProps} />}
    </>
  );
}
```

The `onFallback` callback handles the case where GoogleMapView fails to load (CDN unreachable, invalid key). GoogleMapView calls `onFallback()` on script load error → App re-renders with MapView.

---

## 6. Sources
- [Google Maps JS API — Loading the API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Maps JS API — mapTypeId constants](https://developers.google.com/maps/documentation/javascript/maptypes)
- [Maps JS API — Markers (legacy)](https://developers.google.com/maps/documentation/javascript/markers)
- [Maps JS API — Advanced Markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/overview)
- [Maps JS API Pricing — May 2026](https://mapsplatform.google.com/pricing/)
- [Electron CSP — unsafe-eval](https://www.electronjs.org/docs/latest/tutorial/security#6-do-not-disable-websecurity)
- [electron-store atomic writes](https://github.com/sindresorhus/electron-store#readme)
