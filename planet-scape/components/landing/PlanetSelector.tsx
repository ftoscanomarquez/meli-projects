"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Mercury } from "@/components/characters/Mercury";
import { Venus } from "@/components/characters/Venus";
import { Earth } from "@/components/characters/Earth";
import { Mars } from "@/components/characters/Mars";
import { Jupiter } from "@/components/characters/Jupiter";
import { Saturn } from "@/components/characters/Saturn";
import { Neptune } from "@/components/characters/Neptune";
import { PlanetInfoModal } from "./PlanetInfoModal";
import { Link } from "@/i18n/navigation";
import { useGlobalContext } from "@/lib/context/GlobalContext";
import { PLANET_UNLOCK_COSTS } from "@/lib/planetUnlocks";
import type { PlanetKey, PremiumPlanetKey } from "@/engine/characterSvg";
import styles from "./PlanetSelector.module.css";

const STARTER_PLANETS = [
  { key: "mercury", Character: Mercury, accent: "var(--mercury)" },
  { key: "venus", Character: Venus, accent: "var(--venus)" },
  { key: "earth", Character: Earth, accent: "var(--earth)" },
  { key: "mars", Character: Mars, accent: "var(--mars)" },
] as const;

// Desbloqueables con estrellas — pedido real del usuario (2026-07-22):
// Júpiter 1000 ⭐, Saturno 1200 ⭐. Neptuno agregado 2026-07-23, el más caro
// (3500 ⭐, ver lib/planetUnlocks.ts).
const PREMIUM_PLANETS = [
  { key: "jupiter", Character: Jupiter, accent: "var(--jupiter)" },
  { key: "saturn", Character: Saturn, accent: "var(--saturn)" },
  { key: "neptune", Character: Neptune, accent: "var(--neptune)" },
] as const satisfies readonly { key: PremiumPlanetKey; Character: typeof Jupiter; accent: string }[];

type CarouselItem = { key: PlanetKey; Character: typeof Mercury; accent: string; premium: boolean };

const ALL_ITEMS: CarouselItem[] = [
  ...STARTER_PLANETS.map((p) => ({ ...p, premium: false })),
  ...PREMIUM_PLANETS.map((p) => ({ ...p, premium: true })),
];
const ANGLE_STEP = 360 / ALL_ITEMS.length;

const DRAG_SENSITIVITY = 0.5; // grados por px arrastrado (clic y arrastra)
// Pasar el mouse por encima ya gira el carrusel de verdad (sin necesitar
// clic) — pedido explícito del usuario (2026-07-22): "debe ser más rápido...
// se debe mover conforme la dirección del mouse... que te permita
// seleccionar más elementos del carrusel". Es movimiento DIRECTO (grados
// por px de `movementX`), no un tope de inclinación como el primer intento.
const HOVER_SENSITIVITY = 0.75;
// Tope por evento de mousemove — sin esto, un salto grande de un solo
// evento (el cursor "entrando" de golpe al área, un movimiento muy rápido)
// gira tanto de una vez que el planeta se corre justo cuando intentas darle
// clic. Con el tope, el giro sigue siendo rápido en un barrido continuo
// (muchos eventos pequeños se suman), pero nunca "teletransporta".
const MAX_HOVER_DELTA_PER_EVENT = 6;
const HOVER_DEADZONE_PX = 16;
// Cuánto esperar sin recibir un nuevo mousemove antes de asumir que el
// cursor se detuvo (sin salir del carrusel) y empezar el "coast".
const IDLE_COAST_DELAY_MS = 70;
const DRAG_MOVE_THRESHOLD = 6; // px — por debajo de esto, un pointerup cuenta como clic, no arrastre
// "Como una ruleta": al soltar/salir, sigue girando por su propio impulso y
// se frena gradual — no un tope duro a 0. Factor de fricción por frame
// (~60fps): decae a ~5% del impulso inicial en poco menos de 1s.
const COAST_FRICTION = 0.945;
const COAST_MIN_VELOCITY = 0.02; // deg/frame — debajo de esto se considera detenido
const SNAP_TRANSITION = "transform 0.5s cubic-bezier(0.22, 0.8, 0.24, 1), opacity 0.5s ease";
const MIN_SCALE = 0.5;
const MIN_OPACITY = 0.4;

