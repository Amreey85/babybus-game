import type { HeroId } from '../core/types';
import type { TranslationKey } from '../localization/en';

/** Original hero designs (names, colours and outfits are not BabyBus assets). */
export interface HeroDef {
  id: HeroId;
  nameKey: TranslationKey;
  descKey: TranslationKey;
  fur: string;
  furDark: string;
  muzzle: string;
  ear: string;
  earStyle: 'floppy' | 'pointy' | 'long';
  shirt: string;
  trousers: string;
  accent: string;
  hat: 'cowboy' | 'cap' | 'beret';
  hatColour: string;
  hatBand: string;
  scarf?: string;
  bow?: string;
  /** CSS gradient used on the selection card. */
  card: string;
}

export const HEROES: Record<HeroId, HeroDef> = {
  biscuit: {
    id: 'biscuit',
    nameKey: 'hero.biscuit',
    descKey: 'hero.biscuit.desc',
    fur: '#F4B860',
    furDark: '#D68A36',
    muzzle: '#FFE6BF',
    ear: '#C9772E',
    earStyle: 'floppy',
    shirt: '#4FA9EE',
    trousers: '#2F5FA8',
    accent: '#FFCF3D',
    hat: 'cowboy',
    hatColour: '#A65E2E',
    hatBand: '#FFCF3D',
    scarf: '#FF5A5A',
    card: 'linear-gradient(160deg,#FFE7B0,#FFB65C)',
  },
  pepper: {
    id: 'pepper',
    nameKey: 'hero.pepper',
    descKey: 'hero.pepper.desc',
    fur: '#6B7286',
    furDark: '#4C5263',
    muzzle: '#EBCFA8',
    ear: '#4C5263',
    earStyle: 'pointy',
    shirt: '#FFD23F',
    trousers: '#2E8B66',
    accent: '#2E8B66',
    hat: 'cap',
    hatColour: '#2E9E70',
    hatBand: '#FFFFFF',
    scarf: '#2E9E70',
    card: 'linear-gradient(160deg,#D8F5E6,#5CCB98)',
  },
  poppy: {
    id: 'poppy',
    nameKey: 'hero.poppy',
    descKey: 'hero.poppy.desc',
    fur: '#FFFFFF',
    furDark: '#F1E7EA',
    muzzle: '#FFF7F9',
    ear: '#FF6E8E',
    earStyle: 'long',
    shirt: '#FF8FB4',
    trousers: '#7B61FF',
    accent: '#7B61FF',
    hat: 'beret',
    hatColour: '#7B61FF',
    hatBand: '#FFD23F',
    bow: '#FFD23F',
    card: 'linear-gradient(160deg,#FFE0EC,#FF8FB4)',
  },
};

export const HERO_ORDER: HeroId[] = ['biscuit', 'pepper', 'poppy'];
