/** Júpiter — bandas cafés/beige y la Gran Mancha Roja, sonrisa amplia y segura. */
export function Jupiter({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Júpiter">
      <defs>
        <radialGradient id="jupiterBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f5d9a8" />
          <stop offset="55%" stopColor="var(--jupiter)" />
          <stop offset="100%" stopColor="var(--jupiter-band)" />
        </radialGradient>
        <clipPath id="jupiterClip">
          <circle cx="100" cy="100" r="82" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="82" fill="url(#jupiterBody)" stroke="#6b4423" strokeWidth="4" />
      <g clipPath="url(#jupiterClip)" opacity="0.55">
        <rect x="18" y="52" width="164" height="10" fill="var(--jupiter-band)" />
        <rect x="18" y="70" width="164" height="7" fill="#c68a4e" />
        <rect x="18" y="118" width="164" height="9" fill="#8a5a2e" />
        <rect x="18" y="136" width="164" height="6" fill="#c68a4e" />
      </g>
      {/* Gran Mancha Roja */}
      <ellipse cx="134" cy="112" rx="18" ry="11" fill="var(--jupiter-spot)" opacity="0.75" />
      {/* ojos amplios y confiados */}
      <ellipse cx="73" cy="92" rx="9" ry="11" fill="#4a2e12" />
      <ellipse cx="127" cy="92" rx="9" ry="11" fill="#4a2e12" />
      <circle cx="76" cy="87" r="2.8" fill="#fff" />
      <circle cx="130" cy="87" r="2.8" fill="#fff" />
      <path d="M75 122 Q100 138 128 122" fill="none" stroke="#4a2e12" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
