// src/renderer/src/App.tsx
//
// Atlas / Mission Control — full-bleed satellite map with floating instrument
// panels for the brand, status, command bar, and sidebar.
//
// Composition:
//   <map (full viewport)>
//   <TopBar (brand + status + cursor reticle)>
//   <Sidebar group (right-edge, translucent)>
//     - Running instances
//     - Favorites
//     - Recent pins
//   <CommandBar (floating bottom-center)>
//   <ScopeOverlay (first-run only)>
//   <SettingsPanel (slide-out from right)>
//   <HiddenTestids (off-screen — preserves legacy data-testids for tests)>
//
// State decomposition is hoisted here so the IPC layer stays untouched.
// Persistence is debounced via small custom hooks to avoid IO churn.

import { useEffect, useRef, useState } from 'react';
import MapView, { type PinCoords } from './map/MapView';
import GoogleMapView from './map/GoogleMapView';
import Sidebar, { type VerifyResult } from './Sidebar';
import RecentPins from './RecentPins';
import Favorites, { type Favorite } from './Favorites';
import ScopeOverlay from './ScopeOverlay';
import TopBar from './TopBar';
import CommandBar from './CommandBar';
import SettingsPanel from './SettingsPanel';
import Search from './Search';
import { theme, colorForInstanceId } from './theme';
import { pushBounded } from './utils/ringBuffer';

type InstanceId = string;
interface RunningInstance {
  id: InstanceId;
  coords: PinCoords;
  color: string;
}

