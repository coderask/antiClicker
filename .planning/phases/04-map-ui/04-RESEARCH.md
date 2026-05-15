# Phase 04 Research — Map UI

**Domain:** MapLibre GL JS 5 integration with EOX S2cloudless satellite tiles in Electron/Vite renderer
**Researched:** 2026-05-15
**Confidence:** HIGH (MapLibre 5 ships its own TypeScript types; tile endpoint verified via EOX public docs)

---

## 1. MapLibre GL JS 5 API Surface Used

### Map instantiation

```ts
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const map = new maplibregl.Map({
  container: 'map-container',     // or a div element reference
  style: { ... },                 // StyleSpecification object (inline — no network fetch)
  center: [lng, lat],             // note: MapLibre order is [lng, lat], not [lat, lng]
  zoom: 4,
  maxZoom: 14,                    // EOX tiles only go to zoom 14
});
```

Critical: `container` must have an explicit pixel height. A 0-height container causes
MapLibre to silently render nothing. Use `height: '100vh'` or equivalent.

### React cleanup

```ts
useEffect(() => {
  const map = new maplibregl.Map({ ... });
  return () => map.remove();  // MANDATORY — prevents WebGL context leak on hot-reload
}, []);
```

### Click event (drop pin)

```ts
map.on('click', (e: maplibregl.MapMouseEvent) => {
  const { lat, lng } = e.lngLat;
  // lat/lng are correct-named in MapMouseEvent.lngLat
});
```

### Draggable Marker

```ts
const marker = new maplibregl.Marker({ draggable: true })
  .setLngLat([lng, lat])
  .addTo(map);

marker.on('dragend', () => {
  const pos = marker.getLngLat();
  // pos.lat, pos.lng
});
```

### flyTo (animate map to coordinates)

```ts
map.flyTo({ center: [lng, lat], zoom: 10 });
```

### TypeScript types

MapLibre 5 ships its own types — no `@types/maplibre-gl` package needed. Import the
type `maplibregl.StyleSpecification` directly from `maplibre-gl`.

---

## 2. EOX S2cloudless Raster Source Configuration

```ts
const style: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    'eox-s2cloudless': {
      type: 'raster',
      tiles: [
        'https://s2maps-tiles.eu/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg'
      ],
      tileSize: 256,
      attribution: 'Sentinel-2 cloudless by EOX IT Services GmbH (2020)',
      maxzoom: 14,
    },
  },
  layers: [
    { id: 'eox-layer', type: 'raster', source: 'eox-s2cloudless' },
  ],
};
```

**Attribution requirement:** EOX S2cloudless-2020 is published under CC BY 4.0.
Attribution must be visible to the end user. MapLibre's built-in attribution control
renders the `attribution` string from the raster source automatically. Do NOT disable
the attribution control (`attributionControl: false`).

**Tile zoom cap:** `maxzoom: 14` on the source AND `maxZoom: 14` on the Map constructor.
Zooming past 14 produces blank tiles with no error — cap it.

---

## 3. CSP Additions Required in `src/renderer/index.html`

MapLibre uses:
- Tile fetches → `connect-src` and `img-src` pointing at the tile domain
- Inline styles for the attribution/navigation controls → `style-src 'unsafe-inline'`
- Worker scripts bundled as `blob:` URLs → `worker-src 'self' blob:`

Required CSP directives (additive to existing `'self'`):

```
img-src     'self' data: blob: https://s2maps-tiles.eu;
connect-src 'self' https://s2maps-tiles.eu;
worker-src  'self' blob:;
script-src  'self';
style-src   'self' 'unsafe-inline';
```

Note: The current `index.html` has no `<meta http-equiv="Content-Security-Policy">` tag.
The Electron main process sets CSP headers; check `src/main/index.ts` for session CSP
overrides and add the tile domain there if needed, in addition to the meta tag.

---

## 4. Google Maps URL Parsing Patterns

