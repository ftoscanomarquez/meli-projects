"use client";

import { useState } from "react";
import styles from "./Admin.module.css";

/**
 * Input numérico con separador de miles (1,000 en vez de 1000) — pedido
 * explícito del usuario (2026-07-22): "en las denominaciones como números
 * pon la coma cada 3 cifras para que sean más fáciles de leer". Los
 * `<input type="number">` nativos no soportan separadores de miles, así que
 * esto usa `type="text"` + `inputMode="decimal"`: mientras el campo tiene el
 * foco se ve el número "crudo" (fácil de editar), y fuera de foco se ve
 * formateado con comas — patrón estándar para este tipo de campo.
 *
 * `draft` es la fuente de verdad SOLO mientras se edita (no null); en reposo
 * el texto mostrado se deriva directo de `value` en cada render — así no
 * hace falta un `useEffect` sincronizando estado desde una prop (evita el
 * anti-patrón "setState dentro de un efecto", ver React docs).
 */
export function FormattedNumberInput({
  id,
  value,
  min,
  max,
  step,
  wide = false,
  onChange,
}: {
  id: string;
  value: number;
  min?: number;
  // Tope superior — agregado 2026-07-24 para los nuevos parámetros de
  // habilidades tipo "factor" (0-1, ver AGENTS.md §9): sin esto, el admin
  // podía teclear cualquier número en un campo pensado como porcentaje.
  max?: number;
  step?: number;
  wide?: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft !== null ? draft : formatNumber(value);

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      className={wide ? styles.fieldInputWide : styles.fieldInput}
      value={text}
      onFocus={() => setDraft(String(value))} // sin comas mientras se edita, más fácil de escribir
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const parsed = Number(raw.replace(/,/g, ""));
        if (raw.trim() !== "" && !Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => {
        const parsed = Number((draft ?? "").replace(/,/g, ""));
        let clamped = Number.isNaN(parsed) ? (min ?? 0) : Math.max(min ?? -Infinity, parsed);
        if (max !== undefined) clamped = Math.min(max, clamped);
        onChange(clamped);
        setDraft(null); // vuelve a mostrar `value` formateado, derivado del render
      }}
      {...(min !== undefined ? { min } : {})}
      {...(max !== undefined ? { max } : {})}
      {...(step !== undefined ? { step } : {})}
    />
  );
}

function formatNumber(n: number): string {
  if (Number.isNaN(n)) return "0";
  return n.toLocaleString("es-MX", { maximumFractionDigits: 3 });
}
