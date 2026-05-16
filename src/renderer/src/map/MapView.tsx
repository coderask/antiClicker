// src/renderer/src/map/MapView.tsx
//
// Fallback MapLibre + Esri map. Used when no Google Maps key is configured.
// Visual treatment matches GoogleMapView: instance markers are colored reticles,
// active instance pulses, draft pin is an amber crosshair.

import { useEffect, useRef } from 'react';
import maplibregl, { type StyleSpecification } from 'maplibre-gl';
import { theme } from '../theme';

// Esri World Imagery — free, no API key, worldwide satellite coverage.
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-world-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution:
        '&copy; Esri / Maxar / Earthstar Geographics',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'satellite-layer', type: 'raster', source: 'esri-world-imagery' }],
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
  pin: PinCoords | null;
  onPinChange: (coords: PinCoords) => void;
  flyToTrigger?: { latitude: number; longitude: number; counter: number };
  instances?: Map<string, InstanceMarkerInfo>;
  activeId?: string | null;
  onMarkerDrag?: (id: string, newCoords: PinCoords) => void;
  onCursorMove?: (coords: PinCoords | null) => void;
}

function reticleElement(color: string, active: boolean): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 28px; height: 28px; cursor: grab; position: relative;
    transform: ${active ? 'scale(1.15)' : 'scale(1)'};
    transition: transform ${theme.motion.fast};
  `;
  el.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="${active ? 11 : 9}" fill="${color}" fill-opacity="0.18"
              stroke="${color}" stroke-width="${active ? 2.5 : 1.5}"/>
      <circle cx="14" cy="14" r="2.5" fill="${color}"/>
      <line x1="14" y1="2" x2="14" y2="6" stroke="${active ? '#fff' : 'rgba(255,255,255,0.55)'}" stroke-width="1.2"/>
      <line x1="14" y1="22" x2="14" y2="26" stroke="${active ? '#fff' : 'rgba(255,255,255,0.55)'}" stroke-width="1.2"/>
      <line x1="2" y1="14" x2="6" y2="14" stroke="${active ? '#fff' : 'rgba(255,255,255,0.55)'}" stroke-width="1.2"/>
      <line x1="22" y1="14" x2="26" y2="14" stroke="${active ? '#fff' : 'rgba(255,255,255,0.55)'}" stroke-width="1.2"/>
    </svg>
  `;
  if (active) {
    const ring = el.firstElementChild?.firstElementChild as SVGCircleElement | null;
    if (ring) ring.classList.add('ac-pulse');
  }
  return el;
}

function draftElement(): HTMLElement {
  const el = document.createElement('div');
  const c = theme.color.accent;
  el.style.cssText = 'width:32px;height:32px;cursor:grab;';
  el.innerHTML = `
    <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="13" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 3" opacity="0.65"/>
      <circle cx="16" cy="16" r="6" fill="${c}" fill-opacity="0.22" stroke="${c}" stroke-width="1.6"/>
      <circle cx="16" cy="16" r="2" fill="${c}"/>
      <line x1="16" y1="0" x2="16" y2="5" stroke="${c}" stroke-width="1.4"/>
      <line x1="16" y1="27" x2="16" y2="32" stroke="${c}" stroke-width="1.4"/>
      <line x1="0" y1="16" x2="5" y2="16" stroke="${c}" stroke-width="1.4"/>
      <line x1="27" y1="16" x2="32" y2="16" stroke="${c}" stroke-width="1.4"/>
    </svg>
  `;
  return el;
}

export default function MapView({
  pin,
  onPinChange,
  flyToTrigger,
  instances,
  activeId,
  onMarkerDrag,
  onCursorMove,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const instanceMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());

  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;
  const onCursorMoveRef = useRef(onCursorMove);
  onCursorMoveRef.current = onCursorMove;

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: [0, 20],
      zoom: 2,
      maxZoom: 18,
      attributionControl: { compact: true },
    });

    mapRef.current = map;

    map.on('click', (e: maplibregl.MapMouseEvent) => {
      onPinChangeRef.current({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    });

    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      onCursorMoveRef.current?.({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    });
    map.on('mouseout', () => onCursorMoveRef.current?.(null));

    return () => {
      for (const marker of instanceMarkersRef.current.values()) marker.remove();
      instanceMarkersRef.current.clear();
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (pin === null) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const lngLat: [number, number] = [pin.longitude, pin.latitude];

    if (!markerRef.current) {
      const marker = new maplibregl.Marker({
        element: draftElement(),
        draggable: true,
      })
        .setLngLat(lngLat)
        .addTo(map);
      marker.on('dragend', () => {
        const pos = marker.getLngLat();
        onPinChangeRef.current({ latitude: pos.lat, longitude: pos.lng });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setLngLat(lngLat);
    }
  }, [pin]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const incoming = instances ?? new Map<string, InstanceMarkerInfo>();
    const markerMap = instanceMarkersRef.current;

    for (const [id, marker] of markerMap) {
      if (!incoming.has(id)) {
        marker.remove();
        markerMap.delete(id);
      }
    }

    for (const [id, info] of incoming) {
      const isActive = activeId === id;
      const existing = markerMap.get(id);
      if (existing) {
        existing.setLngLat([info.coords.longitude, info.coords.latitude]);
        // Replace element to refresh visual state cleanly.
        const newEl = reticleElement(info.color, isActive);
        const oldEl = existing.getElement();
        oldEl.replaceWith(newEl);
        (existing as unknown as { _element: HTMLElement })._element = newEl;
      } else {
        const capturedId = id;
        const marker = new maplibregl.Marker({
          element: reticleElement(info.color, isActive),
          draggable: true,
        })
          .setLngLat([info.coords.longitude, info.coords.latitude])
          .addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLngLat();
          onMarkerDragRef.current?.(capturedId, {
            latitude: pos.lat,
            longitude: pos.lng,
          });
        });
        markerMap.set(id, marker);
      }
    }
  }, [instances, activeId]);

  useEffect(() => {
    if (!flyToTrigger || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyToTrigger.longitude, flyToTrigger.latitude],
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 1200,
    });
  }, [flyToTrigger]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', background: theme.color.bg }}
      data-testid="map-container"
    />
  );
}
