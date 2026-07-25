/**
 * Música de fondo — ver AGENTS.md §5.1 y feedback real del usuario (2026-07-22
 * y ronda posterior): la primera versión (pads largos, acordes sostenidos)
 * resultó "aburrida"/"me duerme" — se rediseña por completo a un estilo
 * chiptune/arcade ALEGRE: melodía en arpegio, acordes cortos ("stabs") en
 * vez de pads sostenidos, percusión simple (ruido filtrado) y tempo rápido.
 * Sigue siendo 100% sintetizado (Web Audio API, sin librerías ni archivos de
 * audio con licencia) y sigue rotando entre 4 melodías distintas — ahora de
 * forma verdaderamente aleatoria en cada vuelta, no cíclica fija.
 *
 * Además soporta que el jugador cargue su propia canción (mp3/wav/ogg/m4a)
 * desde `MusicPicker` — en ese modo se reproduce con un <audio> normal en
 * vez del sintetizador, ver `loadCustomTrack()`.
 */

type ChordName = "C" | "G" | "Am" | "F" | "D" | "Em" | "Dm" | "Bb";

const CHORDS: Record<ChordName, number[]> = {
  C: [261.63, 329.63, 392],
  G: [196, 246.94, 293.66],
  Am: [220, 261.63, 329.63],
  F: [174.61, 220, 261.63],
  D: [293.66, 369.99, 440],
  Em: [329.63, 392, 493.88],
  Dm: [293.66, 349.23, 440],
  Bb: [233.08, 293.66, 349.23],
};

type MusicTheme = {
  name: string;
  progression: ChordName[];
  chordDurationS: number;
  leadWave: OscillatorType;
  bassWave: OscillatorType;
  stabWave: OscillatorType;
  leadGainLevel: number;
  bassGainLevel: number;
  stabGainLevel: number;
  percGainLevel: number;
};

// 4 melodías alegres con carácter distinto — todas en modo mayor, tempo
// rápido, con arpegio + "stabs" de acorde en vez de pads sostenidos.
const THEMES: MusicTheme[] = [
  {
    name: "fiesta-espacial",
    progression: ["C", "G", "Am", "F"], // I-V-vi-IV, progresión "pop feliz" clásica
    chordDurationS: 1.8,
    leadWave: "square",
    bassWave: "triangle",
    stabWave: "triangle",
    leadGainLevel: 0.05,
    bassGainLevel: 0.09,
    stabGainLevel: 0.045,
    percGainLevel: 0.06,
  },
  {
    name: "arcade-turbo",
    progression: ["F", "C", "G", "C"], // IV-I-V-I, brillante y directa
    chordDurationS: 1.4,
    leadWave: "square",
    bassWave: "square",
    stabWave: "sawtooth",
    leadGainLevel: 0.045,
    bassGainLevel: 0.08,
    stabGainLevel: 0.04,
    percGainLevel: 0.07,
  },
  {
    name: "carnaval-cosmico",
    progression: ["G", "D", "Em", "C"], // I-V-vi-IV en tono de G, saltarín
    chordDurationS: 1.7,
    leadWave: "triangle",
    bassWave: "triangle",
    stabWave: "triangle",
    leadGainLevel: 0.055,
    bassGainLevel: 0.08,
    stabGainLevel: 0.05,
    percGainLevel: 0.05,
  },
  {
    name: "aventura-feliz",
    progression: ["C", "Am", "F", "G"], // I-vi-IV-V, aventura brillante
    chordDurationS: 1.6,
    leadWave: "square",
    bassWave: "triangle",
    stabWave: "square",
    leadGainLevel: 0.05,
    bassGainLevel: 0.085,
    stabGainLevel: 0.045,
    percGainLevel: 0.065,
  },
];

export const MUSIC_THEME_NAMES = THEMES.map((t) => t.name);

/** Elección del jugador en `MusicPicker` (ver AGENTS.md §4) — `undefined` = rotación aleatoria entre las 4 de siempre. */
export type MusicChoice = { type: "theme"; themeIndex: number } | { type: "custom"; file: File };

