/**
 * Original procedural music and sound effects, synthesised with Web Audio.
 * No external audio files, so nothing to license. The AudioContext is only
 * created after a user gesture to respect browser autoplay rules.
 */
import { speechLang } from '../localization/i18n';

export type Sfx =
  | 'jump'
  | 'land'
  | 'star'
  | 'bonus'
  | 'checkpoint'
  | 'rescue'
  | 'meow'
  | 'celebrate'
  | 'button'
  | 'splash'
  | 'bounce'
  | 'badge'
  | 'locked';

export type Song = 'menu' | 'town' | 'victory';

interface SongDef {
  bpm: number;
  /** Eighth-note tokens: note name, '-' hold, '.' rest. */
  melody: string;
  /** One chord root per bar. */
  chords: string[];
  swing?: number;
}

const SONGS: Record<Song, SongDef> = {
  town: {
    bpm: 116,
    melody:
      'C5 E5 G5 E5 F5 A5 G5 - E5 G5 C6 G5 A5 G5 E5 - D5 F5 A5 F5 G5 F5 E5 D5 C5 E5 G5 E5 C5 - - . ' +
      'E5 E5 D5 C5 D5 - G4 - A4 C5 E5 D5 C5 - - . F5 F5 E5 D5 E5 G5 C6 - B5 A5 G5 F5 E5 D5 C5 - ',
    chords: ['C', 'F', 'C', 'Am', 'Dm', 'G', 'C', 'C', 'C', 'G', 'Am', 'Am', 'F', 'C', 'G', 'C'],
  },
  menu: {
    bpm: 96,
    melody: 'G4 - C5 E5 D5 - C5 - A4 - C5 - G4 - - . F4 - A4 C5 B4 - D5 - C5 - - - . . . . ',
    chords: ['C', 'F', 'G', 'C'],
  },
  victory: {
    bpm: 132,
    melody: 'C5 E5 G5 C6 - G5 C6 - E6 - - - . . . . ',
    chords: ['C', 'C'],
  },
};

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteToFreq(note: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(note);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const CHORD_TONES: Record<string, string[]> = {
  C: ['C3', 'E3', 'G3'],
  F: ['F2', 'A2', 'C3'],
  G: ['G2', 'B2', 'D3'],
  Am: ['A2', 'C3', 'E3'],
  Dm: ['D3', 'F3', 'A3'],
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private musicVolume = 0.6;
  private sfxVolume = 0.8;
  private song: Song | null = null;
  private songStep = 0;
  private nextNoteTime = 0;
  private timer: number | null = null;
  private suspendedByApp = false;
  voiceEnabled = false;

  /** Call from any user gesture handler. Safe to call repeatedly. */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      master.connect(comp).connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(master);
      this.sfxGain.connect(master);
      this.applyVolumes();
      const len = this.ctx.sampleRate * 0.5;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      if (this.song) this.startScheduler();
    }
    if (this.ctx.state === 'suspended' && !this.suspendedByApp) void this.ctx.resume();
  }

  get unlocked(): boolean {
    return !!this.ctx;
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(this.musicVolume * this.musicVolume * 0.32, now, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume * this.sfxVolume * 0.7, now, 0.02);
  }

  /** Pause all audio, e.g. when the tab is hidden. */
  suspend(): void {
    this.suspendedByApp = true;
    void this.ctx?.suspend();
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }

  resume(): void {
    this.suspendedByApp = false;
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  playMusic(song: Song | null): void {
    if (song === this.song) return;
    this.song = song;
    this.songStep = 0;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (song && this.ctx) this.startScheduler();
  }

  private startScheduler(): void {
    if (!this.ctx || this.timer !== null) return;
    this.nextNoteTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.song || ctx.state !== 'running') return;
    const def = SONGS[this.song];
    const tokens = def.melody.trim().split(/\s+/);
    const eighth = 60 / def.bpm / 2;
    while (this.nextNoteTime < ctx.currentTime + 0.15) {
      const step = this.songStep % tokens.length;
      const tok = tokens[step];
      if (tok !== '-' && tok !== '.') {
        let len = 1;
        while (tokens[(step + len) % tokens.length] === '-' && len < 8) len++;
        this.tone(noteToFreq(tok), this.nextNoteTime, eighth * len * 0.95, 'triangle', 0.42, this.musicGain);
      }
      const bar = Math.floor(step / 8) % def.chords.length;
      const chord = CHORD_TONES[def.chords[bar]] ?? CHORD_TONES.C;
      const inBar = step % 8;
      if (inBar % 2 === 0) {
        const bassNote = inBar === 4 ? chord[2] : chord[0];
        this.tone(noteToFreq(bassNote), this.nextNoteTime, eighth * 1.6, 'sine', 0.5, this.musicGain);
      }
      if (inBar === 2 || inBar === 6) {
        for (const n of chord) this.tone(noteToFreq(n) * 2, this.nextNoteTime, eighth * 0.6, 'sine', 0.09, this.musicGain);
      }
      if (this.song !== 'menu' && (inBar === 2 || inBar === 6)) this.hat(this.nextNoteTime);
      this.nextNoteTime += eighth;
      this.songStep++;
      if (this.song === 'victory' && this.songStep >= tokens.length) {
        this.playMusic(null);
        return;
      }
    }
  }

  private tone(
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    dest: AudioNode | null,
    slideTo?: number,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !dest || freq <= 0) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, at);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.02);
  }

  private hat(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.musicGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(hp).connect(g).connect(this.musicGain);
    src.start(at, Math.random() * 0.3, 0.06);
  }

  private noiseBurst(at: number, dur: number, freq: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.sfxGain) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(freq, at);
    bp.frequency.exponentialRampToValueAtTime(freq / 4, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(bp).connect(g).connect(this.sfxGain);
    src.start(at, 0, dur);
  }

  play(sfx: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const out = this.sfxGain;
    const seq = (notes: string[], step: number, dur: number, type: OscillatorType, vol: number) =>
      notes.forEach((n, i) => this.tone(noteToFreq(n), t + i * step, dur, type, vol, out));
    switch (sfx) {
      case 'jump':
        this.tone(330, t, 0.16, 'square', 0.12, out, 700);
        break;
      case 'land':
        this.noiseBurst(t, 0.08, 900, 0.18);
        break;
      case 'star':
        seq(['E6', 'B6'], 0.06, 0.18, 'sine', 0.35);
        break;
      case 'bonus':
        seq(['C6', 'E6', 'G6', 'C7'], 0.05, 0.2, 'sine', 0.3);
        break;
      case 'checkpoint':
        seq(['C5', 'E5', 'G5', 'C6'], 0.08, 0.25, 'triangle', 0.35);
        break;
      case 'rescue':
        seq(['G5', 'C6', 'E6', 'G6', 'E6', 'G6'], 0.09, 0.3, 'triangle', 0.32);
        break;
      case 'meow':
        this.tone(700, t, 0.12, 'sine', 0.25, out, 1100);
        this.tone(1100, t + 0.12, 0.22, 'sine', 0.22, out, 600);
        break;
      case 'celebrate':
        seq(['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.1, 0.35, 'square', 0.12);
        seq(['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.1, 0.35, 'triangle', 0.3);
        break;
      case 'badge':
        seq(['A5', 'C#6', 'E6', 'A6'], 0.07, 0.4, 'sine', 0.3);
        break;
      case 'button':
        this.tone(880, t, 0.07, 'sine', 0.25, out, 1320);
        break;
      case 'locked':
        this.tone(300, t, 0.12, 'triangle', 0.25, out, 220);
        break;
      case 'splash':
        this.noiseBurst(t, 0.45, 2400, 0.4);
        this.tone(500, t, 0.25, 'sine', 0.15, out, 180);
        break;
      case 'bounce':
        this.tone(160, t, 0.35, 'sine', 0.45, out, 620);
        break;
    }
  }

  /** Optional spoken hint, using the device's built-in voice if available. */
  speak(text: string): void {
    if (!this.voiceEnabled || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = speechLang();
      u.rate = 0.95;
      u.pitch = 1.25;
      u.volume = Math.max(0.2, this.sfxVolume);
      speechSynthesis.speak(u);
    } catch {
      /* speech is optional */
    }
  }
}
