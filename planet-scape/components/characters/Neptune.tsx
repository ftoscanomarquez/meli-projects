/**
 * Neptuno — gigante de hielo, el planeta premium más caro (3500 ⭐, ver
 * AGENTS.md §5/§9 y lib/planetUnlocks.ts) — pedido explícito del usuario
 * (2026-07-23): "quiero un diseño muy bonito y que brille y parpadee".
 *
 * El brillo/parpadeo real (a diferencia del resto de personajes, estáticos)
 * usa animación SMIL nativa de SVG (`<animate>`) sobre un halo exterior y el
 * anillo — funciona en vivo aquí (componente React del carrusel), a
 * diferencia de `engine/characterSvg.ts` (la textura de PixiJS de la
 * partida real, que se rasteriza UNA sola vez a un bitmap estático — ahí el
 * parpadeo se resuelve aparte con un `PIXI.Graphics` propio, ver
 * GameEngine.ts `neptuneAuraVisual`).
 *
 * Mismo patrón de anillo en dos piezas que Saturn.tsx (mitad trasera detrás
 * del cuerpo, mitad delantera encima) — más delgado y en tonos hielo, ya
 * que el anillo real de Neptuno es mucho más tenue que el de Saturno.
 */
export function Neptune({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Neptuno">
      <defs>
        <radialGradient id="neptuneBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#bfe8ff" />
          <stop offset="45%" stopColor="var(--neptune)" />
          <stop offset="100%" stopColor="#122a6e" />
        </radialGradient>
        <linearGradient id="neptuneRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9fd8ff" />
          <stop offset="50%" stopColor="#e8f8ff" />
          <stop offset="100%" stopColor="#7fb8f0" />
        </linearGradient>
        <radialGradient id="neptuneHalo" cx="50%" cy="50%" r="50%">
          <stop offset="55%" stopColor="var(--neptune-glow)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--neptune-glow)" stopOpacity="0.55" />
        </radialGradient>
        <clipPath id="neptuneRingFrontClip">
          <rect x="0" y="100" width="200" height="100" />
        </clipPath>
      </defs>

      {/* Halo exterior — parpadea de verdad (SMIL), pedido explícito del
          usuario: "que brille y parpadee". */}
      <circle cx="100" cy="100" r="98" fill="url(#neptuneHalo)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2.4s" repeatCount="indefinite" />
      </circle>

      {/* Anillo — mitad trasera, detrás del cuerpo */}
      <ellipse
        cx="100"
        cy="100"
        rx="94"
        ry="16"
        fill="none"
        stroke="url(#neptuneRingGradient)"
        strokeWidth="5"
        opacity="0.75"
        transform="rotate(-10 100 100)"
      >
        <animate attributeName="opacity" values="0.55;0.9;0.55" dur="2.4s" repeatCount="indefinite" />
      </ellipse>

      <circle cx="100" cy="100" r="80" fill="url(#neptuneBody)" stroke="#0a1a4a" strokeWidth="4" />
      {/* Vetas de nubes heladas */}
      <ellipse cx="70" cy="70" rx="34" ry="14" fill="#e8f8ff" opacity="0.5" transform="rotate(-18 70 70)" />
      <ellipse cx="70" cy="70" rx="34" ry="14" fill="#e8f8ff" opacity="0.25" transform="rotate(-18 70 70)">
        <animate attributeName="opacity" values="0.15;0.4;0.15" dur="3.2s" repeatCount="indefinite" />
      </ellipse>

      <ellipse cx="72" cy="90" rx="9" ry="11" fill="#061238" />
      <ellipse cx="128" cy="90" rx="9" ry="11" fill="#061238" />
      <circle cx="75" cy="85" r="2.8" fill="#fff" />
      <circle cx="131" cy="85" r="2.8" fill="#fff" />
      <path d="M78 122 Q100 134 122 120" fill="none" stroke="#061238" strokeWidth="4" strokeLinecap="round" />

      {/* Anillo — mitad delantera, encima del cuerpo */}
      <g clipPath="url(#neptuneRingFrontClip)">
        <ellipse
          cx="100"
          cy="100"
          rx="94"
          ry="16"
          fill="none"
          stroke="url(#neptuneRingGradient)"
          strokeWidth="5"
          transform="rotate(-10 100 100)"
        />
      </g>
    </svg>
  );
}