export class BackgroundMusic {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private leadGain: GainNode | null = null;
  private bassGain: GainNode | null = null;
  private stabGain: GainNode | null = null;
  private percGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private muted = false;
  private themeIndex = 0;
  // true cuando el jugador eligió una melodía específica en MusicPicker —
  // en ese caso se repite esa, no se rota aleatoriamente entre las 4.
  private fixedTheme = false;

  // Modo "canción propia" — reemplaza por completo al sintetizador.
  private customAudio: HTMLAudioElement | null = null;
  private customObjectUrl: string | null = null;

  get isPlaying() {
    return this.ctx !== null || this.customAudio !== null;
  }

  /** themeIndex opcional: si se pasa, esa melodía se repite fija; si no, rota al azar entre las 4 en cada vuelta. */
  start(themeIndex?: number) {
    if (this.isPlaying) return;
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return; // navegador sin Web Audio API — silencioso, no bloquea el juego
    this.ctx = new AudioContextCtor();
    this.fixedTheme = typeof themeIndex === "number";
    this.themeIndex = typeof themeIndex === "number" ? themeIndex % THEMES.length : Math.floor(Math.random() * THEMES.length);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.55;
    this.masterGain.connect(this.ctx.destination);

    this.leadGain = this.ctx.createGain();
    this.leadGain.connect(this.masterGain);
    this.bassGain = this.ctx.createGain();
    this.bassGain.connect(this.masterGain);
    this.stabGain = this.ctx.createGain();
    this.stabGain.connect(this.masterGain);
    this.percGain = this.ctx.createGain();
    this.percGain.connect(this.masterGain);

    this.noiseBuffer = this.buildNoiseBuffer(this.ctx);

    this.scheduleChord(0);
  }

  /** Carga y reproduce la canción propia del jugador (mp3/wav/ogg/m4a, etc.) en loop, reemplazando al sintetizador. */
  loadCustomTrack(file: File) {
    this.stop();
    const url = URL.createObjectURL(file);
    this.customObjectUrl = url;
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = this.muted ? 0 : 0.5;
    void audio.play().catch(() => {
      // Bloqueado por la política de autoplay hasta el próximo gesto del
      // usuario — resume() lo reintenta.
    });
    this.customAudio = audio;
  }

  private scheduleChord(chordIndexInTheme: number) {
    if (!this.ctx || !this.leadGain || !this.bassGain || !this.stabGain || !this.percGain) return;
    const theme = THEMES[this.themeIndex];
    const chord = theme.progression[chordIndexInTheme % theme.progression.length];
    const startTime = this.ctx.currentTime + 0.05;

    this.leadGain.gain.value = theme.leadGainLevel;
    this.bassGain.gain.value = theme.bassGainLevel;
    this.stabGain.gain.value = theme.stabGainLevel;
    this.percGain.gain.value = theme.percGainLevel;

    this.playChordStabs(chord, startTime, theme.chordDurationS, theme.stabWave);
    this.playLeadArpeggio(chord, startTime, theme.chordDurationS, theme.leadWave);
    this.playBassPulses(chord, startTime, theme.chordDurationS, theme.bassWave);
    this.playPercussion(startTime, theme.chordDurationS);

    const isLastChordOfTheme = chordIndexInTheme % theme.progression.length === theme.progression.length - 1;
    this.schedulerTimer = setTimeout(() => {
      if (isLastChordOfTheme) {
        // Termina la progresión completa de esta melodía. Si el jugador
        // eligió una específica, se repite; si no, salta a otra al azar
        // (puede repetirse — aleatorio real, no un ciclo fijo 0→1→2→3).
        this.themeIndex = this.fixedTheme ? this.themeIndex : Math.floor(Math.random() * THEMES.length);
        this.scheduleChord(0);
      } else {
        this.scheduleChord(chordIndexInTheme + 1);
      }
    }, theme.chordDurationS * 1000);
  }

