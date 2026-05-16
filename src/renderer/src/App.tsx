// src/renderer/src/App.tsx
//
// Phase 5 — Multi-Instance UX + Live Update
//
// Layout:
//   flex-column (100vh)
//     flex-row (flex: 1, min-height: 0)
//       div (flex: 1, map canvas)
//       Sidebar (280px, right panel)
//         - Running instances list
//         - Recent pins section
//     div (bottom bar — coord input, draft pin readout, launch button, live count)
//     details (Phase 0 verification rows — preserved)
//
// State model:
//   - instances:  Map<InstanceId, RunningInstance> — running Chrome instances
//   - draftPin:   PinCoords | null — un-launched click (replacing single 'pin')
//   - activeId:   InstanceId | null — currently focused instance
//   - recentPins: PinCoords[]       — ring buffer of last 10 launched coords (session only)
//
// On launch: draft pin becomes a tracked instance; instance gets a color from the 8-color palette.
// On drag:   instance marker dragend → setGeo IPC (optimistic update).
// On close:  IPC close → onInstanceClosed push event removes from Map.

import { useEffect, useState } from 'react';
import MapView, { type PinCoords } from './map/MapView';
import GoogleMapView from './map/GoogleMapView';
import CoordInput from './CoordInput';
import Sidebar, { type VerifyResult } from './Sidebar';
import RecentPins from './RecentPins';
import Favorites, { type Favorite } from './Favorites';
import ScopeOverlay from './ScopeOverlay';
import { pushBounded } from './utils/ringBuffer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type InstanceId = string;

interface RunningInstance {
  id: InstanceId;
  coords: PinCoords;
  color: string;
}

