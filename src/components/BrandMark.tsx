/** Joystick-cube brand glyph inspired by the public High Score Host mark. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="High Score Host">
      <defs>
        <linearGradient id="cubeTop" x1="134" x2="382" y1="160" y2="238" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6ff6ff" />
          <stop offset="1" stopColor="#00b7d2" />
        </linearGradient>
        <linearGradient id="cubeRed" x1="292" x2="412" y1="218" y2="388" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff4262" />
          <stop offset="1" stopColor="#d80f31" />
        </linearGradient>
        <filter id="brandGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="18" stdDeviation="20" floodColor="#2eeaff" floodOpacity="0.35" />
          <feDropShadow dx="0" dy="12" stdDeviation="16" floodColor="#ff2448" floodOpacity="0.28" />
        </filter>
      </defs>

      <rect x="24" y="24" width="464" height="464" rx="74" fill="#050506" />
      <rect x="42" y="42" width="428" height="428" rx="58" fill="none" stroke="rgba(255,255,255,.12)" />

      <g filter="url(#brandGlow)">
        <path d="M112 216 256 152l144 64-144 70z" fill="url(#cubeTop)" />
        <path d="M112 216v150l144 74V286z" fill="#fbf7ee" />
        <path d="M256 286v154l144-74V216z" fill="url(#cubeRed)" />
        <path d="M112 216 256 286l144-70" fill="none" stroke="#050506" strokeWidth="16" strokeLinejoin="round" />
        <path d="M256 286v154" stroke="#050506" strokeWidth="16" strokeLinecap="round" />

        <path d="M154 250h48v54h70v-54h48v142h-48v-54h-70v54h-48z" fill="#050506" />
        <path d="M306 284h66v32h-66zM306 344h74v32h-74z" fill="#fbf7ee" opacity="0.92" />

        <path d="M246 164 268 78" stroke="#fbf7ee" strokeWidth="28" strokeLinecap="round" />
        <path d="M246 164 268 78" stroke="#050506" strokeWidth="12" strokeLinecap="round" opacity="0.8" />
        <circle cx="272" cy="64" r="34" fill="#ff2448" stroke="#050506" strokeWidth="12" />
        <circle cx="284" cy="52" r="9" fill="#fbf7ee" opacity="0.9" />
      </g>
    </svg>
  )
}