  /** Acordes cortos y "golpeados" en vez de un pad sostenido — le da el rebote alegre. */
  private playChordStabs(chord: ChordName, startTime: number, duration: number, wave: OscillatorType) {
    if (!this.ctx || !this.stabGain) return;
    const stabTimes = [startTime, startTime + duration / 2];
    for (const t of stabTimes) {
      for (const freq of CHORDS[chord]) {
        const osc = this.ctx.createOscillator();
        osc.type = wave;
        osc.frequency.value = freq;

        const envelope = this.ctx.createGain();
        envelope.gain.setValueAtTime(0, t);
        envelope.gain.linearRampToValueAtTime(1, t + 0.015);
        envelope.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.42);

        osc.connect(envelope);
        envelope.connect(this.stabGain);
        osc.start(t);
        osc.stop(t + duration * 0.45);
      }
    }
  }

  /** Melodía en arpegio (raíz-quinta-tercera-quinta), una octava arriba del acorde — el gancho "feliz". */
  private playLeadArpeggio(chord: ChordName, startTime: number, duration: number, wave: OscillatorType) {
    if (!this.ctx || !this.leadGain) return;
    const [root, third, fifth] = CHORDS[chord];
    const pattern = [root, fifth, third, fifth, root, fifth, third, fifth].map((f) => f * 2);
    const noteS = duration / pattern.length;
    pattern.forEach((freq, i) => {
      const t = startTime + i * noteS;
      const osc = this.ctx!.createOscillator();
      osc.type = wave;
      osc.frequency.value = freq;

      const envelope = this.ctx!.createGain();
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(1, t + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.001, t + noteS * 0.85);

      osc.connect(envelope);
      envelope.connect(this.leadGain!);
      osc.start(t);
      osc.stop(t + noteS);
    });
  }

  private playBassPulses(chord: ChordName, startTime: number, duration: number, wave: OscillatorType) {
    if (!this.ctx || !this.bassGain) return;
    const root = CHORDS[chord][0] / 2;
    const noteS = duration / 4;
    for (let i = 0; i < 4; i++) {
      const t = startTime + i * noteS;
      const osc = this.ctx.createOscillator();
      osc.type = wave;
      osc.frequency.value = root;

      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(1, t + 0.015);
      envelope.gain.exponentialRampToValueAtTime(0.001, t + noteS * 0.8);

      osc.connect(envelope);
      envelope.connect(this.bassGain);
      osc.start(t);
      osc.stop(t + noteS);
    }
  }

  /** "Hi-hat" simple con ruido filtrado — le da el pulso rítmico que un pad sostenido no tiene. */
  private playPercussion(startTime: number, duration: number) {
    if (!this.ctx || !this.percGain || !this.noiseBuffer) return;
    const hits = 8;
    const noteS = duration / hits;
    for (let i = 0; i < hits; i++) {
      const t = startTime + i * noteS;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 6000;

      const envelope = this.ctx.createGain();
      envelope.gain.setValueAtTime(0, t);
      envelope.gain.linearRampToValueAtTime(1, t + 0.002);
      envelope.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

      src.connect(filter);
      filter.connect(envelope);
      envelope.connect(this.percGain);
      src.start(t);
      src.stop(t + 0.05);
    }
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Los navegadores crean el AudioContext/<audio> "suspendido" sin un gesto previo del usuario. */
  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
    if (this.customAudio?.paused) void this.customAudio.play().catch(() => {});
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.15);
    }
    if (this.customAudio) {
      this.customAudio.volume = muted ? 0 : 0.5;
    }
  }

  stop() {
    if (this.schedulerTimer) clearTimeout(this.schedulerTimer);
    this.schedulerTimer = null;
    if (this.ctx) {
      void this.ctx.close();
    }
    this.ctx = null;
    this.masterGain = null;
    this.leadGain = null;
    this.bassGain = null;
    this.stabGain = null;
    this.percGain = null;
    this.noiseBuffer = null;

    if (this.customAudio) {
      this.customAudio.pause();
      this.customAudio.src = "";
      this.customAudio = null;
    }
    if (this.customObjectUrl) {
      URL.revokeObjectURL(this.customObjectUrl);
      this.customObjectUrl = null;
    }
  }
}