Patterns to detect and parse (in priority order):

| Input format | Regex anchor | Example |
|---|---|---|
| `/maps/@<lat>,<lng>,<zoom>z` | path segment `@` | `https://www.google.com/maps/@35.6762,139.6503,15z` |
| `/maps/@<lat>,<lng>,<zoom>z/data=...` | same, with trailing data | `https://www.google.com/maps/@35.6762,139.6503,15.5z/data=!3m1` |
| `/maps/place/.../@<lat>,<lng>` | place URL with `@` anchor | `https://www.google.com/maps/place/Tokyo/@35.6762,139.6503,15z` |
| `?q=<lat>,<lng>` | query string `q` | `https://maps.google.com/?q=35.6762,139.6503` |
| `?q=<lat>,<lng>&...` | query string `q` with extras | `https://www.google.com/maps?q=35.6762,139.6503&z=12` |
| `?ll=<lat>,<lng>` | query string `ll` | `https://www.google.com/maps?ll=35.6762,139.6503` |

Return type: `{ latitude: number; longitude: number } | null`

Use plain regex — no `url-parse` or similar library:

```ts
// Match @lat,lng in path
const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
// Match q=lat,lng or ll=lat,lng in query
const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
```

Validation after parse: `-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`. Return null if out of bounds.
Return null if URL is not a `maps.google.com` or `google.com/maps` URL.

---

## 5. React Component Architecture

```
App.tsx
├── pin: { latitude, longitude } | null  (state — lifted)
├── MapView.tsx          ← controlled map; receives pin + onPinChange
├── CoordInput.tsx        ← lat/lng form + Google Maps URL paste input
└── <details> footer     ← Phase 0 verification rows (hidden by default, testids preserved)
```

**MapView** is a controlled component:
- Props: `pin`, `onPinChange: (coords: { latitude; longitude }) => void`
- Internal marker updates when `pin` prop changes (useEffect on pin dep)
- onClick → `onPinChange(newCoords)`
- marker dragend → `onPinChange(newCoords)`

**CoordInput** props:
- `pin: { latitude; longitude } | null` — to show current values
- `onSubmit: (coords: { latitude; longitude }) => void`

---

## 6. Vite / electron-vite Worker Config

MapLibre's worker is bundled as part of `maplibre-gl` and injected as a `blob:` URL
at runtime. No extra Vite config is needed for the worker itself. Vite 6 handles the
WASM/worker internally as part of the maplibre-gl bundle.

**`optimizeDeps` note:** If Vite dev server fails to pre-bundle maplibre-gl, add:
```ts
optimizeDeps: { include: ['maplibre-gl'] }
```
to the renderer config in `electron.vite.config.ts`. This is a known quirk with ESM
packages that include worker code.

---

## 7. Known Pitfalls (Phase 4 specific)

| Pitfall | Prevention |
|---|---|
| Map renders into 0-height div | Set `height: '100vh'` (or 100% with parent height set) on container div |
| `Map.remove()` not called on unmount | Always return `() => map.remove()` from the useEffect that creates the map |
| MapLibre CSS not imported | Import `maplibre-gl/dist/maplibre-gl.css` once (in main.tsx or App.tsx) |
| Tile fetches blocked by CSP | Add `img-src` + `connect-src` for `https://s2maps-tiles.eu` |
| Worker instantiation blocked by CSP | Add `worker-src 'self' blob:` |
| EOX tiles capped at zoom 14 | Set `maxZoom: 14` on Map constructor; `maxzoom: 14` on source |
| MapLibre center is [lng, lat] not [lat, lng] | Always use `[coords.longitude, coords.latitude]` order |
| Inline style injection from controls | Allow `style-src 'unsafe-inline'` |
| Google Maps URL paste fires submit | Use `onPaste` handler on URL input, prevent form submit, parse immediately |

---

*Research complete — proceed to plan execution.*
