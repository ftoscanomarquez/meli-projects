import { Container, Graphics } from "pixi.js";

/**
 * Sistema de partículas propio, en canales independientes por tipo — ver
 * AGENTS.md §4. Reemplaza a `@pixi/particle-emitter` (incompatible con
 * PixiJS 8, ver RETROSPECTIVA.md). Pool con reciclado de objetos para no
 * generar basura de GC dentro del loop de 60 FPS.
 */

type Particle = {
  gfx: Graphics;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
};

export class ParticlePool {
  private particles: Particle[] = [];

  constructor(
    private container: Container,
    private buildGraphics: () => Graphics,
    poolSize: number,
    // Llamaradas: se piden "que no se desvanezcan al final" — quedan a
    // alpha=1 toda su vida y desaparecen de golpe, en vez del fundido a
    // negro por defecto (lava/absorción sí siguen desvaneciéndose).
    private fade = true,
  ) {
    for (let i = 0; i < poolSize; i++) {
      const gfx = this.buildGraphics();
      gfx.visible = false;
      container.addChild(gfx);
      this.particles.push({ gfx, vx: 0, vy: 0, life: 0, maxLife: 1, active: false });
    }
  }

  spawn(x: number, y: number, vx: number, vy: number, lifeMs: number, scale = 1) {
    const p = this.particles.find((particle) => !particle.active);
    if (!p) return; // pool agotado: se descarta el spawn, no se crea más basura
    p.active = true;
    p.vx = vx;
    p.vy = vy;
    p.life = lifeMs;
    p.maxLife = lifeMs;
    p.gfx.visible = true;
    p.gfx.alpha = 1;
    p.gfx.scale.set(scale);
    p.gfx.position.set(x, y);
    // Orienta la "punta" de la forma (dibujada apuntando hacia abajo, ver
    // buildFlareParticles) en la dirección real de vuelo.
    p.gfx.rotation = vx !== 0 || vy !== 0 ? Math.atan2(vy, vx) - Math.PI / 2 : 0;
  }

  update(deltaMS: number) {
    for (const p of this.particles) {
      if (!p.active) continue;
      p.life -= deltaMS;
      if (p.life <= 0) {
        p.active = false;
        p.gfx.visible = false;
        continue;
      }
      p.gfx.x += (p.vx * deltaMS) / 1000;
      p.gfx.y += (p.vy * deltaMS) / 1000;
      if (this.fade) p.gfx.alpha = p.life / p.maxLife;
    }
  }

  clear() {
    for (const p of this.particles) {
      p.active = false;
      p.gfx.visible = false;
    }
  }

  /** Para detección de colisión (ej. llamarada vs jugador) sin exponer el pool completo. */
  forEachActive(cb: (x: number, y: number, deactivate: () => void) => void) {
    for (const p of this.particles) {
      if (!p.active) continue;
      cb(p.gfx.x, p.gfx.y, () => {
        p.active = false;
        p.gfx.visible = false;
      });
    }
  }
}

export function buildFlareParticles(container: Container) {
  return new ParticlePool(
    container,
    // Forma de "lengua de fuego" (llamarada solar real) en vez de una
    // elipse plana — apunta hacia abajo en su espacio local; ParticlePool
    // la rota hacia la dirección real de vuelo en cada spawn(). Capa
    // exterior naranja + núcleo amarillo-blanco brillante, más grande que
    // antes.
    () =>
      new Graphics()
        .moveTo(0, -7)
        .quadraticCurveTo(13, 2, 0, 22)
        .quadraticCurveTo(-13, 2, 0, -7)
        .fill({ color: 0xff5a1f, alpha: 0.9 })
        .moveTo(0, -4)
        .quadraticCurveTo(6, 1, 0, 12)
        .quadraticCurveTo(-6, 1, 0, -4)
        .fill({ color: 0xffe08a }),
    120,
    false, // no se desvanecen — se quedan a alpha=1 hasta desaparecer de golpe
  );
}

/**
 * Llamaradas del Sol Rojo (nivel 45+, ver AGENTS.md §5.1) — mismo canal
 * independiente de siempre (evita mezclarlas con las amarillas), misma
 * forma pero en tonos rojizos/carmesí para distinguirlas a simple vista de
 * que estas NO se pueden bloquear con ningún escudo.
 */
export function buildRedFlareParticles(container: Container) {
  return new ParticlePool(
    container,
    () =>
      new Graphics()
        .moveTo(0, -7)
        .quadraticCurveTo(13, 2, 0, 22)
        .quadraticCurveTo(-13, 2, 0, -7)
        .fill({ color: 0xb3001f, alpha: 0.92 })
        .moveTo(0, -4)
        .quadraticCurveTo(6, 1, 0, 12)
        .quadraticCurveTo(-6, 1, 0, -4)
        .fill({ color: 0xff5a3d }),
    120,
    false,
  );
}

export function buildLavaParticles(container: Container) {
  return new ParticlePool(
    container,
    () => new Graphics().circle(0, 0, 5).fill({ color: 0xff4d1f }),
    100,
  );
}

export function buildAbsorbParticles(container: Container) {
  return new ParticlePool(
    container,
    () => new Graphics().circle(0, 0, 4).fill({ color: 0xd9a8ff }),
    60,
  );
}

/**
 * Explosión final del jugador al ser eliminado (secuencia de muerte, ver
 * AGENTS.md §5.1 y GameEngine.ts#runDeathSequence) — pedido explícito del
 * usuario (2026-07-22): "sale una explosión intensa desde el centro del
 * planeta, estalla y muere". Fragmentos naranja/amarillo/rojo que salen
 * disparados en todas direcciones y se desvanecen (`fade: true`).
 */
