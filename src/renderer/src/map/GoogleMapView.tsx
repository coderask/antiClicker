// src/renderer/src/map/GoogleMapView.tsx
//
// Google Maps satellite backend. Implements the same MapViewProps interface
// as MapView.tsx so App.tsx can swap them based on whether a key is stored.
//
// IMPORTANT — the v0.0.5 bug: the previous implementation used a `loading=async`
// script URL but then immediately called `new window.google.maps.Map(...)` on
// `script.onload`. With `loading=async`, onload fires when the loader bootstrap
// is parsed, NOT when the maps libraries are ready. The fix is to use
// `await google.maps.importLibrary('maps')` (and 'marker') which is the modern
// dynamic-import pattern that resolves only when each library is fully loaded.
//
// Failure modes — all surface a fallback to MapLibre:
//   - script element fails to load (network, CSP, bad CDN) → catch in load
//   - importLibrary rejects (invalid key, restricted referrer) → catch
//   - new Map() / new Marker() throws → catch each in try blocks
//
// Visuals: instance markers are colored reticles (small SVG bullseyes) that
// match the cartographic aesthetic. Active marker pulses a phosphor ring.

import { useEffect, useRef } from 'react';
import type { MapViewProps } from './MapView';
import { theme } from '../theme';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface GMap {
  setCenter(pos: { lat: number; lng: number }): void;
  setZoom(z: number): void;
  panTo(pos: { lat: number; lng: number }): void;
  addListener(event: string, cb: (...args: any[]) => void): void;
}

interface GMarker {
  setPosition(pos: { lat: number; lng: number }): void;
  setMap(map: GMap | null): void;
  setIcon(icon: any): void;
  getPosition(): { lat(): number; lng(): number } | null;
  addListener(event: string, cb: () => void): void;
}

interface GoogleMapsNS {
  Map: new (el: HTMLElement, opts: object) => GMap;
  Marker: new (opts: object) => GMarker;
  SymbolPath: { CIRCLE: number };
  importLibrary: (name: string) => Promise<unknown>;
}

