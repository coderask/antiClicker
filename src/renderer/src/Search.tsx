// src/renderer/src/Search.tsx
//
// Floating place-search bar — anchored top-center over the map. Debounced
// 300ms autocomplete against Nominatim (via the main process IPC handler).
// Cmd/Ctrl+K focuses; Esc clears and blurs; ↑/↓/Enter navigate the dropdown.
//
// On selection: fires onSelect with the chosen coords. The host (App.tsx)
// wires this to "set draft pin + fly map", matching the existing
// recent-pin / favorite click pattern.

import { useCallback, useEffect, useRef, useState } from 'react';
import { theme } from './theme';

export interface SearchResult {
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

interface SearchProps {
  onSelect: (coords: { latitude: number; longitude: number }) => void;
}

export default function Search({ onSelect }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K to focus the search input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Debounced geocode
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rs = await window.api.geocodeSearch(trimmed);
        if (cancelled) return;
        setResults(rs);
        setHoverIdx(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const handleSelect = useCallback(
    (r: SearchResult) => {
      onSelect({ latitude: r.latitude, longitude: r.longitude });
      setQuery(r.name);
      setOpen(false);
      inputRef.current?.blur();
    },
    [onSelect],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.currentTarget.blur();
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const r = results[hoverIdx];
      if (r) handleSelect(r);
    }
  };

  const showDropdown = open && (loading || results.length > 0 || query.trim().length >= 2);

  return (
    <div
      data-testid="search"
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        width: 380,
        maxWidth: 'calc(100vw - 480px)',
        minWidth: 280,
      }}
    >
      <div
        className="ac-reveal"
        style={{
          background: theme.color.surface,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${
            open ? theme.color.borderAccent : theme.color.border
          }`,
          boxShadow: theme.shadow.panel,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 10px',
          transition: `border-color ${theme.motion.fast}`,
        }}
      >
        <SearchGlyph active={open || query.length > 0} />
        <input
          ref={inputRef}
          data-testid="search-input"
          type="text"
          value={query}
          placeholder="Search places — buildings, landmarks, addresses…"
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so a click on a result row registers before we hide.
            setTimeout(() => setOpen(false), 150);
          }}
          onKeyDown={handleKey}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: theme.color.text,
            fontFamily: theme.font.body,
            fontSize: 13,
            padding: '10px 0',
            letterSpacing: '0.01em',
          }}
        />
        {query.length > 0 && (
          <button
            data-testid="search-clear"
            onMouseDown={(e) => {
              e.preventDefault();
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            style={{
              background: 'none',
              border: 'none',
              color: theme.color.textFaint,
              cursor: 'pointer',
              fontSize: 14,
              padding: '0 4px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
        <KeyHint />
      </div>

      {showDropdown && (
        <div
          data-testid="search-dropdown"
          className="ac-reveal"
          style={{
            marginTop: 6,
            background: theme.color.surfaceElevated,
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${theme.color.border}`,
            boxShadow: theme.shadow.panel,
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {loading && results.length === 0 ? (
            <SearchLoadingRow />
          ) : results.length === 0 ? (
            <SearchEmptyRow query={query.trim()} />
          ) : (
            results.map((r, idx) => (
              <SearchRow
                key={`${r.latitude}-${r.longitude}-${idx}`}
                result={r}
                active={idx === hoverIdx}
                onSelect={() => handleSelect(r)}
                onHover={() => setHoverIdx(idx)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function SearchGlyph({ active }: { active: boolean }) {
  const c = active ? theme.color.accent : theme.color.textFaint;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ flexShrink: 0, transition: `stroke ${theme.motion.fast}` }}
    >
      <circle cx="6" cy="6" r="4.5" stroke={c} strokeWidth="1.4" />
      <line x1="9.5" y1="9.5" x2="12.5" y2="12.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function KeyHint() {
  const isMac =
    typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
  return (
    <span
      className="ac-mono"
      style={{
        fontSize: 9,
        color: theme.color.textFaint,
        letterSpacing: '0.05em',
        padding: '2px 6px',
        border: `1px solid ${theme.color.border}`,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {isMac ? '⌘K' : 'Ctrl K'}
    </span>
  );
}

function SearchRow({
  result,
  active,
  onSelect,
  onHover,
}: {
  result: SearchResult;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
}) {
  return (
    <button
      data-testid="search-result"
      onMouseDown={(e) => {
        // mousedown so click registers before the input's onBlur kills the dropdown
        e.preventDefault();
        onSelect();
      }}
      onMouseEnter={onHover}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        background: active ? 'rgba(255, 45, 146, 0.08)' : 'transparent',
        borderLeft: `2px solid ${active ? theme.color.accent : 'transparent'}`,
        border: 'none',
        borderBottom: `1px solid ${theme.color.border}`,
        padding: '10px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        transition: `background ${theme.motion.fast}`,
      }}
    >
      <PinGlyph color={active ? theme.color.accent : theme.color.textMuted} />
      <span
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            color: theme.color.text,
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {result.name}
        </span>
        <span
          className="ac-mono"
          style={{
            color: theme.color.textMuted,
            fontSize: 10,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.02em',
          }}
        >
          {result.detail || `${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)}`}
        </span>
      </span>
      <span
        className="ac-mono"
        style={{
          color: theme.color.textFaint,
          fontSize: 9,
          letterSpacing: '0.04em',
          flexShrink: 0,
        }}
      >
        {result.latitude.toFixed(3)}, {result.longitude.toFixed(3)}
      </span>
    </button>
  );
}

function PinGlyph({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}>
      <circle cx="7" cy="7" r="5" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.2" />
      <circle cx="7" cy="7" r="1.5" fill={color} />
    </svg>
  );
}

function SearchLoadingRow() {
  return (
    <div
      data-testid="search-loading"
      style={{
        padding: '14px 18px',
        color: theme.color.textMuted,
        fontSize: 11,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span
        className="ac-pulse"
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: theme.color.accent,
        }}
      />
      Searching…
    </div>
  );
}

function SearchEmptyRow({ query }: { query: string }) {
  return (
    <div
      data-testid="search-empty"
      style={{
        padding: '14px 18px',
        color: theme.color.textFaint,
        fontSize: 11,
        lineHeight: 1.5,
      }}
    >
      {query.length < 2
        ? 'Type at least two characters.'
        : `No results for "${query}".`}
    </div>
  );
}
