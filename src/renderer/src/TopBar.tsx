// src/renderer/src/TopBar.tsx
//
// Floating brand + status surface anchored to the top edges. Two panels:
//  - Top-left: brand identity (ANTICLICKER / Spoof Console)
//  - Top-right: status cluster — live instances count, backend indicator,
//    settings cog
// Both panels are translucent overlays over the map, instrument-console feel.

import { theme } from './theme';

interface TopBarProps {
  liveCount: number;
  backend: 'google' | 'esri';
  onOpenSettings: () => void;
  cursorCoords: { latitude: number; longitude: number } | null;
}

export default function TopBar({
  liveCount,
  backend,
  onOpenSettings,
  cursorCoords,
}: TopBarProps) {
  return (
    <>
      {/* Top-left: brand */}
      <div
        className="ac-reveal"
        style={{
          position: 'absolute',
          top: 20,
          left: 20,
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: theme.font.serif,
              fontStyle: 'italic',
              fontSize: 22,
              fontWeight: 400,
              color: theme.color.text,
              lineHeight: 1,
              letterSpacing: '-0.01em',
              textShadow: '0 1px 8px rgba(0,0,0,0.6)',
            }}
          >
            AntiClicker
          </span>
          <span
            className="ac-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.18em',
              color: theme.color.accent,
              textTransform: 'uppercase',
              textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            }}
          >
            spoof
            <br />
            console
          </span>
        </div>
      </div>

      {/* Top-right: status cluster */}
      <div
        className="ac-reveal ac-reveal-1"
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'auto',
        }}
      >
        <CursorReticle coords={cursorCoords} />

        <StatusPill
          label="live"
          value={
            <span data-testid="live-instances" className="ac-mono">
              {String(liveCount).padStart(2, '0')}
            </span>
          }
          accent={liveCount > 0}
        />

        <StatusPill
          label="tile"
          value={
            <span
              className="ac-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.04em',
              }}
            >
              {backend === 'google' ? 'GOOGLE' : 'ESRI'}
            </span>
          }
        />

        <button
          data-testid="maps-key-toggle"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
          style={{
            background: theme.color.surface,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: `1px solid ${theme.color.border}`,
            color: theme.color.textMuted,
            padding: '6px 10px',
            cursor: 'pointer',
            fontSize: 13,
            lineHeight: 1,
            transition: `color ${theme.motion.fast}, border-color ${theme.motion.fast}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.color.text;
            e.currentTarget.style.borderColor = theme.color.borderStrong;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.color.textMuted;
            e.currentTarget.style.borderColor = theme.color.border;
          }}
        >
          ⚙
        </button>
      </div>
    </>
  );
}

// ─── Cursor reticle — shows live lat/lng under cursor ──────────────────────
function CursorReticle({
  coords,
}: {
  coords: { latitude: number; longitude: number } | null;
}) {
  return (
    <div
      style={{
        background: theme.color.surface,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${theme.color.border}`,
        padding: '5px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 168,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: coords ? theme.color.accent : theme.color.textFaint,
          boxShadow: coords ? `0 0 6px ${theme.color.accentGlow}` : 'none',
          flexShrink: 0,
        }}
      />
      <span
        className="ac-mono"
        style={{
          fontSize: 10,
          color: coords ? theme.color.text : theme.color.textFaint,
          letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {coords
          ? `${coords.latitude >= 0 ? '+' : ''}${coords.latitude.toFixed(4)} ${coords.longitude >= 0 ? '+' : ''}${coords.longitude.toFixed(4)}`
          : '—— · ——'}
      </span>
    </div>
  );
}

// ─── Status pill ───────────────────────────────────────────────────────────
function StatusPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        background: theme.color.surface,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${accent ? theme.color.borderAccent : theme.color.border}`,
        padding: '5px 10px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        className="ac-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.12em',
          color: theme.color.textFaint,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          color: accent ? theme.color.accent : theme.color.text,
          fontWeight: 500,
        }}
      >
        {value}
      </span>
    </div>
  );
}
