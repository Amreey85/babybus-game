/** Contract between the app shell and a running stage. */
import type { AudioManager } from '../audio/AudioManager';
import type { InputManager } from '../controls/InputManager';
import type { EngineHost } from '../engine/EngineHost';
import type { TranslationKey } from '../localization/en';
import type { StageResult } from '../progression/SaveManager';
import type { Difficulty, HeroId } from './types';

export type ToastIcon = 'star' | 'flag' | 'heart' | 'badge' | 'splash' | 'info' | 'move' | 'jump' | 'bounce';

export interface HudApi {
  setStars(collected: number, total: number): void;
  setObjective(key: TranslationKey, icon: 'star' | 'kitten' | 'cat' | 'flag' | 'party'): void;
  toast(key: TranslationKey, icon: ToastIcon): void;
  caption(key: TranslationKey | null): void;
  /** World-anchored labels (speech bubbles, prompts, hint arrows). */
  label(id: string, opts: { x: number; y: number; visible: boolean; text?: string; kind?: 'bubble' | 'prompt' | 'arrow' }): void;
  clearLabels(): void;
  setInteractHighlight(on: boolean): void;
  fade(on: boolean): void;
  setIntro(on: boolean): void;
  badgePop(): void;
}

export interface StageContext {
  host: EngineHost;
  audio: AudioManager;
  input: InputManager;
  hud: HudApi;
  hero: HeroId;
  difficulty: Difficulty;
  autoJump: boolean;
  lowQuality: boolean;
  onComplete(result: StageResult): void;
}

export interface StageDebugState {
  phase: string;
  x: number;
  y: number;
  onGround: boolean;
  stars: number;
  totalStars: number;
  bonusStars: number;
  kitten: string;
  checkpoint: string | null;
  respawns: number;
  fps: number;
}

export interface StageController {
  start(): void;
  skipIntro(): void;
  setPaused(paused: boolean): void;
  readonly paused: boolean;
  setAutoJump(on: boolean): void;
  showHint(): void;
  render(): void;
  dispose(): void;
  debugState(): StageDebugState;
  debugTeleport(x: number, y: number): void;
}
