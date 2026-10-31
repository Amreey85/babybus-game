/**
 * Stage catalogue for the full 15-stage roadmap. Only stages with a `load`
 * function are playable; each is a separate lazily-loaded chunk so the browser
 * never downloads stages it does not need.
 */
import type { TranslationKey } from '../localization/en';

export interface StageModule {
  /** Builds and runs the stage; see levels/stage1/index.ts. */
  createStage: typeof import('./stage1').createStage;
}

export interface StageInfo {
  id: string;
  number: number;
  world: 1 | 2 | 3;
  nameKey: TranslationKey;
  load?: () => Promise<StageModule>;
}

const name = (n: number) => `stage.${n}.name` as TranslationKey;

export const STAGES: StageInfo[] = Array.from({ length: 15 }, (_, i) => {
  const number = i + 1;
  const info: StageInfo = {
    id: `stage${number}`,
    number,
    world: (number <= 5 ? 1 : number <= 10 ? 2 : 3) as 1 | 2 | 3,
    nameKey: name(number),
  };
  if (number === 1) info.load = () => import('./stage1');
  return info;
});

export const isPlayable = (s: StageInfo): boolean => typeof s.load === 'function';
export const getStage = (n: number): StageInfo | undefined => STAGES[n - 1];