/** Diferencia angular más corta (en grados) para llevar `current` hacia `target`, sin dar la vuelta larga. */
function shortestRotation(current: number, target: number): number {
  const diff = ((target - current + 540) % 360) - 180;
  return current + diff;
}

/**
 * Carrusel elíptico de planetas — pedido explícito del usuario (2026-07-22):
 * "que se pueda mover conforme pase el mouse sobre y/o dando clic y
 * arrastrando... los elegibles según haya dado vuelta... los otros
 * elementos se van hacia atrás y se reducen mientras están en la parte de
 * atrás del óvalo elíptico". Los 6 planetas (4 iniciales + 2 premium) viven
 * en un óvalo virtual: el de adelante (más grande, más opaco) es el
 * candidato a elegir; los de atrás se encogen y se apagan un poco según su
 * "profundidad" en la elipse — todo calculado en 2D (translate+scale), sin
 * `perspective` CSS, para mantenerlo simple y predecible entre navegadores.
 * Fase 4 (Habilidades Completas — AGENTS.md §5): los 4 iniciales ya tienen
 * su habilidad completa. Júpiter/Saturno se compran con estrellas — flujo
 * de desbloqueo sin cambios, ver §5.2/§9 y app/api/planets/unlock/route.ts.
 */
export function PlanetSelector({ playCounts = {} }: { playCounts?: Record<string, number> }) {
  const t = useTranslations("Landing");
  const tPlanets = useTranslations("Planets");
  const { session, setSession } = useGlobalContext();
  const [selected, setSelected] = useState<PlanetKey | null>(null);
  // Sección informativa por planeta — pedido explícito del usuario
  // (2026-07-23): datos reales + habilidades individuales/en equipo, ver
  // PlanetInfoModal.tsx.
  const [infoPlanet, setInfoPlanet] = useState<PlanetKey | null>(null);
  const [confirming, setConfirming] = useState<PremiumPlanetKey | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  const unlockedPlanets = session?.unlockedPlanets ?? [];

  // --- Carrusel: `rotation` es la única fuente de verdad de hacia dónde
  // apunta. Tres formas de moverlo: (1) pasar el mouse por encima gira
  // directamente en la dirección del cursor, sin necesitar clic; (2) clic y
  // arrastrar, igual de directo pero más deliberado; (3) al soltar o salir
  // del área, sigue girando por impulso y se frena gradual ("como una
  // ruleta" — pedido explícito del usuario, 2026-07-22), en vez de
  // detenerse de golpe. ---
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(320);
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const dragStartRef = useRef<{ x: number; rotation: number; pointerId: number; el: HTMLDivElement } | null>(null);
  const wasDraggingRef = useRef(false);
  const velocityRef = useRef(0); // deg/frame — impulso actual, usado por el "coast"
  const coastFrameRef = useRef<number | null>(null);
  const snapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Zona muerta de entrada del hover — bug real encontrado en vivo
  // (2026-07-22): sin esto, el simple gesto de acercar el cursor a un
  // planeta para darle clic ya lo giraba lo suficiente (incluso limitado
  // por evento) para que el clic cayera fuera de él. Solo empieza a girar
  // una vez que el movimiento NETO desde que el cursor entró/se detuvo
  // supera `HOVER_DEADZONE_PX` — un barrido real lo supera enseguida, un
  // simple acercarse a dar clic no.
  const hoverOriginXRef = useRef<number | null>(null);
  const hoverActiveRef = useRef(false);
  // Si el mouse se DETIENE (sin salir del carrusel) tras un barrido rápido
  // pero corto, antes se frenaba de golpe — bug real reportado en vivo
  // (2026-07-22): "el carrusel sigue girando y se detiene poco a poco" es
  // lo esperado incluso sin salir del área. Este timer detecta esa pausa
  // (ver IDLE_COAST_DELAY_MS) y arranca el "coast"; cualquier movimiento
  // nuevo lo cancela y retoma control directo.
  const idleCoastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setViewportWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stopCoast = () => {
    if (coastFrameRef.current !== null) {
      cancelAnimationFrame(coastFrameRef.current);
      coastFrameRef.current = null;
    }
  };

  const clearIdleCoastTimer = () => {
    if (idleCoastTimerRef.current) {
      clearTimeout(idleCoastTimerRef.current);
      idleCoastTimerRef.current = null;
    }
  };

  // Deja que gire un poco más por su cuenta y se vaya frenando — un tope
  // duro a velocidad 0 se sentía "cortado", no como una ruleta real.
  const startCoast = () => {
    stopCoast();
    if (Math.abs(velocityRef.current) < COAST_MIN_VELOCITY) return;
    const step = () => {
      velocityRef.current *= COAST_FRICTION;
      if (Math.abs(velocityRef.current) < COAST_MIN_VELOCITY) {
        velocityRef.current = 0;
        coastFrameRef.current = null;
        return;
      }
      setRotation((r) => r + velocityRef.current);
      coastFrameRef.current = requestAnimationFrame(step);
    };
    coastFrameRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    return () => {
      stopCoast();
      clearIdleCoastTimer();
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    };
  }, []);

  // Ojo: la captura del puntero se activa RECIÉN cuando el arrastre supera
  // el umbral (`DRAG_MOVE_THRESHOLD`), no en el pointerdown — bug real
  // encontrado en vivo (2026-07-22): capturar el puntero de inmediato sobre
  // el contenedor, incluso cuando el pointerdown ocurría sobre un botón
  // hijo, le "robaba" el clic al carrusel antes de que llegara al botón y
  // el usuario se quedaba sin poder elegir ningún planeta. Con captura
  // perezosa, un clic simple (sin movimiento) nunca activa el modo
  // arrastre y el botón recibe su `click` normalmente.
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    stopCoast();
    clearIdleCoastTimer();
    setSnapping(false);
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    dragStartRef.current = { x: e.clientX, rotation, pointerId: e.pointerId, el: e.currentTarget };
    wasDraggingRef.current = false;
    hoverOriginXRef.current = null;
    hoverActiveRef.current = false;
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      if (!wasDraggingRef.current) {
        if (Math.abs(dx) <= DRAG_MOVE_THRESHOLD) return; // todavía podría ser un clic — no hacer nada aún
        wasDraggingRef.current = true;
        setDragging(true);
        dragStartRef.current.el.setPointerCapture(dragStartRef.current.pointerId);
      }
      velocityRef.current = e.movementX * DRAG_SENSITIVITY;
      setRotation(dragStartRef.current.rotation + dx * DRAG_SENSITIVITY);
      return;
    }
    // Girar solo con pasar el mouse (sin clic): directo y rápido, solo
    // mouse — no aplica a touch, mismo patrón que separa mouse/touch en
    // engine/controls/InputController.ts. Ver HOVER_DEADZONE_PX arriba:
    // acercarse a dar clic no debe contar como "barrer para girar".
    if (e.pointerType === "mouse") {
      // Si el carrusel ya está girando por impulso (coast en curso), un
      // simple movimiento del mouse — incluso en sentido contrario — NO
      // debe interrumpirlo ni pelear contra el impulso; pedido explícito
      // del usuario (2026-07-24): "si ya se movio con el mouse rapidamente
      // y agarro velocidad que no se detenga aunque el mouse cambie a la
      // izquierda o a la derecha... que siga girando... hasta que haga clic
      // para detenerlo o se detenga solo... solo se mueve rapidamente si ya
      // estaba el carrusel en reposo". El control directo por hover solo
      // aplica quien el carrusel está en reposo (sin coast activo) — un
      // clic (`handlePointerDown` ya llama `stopCoast()`) sigue pudiendo
      // detenerlo en cualquier momento.
      if (coastFrameRef.current !== null) return;
      if (hoverOriginXRef.current === null) hoverOriginXRef.current = e.clientX;
      if (!hoverActiveRef.current) {
        if (Math.abs(e.clientX - hoverOriginXRef.current) < HOVER_DEADZONE_PX) return;
        hoverActiveRef.current = true;
      }
      clearIdleCoastTimer();
      const rawDelta = e.movementX * HOVER_SENSITIVITY;
      const delta = Math.max(-MAX_HOVER_DELTA_PER_EVENT, Math.min(MAX_HOVER_DELTA_PER_EVENT, rawDelta));
      velocityRef.current = delta;
      setRotation((r) => r + delta);
      // Si no llega otro mousemove pronto, el cursor se detuvo (sin salir
      // del carrusel) — arranca el "coast" en vez de quedarse quieto de
      // golpe. Cualquier movimiento nuevo cancela este timer y lo reprograma.
      idleCoastTimerRef.current = setTimeout(() => {
        idleCoastTimerRef.current = null;
        startCoast();
      }, IDLE_COAST_DELAY_MS);
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging && e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
    dragStartRef.current = null;
    if (wasDraggingRef.current) {
      clearIdleCoastTimer();
      startCoast(); // solo si de verdad hubo arrastre — un clic simple no debe dejar girando
    }
  };

  const handlePointerLeave = () => {
    dragStartRef.current = null;
    setDragging(false);
    hoverOriginXRef.current = null;
    hoverActiveRef.current = false;
    clearIdleCoastTimer();
    startCoast(); // el cursor sale del área: sigue girando (si traía impulso) y se frena solo
  };

  const handlePremiumClick = (planet: PremiumPlanetKey) => {
    setStatusMessage(null);
    if (unlockedPlanets.includes(planet)) {
      setSelected(planet);
      return;
    }
    if (!session) {
      setStatusMessage(t("premiumNeedsLogin"));
      return;
    }
    const cost = PLANET_UNLOCK_COSTS[planet];
    if (session.stars < cost) {
      setStatusMessage(t("premiumInsufficientStars", { cost, stars: session.stars }));
      return;
    }
    setConfirming(planet);
  };

  const handleItemClick = (item: CarouselItem, index: number) => {
    // Un arrastre que termina sobre un planeta no debe además "elegirlo" —
    // mismo problema que se resolvió para el mouse del juego (ver
    // RETROSPECTIVA.md), aquí aplicado al carrusel de la landing.
    if (wasDraggingRef.current) return;
    stopCoast();
    clearIdleCoastTimer();
    velocityRef.current = 0;
    // Único momento en que SÍ queremos una transición CSS suave (el resto
    // del tiempo se mueve por JS a 60fps, y una transición ahí lo hacía
    // sentir lento — ver comentario junto a SNAP_TRANSITION).
    setSnapping(true);
    if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
    snapTimeoutRef.current = setTimeout(() => setSnapping(false), 550);
    setRotation((current) => shortestRotation(current, -(index * ANGLE_STEP)));
    if (item.premium) handlePremiumClick(item.key as PremiumPlanetKey);
    else {
      setStatusMessage(null);
      setSelected(item.key);
    }
  };

  const confirmUnlock = async () => {
    if (!confirming || !session) return;
    setUnlocking(true);
    try {
      const res = await fetch("/api/planets/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planet: confirming }),
      });
      const body = await res.json();
      if (!res.ok) {
        setStatusMessage(body.error ?? t("premiumUnlockError"));
        setConfirming(null);
        return;
      }
      setSession({ ...session, stars: body.stars, unlockedPlanets: [...unlockedPlanets, confirming] });
      setSelected(confirming);
      setConfirming(null);
    } catch {
      setStatusMessage(t("premiumUnlockError"));
      setConfirming(null);
    } finally {
      setUnlocking(false);
    }
  };

  const radiusX = viewportWidth * 0.36;
  const radiusY = viewportWidth * 0.1;
  const cardSize = Math.round(Math.min(126, Math.max(58, viewportWidth * 0.2)));

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>{t("chooseYourPlanet")}</h2>
      <p className={styles.hint}>{t("choosePlanetHint")}</p>

      <div
        ref={viewportRef}
        className={styles.carouselViewport}
        data-dragging={dragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerLeave}
      >
        {ALL_ITEMS.map((item, i) => {
          const baseAngle = i * ANGLE_STEP;
          const angle = baseAngle + rotation;
          const rad = (angle * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const depth = (cos + 1) / 2; // 0 = fondo del óvalo, 1 = frente
          // Redondeado a un par de decimales: evita un warning de hidratación
          // real visto en pruebas (el navegador reformatea floats largos al
          // serializar el atributo `style`, y React comparaba esa versión
          // redondeada contra el valor sin redondear del primer render).
          const x = Math.round(sin * radiusX * 100) / 100;
          const y = Math.round(cos * radiusY * 100) / 100;
          const scale = Math.round((MIN_SCALE + (1 - MIN_SCALE) * depth) * 1000) / 1000;
          const opacity = Math.round((MIN_OPACITY + (1 - MIN_OPACITY) * depth) * 1000) / 1000;
          const unlocked = !item.premium || unlockedPlanets.includes(item.key);
          const isSelected = selected === item.key;

          return (
            <button
              key={item.key}
              type="button"
              className={styles.planetButton}
              data-selected={isSelected}
              data-locked={item.premium && !unlocked}
              style={{
                ["--ring-color" as string]: item.accent,
                transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
                opacity,
                zIndex: Math.round(depth * 100),
                width: cardSize,
                transition: snapping ? SNAP_TRANSITION : "none",
              }}
              onClick={() => handleItemClick(item, i)}
              aria-pressed={isSelected}
            >
              <div className={styles.premiumWrap}>
                <item.Character size={cardSize} />
                {item.premium && !unlocked && (
                  <span className={styles.lockBadge}>🔒 {PLANET_UNLOCK_COSTS[item.key as PremiumPlanetKey]}⭐</span>
                )}
                {/* Esquina superior derecha de la tarjeta: ícono de
                    información + contador de popularidad juntos — pedido
                    explícito del usuario (2026-07-24): antes había un solo
                    botón "Sobre {planeta}" debajo de todo el carrusel que
                    solo abría información del planeta al frente; ahora cada
                    tarjeta tiene su propio ícono ℹ️, a la izquierda de su
                    propio ❤️ de popularidad. `stopPropagation` evita que el
                    clic en el ícono también seleccione la tarjeta completa
                    (el ícono vive dentro del <button> de la tarjeta). */}
                <span className={styles.cornerBadges}>
                  <span
                    role="button"
                    tabIndex={0}
                    className={styles.infoIcon}
                    aria-label={t("infoButtonLabel", { planet: tPlanets(item.key) })}
                    onClick={(e) => {
                      e.stopPropagation();
                      setInfoPlanet(item.key);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      e.stopPropagation();
                      setInfoPlanet(item.key);
                    }}
                  >
                    ℹ️
                  </span>
                  {!!playCounts[item.key] && (
                    <span className={styles.playCountBadge}>❤️ {playCounts[item.key]}</span>
                  )}
                </span>
              </div>
              <span className={styles.planetName}>{tPlanets(item.key)}</span>
            </button>
          );
        })}
      </div>

      {statusMessage && <p className={styles.statusMessage}>{statusMessage}</p>}

      <div className={styles.ctaArea}>
        {selected && (
          <div className={styles.ctaCard}>
            <p className={styles.selectedLabel}>{t("selected", { planet: tPlanets(selected) })}</p>
            <Link href={{ pathname: "/lobby", query: { planet: selected } }} className={styles.playButton}>
              {t("playAs", { planet: tPlanets(selected) })}
            </Link>
          </div>
        )}
      </div>

      {infoPlanet && <PlanetInfoModal planet={infoPlanet} onClose={() => setInfoPlanet(null)} />}

      {confirming && (
        <div className={styles.confirmOverlay} role="dialog" aria-modal="true">
          <div className={styles.confirmCard}>
            <p className={styles.confirmText}>
              {t("premiumConfirm", { planet: tPlanets(confirming), cost: PLANET_UNLOCK_COSTS[confirming] })}
            </p>
            <div className={styles.confirmActions}>
              <button type="button" className={styles.confirmNo} onClick={() => setConfirming(null)} disabled={unlocking}>
                {t("premiumConfirmNo")}
              </button>
              <button type="button" className={styles.confirmYes} onClick={confirmUnlock} disabled={unlocking}>
                {unlocking ? t("premiumUnlocking") : t("premiumConfirmYes")}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
