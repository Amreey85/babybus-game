import type { Language } from '../core/types';
import { en, type TranslationKey } from './en';
import { ms } from './ms';

const tables: Record<Language, Record<TranslationKey, string>> = { en, ms };
let current: Language = 'en';
const listeners = new Set<() => void>();

export function setLanguage(lang: Language): void {
  if (lang === current) return;
  current = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang === 'ms' ? 'ms' : 'en';
  listeners.forEach((l) => l());
}

export const getLanguage = (): Language => current;

export function t(key: TranslationKey): string {
  return tables[current][key] ?? en[key] ?? key;
}

export function onLanguageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const speechLang = (): string => (current === 'ms' ? 'ms-MY' : 'en-GB');

export type { TranslationKey };
export { en, ms };
