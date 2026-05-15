// src/renderer/src/map/MapView.tsx
//
// Phase 5 — Multi-Instance UX (extends Phase 4 Map UI)
//
// Renders:
//   1. A "draft" pin — the un-launched click (existing Phase 4 single-pin behavior)
//   2. N "instance" markers — one per running Chrome instance, colored + draggable
//
// Instance markers:
//   - Each gets a custom HTML element with the instance's assigned color
//   - draggable: true — dragend fires onMarkerDrag(id, newCoords)
//   - Active instance marker gets a bright white border + scale-up
//   - Markers are diffed on every render (add missing, remove stale, update existing)
//
// Notes:
//  - Container div must have explicit height (100%) — MapLibre silently renders into
//    a 0-height container otherwise.
//  - map.remove() MUST be called on unmount to prevent WebGL context leaks on hot-reload.
//  - MapLibre center is [lng, lat], not [lat, lng].
//  - maxZoom is capped at 14 — EOX tiles don't go higher.

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';

// ---------------------------------------------------------------------------
// EOX S2cloudless 2020 raster source — no API key, CC BY 4.0 attribution
// ---------------------------------------------------------------------------
const EOX_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'eox-s2cloudless': {
      type: 'raster',
      tiles: [
        'https://s2maps-tiles.eu/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg',
      ],
      tileSize: 256,
      attribution: 'Sentinel-2 cloudless by <a href="https://eox.at">EOX IT Services GmbH</a> (2020)',
      maxzoom: 14,
    },
  },
  layers: [{ id: 'eox-layer', type: 'raster', source: 'eox-s2cloudless' }],
};

export interface PinCoords {
  latitude: number;
  longitude: number;
}

export interface InstanceMarkerInfo {
  id: string;
  coords: PinCoords;
  color: string;
}

export interface MapViewProps {
  // Draft pin (un-launched click) — existing single-pin behavior
  pin: PinCoords | null;
  onPinChange: (coords: PinCoords) => void;
  flyToTrigger?: { latitude: number; longitude: number; counter: number };
  // Multi-instance markers (optional — backward compatible)
  instances?: Map<string, InstanceMarkerInfo>;
  activeId?: string | null;
  onMarkerDrag?: (id: string, newCoords: PinCoords) => void;
}

export default function MapView({
  pin,
  onPinChange,
  flyToTrigger,
  instances,
  activeId,
  onMarkerDrag,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Draft pin marker ref (single marker for un-launched pin)
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Per-instance marker map: InstanceId → Marker
  const instanceMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  // Store callbacks in refs so event listeners always call the current version
  // without needing to re-attach on every render.
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;

  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;

  // -------------------------------------------------------------------------
  // Mount: create the map instance (runs once)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: EOX_STYLE,
      center: [0, 0],
      zoom: 2,
      maxZoom: 14,
    });

    mapRef.current = map;

    // Click-to-drop-pin: clicking anywhere on the map places/moves the draft pin
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      onPinChangeRef.current({ latitude: lat, longitude: lng });
    });

    // Cleanup: MUST call map.remove() to free WebGL context (critical for hot-reload)
    return () => {
      // Remove all instance markers
      for (const marker of instanceMarkersRef.current.values()) {
        marker.remove();
      }
      instanceMarkersRef.current.clear();

      // Remove draft marker
      markerRef.current?.remove();
      markerRef.current = null;

      map.remove();
      mapRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Draft pin sync: create/update/remove draft marker when pin prop changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pin === null) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const lngLat: [number, number] = [pin.longitude, pin.latitude];

    if (!markerRef.current) {
      // Create a new draggable draft marker (default MapLibre style)
      const marker = new maplibregl.Marker({ draggable: true })
        .setLngLat(lngLat)
        .addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        onPinChangeRef.current({ latitude: pos.lat, longitude: pos.lng });
      });

      markerRef.current = marker;
    } else {
      // Update existing draft marker position
      markerRef.current.setLngLat(lngLat);
    }
  }, [pin]);

  // -------------------------------------------------------------------------
  // Instance markers sync: diff the instances Map and update markers
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = instances ?? new Map<string, InstanceMarkerInfo>();
    const markerMap = instanceMarkersRef.current;

    // Remove markers for instances no longer in the Map
    for (const [id, marker] of markerMap) {
      if (!incoming.has(id)) {
        marker.remove();
        markerMap.delete(id);
      }
    }

    // Add or update markers for current instances
    for (const [id, info] of incoming) {
      const isActive = activeId === id;

      if (markerMap.has(id)) {
        // Update position
        markerMap.get(id)!.setLngLat([info.coords.longitude, info.coords.latitude]);
        // Update active state styling on the element
        const el = markerMap.get(id)!.getElement();
        el.style.border = `3px solid ${isActive ? '#ffffff' : 'rgba(255,255,255,0.4)'}`;
        el.style.transform = isActive ? 'scale(1.3)' : 'scale(1)';
      } else {
        // Create new colored instance marker
        const el = document.createElement('div');
        el.style.cssText = [
          'width:20px',
          'height:20px',
          'border-radius:50%',
          `background:${info.color}`,
          `border:3px solid ${isActive ? '#ffffff' : 'rgba(255,255,255,0.4)'}`,
          'cursor:grab',
          'box-shadow:0 2px 6px rgba(0,0,0,0.6)',
          `transform:${isActive ? 'scale(1.3)' : 'scale(1)'}`,
          'transition:transform 0.15s,border-color 0.15s',
        ].join(';');

        const capturedId = id;
        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([info.coords.longitude, info.coords.latitude])
          .addTo(map);

        marker.on('dragend', () => {
          const pos = marker.getLngLat();
          onMarkerDragRef.current?.(capturedId, { latitude: pos.lat, longitude: pos.lng });
        });

        markerMap.set(id, marker);
      }
    }
  }, [instances, activeId]);

  // -------------------------------------------------------------------------
  // flyTo: animate map to coords when flyToTrigger counter changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!flyToTrigger || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyToTrigger.longitude, flyToTrigger.latitude],
      zoom: 10,
    });
  }, [flyToTrigger]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      data-testid="map-container"
    />
  );
}
