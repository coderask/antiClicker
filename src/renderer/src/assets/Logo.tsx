// src/renderer/src/assets/Logo.tsx
//
// AntiClicker brand mark. Inline SVG so it scales crisply and can pick up
// theme colors at runtime. Composition: gradient circle with two white
// play-triangle marks (a small filled triangle behind a larger outlined
// triangle with a center dot — "double-skip forward" motif).
//
// Red palette by user request. Inner shapes stay white for legibility;
// without the contrast the marks would be unreadable.

interface LogoProps {
  size?: number;
  /** Override the SVG ID for the gradient (avoid collisions if used twice). */
  idSuffix?: string;
}

export default function Logo({ size = 28, idSuffix = '' }: LogoProps) {
  const gradId = `ac-logo-grad${idSuffix}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="AntiClicker"
      role="img"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <defs>
        <linearGradient id={gradId} x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#b91c1c" />
          <stop offset="55%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      {/* Background circle */}
      <circle cx="200" cy="200" r="195" fill={`url(#${gradId})`} />

      {/* Small filled play triangle (behind / left) */}
      <path
        d="M 90 165 L 90 235 L 145 200 Z"
        fill="#ffffff"
      />

      {/* Larger outlined play triangle (front / right) */}
      <path
        d="M 165 110 L 165 290 L 310 200 Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="24"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Center dot inside the large triangle */}
      <circle cx="215" cy="200" r="10" fill="#ffffff" />
    </svg>
  );
}
