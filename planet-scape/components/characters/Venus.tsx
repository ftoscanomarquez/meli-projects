/** Venus — naranja-rojizo con vetas amarillas en el ecuador, sonrisa ladeada. */
export function Venus({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Venus">
      <defs>
        <radialGradient id="venusBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff8a5c" />
          <stop offset="55%" stopColor="var(--venus)" />
          <stop offset="100%" stopColor="#a53410" />
        </radialGradient>
        <clipPath id="venusClip">
          <circle cx="100" cy="100" r="82" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="82" fill="url(#venusBody)" stroke="#5c1c08" strokeWidth="4" />
      {/* vetas ecuatoriales */}
      <g clipPath="url(#venusClip)" opacity="0.85">
        <path d="M18 108 Q100 128 182 108" stroke="var(--venus-stripe)" strokeWidth="7" fill="none" />
        <path d="M14 92 Q100 108 186 92" stroke="var(--venus-stripe)" strokeWidth="5" fill="none" opacity="0.7" />
      </g>
      {/* ojos parejos, más separados de la boca */}
      <ellipse cx="72" cy="85" rx="9" ry="11" fill="#3a0f04" />
      <ellipse cx="128" cy="85" rx="9" ry="11" fill="#3a0f04" />
      <circle cx="75" cy="80" r="2.8" fill="#fff" />
      <circle cx="131" cy="80" r="2.8" fill="#fff" />
      {/* sonrisa ladeada (personalidad un poco creída) */}
      <path d="M78 132 Q102 146 124 128" fill="none" stroke="#3a0f04" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
