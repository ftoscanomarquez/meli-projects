/** Marte — naranja con parches oscuros y claros, sonrisa segura y protectora. */
export function Mars({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Marte">
      <defs>
        <radialGradient id="marsBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ff9d63" />
          <stop offset="55%" stopColor="var(--mars)" />
          <stop offset="100%" stopColor="var(--mars-dark)" />
        </radialGradient>
        <clipPath id="marsClip">
          <circle cx="100" cy="100" r="82" />
        </clipPath>
      </defs>
      <circle cx="100" cy="100" r="82" fill="url(#marsBody)" stroke="#5c2308" strokeWidth="4" />
      <g clipPath="url(#marsClip)" opacity="0.75">
        <ellipse cx="60" cy="60" rx="20" ry="12" fill="var(--mars-dark)" />
        <ellipse cx="140" cy="120" rx="24" ry="14" fill="var(--mars-dark)" />
        <ellipse cx="70" cy="140" rx="14" ry="9" fill="#ffb27a" />
      </g>
      {/* casquete polar — rasgo real de Marte que lo distingue de Venus a simple vista */}
      <ellipse cx="100" cy="26" rx="26" ry="11" fill="#fff3ea" opacity="0.9" />
      <ellipse cx="100" cy="26" rx="26" ry="11" fill="none" stroke="#ffd9b8" strokeWidth="1.5" opacity="0.6" />
      {/* ojos decididos */}
      <ellipse cx="73" cy="92" rx="9" ry="11" fill="#3a1204" />
      <ellipse cx="127" cy="92" rx="9" ry="11" fill="#3a1204" />
      <circle cx="76" cy="87" r="2.8" fill="#fff" />
      <circle cx="130" cy="87" r="2.8" fill="#fff" />
      {/* sonrisa confiada, ligeramente asimétrica */}
      <path d="M75 124 Q100 142 128 120" fill="none" stroke="#3a1204" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
