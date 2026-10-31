import { describe, expect, it } from 'vitest';
import { en } from '../../src/localization/en';
import { getLanguage, ms, setLanguage, t } from '../../src/localization/i18n';

describe('localisation', () => {
  it('Bahasa Melayu covers every English key with non-empty text', () => {
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      expect(ms[key], key).toBeTruthy();
    }
    expect(Object.keys(ms).sort()).toEqual(Object.keys(en).sort());
  });

  it('switches language at runtime', () => {
    setLanguage('ms');
    expect(getLanguage()).toBe('ms');
    expect(t('menu.play')).toBe('Main');
    setLanguage('en');
    expect(t('menu.play')).toBe('Play');
  });

  it('quit warning explains that the game restarts from Stage 1 in both languages', () => {
    expect(en['quit.body']).toMatch(/Stage 1/);
    expect(ms['quit.body']).toMatch(/Peringkat 1/);
  });

  it('keeps child-facing strings short', () => {
    const long = (Object.entries(en) as Array<[string, string]>).filter(([k, v]) => !k.startsWith('game.') && !k.startsWith('error.') && v.length > 110);
    expect(long).toEqual([]);
  });
});
