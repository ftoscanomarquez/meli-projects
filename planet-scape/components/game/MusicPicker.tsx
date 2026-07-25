"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { MUSIC_THEME_NAMES, type MusicChoice } from "@/engine/audio/backgroundMusic";
import styles from "./MusicPicker.module.css";

const THEME_EMOJI: Record<string, string> = {
  "fiesta-espacial": "🎉",
  "arcade-turbo": "🕹️",
  "carnaval-cosmico": "🎪",
  "aventura-feliz": "🚀",
};

const ACCEPTED_AUDIO = "audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/x-m4a,audio/mp4,audio/aac,audio/*";

/**
 * Pantalla "antes de jugar" para elegir la música de fondo — pedido
 * explícito del usuario (2026-07-22): la música procedural por defecto le
 * pareció aburrida, y además quiere poder subir su propia canción (mp3 y
 * otros formatos comunes) en vez de/además de las 4 melodías del juego. Ver
 * AGENTS.md §4/§6.4 y engine/audio/backgroundMusic.ts.
 */
export function MusicPicker({ onConfirm }: { onConfirm: (choice: MusicChoice | undefined) => void }) {
  const t = useTranslations("Game");
  const router = useRouter();
  const [themeIndex, setThemeIndex] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith("audio/")) {
      setFileError(t("musicPickerInvalidFile"));
      setFile(null);
      return;
    }
    setFileError(null);
    setFile(picked);
    setThemeIndex(null);
  };

  const selectTheme = (index: number) => {
    setThemeIndex(index);
    setFile(null);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePlay = () => {
    if (file) onConfirm({ type: "custom", file });
    else if (themeIndex !== null) onConfirm({ type: "theme", themeIndex });
    else onConfirm(undefined); // sin elegir: rotación aleatoria entre las 4 de siempre
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        {/* Pedido explícito del usuario (2026-07-22): "todos deben poder
            tener una salida... ya que me creas unos modales que a veces no
            se cierran" — antes esta pantalla no tenía forma de salir salvo
            el botón "atrás" del navegador. */}
        <button type="button" className={styles.closeButton} aria-label={t("backToMenu")} onClick={() => router.push("/")}>
          ✕
        </button>
        <h2 className={styles.title}>{t("musicPickerTitle")}</h2>
        <p className={styles.hint}>{t("musicPickerHint")}</p>

        <div className={styles.themeGrid}>
          {MUSIC_THEME_NAMES.map((name, i) => (
            <button
              key={name}
              type="button"
              className={styles.themeButton}
              data-selected={themeIndex === i}
              onClick={() => selectTheme(i)}
            >
              <span className={styles.themeEmoji}>{THEME_EMOJI[name] ?? "🎵"}</span>
              <span className={styles.themeName}>{t(`musicTheme_${name.replace(/-/g, "_")}`)}</span>
            </button>
          ))}
        </div>

        <div className={styles.uploadRow}>
          <button type="button" className={styles.uploadButton} onClick={() => fileInputRef.current?.click()}>
            📁 {t("musicPickerUpload")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_AUDIO}
            onChange={handleFileChange}
            className={styles.hiddenFileInput}
            aria-label={t("musicPickerUpload")}
          />
          {file && <span className={styles.fileName}>🎵 {file.name}</span>}
        </div>
        {fileError && <p className={styles.fileError}>{fileError}</p>}
        <p className={styles.formatsHint}>{t("musicPickerFormats")}</p>

        <button type="button" className={styles.playButton} onClick={handlePlay}>
          {t("musicPickerPlay")}
        </button>
      </div>
    </div>
  );
}
