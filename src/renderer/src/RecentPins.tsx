// src/renderer/src/RecentPins.tsx
//
// Phase 5 — Multi-Instance UX
//
// Displays the last N=10 pin coordinates used in the current session.
// Clicking a row populates the CoordInput (via onSelect callback) and
// flies the map to that location — does NOT auto-launch.
//
// Session-only: lives entirely in React state, no disk persistence.
// Clears automatically on app quit.

export interface RecentPinsProps {
  pins: Array<{ latitude: number; longitude: number }>;
  onSelect: (coords: { latitude: number; longitude: number }) => void;
}

export default function RecentPins({ pins, onSelect }: RecentPinsProps) {
  // Show most recent first (reverse order)
  const reversed = [...pins].reverse();

  return (
    <div
      data-testid="recent-pins"
      style={{
        borderTop: '1px solid #2a2a3e',
        flexShrink: 0,
        maxHeight: 200,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '6px 12px 4px',
          fontSize: 11,
          color: '#888',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        Recent Pins
      </div>

      {/* Pin list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {reversed.length === 0 ? (
          <div
            data-testid="recent-pins-empty"
            style={{
              padding: '8px 12px',
              color: '#555',
              fontSize: 11,
              textAlign: 'center',
            }}
          >
            No recent pins
          </div>
        ) : (
          reversed.map((pin, idx) => (
            <button
              key={idx}
              data-testid="recent-pin-row"
              onClick={() => onSelect(pin)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                color: '#bbb',
                padding: '4px 12px',
                fontSize: 11,
                fontFamily: 'monospace',
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
            >
              {pin.latitude.toFixed(4)}, {pin.longitude.toFixed(4)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
