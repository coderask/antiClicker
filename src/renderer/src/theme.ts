// src/renderer/src/theme.ts
//
// Single source of truth for design tokens. Components destructure from here
// instead of inlining magic numbers. Inspired by cartographic instrument
// consoles — dark, monochromatic, survey-magenta accent (no Earth equivalent,
// maximum contrast against satellite imagery).

export const theme = {
  color: {
    // Surfaces — translucent panels layer over the map.
    bg: '#08090d',
    surface: 'rgba(14, 16, 22, 0.86)',
    surfaceSolid: '#0e1016',
    surfaceElevated: 'rgba(20, 23, 32, 0.92)',
    overlay: 'rgba(4, 5, 8, 0.72)',

    // Borders / dividers — hairline.
    border: 'rgba(255, 255, 255, 0.07)',
    borderStrong: 'rgba(255, 255, 255, 0.14)',
    borderAccent: 'rgba(255, 45, 146, 0.4)',

    // Text — warm whites, never pure.
    text: '#ecedef',
    textMuted: '#8a8e98',
    textFaint: '#5a5d66',

    // The single accent: hot magenta. Survey / cartographic convention —
    // no natural Earth surface produces this hue, so it pops against any
    // satellite imagery (vegetation, deserts, water, urban concrete).
    accent: '#ff2d92',
    accentDim: 'rgba(255, 45, 146, 0.20)',
    accentGlow: 'rgba(255, 45, 146, 0.55)',

    // Semantic.
    success: '#5eead4',
    danger: '#f87171',
    warning: '#fbbf24',
  },

  // Instance marker palette — 8 perceptually-uniform shades. Designer-chosen,
  // all sit at similar luminance + chroma so multiple pins read as siblings.
  instancePalette: [
    '#ff2d92', // hot magenta (primary — survey/cartographic high-vis)
    '#6b9bc4', // slate-blue
    '#8da888', // sage
    '#c97f5a', // terracotta
    '#a594bc', // lavender
    '#6ba59a', // teal
    '#c890a0', // dusty-rose
    '#b8a062', // ochre
  ] as const,

  font: {
    // Loaded via index.html @import (Google Fonts CDN, CSP-allowed).
    mono: '"JetBrains Mono", "SF Mono", "Menlo", monospace',
    serif: '"Instrument Serif", "Iowan Old Style", "Charter", Georgia, serif',
    body: '"Inter Tight", "Inter", system-ui, -apple-system, sans-serif',
  },

  // Type scale — opinionated, restrained.
  size: {
    xxs: 10,
    xs: 11,
    sm: 12,
    base: 13,
    md: 14,
    lg: 17,
    xl: 22,
    xxl: 32,
  },

  space: {
    px: 1,
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 40,
  },

  // Tight radii — almost-sharp corners on instrument panels.
  radius: {
    none: 0,
    sm: 2,
    md: 4,
    pill: 999,
  },

  shadow: {
    // Used sparingly — only on lifted panels.
    panel: '0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.35)',
    inset: 'inset 0 1px 0 rgba(255, 255, 255, 0.04)',
    accentGlow: '0 0 0 1px rgba(255, 45, 146, 0.45), 0 0 18px rgba(255, 45, 146, 0.2)',
  },

  // Motion — short, snappy.
  motion: {
    fast: '120ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    base: '220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
    slow: '420ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

export type Theme = typeof theme;

// Stable per-instance color: hash the instance id to an index in the palette.
// Same id always gets the same color across re-renders + re-launches.
export function colorForInstanceId(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return theme.instancePalette[Math.abs(h) % theme.instancePalette.length];
}

// Index-based fallback (for code paths that have count not id).
export function colorForIndex(idx: number): string {
  return theme.instancePalette[idx % theme.instancePalette.length];
}