declare global {
  interface Window {
    google?: { maps?: GoogleMapsNS };
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface GoogleMapViewProps extends MapViewProps {
  apiKey: string;
  onFallback: () => void;
}

// ─── Script loader ────────────────────────────────────────────────────────
// Inject the Google Maps bootstrap once. Idempotent across mounts.
function loadBootstrap(apiKey: string): Promise<void> {
  if (window.google?.maps?.importLibrary) return Promise.resolve();

  const existing = document.querySelector('script[data-gm-loader]');
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', reject);
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async`;
    script.async = true;
    script.defer = true;
    script.setAttribute('data-gm-loader', 'true');
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
}

// SVG-as-data-URI: a reticle marker matching the theme.
function reticleIcon(color: string, active: boolean): object {
  const ring = active ? '#ffffff' : 'rgba(255,255,255,0.55)';
  const stroke = active ? 2.5 : 1.5;
  const r = active ? 11 : 9;
  // 28x28 viewBox: outer ring, inner dot, two short crosshair ticks
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <circle cx="14" cy="14" r="${r}" fill="${color}" fill-opacity="0.18" stroke="${color}" stroke-width="${stroke}"/>
  <circle cx="14" cy="14" r="2.5" fill="${color}"/>
  <line x1="14" y1="2" x2="14" y2="6" stroke="${ring}" stroke-width="1.2"/>
  <line x1="14" y1="22" x2="14" y2="26" stroke="${ring}" stroke-width="1.2"/>
  <line x1="2" y1="14" x2="6" y2="14" stroke="${ring}" stroke-width="1.2"/>
  <line x1="22" y1="14" x2="26" y2="14" stroke="${ring}" stroke-width="1.2"/>
</svg>`.trim();
  return {
    url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
    anchor: { x: 14, y: 14 },
    scaledSize: { width: 28, height: 28 },
  };
}

function draftIcon(): object {
  const c = theme.color.accent;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="13" fill="none" stroke="${c}" stroke-width="1" stroke-dasharray="2 3" opacity="0.6"/>
  <circle cx="16" cy="16" r="6" fill="${c}" fill-opacity="0.2" stroke="${c}" stroke-width="1.6"/>
  <circle cx="16" cy="16" r="2" fill="${c}"/>
  <line x1="16" y1="0" x2="16" y2="5" stroke="${c}" stroke-width="1.4"/>
  <line x1="16" y1="27" x2="16" y2="32" stroke="${c}" stroke-width="1.4"/>
  <line x1="0" y1="16" x2="5" y2="16" stroke="${c}" stroke-width="1.4"/>
  <line x1="27" y1="16" x2="32" y2="16" stroke="${c}" stroke-width="1.4"/>
</svg>`.trim();
  return {
    url: `data:image/svg+xml;utf-8,${encodeURIComponent(svg)}`,
    anchor: { x: 16, y: 16 },
    scaledSize: { width: 32, height: 32 },
  };
}

// Mission-control-style Maps style — heavy dark theme, dampened POIs.
// Applied on top of `hybrid` map type to keep satellite + tone down labels.
const STYLED_LABELS = [
  { elementType: 'labels.text.fill', stylers: [{ color: '#d6d8e0' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }, { weight: 2 }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

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
  const draftMarkerRef = useRef<GMarker | null>(null);
  const instanceMarkersRef = useRef<Map<string, GMarker>>(new Map());

  // Stable callback refs
  const onPinChangeRef = useRef(onPinChange);
  onPinChangeRef.current = onPinChange;
  const onMarkerDragRef = useRef(onMarkerDrag);
  onMarkerDragRef.current = onMarkerDrag;
  const onFallbackRef = useRef(onFallback);
  onFallbackRef.current = onFallback;

  // Mount: load bootstrap, importLibrary('maps'), create Map.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async (): Promise<void> => {
      try {
        await loadBootstrap(apiKey);
        if (cancelled) return;

        const gmaps = window.google?.maps;
        if (!gmaps?.importLibrary) {
          throw new Error('google.maps.importLibrary unavailable after bootstrap');
        }

        // THE FIX: importLibrary returns the actual classes, resolves only when ready.
        await gmaps.importLibrary('maps');
        if (cancelled || !containerRef.current) return;

        // After importLibrary('maps'), gmaps.Map is guaranteed defined.
        const map = new gmaps.Map(containerRef.current, {
          center: { lat: 20, lng: 0 },
          zoom: 2,
          mapTypeId: 'hybrid',
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: 9 /* RIGHT_TOP */ },
          gestureHandling: 'greedy',
          backgroundColor: theme.color.bg,
          styles: STYLED_LABELS,
          clickableIcons: false,
        });
        mapRef.current = map;

        map.addListener('click', (e: { latLng: { lat(): number; lng(): number } }) => {
          if (!e?.latLng) return;
          onPinChangeRef.current({
            latitude: e.latLng.lat(),
            longitude: e.latLng.lng(),
          });
        });
      } catch (err) {
        // Any failure in the boot chain → fall back to MapLibre.
        // Don't surface to user as an error — the indicator badge will flip.
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.warn('[GoogleMapView] fallback:', err);
          onFallbackRef.current();
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const m of instanceMarkersRef.current.values()) m.setMap(null);
      instanceMarkersRef.current.clear();
      draftMarkerRef.current?.setMap(null);
      draftMarkerRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey]);

  // Draft pin sync
  useEffect(() => {
    const map = mapRef.current;
    const gmaps = window.google?.maps;
    if (!map || !gmaps) return;

    if (pin === null) {
      draftMarkerRef.current?.setMap(null);
      draftMarkerRef.current = null;
      return;
    }

    const pos = { lat: pin.latitude, lng: pin.longitude };
    if (!draftMarkerRef.current) {
      try {
        const marker = new gmaps.Marker({
          position: pos,
          map,
          draggable: true,
          icon: draftIcon(),
          zIndex: 1000,
          title: 'Draft pin',
        });
        marker.addListener('dragend', () => {
          const p = marker.getPosition();
          if (p) onPinChangeRef.current({ latitude: p.lat(), longitude: p.lng() });
        });
        draftMarkerRef.current = marker;
      } catch {
        /* swallow — fallback handler will revert backend if Marker is unavailable */
      }
    } else {
      draftMarkerRef.current.setPosition(pos);
    }
  }, [pin]);

  // Instance markers sync
  useEffect(() => {
    const map = mapRef.current;
    const gmaps = window.google?.maps;
    if (!map || !gmaps) return;

    const incoming = instances ?? new Map();
    const markerMap = instanceMarkersRef.current;

    for (const [id, marker] of markerMap) {
      if (!incoming.has(id)) {
        marker.setMap(null);
        markerMap.delete(id);
      }
    }

    for (const [id, info] of incoming) {
      const pos = { lat: info.coords.latitude, lng: info.coords.longitude };
      const active = activeId === id;
      const existing = markerMap.get(id);
      if (existing) {
        existing.setPosition(pos);
        existing.setIcon(reticleIcon(info.color, active));
      } else {
        try {
          const capturedId = id;
          const marker = new gmaps.Marker({
            position: pos,
            map,
            draggable: true,
            title: id,
            icon: reticleIcon(info.color, active),
          });
          marker.addListener('dragend', () => {
            const p = marker.getPosition();
            if (p) {
              onMarkerDragRef.current?.(capturedId, {
                latitude: p.lat(),
                longitude: p.lng(),
              });
            }
          });
          markerMap.set(id, marker);
        } catch {
          /* swallow */
        }
      }
    }
  }, [instances, activeId]);

  // flyTo
  useEffect(() => {
    if (!flyToTrigger || !mapRef.current) return;
    mapRef.current.panTo({
      lat: flyToTrigger.latitude,
      lng: flyToTrigger.longitude,
    });
    mapRef.current.setZoom(17);
  }, [flyToTrigger]);

  return (
    <div
      ref={containerRef}
      data-testid="map-container"
      style={{ width: '100%', height: '100%', background: theme.color.bg }}
    />
  );
}
