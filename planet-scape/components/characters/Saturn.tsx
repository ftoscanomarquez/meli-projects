/**
 * Saturno — amarillo pálido con anillos icónicos, sonrisa tranquila.
 *
 * Anillo en dos piezas (2026-07-22, pedido explícito del usuario: "una
 * parte del anillo va atrás y otra parte del anillo va enfrente"): la
 * elipse completa se dibuja primero DETRÁS del cuerpo (solo asoman los
 * lados, como antes), y luego una SEGUNDA copia de la misma elipse —
 * recortada a solo su mitad inferior (`saturnRingFrontClip`) — se dibuja
 * ENCIMA del cuerpo, cruzando el borde inferior del planeta como el arco
 * frontal real de un anillo visto en perspectiva. Color plateado con una
 * franja brillante al centro del degradado (`saturnRingGradient`) — pedido
 * explícito: "que resalte que parezca que se mueve" (el brillo simula un
 * reflejo metálico en vez del tono dorado plano de antes).
 */
export function Saturn({ size = 140 }: { size?: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="Saturno">
      <defs>
        <radialGradient id="saturnBody" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff0c2" />
          <stop offset="55%" stopColor="var(--saturn)" />
          <stop offset="100%" stopColor="#b8934a" />
        </radialGradient>
        <linearGradient id="saturnRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c7cbd6" />
          <stop offset="30%" stopColor="#8f94a3" />
          <stop offset="50%" stopColor="#f2f3f8" />
          <stop offset="70%" stopColor="#8f94a3" />
          <stop offset="100%" stopColor="#d8dbe4" />
        </linearGradient>
        <clipPath id="saturnRingFrontClip">
          {/* Solo la mitad inferior de la elipse del anillo — el resto queda
              detrás del cuerpo, dibujado antes. */}
          <rect x="0" y="100" width="200" height="100" />
        </clipPath>
      </defs>
      {/* Anillo — mitad trasera, detrás del cuerpo (solo asoma a los lados) */}
      <ellipse
        cx="100"
        cy="100"
        rx="98"
        ry="20"
        fill="none"
        stroke="url(#saturnRingGradient)"
        strokeWidth="9"
        opacity="0.9"
        transform="rotate(-8 100 100)"
      />
      <circle cx="100" cy="100" r="72" fill="url(#saturnBody)" stroke="#8a6a34" strokeWidth="4" />
      <ellipse cx="66" cy="84" rx="8" ry="10" fill="#4a3818" />
      <ellipse cx="112" cy="84" rx="8" ry="10" fill="#4a3818" />
      <circle cx="69" cy="80" r="2.4" fill="#fff" />
      <circle cx="115" cy="80" r="2.4" fill="#fff" />
      <path d="M68 108 Q90 120 114 106" fill="none" stroke="#4a3818" strokeWidth="3.5" strokeLinecap="round" />
      {/* Anillo — mitad delantera, encima del cuerpo (ver comentario arriba) */}
      <g clipPath="url(#saturnRingFrontClip)">
        <ellipse
          cx="100"
          cy="100"
          rx="98"
          ry="20"
          fill="none"
          stroke="url(#saturnRingGradient)"
          strokeWidth="9"
          transform="rotate(-8 100 100)"
        />
      </g>
    </svg>
  );
}
