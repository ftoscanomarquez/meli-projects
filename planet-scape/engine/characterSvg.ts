/**
 * Mismo diseño visual que components/characters/*.tsx (React, landing), pero
 * como strings SVG planos para cargarlos como textura de PixiJS — ver
 * AGENTS.md §4. PixiJS no puede rasterizar un componente React directamente;
 * esto evita duplicar la lógica de gradientes/colores en dos formatos.
 */

const PLANET_SVG: Record<string, string> = {
  mercury: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs><radialGradient id="g" cx="35%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#dcb185"/><stop offset="55%" stop-color="#b98356"/><stop offset="100%" stop-color="#7a5636"/>
    </radialGradient></defs>
    <circle cx="100" cy="100" r="82" fill="url(#g)" stroke="#4a3018" stroke-width="4"/>
    <circle cx="60" cy="70" r="9" fill="#7a5636" opacity="0.6"/>
    <circle cx="135" cy="60" r="6" fill="#7a5636" opacity="0.6"/>
    <circle cx="140" cy="130" r="11" fill="#7a5636" opacity="0.6"/>
    <circle cx="55" cy="130" r="5" fill="#7a5636" opacity="0.6"/>
    <ellipse cx="68" cy="98" rx="8" ry="10" fill="#2c1a0c"/><ellipse cx="132" cy="98" rx="8" ry="10" fill="#2c1a0c"/>
    <circle cx="71" cy="94" r="2.5" fill="#fff"/><circle cx="135" cy="94" r="2.5" fill="#fff"/>
    <path d="M92 122 Q100 126 108 122" fill="none" stroke="#2c1a0c" stroke-width="3.5" stroke-linecap="round"/>
  </svg>`,
  venus: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#ff8a5c"/><stop offset="55%" stop-color="#e4592a"/><stop offset="100%" stop-color="#a53410"/></radialGradient>
      <clipPath id="c"><circle cx="100" cy="100" r="82"/></clipPath>
    </defs>
    <circle cx="100" cy="100" r="82" fill="url(#g)" stroke="#5c1c08" stroke-width="4"/>
    <g clip-path="url(#c)" opacity="0.85">
      <path d="M18 108 Q100 128 182 108" stroke="#f4c430" stroke-width="7" fill="none"/>
      <path d="M14 92 Q100 108 186 92" stroke="#f4c430" stroke-width="5" fill="none" opacity="0.7"/>
    </g>
    <ellipse cx="72" cy="85" rx="9" ry="11" fill="#3a0f04"/><ellipse cx="128" cy="85" rx="9" ry="11" fill="#3a0f04"/>
    <circle cx="75" cy="80" r="2.8" fill="#fff"/><circle cx="131" cy="80" r="2.8" fill="#fff"/>
    <path d="M78 132 Q102 146 124 128" fill="none" stroke="#3a0f04" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  earth: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#6fa8ff"/><stop offset="55%" stop-color="#2e6fe0"/><stop offset="100%" stop-color="#173f8c"/></radialGradient>
      <clipPath id="c"><circle cx="100" cy="100" r="82"/></clipPath>
    </defs>
    <circle cx="100" cy="100" r="82" fill="url(#g)" stroke="#0e2657" stroke-width="4"/>
    <g clip-path="url(#c)">
      <path d="M40 70 Q60 55 82 68 Q76 90 54 92 Q38 84 40 70Z" fill="#3fa34d"/>
      <path d="M110 50 Q145 55 150 82 Q128 92 112 78Z" fill="#3fa34d"/>
      <path d="M90 120 Q120 118 132 145 Q108 158 88 145Z" fill="#3fa34d"/>
      <ellipse cx="100" cy="26" rx="34" ry="14" fill="#f3fbff" opacity="0.9"/>
      <ellipse cx="100" cy="176" rx="30" ry="12" fill="#f3fbff" opacity="0.9"/>
    </g>
    <ellipse cx="74" cy="96" rx="9" ry="11" fill="#04122e"/><ellipse cx="126" cy="96" rx="9" ry="11" fill="#04122e"/>
    <circle cx="77" cy="91" r="2.8" fill="#fff"/><circle cx="129" cy="91" r="2.8" fill="#fff"/>
    <path d="M70 122 Q100 152 130 122" fill="none" stroke="#04122e" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`,
  mars: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#ff9d63"/><stop offset="55%" stop-color="#c1440e"/><stop offset="100%" stop-color="#7a2c0a"/></radialGradient>
      <clipPath id="c"><circle cx="100" cy="100" r="82"/></clipPath>
    </defs>
    <circle cx="100" cy="100" r="82" fill="url(#g)" stroke="#5c2308" stroke-width="4"/>
    <g clip-path="url(#c)" opacity="0.75">
      <ellipse cx="60" cy="60" rx="20" ry="12" fill="#7a2c0a"/>
      <ellipse cx="140" cy="120" rx="24" ry="14" fill="#7a2c0a"/>
      <ellipse cx="70" cy="140" rx="14" ry="9" fill="#ffb27a"/>
    </g>
    <ellipse cx="100" cy="26" rx="26" ry="11" fill="#fff3ea" opacity="0.9"/>
    <ellipse cx="73" cy="92" rx="9" ry="11" fill="#3a1204"/><ellipse cx="127" cy="92" rx="9" ry="11" fill="#3a1204"/>
    <circle cx="76" cy="87" r="2.8" fill="#fff"/><circle cx="130" cy="87" r="2.8" fill="#fff"/>
    <path d="M75 124 Q100 142 128 120" fill="none" stroke="#3a1204" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`,
  // Desbloqueables con estrellas (ver AGENTS.md §5 y §9) — pedido real del
  // usuario (2026-07-22): Júpiter (1000 ⭐) y Saturno (1200 ⭐) ya
  // seleccionables, antes solo documentados como pendientes.
  jupiter: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#f5d9a8"/><stop offset="55%" stop-color="#d9a066"/><stop offset="100%" stop-color="#a8703c"/></radialGradient>
      <clipPath id="c"><circle cx="100" cy="100" r="82"/></clipPath>
    </defs>
    <circle cx="100" cy="100" r="82" fill="url(#g)" stroke="#6b4423" stroke-width="4"/>
    <g clip-path="url(#c)" opacity="0.55">
      <rect x="18" y="52" width="164" height="10" fill="#a8703c"/>
      <rect x="18" y="70" width="164" height="7" fill="#c68a4e"/>
      <rect x="18" y="118" width="164" height="9" fill="#8a5a2e"/>
      <rect x="18" y="136" width="164" height="6" fill="#c68a4e"/>
    </g>
    <ellipse cx="134" cy="112" rx="18" ry="11" fill="#c1440e" opacity="0.75"/>
    <ellipse cx="73" cy="92" rx="9" ry="11" fill="#4a2e12"/><ellipse cx="127" cy="92" rx="9" ry="11" fill="#4a2e12"/>
    <circle cx="76" cy="87" r="2.8" fill="#fff"/><circle cx="130" cy="87" r="2.8" fill="#fff"/>
    <path d="M75 122 Q100 138 128 122" fill="none" stroke="#4a2e12" stroke-width="4" stroke-linecap="round"/>
  </svg>`,
  // Anillo en dos piezas + degradado plateado (2026-07-22, ver
  // components/characters/Saturn.tsx) — este SVG es el que se rasteriza a
  // textura de PixiJS para la partida real (`loadPlanetTexture()`), un
  // documento SEPARADO del componente React del carrusel de la landing.
  // Brecha real detectada por el usuario (2026-07-23): el rediseño del
  // anillo solo se había aplicado al carrusel, la partida seguía mostrando
  // el anillo viejo (una sola pieza, siempre detrás, tono dorado plano).
  saturn: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#fff0c2"/><stop offset="55%" stop-color="#e8c778"/><stop offset="100%" stop-color="#b8934a"/></radialGradient>
      <clipPath id="c"><circle cx="100" cy="100" r="72"/></clipPath>
      <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#c7cbd6"/><stop offset="30%" stop-color="#8f94a3"/><stop offset="50%" stop-color="#f2f3f8"/><stop offset="70%" stop-color="#8f94a3"/><stop offset="100%" stop-color="#d8dbe4"/></linearGradient>
      <clipPath id="rc"><rect x="0" y="100" width="200" height="100"/></clipPath>
    </defs>
    <ellipse cx="100" cy="100" rx="98" ry="20" fill="none" stroke="url(#rg)" stroke-width="9" opacity="0.9" transform="rotate(-8 100 100)"/>
    <circle cx="100" cy="100" r="72" fill="url(#g)" stroke="#8a6a34" stroke-width="4"/>
    <g clip-path="url(#c)" opacity="0.45">
      <rect x="28" y="78" width="144" height="7" fill="#c9a76a"/>
      <rect x="28" y="110" width="144" height="6" fill="#a8833f"/>
    </g>
    <ellipse cx="66" cy="84" rx="8" ry="10" fill="#4a3818"/><ellipse cx="112" cy="84" rx="8" ry="10" fill="#4a3818"/>
    <circle cx="69" cy="80" r="2.4" fill="#fff"/><circle cx="115" cy="80" r="2.4" fill="#fff"/>
    <path d="M68 108 Q90 120 114 106" fill="none" stroke="#4a3818" stroke-width="3.5" stroke-linecap="round"/>
    <g clip-path="url(#rc)">
      <ellipse cx="100" cy="100" rx="98" ry="20" fill="none" stroke="url(#rg)" stroke-width="9" transform="rotate(-8 100 100)"/>
    </g>
  </svg>`,
  // Neptuno — gigante de hielo, el planeta premium más caro (3500 ⭐, ver
  // AGENTS.md §5/§9). Este SVG es la textura real de partida (rasterizada
  // una sola vez, ver comentario de Saturno arriba sobre por qué es un
  // documento separado de components/characters/Neptune.tsx); el brillo
  // parpadeante en sí solo existe en ese componente React del carrusel
  // (`components/characters/Neptune.tsx`, animación SMIL) — un SVG
  // rasterizado a textura estática no puede animarse, así que aquí el
  // "brillo" se resuelve con un halo azul suave horneado en la imagen y,
  // aparte, un aro `PIXI.Graphics` propio que sí parpadea de verdad sobre
  // el sprite en partida (ver GameEngine.ts, mismo patrón que el anillo de
  // Saturno).
  neptune: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <radialGradient id="g" cx="35%" cy="30%" r="75%"><stop offset="0%" stop-color="#bfe8ff"/><stop offset="45%" stop-color="#3c6fd8"/><stop offset="100%" stop-color="#122a6e"/></radialGradient>
      <clipPath id="c"><circle cx="100" cy="100" r="80"/></clipPath>
      <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9fd8ff"/><stop offset="50%" stop-color="#e8f8ff"/><stop offset="100%" stop-color="#7fb8f0"/></linearGradient>
      <clipPath id="rc"><rect x="0" y="100" width="200" height="100"/></clipPath>
      <radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="60%" stop-color="#5ec8ff" stop-opacity="0"/><stop offset="100%" stop-color="#5ec8ff" stop-opacity="0.35"/></radialGradient>
    </defs>
    <circle cx="100" cy="100" r="96" fill="url(#halo)"/>
    <ellipse cx="100" cy="100" rx="94" ry="16" fill="none" stroke="url(#rg)" stroke-width="5" opacity="0.75" transform="rotate(-10 100 100)"/>
    <circle cx="100" cy="100" r="80" fill="url(#g)" stroke="#0a1a4a" stroke-width="4"/>
    <g clip-path="url(#c)" opacity="0.5">
      <ellipse cx="70" cy="70" rx="34" ry="14" fill="#e8f8ff" opacity="0.5" transform="rotate(-18 70 70)"/>
      <rect x="20" y="112" width="160" height="8" fill="#1a3a8c"/>
      <rect x="20" y="128" width="160" height="6" fill="#0e2560"/>
    </g>
    <ellipse cx="72" cy="90" rx="9" ry="11" fill="#061238"/><ellipse cx="128" cy="90" rx="9" ry="11" fill="#061238"/>
    <circle cx="75" cy="85" r="2.8" fill="#fff"/><circle cx="131" cy="85" r="2.8" fill="#fff"/>
    <path d="M78 122 Q100 134 122 120" fill="none" stroke="#061238" stroke-width="4" stroke-linecap="round"/>
    <g clip-path="url(#rc)">
      <ellipse cx="100" cy="100" rx="94" ry="16" fill="none" stroke="url(#rg)" stroke-width="5" transform="rotate(-10 100 100)"/>
    </g>
  </svg>`,
};

