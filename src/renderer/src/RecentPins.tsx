// src/renderer/src/RecentPins.tsx
//
// Ring buffer of the last 10 launched pin coordinates. Click a row to set as
// draft pin + fly the map. Persisted via electron-store (handled in App).

import { theme } from './theme';
import { SectionHeader } from './Sidebar';

export interface RecentPinsProps {
  pins: Array<{ latitude: number; longitude: number }>;
  onSelect: (coords: { latitude: number; longitude: number }) => void;
}

export default function RecentPins({ pins, onSelect }: RecentPinsProps) {
  const reversed = [...pins].reverse();

  return (
    <div
      data-testid="recent-pins"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <SectionHeader
        label="Recent pins"
        count={reversed.length}
        empty={reversed.length === 0}
      />
      <div style={{ overflowY: 'auto', maxHeight: 220 }}>
        {reversed.length === 0 ? (
          <div
            data-testid="recent-pins-empty"
            style={{
              padding: '8px 18px 16px',
              color: theme.color.textFaint,
              fontSize: theme.size.xs,
              lineHeight: 1.5,
            }}
          >
            Launched pins land here.
          </div>
        ) : (
          reversed.map((pin, idx) => (
            <button
              key={idx}
              data-testid="recent-pin-row"
              onClick={() => onSelect(pin)}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: 'transparent',
                border: 'none',
                color: theme.color.textMuted,
                padding: '6px 18px',
                fontFamily: theme.font.mono,
                fontSize: 11,
                fontFeatureSettings: '"tnum"',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 8,
                letterSpacing: '0.02em',
                transition: `background ${theme.motion.fast}, color ${theme.motion.fast}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.color = theme.color.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = theme.color.textMuted;
              }}
            >
              <span
                style={{
                  color: theme.color.textFaint,
                  fontSize: 9,
                  width: 14,
                  letterSpacing: 0,
                }}
              >
                {String(idx + 1).padStart(2, '0')}
              </span>
              <span>{pin.latitude.toFixed(4)}</span>
              <span style={{ color: theme.color.textFaint }}>,</span>
              <span>{pin.longitude.toFixed(4)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
