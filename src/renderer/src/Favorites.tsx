// src/renderer/src/Favorites.tsx
//
// Phase 7 — Favorites sidebar section
//
// Shows above Recent Pins in the sidebar. Each favorite has:
//   id: unique string (Date.now().toString(36) + random suffix in App.tsx)
//   name: user-supplied or default "{lat.toFixed(3)}, {lng.toFixed(3)}"
//   latitude, longitude, createdAt (unix ms)
//
// Click row: fly map to coords + set as draft pin (via onSelect callback)
// Delete (×): removes from list (persisted via App.tsx debounced persist)
// Cap display at 100 favorites total (enforced in App.tsx on add)

export interface Favorite {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  createdAt: number;
}

export interface FavoritesProps {
  favorites: Favorite[];
  onSelect: (coords: { latitude: number; longitude: number }) => void;
  onDelete: (id: string) => void;
}

export default function Favorites({ favorites, onSelect, onDelete }: FavoritesProps) {
  const displayFavs = favorites.slice(0, 100);

  return (
    <div
      data-testid="favorites"
      style={{
        borderTop: '1px solid #2a2a3e',
        flexShrink: 0,
        maxHeight: 180,
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
        Favorites
      </div>

      {/* Favorites list */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {displayFavs.length === 0 ? (
          <div
            data-testid="favorites-empty"
            style={{
              padding: '8px 12px',
              color: '#555',
              fontSize: 11,
              textAlign: 'center',
            }}
          >
            No favorites yet — click &quot;★ Save&quot; on a pin
          </div>
        ) : (
          displayFavs.map((fav) => (
            <div
              key={fav.id}
              data-testid="favorite-row"
              onClick={() => onSelect({ latitude: fav.latitude, longitude: fav.longitude })}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                background: 'none',
                borderBottom: '1px solid #1a1a2e',
                color: '#bbb',
                padding: '4px 8px 4px 12px',
                fontSize: 11,
                fontFamily: 'system-ui, sans-serif',
                cursor: 'pointer',
                lineHeight: 1.4,
                gap: 4,
                boxSizing: 'border-box',
              }}
            >
              <span style={{ color: '#f39c12', marginRight: 2 }}>★</span>
              <span
                style={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 170,
                }}
                title={fav.name}
              >
                {fav.name.length > 24 ? fav.name.slice(0, 24) + '…' : fav.name}
              </span>
              <button
                data-testid="favorite-delete"
                onClick={(e) => {
                  e.stopPropagation(); // prevent row click
                  onDelete(fav.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#666',
                  cursor: 'pointer',
                  fontSize: 13,
                  lineHeight: 1,
                  padding: '0 2px',
                  flexShrink: 0,
                }}
                title="Remove favorite"
                aria-label={`Remove ${fav.name} from favorites`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
