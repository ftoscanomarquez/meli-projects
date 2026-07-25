import styles from "./Sun.module.css";

/**
 * Sol — esfera amarillo-naranja con contorno de fuego en movimiento
 * constante (referencia real de SolarBalls). La boca se anima como si
 * estuviera narrando el dato curioso (ver AGENTS.md §1.1 firma visual).
 */
export function Sun({ size = 220, talking = true }: { size?: number; talking?: boolean }) {
  return (
    <div className={styles.wrapper} style={{ width: size, height: size }}>
      <div className={styles.flareRing} aria-hidden="true" />
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="El Sol">
        <defs>
          <radialGradient id="sunBody" cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#fff3c4" />
            <stop offset="45%" stopColor="var(--sun-core)" />
            <stop offset="100%" stopColor="var(--sun-flare)" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="88" fill="url(#sunBody)" stroke="#7a3b12" strokeWidth="4" />
        {/* manchas solares */}
        <ellipse cx="65" cy="120" rx="10" ry="6" fill="#e8862f" opacity="0.5" />
        <ellipse cx="135" cy="80" rx="8" ry="5" fill="#e8862f" opacity="0.5" />
        {/* ojos */}
        <g>
          <ellipse cx="76" cy="92" rx="9" ry="12" fill="#3a1f0a" />
          <ellipse cx="124" cy="92" rx="9" ry="12" fill="#3a1f0a" />
          <circle cx="79" cy="87" r="3" fill="#fff" />
          <circle cx="127" cy="87" r="3" fill="#fff" />
        </g>
        {/* boca */}
        <path
          d={talking ? "M78 122 Q100 148 122 122 Q100 134 78 122 Z" : "M80 122 Q100 134 120 122"}
          fill={talking ? "#5c2a10" : "none"}
          stroke="#3a1f0a"
          strokeWidth="4"
          strokeLinecap="round"
          className={talking ? styles.mouthTalking : undefined}
        />
      </svg>
    </div>
  );
}
