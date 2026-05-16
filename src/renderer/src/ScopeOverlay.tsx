// src/renderer/src/ScopeOverlay.tsx
//
// First-run scope overlay. Explains that only GPS coordinates are spoofed —
// not IP, timezone, or browser language. Editorial / cartographic treatment:
// serif headline, instrument-mono coords, single amber primary action.

import { theme } from './theme';

interface ScopeOverlayProps {
  onDismiss: () => void;
}

export default function ScopeOverlay({ onDismiss }: ScopeOverlayProps) {
  return (
    <div
      data-testid="scope-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: theme.color.overlay,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="ac-reveal"
        style={{
          background: theme.color.surfaceElevated,
          border: `1px solid ${theme.color.borderStrong}`,
          padding: '40px 48px',
          maxWidth: 540,
          width: '100%',
          color: theme.color.text,
          boxShadow: theme.shadow.panel,
          position: 'relative',
        }}
      >
        {/* corner ticks — instrument detail */}
        <CornerTicks />

        <div
          className="ac-reveal ac-reveal-1"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              background: theme.color.accent,
              boxShadow: `0 0 12px ${theme.color.accentGlow}`,
            }}
          />
          <span
            className="ac-mono"
            style={{
              fontSize: theme.size.xxs,
              letterSpacing: '0.18em',
              color: theme.color.textMuted,
              textTransform: 'uppercase',
            }}
          >
            anticlicker / scope
          </span>
        </div>

        <h2
          className="ac-reveal ac-reveal-2"
          style={{
            fontFamily: theme.font.serif,
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 36,
            lineHeight: 1.1,
            margin: 0,
            color: theme.color.text,
            letterSpacing: '-0.01em',
          }}
        >
          Coordinates only.
          <br />
          <span style={{ color: theme.color.textMuted }}>
            Nothing else changes.
          </span>
        </h2>

        <p
          className="ac-reveal ac-reveal-3"
          style={{
            margin: '28px 0 14px',
            fontSize: theme.size.md,
            lineHeight: 1.65,
            color: theme.color.textMuted,
            maxWidth: 440,
          }}
        >
          AntiClicker overrides{' '}
          <span style={{ color: theme.color.accent }} className="ac-mono">
            navigator.geolocation
          </span>{' '}
          in launched Chromium instances to report the coordinates of your pin.
        </p>

        <p
          className="ac-reveal ac-reveal-3"
          style={{
            margin: '0 0 36px',
            fontSize: theme.size.md,
            lineHeight: 1.65,
            color: theme.color.textMuted,
            maxWidth: 440,
          }}
        >
          Your IP address, timezone, and browser language remain authentic. Use
          the verify button on a running instance to confirm.
        </p>

        <div
          className="ac-reveal ac-reveal-4"
          style={{ display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <button
            data-testid="scope-overlay-dismiss"
            onClick={onDismiss}
            className="ac-btn ac-btn-primary"
            style={{ padding: '10px 24px', fontSize: theme.size.sm }}
          >
            Acknowledge & continue
          </button>
          <span
            className="ac-mono"
            style={{
              fontSize: theme.size.xxs,
              color: theme.color.textFaint,
              letterSpacing: '0.05em',
            }}
          >
            shown once · stored locally
          </span>
        </div>
      </div>
    </div>
  );
}

function CornerTicks() {
  const t = theme.color.accent;
  const len = 14;
  const off = 0;
  const stroke = 1.2;
  const style = (extra: React.CSSProperties): React.CSSProperties => ({
    position: 'absolute',
    width: len,
    height: len,
    pointerEvents: 'none',
    ...extra,
  });
  return (
    <>
      <div style={style({ top: off, left: off })}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: len, height: stroke, background: t }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: stroke, height: len, background: t }} />
      </div>
      <div style={style({ top: off, right: off })}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: len, height: stroke, background: t }} />
        <div style={{ position: 'absolute', top: 0, right: 0, width: stroke, height: len, background: t }} />
      </div>
      <div style={style({ bottom: off, left: off })}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: len, height: stroke, background: t }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, width: stroke, height: len, background: t }} />
      </div>
      <div style={style({ bottom: off, right: off })}>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: len, height: stroke, background: t }} />
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: stroke, height: len, background: t }} />
      </div>
    </>
  );
}
