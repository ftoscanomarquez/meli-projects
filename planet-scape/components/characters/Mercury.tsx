/** Mercurio — café dorado con cráteres, ojos separados, expresión tímida. */
export function Mercury({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Mercurio">
      <defs>
        <radialGradient id="mercuryBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#dcb185" />
          <stop offset="55%" stopColor="var(--mercury)" />
          <stop offset="100%" stopColor="var(--mercury-dark)" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="82" fill="url(#mercuryBody)" stroke="#4a3018" strokeWidth="4" />
      {/* cráteres */}
      <circle cx="60" cy="70" r="9" fill="var(--mercury-dark)" opacity="0.6" />
      <circle cx="135" cy="60" r="6" fill="var(--mercury-dark)" opacity="0.6" />
      <circle cx="140" cy="130" r="11" fill="var(--mercury-dark)" opacity="0.6" />
      <circle cx="55" cy="130" r="5" fill="var(--mercury-dark)" opacity="0.6" />
      {/* ojos separados y tímidos */}
      <ellipse cx="68" cy="98" rx="8" ry="10" fill="#2c1a0c" />
      <ellipse cx="132" cy="98" rx="8" ry="10" fill="#2c1a0c" />
      <circle cx="71" cy="94" r="2.5" fill="#fff" />
      <circle cx="135" cy="94" r="2.5" fill="#fff" />
      {/* boca pequeña, cerrada */}
      <path d="M92 122 Q100 126 108 122" fill="none" stroke="#2c1a0c" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
