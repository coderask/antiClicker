// src/renderer/src/ScopeOverlay.tsx
//
// Phase 6 — First-run scope overlay.
//
// Shows once on first run, explaining that AntiClicker only spoofs GPS
// coordinates — not IP, timezone, or language. Dismissing it persists
// `firstRunSeen: true` via the IPC API so it never appears again.

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
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#1e1e2e',
          border: '1px solid #3d3d5c',
          borderRadius: 8,
          padding: '32px 40px',
          maxWidth: 480,
          color: '#eee',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 20, color: '#fff' }}>
          AntiClicker — Coordinate Spoof Only
        </h2>

        <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.6, color: '#ccc' }}>
          This tool overrides your browser's <strong style={{ color: '#7eb8f7' }}>GPS coordinates</strong> to the location you pin on the map.
        </p>

        <p style={{ margin: '0 0 24px', fontSize: 14, lineHeight: 1.6, color: '#ccc' }}>
          Your <strong>IP address</strong>, <strong>timezone</strong>, and <strong>browser language</strong> are <em>not</em> changed — only the coordinates reported to websites are affected.
        </p>

        <p style={{ margin: '0 0 24px', fontSize: 12, color: '#888', lineHeight: 1.5 }}>
          Use the "Verify spoof" button on each running instance to confirm the
          spoofed coordinates. The "Open verification URLs" button opens
          browserleaks.com in the spoofed Chrome to inspect all signals.
        </p>

        <button
          data-testid="scope-overlay-dismiss"
          onClick={onDismiss}
          style={{
            padding: '10px 28px',
            background: '#2d5a8e',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
