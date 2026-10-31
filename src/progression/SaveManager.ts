/**
 * Persistent progress and settings in localStorage.
 * Only completed-stage results are stored. A stage in progress is never saved,
 * so quitting or closing mid-stage always restarts from the beginning.
 */
import type { Difficulty, HeroId, Language, QualityMode } from '../core/types';

export const SAVE_KEY = 'sheriff-labrador-sra.save.v1';
export const SAVE_VERSION = 1;

export interface Settings {
  language: Language;
  musicVolume: number;
  sfxVolume: number;
  /** null means "use the difficulty default". */
  autoJump: boolean | null;
  voiceHints: boolean | null;
  quality: QualityMode;
}

export interface StageRecord {
  completed: boolean;
  bestStars: number;
  totalStars: number;
  bestBonusStars: number;
  rating: number;
  rescued: boolean;
  completions: number;
}

export interface SaveData {
  version: number;
  settings: Settings;
  hero: HeroId;
  difficulty: Difficulty;
  stages: Record<string, StageRecord>;
  /** Highest stage number the player has unlocked. */
  unlockedStage: number;
  badges: string[];
  medals: string[];
}

export function defaultSave(): SaveData {
  const lang: Language =
    typeof navigator !== 'undefined' && /^ms|^id/i.test(navigator.language ?? '') ? 'ms' : 'en';
  return {
    version: SAVE_VERSION,
    settings: { language: lang, musicVolume: 0.6, sfxVolume: 0.8, autoJump: null, voiceHints: null, quality: 'auto' },
    hero: 'biscuit',
    difficulty: 'junior',
    stages: {},
    unlockedStage: 1,
    badges: [],
    medals: [],
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__slsra_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

const clamp01 = (v: unknown, d: number): number => (typeof v === 'number' && isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/** Merge untrusted stored JSON with defaults, dropping anything malformed. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData>;
  const s = (r.settings ?? {}) as Partial<Settings>;
  const out: SaveData = {
    version: SAVE_VERSION,
    settings: {
      language: s.language === 'ms' || s.language === 'en' ? s.language : d.settings.language,
      musicVolume: clamp01(s.musicVolume, d.settings.musicVolume),
      sfxVolume: clamp01(s.sfxVolume, d.settings.sfxVolume),
      autoJump: typeof s.autoJump === 'boolean' ? s.autoJump : null,
      voiceHints: typeof s.voiceHints === 'boolean' ? s.voiceHints : null,
      quality: s.quality === 'high' || s.quality === 'low' || s.quality === 'auto' ? s.quality : 'auto',
    },
    hero: r.hero === 'biscuit' || r.hero === 'pepper' || r.hero === 'poppy' ? r.hero : d.hero,
    difficulty: r.difficulty === 'explorer' || r.difficulty === 'junior' || r.difficulty === 'super' ? r.difficulty : d.difficulty,
    stages: {},
    unlockedStage: typeof r.unlockedStage === 'number' && r.unlockedStage >= 1 ? Math.min(15, Math.floor(r.unlockedStage)) : 1,
    badges: Array.isArray(r.badges) ? r.badges.filter((b): b is string => typeof b === 'string') : [],
    medals: Array.isArray(r.medals) ? r.medals.filter((b): b is string => typeof b === 'string') : [],
  };
  if (r.stages && typeof r.stages === 'object') {
    for (const [id, rec] of Object.entries(r.stages)) {
      if (!rec || typeof rec !== 'object') continue;
      const x = rec as Partial<StageRecord>;
      out.stages[id] = {
        completed: !!x.completed,
        bestStars: Number(x.bestStars) || 0,
        totalStars: Number(x.totalStars) || 0,
        bestBonusStars: Number(x.bestBonusStars) || 0,
        rating: Math.min(3, Math.max(0, Number(x.rating) || 0)),
        rescued: !!x.rescued,
        completions: Number(x.completions) || 0,
      };
    }
  }
  return out;
}

export interface StageResult {
  stageId: string;
  stageNumber: number;
  stars: number;
  totalStars: number;
  bonusStars: number;
  rescued: boolean;
  rating: number;
  badge?: string;
  medal?: string;
}

export class SaveManager {
  data: SaveData;
  private storage: StorageLike | null;

  constructor(storage: StorageLike | null = safeStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  private load(): SaveData {
    if (!this.storage) return defaultSave();
    try {
      const raw = this.storage.getItem(SAVE_KEY);
      return raw ? sanitize(JSON.parse(raw)) : defaultSave();
    } catch {
      return defaultSave();
    }
  }

  save(): boolean {
    if (!this.storage) return false;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  get hasProgress(): boolean {
    return Object.values(this.data.stages).some((s) => s.completed);
  }

  get totalStars(): number {
    return Object.values(this.data.stages).reduce((n, s) => n + s.bestStars + s.bestBonusStars, 0);
  }

  /** Record a completed stage, keep best results, unlock the next stage. */
  recordStageResult(r: StageResult): void {
    const prev = this.data.stages[r.stageId];
    this.data.stages[r.stageId] = {
      completed: true,
      bestStars: Math.max(prev?.bestStars ?? 0, r.stars),
      totalStars: r.totalStars,
      bestBonusStars: Math.max(prev?.bestBonusStars ?? 0, r.bonusStars),
      rating: Math.max(prev?.rating ?? 0, r.rating),
      rescued: (prev?.rescued ?? false) || r.rescued,
      completions: (prev?.completions ?? 0) + 1,
    };
    this.data.unlockedStage = Math.min(15, Math.max(this.data.unlockedStage, r.stageNumber + 1));
    if (r.badge && !this.data.badges.includes(r.badge)) this.data.badges.push(r.badge);
    if (r.medal && !this.data.medals.includes(r.medal)) this.data.medals.push(r.medal);
    this.save();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.save();
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = { ...defaultSave(), settings };
    this.save();
  }
}
