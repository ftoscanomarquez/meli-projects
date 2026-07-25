import { Container, Graphics } from "pixi.js";

/**
 * Quasar (2026-07-24, ver AGENTS.md §5.1) — pedido explícito del usuario:
 * "cuando aparezcan dos agujeros negros... en niveles altos... vas a hacer
 * una emulación de atracción entre ellos como se acercan y una vez juntos
 * girando entre ellos mismos mezclándose entre sí y generando un nuevo
 * fenómeno llamado Quasar". Referencia visual real provista por el usuario
 * (dos agujeros negros con disco de acreción acercándose/fusionándose y un
 * quasar con jets polarizados brillantes) — recreada 100% con `PIXI.Graphics`,
 * nunca la imagen en sí (ver AGENTS.md §4: "no hay imágenes que almacenar").
 *
 * Máquina de estados, orquestada desde GameEngine.ts:
 * - "idle": inactivo, invisible.
 * - "attracting": los dos agujeros negros (clásico + Nova) se representan
 *   como dos "fantasmas" que se desplazan uno hacia el otro — "como se
 *   acercan". NINGUNO de los dos agujeros negros reales es atacable durante
 *   esta fase (confirmado explícitamente por el usuario: "no podran
 *   derrotar a los agujeros negros sino hasta que ya haya explotado y
 *   aparecido el quasar") — GameEngine deja de llamar a su `registerClick()`
 *   mientras el quasar no está en `"idle"`.
 * - "merging": los dos fantasmas orbitan rápido alrededor del punto medio,
 *   encogiéndose — "girando entre ellos mismos mezclándose entre sí".
 * - "active": el Quasar real aparece (núcleo brillante + disco giratorio +
 *   un haz de luz CONSTANTE, no intermitente — pedido explícito del usuario:
 *   "esos rayos que sacan son constantes... mientras el quasar va girando
 *   obvio ese haz de luz se mueve... nadie tiene defensa contra eso" — dos
 *   vigas opuestas que giran junto con el disco, siempre activas). Se
 *   derrota a clics como los agujeros negros, pero con un número FIJO de
 *   clics (`clicksToDefeat`, no escalado por nivel — "para derrotarlo son
 *   25 pulsaciones").
 * - "defeated": breve animación de colapso, después vuelve a "idle" — desde
 *   ahí GameEngine reinicia los dos agujeros negros originales a su ciclo
 *   normal (aviso→activo→clics), como si nunca se hubieran fusionado.
 */
export type QuasarPhase = "idle" | "attracting" | "merging" | "active" | "defeated";

export type QuasarConfig = {
  attractionRadiusMultiplier: number;
  attractionIntensity: number;
  clicksToDefeat: number;
  rayDamageLives: number;
  size: number;
};

const ATTRACT_MS = 2200;
const MERGE_MS = 1700;
const DEFEATED_MS = 550;
// Velocidad de giro del haz (rad/ms) — "barrido" lento tipo faro, sincronizado
// visualmente con la rotación del disco (misma sensación de "esto gira").
const BEAM_ROTATION_SPEED = 0.0011;
const BEAM_LENGTH = 900; // cubre cualquier tamaño de pantalla real del juego
const BEAM_HALF_WIDTH = 10;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function smoothstep(t: number) {
  return t * t * (3 - 2 * t);
}

/** Distancia de un punto al segmento [a,b] — usado para la colisión del haz. */
function pointToSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq)) : 0;
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

export class Quasar {
  readonly container: Container;
  private ghostA: Container;
  private ghostB: Container;
  private disk: Container;
  private core: Graphics;
  private beams: Graphics;
  // Puntos de "polvo de colores" que forman los anillos del disco — pedido
  // explícito del usuario (2026-07-24): "los aros... que sean mas parecido
  // a anillos de polvo de colores... que no se vea tan como una linea...
  // que se vea que parpadeando". Cada uno parpadea con su propia fase (ver
  // `update()`), en vez de ser un solo trazo estático.
  private dustDots: { gfx: Graphics; phase: number; baseAlpha: number }[] = [];

  phase: QuasarPhase = "idle";
  x = 0;
  y = 0;
  private baseRadius: number;
  clicksRequired: number;
  clicksRemaining: number;

  private elapsed = 0;
  private beamAngle = 0;
  private startA = { x: 0, y: 0 };
  private startB = { x: 0, y: 0 };
  private midX = 0;
  private midY = 0;
  private justDefeatedFlag = false;
  // Consumido una vez por GameEngine para disparar la explosión de polvo de
  // colores neón justo cuando termina la fusión — ver `takeJustActivated()`.
  private justActivatedFlag = false;

