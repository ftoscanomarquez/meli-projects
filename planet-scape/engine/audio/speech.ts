/**
 * Frase épica de derrota narrada en voz — pedido explícito del usuario
 * (2026-07-22): "¿qué tan difícil sería que esas frases épicas se
 * escucharan en una voz de audio?". Nada difícil: el navegador ya trae un
 * sintetizador de voz nativo (Web Speech API, `SpeechSynthesisUtterance`) —
 * cero archivos de audio con licencia que gestionar, mismo criterio que la
 * música de fondo 100% sintetizada (ver AGENTS.md §4). Advertencia honesta:
 * la calidad/disponibilidad de voces varía por navegador/dispositivo (no
 * todos tienen una voz en español instalada) — se degrada en silencio si no
 * hay soporte, nunca truena el juego.
 */
export function speakDefeatPhrase(phrase: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  try {
    // Cancela cualquier narración anterior todavía en curso (ej. el
    // jugador murió, reinició rápido y volvió a morir) antes de hablar.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = "es-MX";
    // Un poco más grave y lento que el default — se siente más "dramático/
    // épico" que la voz plana por defecto, sin llegar a ser ininteligible.
    utterance.pitch = 0.85;
    utterance.rate = 0.95;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Sin soporte real (o navegador que lo bloquea) — puramente cosmético,
    // el texto de la frase ya se muestra igual en pantalla.
  }
}

export function stopDefeatSpeech() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // no-op
  }
}
