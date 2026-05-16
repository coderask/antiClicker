---
slug: bolder-pin-color
type: quick
created: 2026-05-16
completed: 2026-05-16
status: complete
---

# Quick: Bolder pin color (magenta accent) — DONE

## What changed
Swapped the single accent color from amber `#f5a524` → hot magenta `#ff2d92`.
Rationale: no natural Earth surface produces magenta (vegetation, deserts,
water, urban concrete all sit outside that chroma family), so the accent now
contrasts maximally against any satellite tile.

## Affected files
- `src/renderer/src/theme.ts` — `accent`, `accentDim`, `accentGlow`,
  `shadow.accentGlow`, `instancePalette[0]`, comments. `color.borderAmber`
  renamed to `color.borderAccent` (value updated).
- `src/renderer/src/styles.css` — every `#f5a524` and `rgba(245, 165, 36, …)`
  swapped for the magenta equivalent. Opacities nudged slightly upward where
  the original alpha was tuned to compensate for amber's lower visual weight
  (magenta is more saturated so it needs less opacity to read).
- `src/renderer/src/TopBar.tsx` — `borderAmber` → `borderAccent` (status pill).
- `src/renderer/src/SettingsPanel.tsx` — `borderAmber` → `borderAccent`
  (active-key banner).
- `src/renderer/src/Sidebar.tsx` — active-instance row background tint.
- `src/renderer/src/Favorites.tsx` — editing-row background tint.

## Visual touch points
- Primary "Launch" button + glow
- Draft pin marker (animated dashed-ring crosshair)
- Active instance pin pulse + sidebar row tint
- Cursor reticle (top-right live lat/lng readout)
- Favorites star
- Settings panel "active key" banner
- Scope overlay corner ticks + headline highlight + dismiss button
- Status pills with `accent={true}` (the live-instances counter when > 0)
- All section-label index marks ("01 settings" etc.)

## Verification
- `npm run typecheck` → clean
- `npm run test:unit` → 135/135 green (no test depended on the old hex)
- No remaining amber refs: `grep -rnE "#f5a524|245, 165, 36|borderAmber" src/renderer/src/` returns empty

## Tradeoffs
- Kept the rest of the 8-color instance palette as-is (slate-blue, sage,
  terracotta, lavender, teal, dusty-rose, ochre). Only slot 0 (formerly amber)
  was replaced with the new magenta to match accent. If sage/ochre/terracotta
  prove to have similar contrast issues against the relevant satellite
  texture, that's a follow-up task — the user complaint was scoped to the
  yellow highlight.
- Opacities on derivative tokens (`accentDim`, `accentGlow`, etc.) were nudged
  ~10-15% to balance magenta's higher visual weight. Equivalent perceived
  intensity to the previous amber treatment.
- `borderAmber` → `borderAccent` rename is a small public-API change inside
  the renderer module. Two consumers updated in this same commit; no other
  references exist.