  constructor(private quasarConfig: QuasarConfig) {
    this.baseRadius = quasarConfig.size;
    this.clicksRequired = quasarConfig.clicksToDefeat;
    this.clicksRemaining = quasarConfig.clicksToDefeat;
    this.container = new Container();
    this.container.visible = false;

    // Fantasmas de la fase de acercamiento/fusión — versiones simplificadas
    // de un agujero negro (núcleo oscuro + aro), uno dorado (eco del clásico)
    // y uno azulado (eco del Nova), como en la referencia visual real.
    this.ghostA = this.buildGhost(0xffc93c);
    this.ghostB = this.buildGhost(0x7ab8ff);

    this.disk = this.buildQuasarDisk();
    this.core = new Graphics().circle(0, 0, this.baseRadius * 0.32).fill({ color: 0xffffff });
    this.beams = this.buildBeams();

    this.container.addChild(this.ghostA, this.ghostB, this.disk, this.beams, this.core);
    this.ghostA.visible = false;
    this.ghostB.visible = false;
    this.disk.visible = false;
    this.core.visible = false;
    this.beams.visible = false;
  }

  /**
   * Agujero negro simplificado para la fase de acercamiento/fusión — disco
   * de acreción alargado (varias elipses concéntricas, como
   * `BlackHole.buildNovaDisk()`) en vez de un simple aro, para que la
   * secuencia se lea como "dos agujeros negros con su disco chocando", más
   * fiel a la referencia visual real que dio el usuario (dos discos
   * dorado/blanco y azul acercándose y entrelazándose). Núcleo oscuro al
   * centro, disco elongado detrás.
   */
  private buildGhost(diskColor: number): Container {
    const g = new Container();
    const disk = new Graphics();
    const layers = [
      { rx: this.baseRadius * 1.9, ry: this.baseRadius * 0.45, alpha: 0.35, width: 7 },
      { rx: this.baseRadius * 1.4, ry: this.baseRadius * 0.32, alpha: 0.55, width: 6 },
      { rx: this.baseRadius * 0.95, ry: this.baseRadius * 0.2, alpha: 0.85, width: 5 },
    ];
    for (const l of layers) {
      disk.ellipse(0, 0, l.rx, l.ry).stroke({ width: l.width, color: diskColor, alpha: l.alpha });
    }
    const core = new Graphics().circle(0, 0, this.baseRadius * 0.5).fill(0x030109);
    g.addChild(disk, core);
    return g;
  }

