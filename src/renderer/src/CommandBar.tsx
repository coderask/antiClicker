// src/renderer/src/CommandBar.tsx
//
// Floating action surface anchored bottom-center over the map. The single
// primary action (Launch) is here, plus the coord entry form and the save-
// favorite affordance. Translucent panel — feels like a ground-station
// console floating over the satellite view.

import CoordInput from './CoordInput';
import { theme } from './theme';

interface CommandBarProps {
  draftPin: { latitude: number; longitude: number } | null;
  onCoordSubmit: (coords: { latitude: number; longitude: number }) => void;
  onLaunch: () => void;
  onSaveFavorite: () => void;
  onClearPin: () => void;
  launchLoading: boolean;
  launchError: string | null;
}

export default function CommandBar({
  draftPin,
  onCoordSubmit,
  onLaunch,
  onSaveFavorite,
  onClearPin,
  launchLoading,
  launchError,
}: CommandBarProps) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {launchError && (
        <div
          data-testid="launch-error"
          className="ac-reveal ac-mono"
          style={{
            background: 'rgba(248, 113, 113, 0.12)',
            border: `1px solid ${theme.color.danger}`,
            color: theme.color.danger,
            padding: '6px 12px',
            fontSize: 11,
            letterSpacing: '0.02em',
            pointerEvents: 'auto',
          }}
        >
          {launchError}
        </div>
      )}

      <div
        className="ac-reveal"
        style={{
          background: theme.color.surface,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${theme.color.border}`,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: theme.shadow.panel,
          pointerEvents: 'auto',
        }}
      >
        <CoordInput onSubmit={onCoordSubmit} />

        <div
          style={{
            width: 1,
            height: 22,
            background: theme.color.border,
          }}
        />

        {/* Pin readout: a 'gauge' showing the current draft pin lat/lng */}
        <PinReadout pin={draftPin} onClear={onClearPin} />

        {/* Save favorite — only when a pin exists */}
        <button
          data-testid="save-favorite-button"
          onClick={onSaveFavorite}
          disabled={!draftPin}
          className="ac-btn ac-btn-ghost"
          aria-label="Save as favorite"
          title={draftPin ? 'Save as favorite' : 'Drop a pin first'}
          style={{
            padding: '6px 8px',
            color: draftPin ? theme.color.accent : theme.color.textFaint,
            fontSize: 14,
          }}
        >
          ★
        </button>

        {/* The primary action — Launch */}
        <button
          data-testid="launch-here-button"
          onClick={onLaunch}
          disabled={!draftPin || launchLoading}
          className="ac-btn ac-btn-primary"
          style={{
            padding: '7px 18px',
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontWeight: 600,
          }}
        >
          {launchLoading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                className="ac-pulse"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: theme.color.accent,
                  display: 'inline-block',
                }}
              />
              Launching
            </span>
          ) : (
            'Launch'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Pin readout — coordinate gauge ───────────────────────────────────────
function PinReadout({
  pin,
  onClear,
}: {
  pin: { latitude: number; longitude: number } | null;
  onClear: () => void;
}) {
  if (!pin) {
    return (
      <span
        data-testid="pin-coords"
        className="ac-mono"
        style={{
          fontSize: 11,
          color: theme.color.textFaint,
          minWidth: 160,
          letterSpacing: '0.04em',
          fontStyle: 'italic',
        }}
      >
        click the map to set pin
      </span>
    );
  }
  return (
    <span
      data-testid="pin-coords"
      className="ac-mono"
      style={{
        fontSize: 11,
        color: theme.color.text,
        minWidth: 160,
        letterSpacing: '0.04em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: theme.color.accent,
          boxShadow: `0 0 8px ${theme.color.accentGlow}`,
        }}
      />
      <span style={{ color: theme.color.textMuted, fontSize: 9 }}>LAT</span>
      <span>{pin.latitude.toFixed(4)}</span>
      <span style={{ color: theme.color.textMuted, fontSize: 9 }}>LNG</span>
      <span>{pin.longitude.toFixed(4)}</span>
      <button
        onClick={onClear}
        aria-label="Clear pin"
        title="Clear pin"
        style={{
          background: 'none',
          border: 'none',
          color: theme.color.textFaint,
          cursor: 'pointer',
          fontSize: 11,
          padding: '0 2px',
          marginLeft: 2,
        }}
      >
        ×
      </button>
    </span>
  );
}
