---
slug: bolder-pin-color
type: quick
created: 2026-05-16
status: in-progress
---

# Quick: Bolder pin color (magenta accent)

## Problem
Current accent color `#f5a524` (amber) blends with the yellowish tones common in
satellite imagery (deserts, urban, dry land, beaches). Pin highlights, the
active-instance pulse, and the primary Launch button all suffer reduced
visibility against those backgrounds.

## Decision
Swap accent → **hot magenta `#ff2d92`**.

Magenta has no equivalent in natural Earth surfaces — minerals, vegetation,
water, and atmosphere all sit outside the magenta chroma family — making it
the cartographic / surveying convention for high-visibility markers.

## Scope (minimal surface change)
1. `src/renderer/src/theme.ts`
   - `color.accent`        `#f5a524` → `#ff2d92`
   - `color.accentDim`     opacity bump 0.18 → 0.20
   - `color.accentGlow`    opacity bump 0.45 → 0.50
   - `color.borderAmber`   **rename** → `color.borderAccent`, value updated
   - `instancePalette[0]`  `#f5a524` → `#ff2d92` (and comment)
   - `shadow.accentGlow`   rgba values updated
2. `src/renderer/src/styles.css`
   - All `#f5a524` and `rgba(245, 165, 36, …)` → magenta equivalents
3. `src/renderer/src/TopBar.tsx` + `src/renderer/src/SettingsPanel.tsx`
   - References to `borderAmber` → `borderAccent`

Other earth-tone palette colors (sage, terracotta, ochre) are left as-is — the
user complaint was specifically about the yellow highlight, not the secondary
instance palette.

## Verification
- `npm run typecheck` clean
- `npm run test:unit` all 135 still green
