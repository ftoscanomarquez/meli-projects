"use client";

import { useCallback, useRef, useState, type PointerEvent, type RefObject } from "react";

type DragPosition = { x: number; y: number };

// Por debajo de esto, un pointerup cuenta como clic, no arrastre — mismo
// valor/patrón ya probado en components/landing/PlanetSelector.tsx.
const DRAG_MOVE_THRESHOLD = 6;

/**
 * Arrastre táctil/mouse compartido para paneles flotantes del HUD (chat,
 * panel de equipo) — pedido explícito del usuario (2026-07-23): "que la
 * ventana que se abre se pueda mover de lugar arrastrandola para que el
 * jugador en mobile la pueda cambiar de lugar". `null` = sigue en su
 * posición CSS por defecto; una vez arrastrado, se fija con `left`/`top`
 * inline (clamado a los límites del viewport). Los handlers van en el
 * elemento "asa" (el encabezado del panel, que normalmente también
 * contiene un botón de cerrar).
 *
 * La captura del puntero se activa RECIÉN cuando el movimiento supera
 * `DRAG_MOVE_THRESHOLD`, no en el pointerdown — mismo bug real ya
 * documentado y corregido en `PlanetSelector.tsx` (ver RETROSPECTIVA.md):
 * capturar de inmediato, incluso sobre un botón hijo (el de cerrar), le
 * "roba" el clic al botón antes de que llegue a dispararse.
 */
export function useDraggablePanel(panelRef: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState<DragPosition | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
    pointerId: number;
    el: HTMLElement;
    captured: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      dragStart.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        originX: rect.left,
        originY: rect.top,
        pointerId: e.pointerId,
        el: e.currentTarget,
        captured: false,
      };
    },
    [panelRef],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent<HTMLElement>) => {
      const start = dragStart.current;
      if (!start) return;
      const dx = e.clientX - start.pointerX;
      const dy = e.clientY - start.pointerY;
      if (!start.captured) {
        if (Math.hypot(dx, dy) <= DRAG_MOVE_THRESHOLD) return; // todavía podría ser un clic
        start.captured = true;
        start.el.setPointerCapture(start.pointerId);
        setDragging(true);
      }
      const panel = panelRef.current;
      let x = start.originX + dx;
      let y = start.originY + dy;
      if (panel) {
        const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);
        x = Math.min(Math.max(0, x), maxX);
        y = Math.min(Math.max(0, y), maxY);
      }
      setPosition({ x, y });
    },
    [panelRef],
  );

  const onPointerUp = useCallback((e: PointerEvent<HTMLElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    if (start?.captured && e.currentTarget.hasPointerCapture(start.pointerId)) {
      e.currentTarget.releasePointerCapture(start.pointerId);
    }
  }, []);

  const style = position ? { left: position.x, top: position.y, right: "auto", bottom: "auto", transform: "none" } : undefined;

  return { style, dragging, handleProps: { onPointerDown, onPointerMove, onPointerUp } };
}
