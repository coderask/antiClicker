// src/renderer/src/Sidebar.tsx
//
// Right-edge floating instrument panel. Shows running instances with inline
// verify state. The Favorites and Recent Pins sections live in separate
// components but are composed here for grouping.

import { theme } from './theme';

export interface SidebarInstance {
  id: string;
  coords: { latitude: number; longitude: number };
  color: string;
}

export interface VerifyResult {
  match: boolean;
  reported: { lat: number; lng: number };
}

export interface SidebarProps {
  instances: Map<string, SidebarInstance>;
  activeId: string | null;
  onFocus: (id: string) => void;
  onClose: (id: string) => void;
  onVerify: (id: string) => void;
  onOpenVerificationUrls: (id: string) => void;
  verifyResults: Map<string, VerifyResult>;
}

export default function Sidebar({
  instances,
  activeId,
  onFocus,
  onClose,
  onVerify,
  onOpenVerificationUrls,
  verifyResults,
}: SidebarProps) {
  return (
    <div
      data-testid="sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
        minHeight: 0,
      }}
    >
      <SectionHeader
        label="Running instances"
        count={instances.size}
        empty={instances.size === 0}
      />
      <div style={{ flex: '0 1 auto', overflowY: 'auto', maxHeight: '40vh' }}>
        {instances.size === 0 ? (
          <EmptyState message="No active instances. Click the map then launch." />
        ) : (
          Array.from(instances.values()).map((inst) => (
            <InstanceRow
              key={inst.id}
              inst={inst}
              active={inst.id === activeId}
              verifyResult={verifyResults.get(inst.id)}
              onFocus={() => onFocus(inst.id)}
              onClose={() => onClose(inst.id)}
              onVerify={() => onVerify(inst.id)}
              onOpenUrls={() => onOpenVerificationUrls(inst.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Reusable section header ──────────────────────────────────────────────
export function SectionHeader({
  label,
  count,
  empty,
}: {
  label: string;
  count?: number;
  empty?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '14px 18px 8px',
        borderTop: `1px solid ${theme.color.border}`,
      }}
    >
      <span className="ac-section-label">{label}</span>
      <span className="ac-section-count">
        {empty ? '—' : (count ?? '').toString().padStart(2, '0')}
      </span>
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '8px 18px 16px',
        color: theme.color.textFaint,
        fontSize: theme.size.xs,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

// ─── Instance row ─────────────────────────────────────────────────────────
function InstanceRow({
  inst,
  active,
  verifyResult,
  onFocus,
  onClose,
  onVerify,
  onOpenUrls,
}: {
  inst: SidebarInstance;
  active: boolean;
  verifyResult?: VerifyResult;
  onFocus: () => void;
  onClose: () => void;
  onVerify: () => void;
  onOpenUrls: () => void;
}) {
  return (
    <div
      data-testid={active ? 'instance-row-active' : 'instance-row'}
      onClick={onFocus}
      style={{
        padding: '10px 18px',
        cursor: 'pointer',
        background: active ? 'rgba(255, 45, 146, 0.06)' : 'transparent',
        borderLeft: `2px solid ${active ? inst.color : 'transparent'}`,
        transition: `background ${theme.motion.fast}, border-color ${theme.motion.fast}`,
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* mini reticle */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            className={active ? 'ac-pulse' : undefined}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: inst.color,
              boxShadow: active ? `0 0 8px ${inst.color}` : 'none',
            }}
          />
        </div>

        <span
          className="ac-mono"
          style={{
            fontSize: theme.size.xs,
            color: active ? theme.color.text : theme.color.textMuted,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '0.04em',
          }}
        >
          {inst.id.slice(0, 8)}
        </span>

        <button
          data-testid={`close-${inst.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          aria-label={`Close ${inst.id.slice(0, 8)}`}
          style={{
            background: 'transparent',
            border: 'none',
            color: theme.color.textFaint,
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 4px',
            transition: `color ${theme.motion.fast}`,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = theme.color.danger)}
          onMouseLeave={(e) => (e.currentTarget.style.color = theme.color.textFaint)}
        >
          ×
        </button>
      </div>

      <div
        className="ac-mono"
        style={{
          fontSize: 10,
          color: theme.color.textFaint,
          marginTop: 4,
          letterSpacing: '0.02em',
        }}
      >
        {inst.coords.latitude.toFixed(4)}°, {inst.coords.longitude.toFixed(4)}°
      </div>

      <div
        style={{ display: 'flex', gap: 6, marginTop: 8 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          data-testid={`verify-${inst.id}`}
          onClick={onVerify}
          className="ac-btn ac-btn-ghost"
          style={{
            padding: '3px 8px',
            fontSize: 10,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
          title="Verify spoof"
        >
          Verify
        </button>
        <button
          data-testid={`verify-urls-${inst.id}`}
          onClick={onOpenUrls}
          className="ac-btn ac-btn-ghost"
          style={{
            padding: '3px 8px',
            fontSize: 10,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
          title="Open browserleaks tabs"
        >
          Leaks
        </button>
      </div>

      {verifyResult && (
        <div
          data-testid={`verify-result-${inst.id}`}
          className="ac-mono ac-reveal"
          style={{
            marginTop: 6,
            fontSize: 10,
            color: verifyResult.match ? theme.color.success : theme.color.danger,
            letterSpacing: '0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: verifyResult.match
                ? theme.color.success
                : theme.color.danger,
              flexShrink: 0,
            }}
          />
          {verifyResult.match ? 'match' : 'mismatch'}
          <span style={{ color: theme.color.textFaint }}>
            · {verifyResult.reported.lat.toFixed(3)}, {verifyResult.reported.lng.toFixed(3)}
          </span>
        </div>
      )}
    </div>
  );
}
