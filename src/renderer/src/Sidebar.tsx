// src/renderer/src/Sidebar.tsx
//
// Phase 5 — Multi-Instance UX
//
// Lists running Chrome instances with:
//   - Colored dot identifier
//   - Short instance ID
//   - Coords readout
//   - Close button (terminates the instance)
//   - Click-to-focus (pans map to that instance's pin)
//
// Active instance is visually highlighted with background tint + left border.

export interface SidebarInstance {
  id: string;
  coords: { latitude: number; longitude: number };
  color: string;
}

export interface SidebarProps {
  instances: Map<string, SidebarInstance>;
  activeId: string | null;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
}

export default function Sidebar({ instances, activeId, onFocus, onClose }: SidebarProps) {
  return (
    <div
      data-testid="sidebar"
      style={{
        width: 280,
        display: 'flex',
        flexDirection: 'column',
        background: '#1a1a2e',
        borderLeft: '1px solid #333',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: '8px 12px 4px',
          fontSize: 11,
          color: '#888',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          borderBottom: '1px solid #2a2a3e',
        }}
      >
        Running Instances ({instances.size})
      </div>

      {/* Instance list — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {instances.size === 0 ? (
          <div
            style={{
              padding: '16px 12px',
              color: '#555',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            No active instances
          </div>
        ) : (
          Array.from(instances.values()).map((inst) => {
            const isActive = inst.id === activeId;
            return (
              <div
                key={inst.id}
                data-testid={isActive ? 'instance-row-active' : 'instance-row'}
                onClick={() => onFocus(inst.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  cursor: 'pointer',
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? inst.color : 'transparent'}`,
                  fontWeight: isActive ? 600 : 400,
                  transition: 'background 0.1s',
                }}
              >
                {/* Colored dot */}
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: inst.color,
                    flexShrink: 0,
                  }}
                />

                {/* Short ID */}
                <span
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    flex: 1,
                    color: '#ddd',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {inst.id.slice(0, 8)}
                </span>

                {/* Coords */}
                <span
                  style={{
                    fontSize: 10,
                    color: '#999',
                    fontVariantNumeric: 'tabular-nums',
                    flexShrink: 0,
                  }}
                >
                  {inst.coords.latitude.toFixed(3)},{inst.coords.longitude.toFixed(3)}
                </span>

                {/* Close button */}
                <button
                  data-testid={`close-${inst.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(inst.id);
                  }}
                  style={{
                    color: '#888',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: '0 2px',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title={`Close instance ${inst.id.slice(0, 8)}`}
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
