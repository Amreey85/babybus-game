import { describe, expect, it } from 'vitest';
import { SaveManager, SAVE_KEY, sanitize, type StorageLike } from '../../src/progression/SaveManager';
import { starRating } from '../../src/progression/rewards';

class MemStorage implements StorageLike {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const result = (stars: number, bonus = 0, rescued = true) => ({
  stageId: 'stage1',
  stageNumber: 1,
  stars,
  totalStars: 28,
  bonusStars: bonus,
  rescued,
  rating: starRating(stars, 28, rescued),
  badge: rescued ? 'badge.kitten' : undefined,
  medal: 'medal.stage1',
});

describe('SaveManager', () => {
  it('starts with defaults and no progress', () => {
    const s = new SaveManager(new MemStorage());
    expect(s.hasProgress).toBe(false);
    expect(s.data.unlockedStage).toBe(1);
    expect(s.totalStars).toBe(0);
  });

  it('records a completed stage, unlocks stage 2 and persists', () => {
    const store = new MemStorage();
    const s = new SaveManager(store);
    s.recordStageResult(result(20, 1));
    expect(s.data.unlockedStage).toBe(2);
    expect(s.data.badges).toContain('badge.kitten');
    expect(s.data.medals).toContain('medal.stage1');
    const again = new SaveManager(store);
    expect(again.hasProgress).toBe(true);
    expect(again.data.stages.stage1.bestStars).toBe(20);
    expect(again.totalStars).toBe(21);
  });

  it('keeps the best result across replays and counts completions', () => {
    const s = new SaveManager(new MemStorage());
    s.recordStageResult(result(24));
    s.recordStageResult(result(10));
    expect(s.data.stages.stage1.bestStars).toBe(24);
    expect(s.data.stages.stage1.completions).toBe(2);
    expect(s.data.badges.filter((b) => b === 'badge.kitten')).toHaveLength(1);
  });

  it('survives corrupt storage', () => {
    const store = new MemStorage();
    store.setItem(SAVE_KEY, '{not json');
    const s = new SaveManager(store);
    expect(s.data.unlockedStage).toBe(1);
  });

  it('sanitises tampered values', () => {
    const d = sanitize({ settings: { musicVolume: 9, language: 'xx', quality: 'ultra' }, hero: 'cat', unlockedStage: 99, badges: [1, 'ok'] });
    expect(d.settings.musicVolume).toBe(1);
    expect(d.settings.language === 'en' || d.settings.language === 'ms').toBe(true);
    expect(d.settings.quality).toBe('auto');
    expect(d.hero).toBe('biscuit');
    expect(d.unlockedStage).toBe(15);
    expect(d.badges).toEqual(['ok']);
  });

  it('works with no storage at all (private mode)', () => {
    const s = new SaveManager(null);
    s.recordStageResult(result(5));
    expect(s.save()).toBe(false);
    expect(s.data.unlockedStage).toBe(2);
  });

  it('reset keeps settings but clears progress', () => {
    const s = new SaveManager(new MemStorage());
    s.updateSettings({ musicVolume: 0.1 });
    s.recordStageResult(result(5));
    s.reset();
    expect(s.hasProgress).toBe(false);
    expect(s.data.settings.musicVolume).toBe(0.1);
  });
});

describe('star rating', () => {
  it('always awards at least one star for finishing', () => {
    expect(starRating(0, 26, false)).toBe(1);
    expect(starRating(26, 26, false)).toBe(1);
  });
  it('needs the rescue for two or three stars', () => {
    expect(starRating(13, 26, true)).toBe(2);
    expect(starRating(24, 26, true)).toBe(3);
  });
});
