// src/renderer/src/App.tsx
//
// Phase 4 — Map UI
//
// Layout:
//   - Full-viewport flex column
//   - Map fills available space (flex: 1)
//   - Bottom bar: coord input, readout, launch button, live-instances counter
//   - Collapsible footer: Phase 0 verification rows (testids preserved per constraint)
//
// Pin state is lifted here; MapView and CoordInput are controlled components.

import { useEffect, useState } from 'react';
import MapView, { type PinCoords } from './map/MapView';
import CoordInput from './CoordInput';

export default function App() {
  // ------------------------------------------------------------------
  // Phase 0 — foundation verification state
  // ------------------------------------------------------------------
  const [pong, setPong] = useState<string | null>(null);
  const [launchCount, setLaunchCount] = useState<number | null>(null);

  // ------------------------------------------------------------------
  // Phase 3 — launcher state
  // ------------------------------------------------------------------
  const [liveCount, setLiveCount] = useState<number>(0);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchLoading, setLaunchLoading] = useState<boolean>(false);

  // ------------------------------------------------------------------
  // Phase 4 — map + pin state
  // ------------------------------------------------------------------
  const [pin, setPin] = useState<PinCoords | null>(null);
  const [flyToTrigger, setFlyToTrigger] = useState<
    { latitude: number; longitude: number; counter: number } | undefined
  >(undefined);

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------
  useEffect(() => {
    // Phase 0: round-trip smoke tests
    window.api.ping().then(setPong).catch(() => setPong('FAIL'));
    window.api.getLaunchCount().then(setLaunchCount).catch(() => setLaunchCount(-1));
  }, []);

  useEffect(() => {
    // Phase 3: subscribe to instance-closed push events from main.
    const unsubscribe = window.api.onInstanceClosed((_id: string) => {
      setLiveCount((prev) => Math.max(0, prev - 1));
    });
    return unsubscribe;
  }, []);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleLaunch = async (): Promise<void> => {
    if (!pin) return;
    setLaunchLoading(true);
    setLaunchError(null);
    try {
      await window.api.launch({ latitude: pin.latitude, longitude: pin.longitude });
      setLiveCount((prev) => prev + 1);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleCoordSubmit = (coords: PinCoords) => {
    setPin(coords);
    setFlyToTrigger((prev) => ({ ...coords, counter: (prev?.counter ?? 0) + 1 }));
  };

  const protocol = window.location.protocol;

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        margin: 0,
        padding: 0,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Map — fills available space */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MapView pin={pin} onPinChange={setPin} flyToTrigger={flyToTrigger} />
      </div>

      {/* Bottom bar */}
      <div
        style={{
          padding: '8px 16px',
          background: '#1a1a2e',
          color: '#eee',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {/* Coord input form (includes Google Maps URL paste) */}
        <CoordInput onSubmit={handleCoordSubmit} />

        {/* Pin coordinate readout */}
        <span
          data-testid="pin-coords"
          style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, minWidth: 180 }}
        >
          {pin
            ? `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`
            : ''}
        </span>

        {/* Launch button */}
        <button
          data-testid="launch-here-button"
          disabled={pin === null || launchLoading}
          onClick={() => void handleLaunch()}
          style={{
            padding: '6px 14px',
            cursor: pin && !launchLoading ? 'pointer' : 'default',
            background: '#2d5a8e',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
          }}
        >
          {launchLoading ? 'Launching…' : 'Launch here'}
        </button>

        {launchError && (
          <span data-testid="launch-error" style={{ color: '#ff6b6b', fontSize: 12 }}>
            {launchError}
          </span>
        )}

        {/* Live-instances counter (Phase 3 — must remain) */}
        <span style={{ marginLeft: 'auto', fontSize: 13 }}>
          live:{' '}
          <span data-testid="live-instances" style={{ fontWeight: 600 }}>
            {liveCount}
          </span>
        </span>
      </div>

      {/* Phase 0 verification rows — hidden by default, testids preserved */}
      <details
        style={{
          padding: '4px 16px',
          background: '#0d0d1a',
          color: '#666',
          fontSize: 11,
          flexShrink: 0,
        }}
      >
        <summary style={{ cursor: 'pointer' }}>Debug (Phase 0)</summary>
        <dl style={{ margin: '4px 0' }}>
          <dt>window.location.protocol</dt>
          <dd data-testid="protocol">{protocol}</dd>
          <dt>window.api.ping()</dt>
          <dd data-testid="ping">{pong ?? '…'}</dd>
          <dt>electron-store launchCount</dt>
          <dd data-testid="launch-count">{launchCount ?? '…'}</dd>
        </dl>
      </details>
    </main>
  );
}