export function buildExplosionParticles(container: Container) {
  return new ParticlePool(
    container,
    () =>
      new Graphics()
        .circle(0, 0, 7)
        .fill({ color: 0xffdd55, alpha: 0.95 })
        .circle(0, 0, 3.5)
        .fill({ color: 0xffffff }),
    40,
  );
}

/**
 * Rastro de luz de Mercurio al activar su súper-velocidad — pedido real
 * del usuario (2026-07-22, faltaba). Destellos blanco-cian que se quedan
 * detrás del jugador y se desvanecen rápido (`fade` por defecto = true).
 */
export function buildTrailParticles(container: Container) {
  return new ParticlePool(
    container,
    () =>
      new Graphics()
        .circle(0, 0, 9)
        .fill({ color: 0x8ff5ff, alpha: 0.55 })
        .circle(0, 0, 4)
        .fill({ color: 0xffffff, alpha: 0.9 }),
    40,
  );
}

/**
 * Fragmento anguloso pequeño (triángulo irregular, más "trozo roto" que un
 * círculo) — base compartida por los dos canales de "hacerse añicos" de
 * abajo. Cada partícula del pool recibe un color al azar de `palette` UNA
 * sola vez, al construirse (no en cada `spawn()` — el pool recicla la misma
 * `Graphics`), así que el pool entero muestra variedad de tonos a la vez.
 */
function buildShatterParticles(container: Container, palette: number[], poolSize: number) {
  return new ParticlePool(
    container,
    () => {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const s = 3 + Math.random() * 3;
      return new Graphics()
        .moveTo(0, -s)
        .lineTo(s * 0.8, s * 0.55)
        .lineTo(-s * 0.7, s * 0.5)
        .closePath()
        .fill({ color });
    },
    poolSize,
  );
}

/**
 * Añicos de hielo — pedido explícito del usuario (2026-07-23): "los
 * asteroides congelados tendran una pequeña animacione donde se rompen en
 * cachitos de hielo para que se vea mas epico el poder de neptuno". Se usa
 * al destruir CUALQUIER asteroide marcado `frozen` (por Neptuno mismo o por
 * su tormenta de equipo), sin importar quién lo toque — ver
 * GameEngine.ts#checkCollisions. Paleta azul/blanco hielo, distinta del
 * cian genérico de ralentización.
 */
export function buildIceShatterParticles(container: Container) {
  return buildShatterParticles(container, [0x9fe8ff, 0xe8f8ff, 0x5ec8ff, 0xbfe8ff], 60);
}

/**
 * Añicos de roca — pedido explícito del usuario (2026-07-23), a raíz de
 * pedir los de hielo para Neptuno: "tambien cuando mercurio con su
 * velocidad destroce los asteroides que se vean como se rompen en cachitos
 * obvio no congelados pero se hacen cachitos". Mismo mecanismo que los de
 * hielo, paleta café/gris rocosa en vez de azul.
 */
export function buildRockShatterParticles(container: Container) {
  return buildShatterParticles(container, [0xb98356, 0x7a5636, 0x9c8266, 0x5c4530], 60);
}

/**
 * Polvo de Venus — pedido explícito del usuario (2026-07-24): "al chocar
 * con venus se vuelven polvo como una pequeña animacion de polvo en donde
 * impactaron a Venus". A diferencia de los añicos angulosos de hielo/roca
 * (un objeto rompiéndose en pedazos), esto es una nube suave desvaneciéndose
 * — círculos pequeños en tonos arena/naranja quemado, `fade: true` (por
 * defecto) para que se disuelvan en vez de desaparecer de golpe.
 */
export function buildDustParticles(container: Container) {
  return new ParticlePool(
    container,
    () => new Graphics().circle(0, 0, 4).fill({ color: 0xe4a56f, alpha: 0.75 }),
    40,
  );
}

/**
 * Aurora boreal de la Tierra — pedido explícito del usuario (2026-07-24):
 * "su campo magnetico... cada vez que lo impactan... provoca una pequeña
 * animacion de aurora boreal donde lo impacto". Brillo suave (círculo
 * exterior tenue + núcleo brillante, mismo patrón que `buildTrailParticles`)
 * en colores típicos de aurora (verde/cian/violeta), uno al azar por
 * partícula del pool.
 */
export function buildAuroraParticles(container: Container) {
  const palette = [0x4dffb8, 0x8ff5ff, 0xb35cff, 0x9bff5c];
  return new ParticlePool(
    container,
    () => {
      const color = palette[Math.floor(Math.random() * palette.length)];
      return new Graphics().circle(0, 0, 11).fill({ color, alpha: 0.35 }).circle(0, 0, 4).fill({ color, alpha: 0.9 });
    },
    30,
  );
}

/**
 * Explosión de polvo de colores neón al terminar de fusionarse los dos
 * agujeros negros en un Quasar — pedido explícito del usuario (2026-07-24):
 * "que se vea como una explosion de colores neon como polvo de colores y
 * despues aparezca la supernova". Paleta arcoíris neón, más grande que
 * `buildDustParticles` (evento único y dramático, no un efecto continuo),
 * `fade: true` para que se disuelva como polvo.
 */
export function buildNeonDustParticles(container: Container) {
  const palette = [0xff5cd6, 0x7ec8ff, 0xffe066, 0xb35cff, 0x5cffb0, 0xff8f5c];
  return new ParticlePool(
    container,
    () => {
      const color = palette[Math.floor(Math.random() * palette.length)];
      return new Graphics().circle(0, 0, 5).fill({ color, alpha: 0.85 }).circle(0, 0, 2).fill({ color: 0xffffff, alpha: 0.9 });
    },
    80,
  );
}
