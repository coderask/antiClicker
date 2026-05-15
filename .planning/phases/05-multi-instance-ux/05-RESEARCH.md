---
phase: 05-multi-instance-ux
type: research
---

# Phase 5 Research — Multi-Instance UX + Live Update

## 1. Rendering N markers in MapLibre GL JS 5

Each running Chrome instance is represented as a `maplibregl.Marker` with a custom HTML element.

### Custom HTML element for colored pins

```ts
function makeMarkerEl(color: string, active: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 24px; height: 24px; border-radius: 50%;
    background: ${color};
    border: 3px solid ${active ? '#fff' : 'rgba(255,255,255,0.4)'};
    cursor: grab;
    box-shadow: 0 2px 6px rgba(0,0,0,0.5);
  `;
  return el;
}
```

Active instance gets a bright white border (ring) + optional CSS `animation: pulse 1.5s infinite`.

### Creating and managing markers

Each instance gets its own `maplibregl.Marker({ element, draggable: true })`.

Markers are stored in a `Map<InstanceId, maplibregl.Marker>` ref inside MapView.

On each render cycle, we diff `instances` prop with the markers ref:
- New instance → create marker, attach dragend handler
- Removed instance → call `marker.remove()`
- Updated coords → `marker.setLngLat([lng, lat])`
- Active instance changed → rebuild element HTML to toggle the border style

### dragend handler with instance ID

The handler is created in a closure over the instance ID at marker creation time:

```ts
marker.on('dragend', () => {
  const pos = marker.getLngLat();
  onMarkerDrag(instanceId, { latitude: pos.lat, longitude: pos.lng });
});
```

The `onMarkerDrag` callback is stored in a ref so the handler always calls the current version.

## 2. React state model for instances

```ts
type InstanceId = string;
type RunningInstance = {
  id: InstanceId;
  coords: { latitude: number; longitude: number };
  color: string;
};

// In App.tsx
const [instances, setInstances] = useState<Map<InstanceId, RunningInstance>>(new Map());
const [draftPin, setDraftPin] = useState<PinCoords | null>(null);
const [activeId, setActiveId] = useState<InstanceId | null>(null);
const [recentPins, setRecentPins] = useState<PinCoords[]>([]);
```

The "draft pin" is the un-launched click (the existing Phase 4 marker behavior). On successful
launch, the draft pin coords become a tracked instance.

### Immutable Map update pattern

Because `Map` is mutated in-place, React won't re-render on `setInstances(prev)`. We always
create a new Map:

```ts
setInstances(prev => {
  const next = new Map(prev);
  next.set(id, { id, coords, color });
  return next;
});
```

## 3. Recent-pins ring buffer

```ts
// src/renderer/src/utils/ringBuffer.ts
export function pushBounded<T>(arr: readonly T[], item: T, max: number): T[] {
  return [...arr, item].slice(-max);
}
```

Usage:
```ts
setRecentPins(prev => pushBounded(prev, coords, 10));
```

Session-only: lives entirely in component state, no disk write. Clears automatically on app quit.

## 4. Sidebar layout and active highlight

```
+--------------------------------------+----------+
|                                      | Sidebar  |
|              Map                     | • row    |
|                                      | • row    |
|                                      | • row    |
|                                      +----------+
|                                      | Recent   |
|                                      | pins     |
+--------------------------------------+----------+
```

The sidebar is a right-docked panel (~280px). Two sections:
1. **Running instances** — one row per instance with colored dot, short ID, coords, close button
2. **Recent pins** — last 10 clicked/launched coords, click to populate CoordInput

Active row gets `background: rgba(255,255,255,0.1)` + `fontWeight: 600`.

### data-testid attributes

| Element | testid |
|---------|--------|
| Active instance row | `instance-row-active` |
| Non-active instance row | `instance-row` |
| Close button for id X | `close-${id}` |
| Sidebar container | `sidebar` |
| Recent pins section | `recent-pins` |

## 5. Color palette (8-color cycle)

```ts
const COLORS = [
  '#e74c3c', // red
  '#3498db', // blue
  '#2ecc71', // green
  '#f39c12', // orange
  '#9b59b6', // purple
  '#1abc9c', // teal
  '#e67e22', // dark orange
  '#34495e', // dark slate
];
```

Color is assigned at launch time: `COLORS[instances.size % 8]`.

## 6. flyTo triggered by sidebar click

Clicking an instance row in the sidebar:
1. Sets `activeId` to that instance's ID
2. Calls `flyToInstance(id)` which triggers a flyTo in MapView

The flyTo trigger uses the same `{ latitude, longitude, counter }` pattern established in Phase 4
to allow re-triggering even for the same coordinates.

## 7. setGeo on marker drag (optimistic update)

When marker dragend fires:
1. Optimistically update `instances` state with new coords
2. Call `window.api.setGeo(id, newCoords)` (fire-and-forget)
3. If `setGeo` rejects: revert coords in state and reposition marker to old coords

This gives immediate visual feedback without waiting for IPC round-trip.

## 8. Layout changes to App.tsx

Current: flex column (map + bottom bar + debug footer)
Phase 5: flex row (map column + sidebar column) inside a flex column (whole viewport)

```
flex-column (100vh)
  flex-row (flex: 1, min-height: 0)
    div (flex: 1, map)
    div (280px, sidebar)
  div (bottom bar — shrinks 0)
  details (debug footer — shrinks 0)
```

The sidebar's inner layout is flex-column: instance list (flex: 1, overflow-y: auto) + recent pins section.