  /**
   * Disco del Quasar en fase activa — anillos de "polvo de colores" (muchos
   * puntos pequeños en una paleta neón, cada uno parpadeando con su propia
   * fase) en vez de trazos lisos — pedido explícito del usuario
   * (2026-07-24): "los aros o anillos que le pusiste al quasar que sean mas
   * parecido a anillos de polvo de colores para que se vea un poco mas
   * realista que no se vea tan como una linea y ya, que se vea que
   * parpadeando esos anillos de colores". Inspirado en la referencia visual
   * real (quasar.jpg/colision-agujeros.webp), con halo exterior amplio.
   */
  private buildQuasarDisk(): Container {
    const disk = new Container();
    const NEON_PALETTE = [0xff5cd6, 0x7ec8ff, 0xbfe8ff, 0xffe066, 0xb35cff, 0x5cffb0];
    const rings: { rx: number; ry: number; count: number; size: number }[] = [
      { rx: this.baseRadius * 3.2, ry: this.baseRadius * 1.05, count: 46, size: 3.2 },
      { rx: this.baseRadius * 2.6, ry: this.baseRadius * 0.82, count: 40, size: 2.9 },
      { rx: this.baseRadius * 2.0, ry: this.baseRadius * 0.6, count: 34, size: 2.6 },
      { rx: this.baseRadius * 1.4, ry: this.baseRadius * 0.4, count: 26, size: 2.3 },
    ];
    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2 + Math.random() * 0.12;
        const x = Math.cos(angle) * ring.rx;
        const y = Math.sin(angle) * ring.ry;
        const color = NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
        const size = ring.size * (0.7 + Math.random() * 0.6);
        const dot = new Graphics().circle(0, 0, size).fill({ color, alpha: 0.9 });
        dot.position.set(x, y);
        disk.addChild(dot);
        this.dustDots.push({ gfx: dot, phase: Math.random() * Math.PI * 2, baseAlpha: 0.55 + Math.random() * 0.35 });
      }
    }
    const glow = new Graphics().circle(0, 0, this.baseRadius * 0.85).fill({ color: 0xbfe8ff, alpha: 0.4 });
    disk.addChildAt(glow, 0);
    return disk;
  }

  /**
   * Dos vigas de luz opuestas ("jets" polarizados) apuntando en +x/-x en su
   * espacio local — `this.beams.rotation` las gira juntas cada cuadro (ver
   * `update()`), simulando el haz constante y giratorio pedido por el
   * usuario. Cada viga es un trapecio que se angosta hacia la punta (ancho
   * `BEAM_HALF_WIDTH*2` en el núcleo, `BEAM_HALF_WIDTH*0.8` en la punta):
   * capa exterior azul tenue + núcleo blanco brillante, mismo criterio
   * visual de dos capas que `buildFlareParticles`.
   */
  private buildBeams(): Graphics {
    const g = new Graphics();
    const tip = BEAM_HALF_WIDTH * 0.4;
    for (const dir of [1, -1]) {
      g.moveTo(0, -BEAM_HALF_WIDTH)
        .lineTo(BEAM_LENGTH * dir, -tip)
        .lineTo(BEAM_LENGTH * dir, tip)
        .lineTo(0, BEAM_HALF_WIDTH)
        .closePath()
        .fill({ color: 0x8fd8ff, alpha: 0.4 });
    }
    const coreTip = tip * 0.5;
    for (const dir of [1, -1]) {
      g.moveTo(0, -BEAM_HALF_WIDTH * 0.4)
        .lineTo(BEAM_LENGTH * dir, -coreTip)
        .lineTo(BEAM_LENGTH * dir, coreTip)
        .lineTo(0, BEAM_HALF_WIDTH * 0.4)
        .closePath()
        .fill({ color: 0xffffff, alpha: 0.9 });
    }
    return g;
  }

  /** GameEngine lo llama cuando el clásico y el Nova están activos a la vez en un nivel válido. */
  begin(ax: number, ay: number, bx: number, by: number) {
    this.startA = { x: ax, y: ay };
    this.startB = { x: bx, y: by };
    this.midX = (ax + bx) / 2;
    this.midY = (ay + by) / 2;
    this.phase = "attracting";
    this.elapsed = 0;
    this.container.visible = true;
    this.ghostA.visible = true;
    this.ghostB.visible = true;
    this.ghostA.alpha = 1;
    this.ghostB.alpha = 1;
    this.ghostA.position.set(ax, ay);
    this.ghostB.position.set(bx, by);
  }

  /** Consumido una sola vez por GameEngine al terminar el colapso, para reiniciar los agujeros negros originales. */
  takeJustDefeated(): boolean {
    const value = this.justDefeatedFlag;
    this.justDefeatedFlag = false;
    return value;
  }

  /** Consumido una sola vez por GameEngine justo cuando termina la fusión — dispara la explosión de polvo neón. */
  takeJustActivated(): boolean {
    const value = this.justActivatedFlag;
    this.justActivatedFlag = false;
    return value;
  }

  get radius() {
    return this.baseRadius;
  }

  /**
   * Radio de atracción — coincide con el anillo más externo del disco
   * visual (`baseRadius * 3.2`, ver `buildQuasarDisk()`), no con la fórmula
   * heredada de un agujero negro normal (`radius*5`, mucho más grande que
   * lo que se ve). Pedido explícito del usuario (2026-07-24): "reduce el
   * radio de alcance del quasar, paso por arriba y me alcanza, que este a
   * la altura de sus anillos".
   */
  get attractionRadius() {
    return this.baseRadius * 3.2 * this.quasarConfig.attractionRadiusMultiplier;
  }

  get attractionForce() {
    return this.quasarConfig.attractionIntensity;
  }

  registerClick(): boolean {
    if (this.phase !== "active") return false;
    this.clicksRemaining = Math.max(0, this.clicksRemaining - 1);
    const scale = 0.4 + 0.6 * (this.clicksRemaining / this.clicksRequired);
    this.disk.scale.set(scale);
    this.core.scale.set(scale);
    if (this.clicksRemaining <= 0) {
      this.phase = "defeated";
      this.elapsed = 0;
      return true;
    }
    return false;
  }

  /**
   * Distancia del punto (px,py) al haz de luz más cercano — `Infinity` si el
   * Quasar no está activo. GameEngine la compara contra el radio del
   * jugador para aplicar daño — "los rayos... si te tocan te quita de a 2
   * vidas... nadie tiene defensa contra eso" (ver checkCollisions()).
   */
  distanceToBeam(px: number, py: number): number {
    if (this.phase !== "active") return Infinity;
    const dx = Math.cos(this.beamAngle);
    const dy = Math.sin(this.beamAngle);
    const d1 = pointToSegmentDistance(px, py, this.x, this.y, this.x + dx * BEAM_LENGTH, this.y + dy * BEAM_LENGTH);
    const d2 = pointToSegmentDistance(px, py, this.x, this.y, this.x - dx * BEAM_LENGTH, this.y - dy * BEAM_LENGTH);
    return Math.min(d1, d2) - BEAM_HALF_WIDTH;
  }

  update(deltaMS: number) {
    this.elapsed += deltaMS;

    if (this.phase === "attracting") {
      const t = smoothstep(Math.min(1, this.elapsed / ATTRACT_MS));
      this.ghostA.position.set(lerp(this.startA.x, this.midX, t), lerp(this.startA.y, this.midY, t));
      this.ghostB.position.set(lerp(this.startB.x, this.midX, t), lerp(this.startB.y, this.midY, t));
      // Discos girando mientras se acercan — más fiel a la referencia visual
      // real (dos discos de acreción rotando al aproximarse).
      this.ghostA.rotation += deltaMS * 0.0035;
      this.ghostB.rotation -= deltaMS * 0.003;
      if (t >= 1) {
        this.phase = "merging";
        this.elapsed = 0;
      }
      return;
    }

    if (this.phase === "merging") {
      const t = Math.min(1, this.elapsed / MERGE_MS);
      const spinRadius = this.baseRadius * 0.9 * (1 - t);
      const angle = t * Math.PI * 7; // varias vueltas rápidas antes de fusionarse
      this.ghostA.position.set(this.midX + Math.cos(angle) * spinRadius, this.midY + Math.sin(angle) * spinRadius);
      this.ghostB.position.set(this.midX - Math.cos(angle) * spinRadius, this.midY - Math.sin(angle) * spinRadius);
      this.ghostA.rotation += deltaMS * 0.012;
      this.ghostB.rotation -= deltaMS * 0.01;
      this.ghostA.alpha = 1 - t * 0.4;
      this.ghostB.alpha = 1 - t * 0.4;
      if (t >= 1) {
        this.phase = "active";
        this.elapsed = 0;
        this.x = this.midX;
        this.y = this.midY;
        this.clicksRequired = this.quasarConfig.clicksToDefeat;
        this.clicksRemaining = this.clicksRequired;
        this.ghostA.visible = false;
        this.ghostB.visible = false;
        this.disk.visible = true;
        this.core.visible = true;
        this.beams.visible = true;
        this.disk.position.set(this.x, this.y);
        this.core.position.set(this.x, this.y);
        this.beams.position.set(this.x, this.y);
        this.disk.scale.set(1);
        this.core.scale.set(1);
        // Dispara la explosión de polvo de colores neón en GameEngine —
        // pedido explícito del usuario: "que se vea como una explosion de
        // colores neon como polvo de colores y despues aparezca la
        // supernova".
        this.justActivatedFlag = true;
      }
      return;
    }

    if (this.phase === "active") {
      // Giro más lento, con una breve rampa de arranque — pedido explícito
      // del usuario (2026-07-24): "que no gire tan rapido un poco mas
      // lento" (antes giraba a velocidad plena desde el primer cuadro).
      const spinRamp = Math.min(1, this.elapsed / 1200);
      this.disk.rotation += deltaMS * 0.0009 * spinRamp;
      this.core.alpha = 0.75 + Math.abs(Math.sin(this.elapsed * 0.006)) * 0.25;
      // Parpadeo individual de cada punto de polvo de color — pedido
      // explícito del usuario: "que se vea que parpadeando esos anillos de
      // colores del quasar".
      for (const dot of this.dustDots) {
        dot.gfx.alpha = dot.baseAlpha + Math.sin(this.elapsed * 0.006 + dot.phase) * 0.35;
      }
      // Haz constante y giratorio — pedido explícito del usuario (2026-07-24):
      // "esos rayos que sacan son constantes... mientras el quasar va
      // girando obvio ese haz de luz se mueve".
      this.beamAngle += deltaMS * BEAM_ROTATION_SPEED;
      this.beams.rotation = this.beamAngle;
      this.beams.alpha = 0.85 + Math.abs(Math.sin(this.elapsed * 0.01)) * 0.15;
      return;
    }

    if (this.phase === "defeated") {
      const scale = Math.max(0, this.disk.scale.x - deltaMS / 450);
      this.disk.scale.set(scale);
      this.core.scale.set(scale);
      this.beams.alpha = Math.max(0, this.beams.alpha - deltaMS / 450);
      if (this.elapsed >= DEFEATED_MS) {
        this.phase = "idle";
        this.container.visible = false;
        this.disk.visible = false;
        this.core.visible = false;
        this.beams.visible = false;
        this.justDefeatedFlag = true;
      }
      return;
    }
  }
}
