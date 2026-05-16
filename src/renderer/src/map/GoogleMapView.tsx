// src/renderer/src/map/GoogleMapView.tsx
//
// Phase 7 — Google Maps satellite backend
//
// Implements the same MapViewProps interface as MapView.tsx so App.tsx can
// swap the two transparently based on whether a Maps API key is stored.
//
// Uses google.maps.Map with mapTypeId: 'hybrid' (satellite + street labels).
// Uses the classic google.maps.Marker API (not AdvancedMarkerElement) to avoid
// the mapId requirement. Markers are draggable for both the draft pin and
// instance pins.
//
// Error handling: if the Google Maps script fails to load (CDN unreachable,
// invalid key), calls onFallback() immediately to revert to MapLibre + Esri.
//
// 'unsafe-eval' in CSP: Google Maps JS API uses eval() internally for tile
// math. This is a known, documented limitation (see 07-RESEARCH.md).

import { useEffect, useRef } from 'react';
import type { MapViewProps } from './MapView';

// ---------------------------------------------------------------------------
// Minimal Google Maps type stubs (no @types/google.maps installed)
// We only use what we reference; `any` fills the rest.
// ---------------------------------------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */
interface GMap {
  setCenter(pos: { lat: number; lng: number }): void;
  setZoom(z: number): void;
  addListener(event: string, cb: (...args: any[]) => void): void;
}

interface GMarker {
  setPosition(pos: { lat: number; lng: number }): void;
  setMap(map: GMap | null): void;
  getPosition(): { lat(): number; lng(): number } | null;
  addListener(event: string, cb: () => void): void;
}

interface GoogleMapsNS {
  Map: new (el: HTMLElement, opts: object) => GMap;
  Marker: new (opts: object) => GMarker;
  SymbolPath: { CIRCLE: number };
}

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNS };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface GoogleMapViewProps extends MapViewProps {
  apiKey: string;
  onFallback: () => void;
}

// ---------------------------------------------------------------------------
// Script loader (idempotent)
// ---------------------------------------------------------------------------
function loadGoogleMapsScript(apiKey: string): Promise<void> {
  // Already loaded
  if (window.google?.maps) return Promise.resolve();

  // Script already injected but not yet loaded
  const existing = document.querySelector('script[data-gm-loader]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    // loading=async is the modern (non-legacy) load mode
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
    script.async = true;
    script.setAttribute('data-gm-loader', 'true');
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function GoogleMapView({
  pin,
  onPinChange,
  flyToTrigger,
  instances,
  activeId,
  onMarkerDrag,
  apiKey,
  onFallback,
}: GoogleMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<GMap | null>(null);
  const markerRef = useRef<GMarker | null>(null);
  const instanceMarkersRef = useRef<Map<string, GMarker>>(new Map());

  // Keep callbacks stable across renders
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  // -------------------------------------------------------------------------
  // Mount: load Google Maps script, create map instance
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    loadGoogleMapsScript(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;
        const gmaps = window.google.maps;
        const map = new gmaps.Map(containerRef.current, {
          center: { lat: 0, lng: 0 },
          zoom: 2,
          mapTypeId: 'hybrid',
          disableDefaultUI: false,
        });
        mapRef.current = map;

        // Click-to-drop-pin
        map.addListener('click', (e: { latLng: { lat(): number; lng(): number } }) => {
          if (!e.latLng) return;
          onPinChangeRef.current({ latitude: e.latLng.lat(), longitude: e.latLng.lng() });
        });
      })
      .catch(() => {
        if (!cancelled) onFallbackRef.current();
      });

    return () => {
      cancelled = true;
      // Detach all markers from map
      instanceMarkersRef.current.forEach((m) => m.setMap(null));
      instanceMarkersRef.current.clear();
      markerRef.current?.setMap(null);
      markerRef.current = null;
      // Google Maps Map instances don't have a .remove() — just null the ref
      mapRef.current = null;
    };
  }, [apiKey]); // re-run only if key changes (practically never)

  // -------------------------------------------------------------------------
  // Draft pin sync
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    if (pin === null) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      return;
    }

    const pos = { lat: pin.latitude, lng: pin.longitude };

    if (!markerRef.current) {
      const marker = new window.google.maps.Marker({
        position: pos,
        map,
        draggable: true,
        title: 'Draft pin',
        zIndex: 100,
      });
      marker.addListener('dragend', () => {
        const p = marker.getPosition();
        if (p) onPinChangeRef.current({ latitude: p.lat(), longitude: p.lng() });
      });
      markerRef.current = marker;
    } else {
      markerRef.current.setPosition(pos);
    }
  }, [pin]);

  // -------------------------------------------------------------------------
  // Instance markers sync
  // -------------------------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const incoming = instances ?? new Map();
    const markerMap = instanceMarkersRef.current;

    // Remove stale markers
    for (const [id, marker] of markerMap) {
      if (!incoming.has(id)) {
        marker.setMap(null);
        markerMap.delete(id);
      }
    }

    // Add or update
    for (const [id, info] of incoming) {
      const pos = { lat: info.coords.latitude, lng: info.coords.longitude };
      if (markerMap.has(id)) {
        markerMap.get(id)!.setPosition(pos);
      } else {
        const capturedId = id;
        const marker = new window.google.maps.Marker({
          position: pos,
          map,
          draggable: true,
          title: id,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: info.color,
            fillOpacity: 1,
            strokeColor: activeId === id ? '#ffffff' : 'rgba(255,255,255,0.4)',
            strokeWeight: 3,
          },
        });
        marker.addListener('dragend', () => {
          const p = marker.getPosition();
          if (p) onMarkerDragRef.current?.(capturedId, { latitude: p.lat(), longitude: p.lng() });
        });
        markerMap.set(id, marker);
      }
    }
  }, [instances, activeId]);

  // -------------------------------------------------------------------------
  // flyTo
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!flyToTrigger || !mapRef.current) return;
    mapRef.current.setCenter({ lat: flyToTrigger.latitude, lng: flyToTrigger.longitude });
    mapRef.current.setZoom(17);
  }, [flyToTrigger]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      data-testid="map-container"
    />
  );
}
