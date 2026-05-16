// src/renderer/src/SettingsPanel.tsx
//
// Slide-out settings panel — anchored to the right edge, overlays the map.
// Sections: Google Maps API key, data hygiene, about. Replaces the
// crowded bottom-bar settings cog UI.

import { useState } from 'react';
import { theme } from './theme';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  apiKey: string | null;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
}

export default function SettingsPanel({
  open,
  onClose,
  apiKey,
  onSaveKey,
  onClearKey,
}: SettingsPanelProps) {
  const [draft, setDraft] = useState('');
  const [revealKey, setRevealKey] = useState(false);

  if (!open) return null;

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSaveKey(trimmed);
    setDraft('');
  };

  const masked = apiKey
    ? `${apiKey.slice(0, 6)}${'•'.repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`
    : null;

  return (
    <>
      {/* Scrim */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 5, 8, 0.5)',
          zIndex: 90,
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <aside
        data-testid="settings-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 420,
          background: theme.color.surfaceElevated,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: `1px solid ${theme.color.borderStrong}`,
          zIndex: 100,
          animation: 'ac-slide-in-right 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: theme.shadow.panel,
        }}
      >
        {/* Header */}
        <header
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${theme.color.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              className="ac-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.18em',
                color: theme.color.accent,
                textTransform: 'uppercase',
              }}
            >
              settings
            </div>
            <h2
              style={{
                fontFamily: theme.font.serif,
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 24,
                color: theme.color.text,
                margin: '2px 0 0',
                lineHeight: 1,
              }}
            >
              Configuration
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="ac-btn ac-btn-ghost"
            style={{ padding: '4px 8px', fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </header>

        {/* Body — scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* ── Section: backend (Google Maps API key) ─────────────────── */}
          <section className="ac-reveal" style={{ marginBottom: 36 }}>
            <SectionTitle index="01" title="Map backend" />
            <p
              style={{
                color: theme.color.textMuted,
                fontSize: theme.size.sm,
                lineHeight: 1.55,
                margin: '0 0 16px',
              }}
            >
              By default AntiClicker uses Esri World Imagery — free, no key
              required, but capped around zoom 17. For building-level zoom,
              add a Google Maps API key below.
            </p>

            {apiKey ? (
              <div
                style={{
                  border: `1px solid ${theme.color.borderAccent}`,
                  background: theme.color.accentDim,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  marginBottom: 14,
                }}
              >
                <div
                  className="ac-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.12em',
                    color: theme.color.accent,
                    textTransform: 'uppercase',
                  }}
                >
                  · active
                </div>
                <div
                  className="ac-mono"
                  style={{
                    fontSize: 12,
                    color: theme.color.text,
                    letterSpacing: '0.04em',
                    wordBreak: 'break-all',
                  }}
                >
                  {revealKey ? apiKey : masked}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => setRevealKey((v) => !v)}
                    className="ac-btn ac-btn-ghost"
                    style={{ padding: '4px 10px', fontSize: 10 }}
                  >
                    {revealKey ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    data-testid="maps-key-clear"
                    onClick={onClearKey}
                    className="ac-btn ac-btn-danger"
                    style={{ padding: '4px 10px', fontSize: 10 }}
                  >
                    Remove key
                  </button>
                </div>
              </div>
            ) : null}

            <label
              style={{
                display: 'block',
                fontSize: 11,
                color: theme.color.textMuted,
                marginBottom: 6,
                letterSpacing: '0.04em',
              }}
            >
              {apiKey ? 'Replace key' : 'Paste your key'}
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                data-testid="maps-key-input"
                type="password"
                placeholder="AIza…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                }}
                className="ac-input"
                style={{ flex: 1, padding: '7px 10px' }}
              />
              <button
                data-testid="maps-key-save"
                onClick={handleSave}
                disabled={!draft.trim()}
                className="ac-btn ac-btn-primary"
                style={{ padding: '7px 14px', fontSize: 11 }}
              >
                Save
              </button>
            </div>

            <details
              style={{
                marginTop: 16,
                fontSize: 12,
                color: theme.color.textMuted,
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  color: theme.color.text,
                  fontSize: 11,
                  letterSpacing: '0.02em',
                  padding: '6px 0',
                }}
              >
                ↳ How to obtain a key
              </summary>
              <ol
                style={{
                  marginTop: 6,
                  paddingLeft: 18,
                  lineHeight: 1.7,
                  fontSize: 11,
                }}
              >
                <li>
                  Open{' '}
                  <span className="ac-mono" style={{ color: theme.color.accent }}>
                    console.cloud.google.com
                  </span>
                </li>
                <li>Create a project, link billing ($200/month free credit applies)</li>
                <li>
                  APIs &amp; Services → Library → enable{' '}
                  <em>Maps JavaScript API</em>
                </li>
                <li>
                  Credentials → Create API key, restrict it to HTTP referrers:{' '}
                  <span
                    className="ac-mono"
                    style={{ color: theme.color.text }}
                  >
                    http://localhost/*
                  </span>{' '}
                  and{' '}
                  <span
                    className="ac-mono"
                    style={{ color: theme.color.text }}
                  >
                    http://127.0.0.1/*
                  </span>
                </li>
                <li>Cap daily quota at ~1000 requests for personal use</li>
                <li>Paste it above and Save</li>
              </ol>
            </details>
          </section>

          {/* ── Section: about ─────────────────────────────────────────── */}
          <section className="ac-reveal ac-reveal-1" style={{ marginBottom: 32 }}>
            <SectionTitle index="02" title="About" />
            <p
              style={{
                color: theme.color.textMuted,
                fontSize: 12,
                lineHeight: 1.7,
                margin: 0,
              }}
            >
              AntiClicker overrides{' '}
              <span className="ac-mono" style={{ color: theme.color.text }}>
                navigator.geolocation
              </span>{' '}
              in spawned Chromium instances. IP, timezone, and browser language
              are unchanged.
              <br />
              <br />
              Each launched instance is a fresh Chromium profile in{' '}
              <span className="ac-mono" style={{ color: theme.color.text }}>
                $TMPDIR/anticlicker-profile-*
              </span>{' '}
              — wiped automatically on close.
            </p>
          </section>
        </div>

        {/* Footer */}
        <footer
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${theme.color.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 10,
            color: theme.color.textFaint,
            letterSpacing: '0.04em',
          }}
        >
          <span className="ac-mono">esc to close</span>
          <span className="ac-mono">v0.0.6</span>
        </footer>
      </aside>
    </>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        marginBottom: 12,
      }}
    >
      <span
        className="ac-mono"
        style={{
          fontSize: 10,
          color: theme.color.textFaint,
          letterSpacing: '0.06em',
        }}
      >
        {index}
      </span>
      <span
        style={{
          fontFamily: theme.font.serif,
          fontStyle: 'italic',
          fontSize: 18,
          color: theme.color.text,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>
    </div>
  );
}
