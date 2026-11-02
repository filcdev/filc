/**
 * Hand-authored decorative art for the site theme picker. Pure inline SVG —
 * no emoji, no external images — sized to fill a card header (the parent
 * supplies sizing via `className`; `slice` crops instead of stretching).
 * Each seasonal piece uses its own fixed palette so it reads correctly no
 * matter which theme happens to be active on the page.
 */

import { useId } from 'react';

type ArtProps = { className?: string };

export function DefaultArt({ className }: ArtProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 400 160"
    >
      <defs>
        <linearGradient id={`dflt-grad-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0f766e" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <rect fill={`url(#dflt-grad-${id})`} height="160" width="400" />
      <circle cx="300" cy="80" fill="#14b8a6" opacity="0.14" r="90" />
      <circle cx="322" cy="60" fill="#2dd4bf" opacity="0.18" r="44" />
      <circle cx="70" cy="120" fill="#0d9488" opacity="0.12" r="40" />
      <path
        d="M60 40 l3.5 8 l8 1 l-6 5.5 l1.5 8 l-7 -4 l-7 4 l1.5 -8 l-6 -5.5 l8 -1 z"
        fill="#0f766e"
        opacity="0.5"
      />
    </svg>
  );
}

export function HalloweenArt({ className }: ArtProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 400 160"
    >
      <defs>
        <linearGradient id={`hw-bg-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ea580c" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id={`hw-pumpkin-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
      </defs>
      <rect fill={`url(#hw-bg-${id})`} height="160" width="400" />
      {/* crescent moon */}
      <path
        d="M312 26 a30 30 0 1 0 0 60 a21 21 0 1 1 0 -60 Z"
        fill="#7c3aed"
        opacity="0.85"
      />
      {/* stars */}
      <path
        d="M56 28 l3 7 l7 1 l-5.5 5 l1.5 7 l-6 -3.6 l-6 3.6 l1.5 -7 l-5.5 -5 l7 -1 z"
        fill="#f59e0b"
      />
      <path
        d="M150 24 l2 4.5 l4.5 0.6 l-3.3 3 l0.9 4.4 l-4 -2.4 l-4 2.4 l0.9 -4.4 l-3.3 -3 l4.5 -0.6 z"
        fill="#fbbf24"
      />
      <circle cx="20" cy="62" fill="#f59e0b" r="2" />
      <circle cx="120" cy="40" fill="#fbbf24" r="2.5" />
      {/* bat */}
      <g fill="#4c1d95">
        <path d="M84 64 Q60 40 50 50 Q46 62 58 66 Z" />
        <path d="M116 64 Q140 40 150 50 Q154 62 142 66 Z" />
        <ellipse cx="100" cy="64" rx="8" ry="12" />
        <circle cx="97" cy="60" fill="#fbbf24" r="2.5" />
        <circle cx="103" cy="60" fill="#fbbf24" r="2.5" />
      </g>
      {/* pumpkin */}
      <ellipse
        cx="210"
        cy="128"
        fill={`url(#hw-pumpkin-${id})`}
        rx="62"
        ry="44"
      />
      <path
        d="M180 128 q30 -30 60 0 q-30 30 -60 0 Z"
        fill="#9a3412"
        opacity="0.28"
      />
      <rect fill="#65a30d" height="14" rx="5" width="12" x="204" y="76" />
      <path
        d="M212 76 q10 -10 0 -16"
        fill="none"
        stroke="#65a30d"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export function ChristmasArt({ className }: ArtProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
      viewBox="0 0 400 160"
    >
      <defs>
        <linearGradient id={`xmas-bg-${id}`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.10" />
        </linearGradient>
        <linearGradient id={`xmas-tree-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" />
          <stop offset="100%" stopColor="#15803d" />
        </linearGradient>
      </defs>
      <rect fill={`url(#xmas-bg-${id})`} height="160" width="400" />
      {/* snowflakes */}
      <path
        d="M60 32 l3 8 l8 1 l-6 6 l2 8 l-7 -4 l-7 4 l2 -8 l-6 -6 l8 -1 z"
        fill="#0ea5e9"
      />
      <path
        d="M150 26 l2.5 6 l6 0.8 l-4.5 4.4 l1.3 6 l-5.3 -3.2 l-5.3 3.2 l1.3 -6 l-4.5 -4.4 l6 -0.8 z"
        fill="#7dd3fc"
      />
      <circle cx="40" cy="92" fill="#7dd3fc" r="2" />
      <circle cx="330" cy="40" fill="#7dd3fc" r="2.5" />
      <circle cx="362" cy="92" fill="#0ea5e9" r="2" />
      {/* pine tree */}
      <g>
        <path d="M260 50 l30 26 l-30 26 Z" fill={`url(#xmas-tree-${id})`} />
        <path d="M260 76 l38 34 l-38 34 Z" fill={`url(#xmas-tree-${id})`} />
        <path d="M260 106 l46 40 l-46 40 Z" fill={`url(#xmas-tree-${id})`} />
        <rect fill="#92400e" height="14" rx="2" width="12" x="254" y="146" />
        <circle cx="260" cy="64" fill="#facc15" r="3" />
        <circle cx="250" cy="96" fill="#f87171" r="3" />
        <circle cx="272" cy="126" fill="#facc15" r="3" />
      </g>
      {/* snowman */}
      <g>
        <circle cx="110" cy="128" fill="#f8fafc" r="14" />
        <circle cx="110" cy="104" fill="#f8fafc" r="10" />
        <rect fill="#1e293b" height="10" rx="2" width="16" x="102" y="88" />
        <rect fill="#dc2626" height="4" width="20" x="100" y="98" />
        <circle cx="106" cy="104" fill="#1e293b" r="1.5" />
        <circle cx="114" cy="104" fill="#1e293b" r="1.5" />
        <path
          d="M110 106 l0 2 l4 0"
          fill="none"
          stroke="#f97316"
          strokeLinecap="round"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
