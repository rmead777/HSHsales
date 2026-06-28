/** Compact "HSH" brand glyph used in the header, login, and loading states. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} role="img" aria-label="High Score Host">
      <rect width="512" height="512" rx="120" fill="#0b1220" />
      <path
        d="M150 140v232M150 256h120M270 140v232"
        fill="none"
        stroke="#ffffff"
        strokeWidth="40"
        strokeLinecap="round"
      />
      <path
        d="M330 372V140h44c44 0 70 26 70 64 0 30-16 52-44 60l52 108h-50l-46-100h-26v100z"
        fill="#2f6bff"
      />
    </svg>
  )
}