export default function App() {
  // ─── Phase-0 diagnostics (kept for hidden-testid div only) ────────────
  const [pong, setPong] = useState<string | null>(null);
  const [launchCount, setLaunchCount] = useState<number | null>(null);

  // ─── Launcher state ───────────────────────────────────────────────────
  const [instances, setInstances] = useState<Map<InstanceId, RunningInstance>>(
    () => new Map(),
  );
  const [draftPin, setDraftPin] = useState<PinCoords | null>(null);
  const [activeId, setActiveId] = useState<InstanceId | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [verifyResults, setVerifyResults] = useState<Map<InstanceId, VerifyResult>>(
    () => new Map(),
  );

  // ─── Persistence ──────────────────────────────────────────────────────
  const [recentPins, setRecentPins] = useState<PinCoords[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(null);

  // Guard against debounced writes firing before initial load completes.
  const recentsLoadedRef = useRef(false);
  const favoritesLoadedRef = useRef(false);

  // ─── UI-only state ────────────────────────────────────────────────────
  const [showOverlay, setShowOverlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingFavoritePin, setPendingFavoritePin] = useState<PinCoords | null>(null);
  const [cursorCoords, setCursorCoords] = useState<PinCoords | null>(null);

  // flyToTrigger counter ensures repeated fly-to-same-coords still animates.
  const [flyToTrigger, setFlyToTrigger] = useState<
    { latitude: number; longitude: number; counter: number } | undefined
  >(undefined);
  const flyTo = (coords: PinCoords) =>
    setFlyToTrigger((prev) => ({ ...coords, counter: (prev?.counter ?? 0) + 1 }));

  // ─── Mount: load everything once ──────────────────────────────────────
  useEffect(() => {
    window.api.ping().then(setPong).catch(() => setPong('FAIL'));
    window.api.getLaunchCount().then(setLaunchCount).catch(() => setLaunchCount(-1));
    window.api.getFirstRunSeen()
      .then((seen) => { if (!seen) setShowOverlay(true); })
      .catch(() => undefined);
    window.api.getRecentPins().then((pins) => {
      setRecentPins(pins.map((p) => ({ latitude: p.latitude, longitude: p.longitude })));
      recentsLoadedRef.current = true;
    }).catch(() => { recentsLoadedRef.current = true; });
    window.api.getFavorites().then((favs) => {
      setFavorites(favs);
      favoritesLoadedRef.current = true;
    }).catch(() => { favoritesLoadedRef.current = true; });
    window.api.getMapsApiKey().then(setMapsApiKey).catch(() => undefined);
  }, []);

  // ─── Debounced persistence (only after initial load) ──────────────────
  useEffect(() => {
    if (!recentsLoadedRef.current) return;
    const t = setTimeout(() => {
      const now = Date.now();
      const toStore = recentPins.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: now,
      }));
      window.api.setRecentPins(toStore).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [recentPins]);

  useEffect(() => {
    if (!favoritesLoadedRef.current) return;
    const t = setTimeout(() => {
      window.api.setFavorites(favorites).catch(() => undefined);
    }, 500);
    return () => clearTimeout(t);
  }, [favorites]);

  // ─── Instance-closed push subscription ────────────────────────────────
  useEffect(() => {
    const unsub = window.api.onInstanceClosed((id: string) => {
      setInstances((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setActiveId((prev) => (prev === id ? null : prev));
      setVerifyResults((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    });
    return unsub;
  }, []);

  // ─── Esc closes settings + cancels favorite naming ────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSettings(false);
        setPendingFavoritePin(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const handleLaunch = async () => {
    if (!draftPin) return;
    setLaunchLoading(true);
    setLaunchError(null);
    try {
      const result = await window.api.launch({
        latitude: draftPin.latitude,
        longitude: draftPin.longitude,
      });
      const id = result.id;
      const coords: PinCoords = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
      };
      const color = colorForInstanceId(id);
      setInstances((prev) => {
        const next = new Map(prev);
        next.set(id, { id, coords, color });
        return next;
      });
      setRecentPins((prev) => pushBounded(prev, coords, 10));
      setActiveId(id);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunchLoading(false);
    }
  };

  const handleSetGeo = async (id: InstanceId, newCoords: PinCoords) => {
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

  const handleClose = async (id: InstanceId) => {
    try { await window.api.close(id); }
    catch {
      setInstances((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      setActiveId((prev) => (prev === id ? null : prev));
    }
  };

  const handleFocusInstance = (id: InstanceId) => {
    setActiveId(id);
    const inst = instances.get(id);
    if (inst) flyTo(inst.coords);
  };

  const handleVerify = async (id: InstanceId) => {
    try {
      const result = await window.api.verifySpoof(id);
      setVerifyResults((prev) => {
        const next = new Map(prev);
        next.set(id, { match: result.match, reported: result.reported });
        return next;
      });
    } catch {
      setVerifyResults((prev) => {
        const next = new Map(prev);
        next.set(id, { match: false, reported: { lat: 0, lng: 0 } });
        return next;
      });
    }
  };

  const handleOpenVerificationUrls = (id: InstanceId) =>
    window.api.openVerificationUrls(id).catch(() => undefined);

  const handleCoordSubmit = (coords: PinCoords) => {
    setDraftPin(coords);
    flyTo(coords);
  };

  const handleRecentSelect = (coords: PinCoords) => {
    setDraftPin(coords);
    flyTo(coords);
  };

  const handleFavoriteSelect = (coords: PinCoords) => {
    setDraftPin(coords);
    flyTo(coords);
  };

  // BUG FIX: window.prompt() is suppressed in sandboxed Electron renderers.
  // Use a tiny inline modal that takes a name via a controlled input instead.
  const handleSaveFavoriteClick = () => {
    if (!draftPin) return;
    setPendingFavoritePin(draftPin);
  };

  const handleCommitFavorite = (name: string) => {
    if (!pendingFavoritePin) return;
    const trimmed = name.trim();
    const defaultName = `${pendingFavoritePin.latitude.toFixed(3)}, ${pendingFavoritePin.longitude.toFixed(3)}`;
    const newFav: Favorite = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: trimmed || defaultName,
      latitude: pendingFavoritePin.latitude,
      longitude: pendingFavoritePin.longitude,
      createdAt: Date.now(),
    };
    setFavorites((prev) => [...prev, newFav].slice(0, 100));
    setPendingFavoritePin(null);
  };

  const handleDeleteFavorite = (id: string) =>
    setFavorites((prev) => prev.filter((f) => f.id !== id));

  const handleRenameFavorite = (id: string, name: string) =>
    setFavorites((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)),
    );

  const handleDismissOverlay = () => {
    setShowOverlay(false);
    window.api.markFirstRunSeen().catch(() => undefined);
  };

  const handleSaveKey = async (key: string) => {
    await window.api.setMapsApiKey(key);
    setMapsApiKey(key);
  };

  const handleClearKey = async () => {
    await window.api.setMapsApiKey(null);
    setMapsApiKey(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: theme.color.bg,
        overflow: 'hidden',
      }}
    >
      {/* Map fills the whole viewport */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {mapsApiKey ? (
          <GoogleMapView
            pin={draftPin}
            onPinChange={setDraftPin}
            flyToTrigger={flyToTrigger}
            instances={instances}
            activeId={activeId}
            onMarkerDrag={(id, c) => void handleSetGeo(id, c)}
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
            onMarkerDrag={(id, c) => void handleSetGeo(id, c)}
            onCursorMove={setCursorCoords}
          />
        )}
      </div>

      {/* Top brand + status cluster */}
      <TopBar
        liveCount={instances.size}
        backend={mapsApiKey ? 'google' : 'esri'}
        onOpenSettings={() => setShowSettings(true)}
        cursorCoords={cursorCoords}
      />

      {/* Floating place search (top-center) */}
      <Search
        onSelect={(coords) => {
          setDraftPin(coords);
          flyTo(coords);
        }}
      />

      {/* Right-side stacked sections (translucent panel) */}
      <aside
        className="ac-reveal ac-reveal-2"
        style={{
          position: 'absolute',
          top: 64,
          right: 20,
          bottom: 100,
          width: 300,
          background: theme.color.surface,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.panel,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 40,
        }}
      >
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
          onRename={handleRenameFavorite}
        />
        <RecentPins pins={recentPins} onSelect={handleRecentSelect} />
      </aside>

      {/* Floating command bar (bottom-center) */}
      <CommandBar
        draftPin={draftPin}
        onCoordSubmit={handleCoordSubmit}
        onLaunch={() => void handleLaunch()}
        onSaveFavorite={handleSaveFavoriteClick}
        onClearPin={() => setDraftPin(null)}
        launchLoading={launchLoading}
        launchError={launchError}
      />

      {/* Favorite naming modal — replaces window.prompt() */}
      {pendingFavoritePin && (
        <NamingModal
          coords={pendingFavoritePin}
          onCancel={() => setPendingFavoritePin(null)}
          onCommit={handleCommitFavorite}
        />
      )}

      {/* First-run scope overlay */}
      {showOverlay && <ScopeOverlay onDismiss={handleDismissOverlay} />}

      {/* Settings slide-out */}
      <SettingsPanel
        open={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={mapsApiKey}
        onSaveKey={(k) => void handleSaveKey(k)}
        onClearKey={() => void handleClearKey()}
      />

      {/* Hidden test-only readouts — kept for Phase-0 e2e backward compat */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
      >
        <span data-testid="protocol">{window.location.protocol}</span>
        <span data-testid="ping">{pong ?? '…'}</span>
        <span data-testid="launch-count">{launchCount ?? '…'}</span>
      </div>
    </div>
  );
}

// ─── Inline naming modal (replaces window.prompt) ─────────────────────────
function NamingModal({
  coords,
  onCommit,
  onCancel,
}: {
  coords: PinCoords;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const defaultName = `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`;
  const [name, setName] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="favorite-name-modal"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 5, 8, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="ac-reveal"
        style={{
          background: theme.color.surfaceElevated,
          border: `1px solid ${theme.color.borderStrong}`,
          padding: '24px 28px',
          minWidth: 360,
          boxShadow: theme.shadow.panel,
        }}
      >
        <div
          className="ac-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            color: theme.color.accent,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          save favorite
        </div>
        <h3
          style={{
            fontFamily: theme.font.serif,
            fontStyle: 'italic',
            fontSize: 22,
            fontWeight: 400,
            margin: '0 0 16px',
            color: theme.color.text,
          }}
        >
          Name this location
        </h3>
        <div
          className="ac-mono"
          style={{
            fontSize: 11,
            color: theme.color.textMuted,
            marginBottom: 12,
            letterSpacing: '0.04em',
          }}
        >
          {coords.latitude.toFixed(5)}°, {coords.longitude.toFixed(5)}°
        </div>
        <input
          autoFocus
          data-testid="favorite-name-input-modal"
          className="ac-input"
          placeholder={defaultName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCommit(name);
            if (e.key === 'Escape') onCancel();
          }}
          style={{ width: '100%', padding: '8px 12px', marginBottom: 18 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="ac-btn ac-btn-ghost">
            Cancel
          </button>
          <button
            data-testid="favorite-name-commit"
            onClick={() => onCommit(name)}
            className="ac-btn ac-btn-primary"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
