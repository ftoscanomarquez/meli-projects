/** Tierra — esfera azul con continentes verdes y casquetes polares blancos, sonrisa amplia y amigable. */
export function Earth({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Tierra">
      <defs>
        <radialGradient id="earthBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#6fa8ff" />
          <stop offset="55%" stopColor="var(--earth)" />
          <stop offset="100%" stopColor="#173f8c" />
        </radialGradient>
        <clipPath id="earthClip">
          <circle cx="100" cy="100" r="82" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="82" fill="url(#earthBody)" stroke="#0e2657" strokeWidth="4" />
      <g clipPath="url(#earthClip)">
        {/* continentes */}
        <path d="M40 70 Q60 55 82 68 Q76 90 54 92 Q38 84 40 70Z" fill="var(--earth-land)" />
        <path d="M110 50 Q145 55 150 82 Q128 92 112 78Z" fill="var(--earth-land)" />
        <path d="M90 120 Q120 118 132 145 Q108 158 88 145Z" fill="var(--earth-land)" />
        {/* casquetes polares */}
        <ellipse cx="100" cy="26" rx="34" ry="14" fill="#f3fbff" opacity="0.9" />
        <ellipse cx="100" cy="176" rx="30" ry="12" fill="#f3fbff" opacity="0.9" />
      </g>
      {/* ojos amigables */}
      <ellipse cx="74" cy="96" rx="9" ry="11" fill="#04122e" />
      <ellipse cx="126" cy="96" rx="9" ry="11" fill="#04122e" />
      <circle cx="77" cy="91" r="2.8" fill="#fff" />
      <circle cx="129" cy="91" r="2.8" fill="#fff" />
      {/* sonrisa amplia */}
      <path d="M70 122 Q100 152 130 122" fill="none" stroke="#04122e" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