// ---------------------------------------------------------------------------
// Color palette (8-color cycle for instance markers)
// ---------------------------------------------------------------------------
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
  // Phase 5 — multi-instance state
  // ------------------------------------------------------------------
  const [instances, setInstances] = useState<Map<InstanceId, RunningInstance>>(new Map());
  const [draftPin, setDraftPin] = useState<PinCoords | null>(null);
  const [activeId, setActiveId] = useState<InstanceId | null>(null);
  const [recentPins, setRecentPins] = useState<PinCoords[]>([]);

  // ------------------------------------------------------------------
  // Phase 6 — verify + first-run overlay state
  // ------------------------------------------------------------------
  const [showOverlay, setShowOverlay] = useState(false);
  const [verifyResults, setVerifyResults] = useState<Map<InstanceId, VerifyResult>>(new Map());

  // ------------------------------------------------------------------
  // Phase 7 — favorites state
  // ------------------------------------------------------------------
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [pendingKey, setPendingKey] = useState('');
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  // flyToTrigger: signals MapView to animate to a location
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
    // Phase 6: show first-run scope overlay if not yet dismissed
    window.api.getFirstRunSeen().then((seen) => {
      if (!seen) setShowOverlay(true);
    }).catch(() => undefined);
    // Phase 7: load persisted recent pins from electron-store on mount
    window.api.getRecentPins().then((pins) => {
      // Strip the timestamp field — React state only needs lat/lng
      setRecentPins(pins.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
    }).catch(() => undefined);
    // Phase 7: load favorites from electron-store on mount
    window.api.getFavorites().then((favs) => setFavorites(favs)).catch(() => undefined);
    // Phase 7: load stored Maps API key on mount
    window.api.getMapsApiKey().then(setMapsApiKey).catch(() => undefined);
  }, []);

  // Phase 7: debounced persist of recentPins to electron-store (500ms)
  useEffect(() => {
    if (recentPins.length === 0) return; // skip initial empty (loaded from store already)
    const timer = setTimeout(() => {
      const now = Date.now();
      const toStore = recentPins.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: now,
      }));
      window.api.setRecentPins(toStore).catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [recentPins]);

  // Phase 7: debounced persist of favorites to electron-store (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      window.api.setFavorites(favorites).catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, [favorites]);

  useEffect(() => {
    // Phase 3/5: subscribe to instance-closed push events from main.
    const unsubscribe = window.api.onInstanceClosed((id: string) => {
      setInstances((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setLiveCount((prev) => Math.max(0, prev - 1));
      setActiveId((prev) => (prev === id ? null : prev));
    });
    return unsubscribe;
  }, []);

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------

  /** Launch a new Chrome at the current draft pin coords */
  const handleLaunch = async (): Promise<void> => {
    if (!draftPin) return;
    setLaunchLoading(true);
    setLaunchError(null);
    try {
      // Pick color based on current instance count (before adding new one)
      const color = COLORS[instances.size % COLORS.length];

      const result = await window.api.launch({
        latitude: draftPin.latitude,
        longitude: draftPin.longitude,
      });

      const id = result.id;
      const coords: PinCoords = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };

      // Add to instances Map
      setInstances((prev) => {
        const next = new Map(prev);
        next.set(id, { id, coords, color });
        return next;
      });

      // Track in recent pins (ring buffer, cap at 10)
      setRecentPins((prev) => pushBounded(prev, coords, 10));

      // New instance becomes the active one
      setActiveId(id);

      setLiveCount((prev) => prev + 1);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunchLoading(false);
    }
  };

  /** Live-update coordinates of a running instance on marker drag (no relaunch) */
  const handleSetGeo = async (id: InstanceId, newCoords: PinCoords): Promise<void> => {
    // Optimistic update — immediately reflect new coords in state
    const prevCoords = instances.get(id)?.coords;
    setInstances((prev) => {
      const next = new Map(prev);
      const inst = next.get(id);
      if (inst) next.set(id, { ...inst, coords: newCoords });
      return next;
    });

    try {
      await window.api.setGeo(id, newCoords);
    } catch {
      // Revert optimistic update on failure
      if (prevCoords) {
        setInstances((prev) => {
          const next = new Map(prev);
          const inst = next.get(id);
          if (inst) next.set(id, { ...inst, coords: prevCoords });
          return next;
        });
      }
    }
  };

  /** Close an instance by id — IPC close + cleanup */
  const handleClose = async (id: InstanceId): Promise<void> => {
    try {
      await window.api.close(id);
      // onInstanceClosed event will fire and remove from state
    } catch {
      // If IPC fails, still clean up state locally
      setInstances((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setLiveCount((prev) => Math.max(0, prev - 1));
      setActiveId((prev) => (prev === id ? null : prev));
    }
  };

  /** Focus and fly to an instance's location when clicking a sidebar row */
  const handleFocusInstance = (id: InstanceId): void => {
    setActiveId(id);
    const inst = instances.get(id);
    if (inst) {
      setFlyToTrigger((prev) => ({
        ...inst.coords,
        counter: (prev?.counter ?? 0) + 1,
      }));
    }
  };

  /** Click a recent pin: populate the draft pin + fly to it (no auto-launch) */
  const handleRecentPinClick = (coords: PinCoords): void => {
    setDraftPin(coords);
    setFlyToTrigger((prev) => ({
      ...coords,
      counter: (prev?.counter ?? 0) + 1,
    }));
  };

  /** Coord form submit: set draft pin + fly to */
  const handleCoordSubmit = (coords: PinCoords): void => {
    setDraftPin(coords);
    setFlyToTrigger((prev) => ({ ...coords, counter: (prev?.counter ?? 0) + 1 }));
  };

  // Phase 6 — dismiss first-run overlay and persist the flag
  const handleDismissOverlay = (): void => {
    setShowOverlay(false);
    window.api.markFirstRunSeen().catch(() => undefined);
  };

  /** Verify spoofed coords for a running instance */
  const handleVerify = async (id: InstanceId): Promise<void> => {
    try {
      const result = await window.api.verifySpoof(id);
      setVerifyResults((prev) => {
        const next = new Map(prev);
        next.set(id, { match: result.match, reported: result.reported });
        return next;
      });
    } catch {
      // If verify fails, mark as mismatch
      setVerifyResults((prev) => {
        const next = new Map(prev);
        next.set(id, { match: false, reported: { lat: 0, lng: 0 } });
        return next;
      });
    }
  };

  /** Open browserleaks verification URLs in a running instance */
  const handleOpenVerificationUrls = (id: InstanceId): void => {
    window.api.openVerificationUrls(id).catch(() => undefined);
  };

  // Phase 7 — favorites handlers

  /** Save the current draft pin as a favorite (prompts for optional name) */
  const handleSaveFavorite = (): void => {
    if (!draftPin) return;
    const defaultName = `${draftPin.latitude.toFixed(3)}, ${draftPin.longitude.toFixed(3)}`;
    const name = window.prompt('Name for this favorite (leave blank for coordinates):', defaultName);
    if (name === null) return; // user cancelled the prompt
    const newFav: Favorite = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: name.trim() || defaultName,
      latitude: draftPin.latitude,
      longitude: draftPin.longitude,
      createdAt: Date.now(),
    };
    setFavorites((prev) => [...prev, newFav].slice(0, 100));
  };

  /** Remove a favorite by id */
  const handleDeleteFavorite = (id: string): void => {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  };

  /** Click a favorite: populate draft pin + fly to it */
  const handleFavoriteSelect = (coords: PinCoords): void => {
    setDraftPin(coords);
    setFlyToTrigger((prev) => ({
      ...coords,
      counter: (prev?.counter ?? 0) + 1,
    }));
  };

  /** Save a new Maps API key */
  const handleSaveKey = async (): Promise<void> => {
    const trimmed = pendingKey.trim();
    if (!trimmed) return;
    await window.api.setMapsApiKey(trimmed);
    setMapsApiKey(trimmed);
    setShowKeyInput(false);
    setPendingKey('');
  };

  /** Clear the stored Maps API key (reverts to Esri/MapLibre) */
  const handleClearKey = async (): Promise<void> => {
    await window.api.setMapsApiKey(null);
    setMapsApiKey(null);
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
      {/* Phase 6 — first-run scope overlay */}
      {showOverlay && <ScopeOverlay onDismiss={handleDismissOverlay} />}
      {/* Main content row: map + sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Map — fills available horizontal space */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          {mapsApiKey ? (
            <GoogleMapView
              pin={draftPin}
              onPinChange={setDraftPin}
              flyToTrigger={flyToTrigger}
              instances={instances}
              activeId={activeId}
              onMarkerDrag={(id, newCoords) => void handleSetGeo(id, newCoords)}
              apiKey={mapsApiKey}
              onFallback={() => setMapsApiKey(null)}
            />
          ) : (
            <MapView
              pin={draftPin}
              onPinChange={setDraftPin}
              flyToTrigger={flyToTrigger}
              instances={instances}
              activeId={activeId}
              onMarkerDrag={(id, newCoords) => void handleSetGeo(id, newCoords)}
            />
          )}
        </div>

        {/* Sidebar (right panel) */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 280, flexShrink: 0 }}>
          <Sidebar
            instances={instances}
            activeId={activeId}
            onFocus={handleFocusInstance}
            onClose={(id) => void handleClose(id)}
            onVerify={(id) => void handleVerify(id)}
            onOpenVerificationUrls={handleOpenVerificationUrls}
            verifyResults={verifyResults}
          />
          <Favorites
            favorites={favorites}
            onSelect={handleFavoriteSelect}
            onDelete={handleDeleteFavorite}
          />
          <RecentPins
            pins={recentPins}
            onSelect={handleRecentPinClick}
          />
        </div>
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

        {/* Draft pin coordinate readout */}
        <span
          data-testid="pin-coords"
          style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, minWidth: 180 }}
        >
          {draftPin
            ? `${draftPin.latitude.toFixed(4)}, ${draftPin.longitude.toFixed(4)}`
            : ''}
        </span>

        {/* Launch button */}
        <button
          data-testid="launch-here-button"
          disabled={draftPin === null || launchLoading}
          onClick={() => void handleLaunch()}
          style={{
            padding: '6px 14px',
            cursor: draftPin && !launchLoading ? 'pointer' : 'default',
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

        {/* Phase 7 — save as favorite button (only when draft pin is set) */}
        {draftPin && (
          <button
            data-testid="save-favorite-button"
            onClick={handleSaveFavorite}
            style={{
              padding: '6px 10px',
              background: '#8e6914',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
            title="Save this location as a favorite"
          >
            ★ Save
          </button>
        )}

        {/* Live-instances counter (Phase 3 — must remain) */}
        <span style={{ marginLeft: 'auto', fontSize: 13 }}>
          live:{' '}
          <span data-testid="live-instances" style={{ fontWeight: 600 }}>
            {liveCount}
          </span>
        </span>

        {/* Phase 7 — backend indicator badge */}
        <span style={{ fontSize: 11, color: '#666' }}>
          {mapsApiKey ? 'Google Maps' : 'Esri (free)'}
        </span>

        {/* Phase 7 — API key settings cog */}
        <button
          data-testid="maps-key-toggle"
          onClick={() => setShowKeyInput((v) => !v)}
          style={{
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: 16,
            padding: '2px 4px',
          }}
          title={mapsApiKey ? 'Change/clear Google Maps API key' : 'Set Google Maps API key'}
        >
          ⚙
        </button>
        {showKeyInput && (
          <>
            <input
              data-testid="maps-key-input"
              type="password"
              placeholder="Paste Google Maps API key..."
              value={pendingKey}
              onChange={(e) => setPendingKey(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 12,
                background: '#1a1a3a',
                color: '#eee',
                border: '1px solid #444',
                borderRadius: 4,
                width: 200,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveKey();
                if (e.key === 'Escape') setShowKeyInput(false);
              }}
            />
            <button
              data-testid="maps-key-save"
              onClick={() => void handleSaveKey()}
              style={{
                padding: '4px 10px',
                background: '#2d5a8e',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              Save
            </button>
            {mapsApiKey && (
              <button
                data-testid="maps-key-clear"
                onClick={() => void handleClearKey()}
                style={{
                  padding: '4px 10px',
                  background: '#5a2d2d',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            )}
          </>
        )}
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
