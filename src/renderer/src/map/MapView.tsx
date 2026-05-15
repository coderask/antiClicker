// src/renderer/src/map/MapView.tsx
//
// MapLibre GL JS 5 satellite map component backed by EOX S2cloudless raster tiles.
// No API key required. Attribution is rendered automatically by MapLibre's built-in
// attribution control from the source's `attribution` string.
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

export interface MapViewProps {
  pin: PinCoords | null;
  onPinChange: (coords: PinCoords) => void;
  flyToTrigger?: { latitude: number; longitude: number; counter: number };
}

export default function MapView({ pin, onPinChange, flyToTrigger }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  // Store the latest onPinChange in a ref so event listeners always call
  // the current version without needing to re-attach listeners on every render.
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;

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

    // Click-to-drop-pin: clicking anywhere on the map places/moves the pin
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      const { lat, lng } = e.lngLat;
      onPinChangeRef.current({ latitude: lat, longitude: lng });
    });

    // Cleanup: MUST call map.remove() to free WebGL context (critical for hot-reload)
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Pin sync: create/update/remove marker when pin prop changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pin === null) {
      // Remove marker if it exists
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    const lngLat: [number, number] = [pin.longitude, pin.latitude];

    if (!markerRef.current) {
      // Create a new draggable marker
      const marker = new maplibregl.Marker({ draggable: true })
        .setLngLat(lngLat)
        .addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        onPinChangeRef.current({ latitude: pos.lat, longitude: pos.lng });
      });

      markerRef.current = marker;
    } else {
      // Update existing marker position
      markerRef.current.setLngLat(lngLat);
    }
  }, [pin]);

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