export type StarterPlanetKey = "mercury" | "venus" | "earth" | "mars";
export const STARTER_PLANET_KEYS: StarterPlanetKey[] = ["mercury", "venus", "earth", "mars"];

// Desbloqueables con estrellas — ver AGENTS.md §5/§9 y lib/planetUnlocks.ts (costos).
export type PremiumPlanetKey = "jupiter" | "saturn" | "neptune";
export const PREMIUM_PLANET_KEYS: PremiumPlanetKey[] = ["jupiter", "saturn", "neptune"];

export type PlanetKey = StarterPlanetKey | PremiumPlanetKey;
export const ALL_PLANET_KEYS: PlanetKey[] = [...STARTER_PLANET_KEYS, ...PREMIUM_PLANET_KEYS];

export function isStarterPlanetKey(value: string | null | undefined): value is StarterPlanetKey {
  return !!value && (STARTER_PLANET_KEYS as string[]).includes(value);
}

export function isPremiumPlanetKey(value: string | null | undefined): value is PremiumPlanetKey {
  return !!value && (PREMIUM_PLANET_KEYS as string[]).includes(value);
}

export function isPlanetKey(value: string | null | undefined): value is PlanetKey {
  return !!value && (ALL_PLANET_KEYS as string[]).includes(value);
}

export function getPlanetSvgDataUri(planet: PlanetKey): string {
  // encodeURIComponent en vez de base64/Buffer: este módulo corre en el
  // navegador (motor de juego, "use client") y `Buffer` no existe ahí.
  const svg = PLANET_SVG[planet];
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
