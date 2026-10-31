/** Shared game-wide types. Kept free of Babylon imports so they can be unit tested. */

export type Difficulty = 'explorer' | 'junior' | 'super';
export type HeroId = 'biscuit' | 'pepper' | 'poppy';
export type Language = 'en' | 'ms';
export type QualityMode = 'auto' | 'high' | 'low';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  interact: boolean;
}

export const EMPTY_INPUT: InputState = { left: false, right: false, jump: false, interact: false };

/** Tuning that changes with the selected age mode. */
export interface DifficultyTuning {
  id: Difficulty;
  /** Max horizontal speed (units / s). */
  maxSpeed: number;
  /** Ground acceleration (units / s^2). */
  accel: number;
  /** Ground deceleration when no input (units / s^2). */
  decel: number;
  /** Air control multiplier on acceleration. */
  airControl: number;
  gravity: number;
  jumpVelocity: number;
  /** Seconds after leaving a ledge during which a jump still counts. */
  coyoteTime: number;
  /** Seconds a jump press is remembered before landing. */
  jumpBuffer: number;
  /** Multiplier applied to upward velocity when jump is released early. */
  jumpCutMultiplier: number;
  maxFallSpeed: number;
  /** Automatically start the kitten rescue on touch. */
  autoInteract: boolean;
  /** Default for the auto-jump assist setting. */
  autoJumpDefault: boolean;
  /** Default for spoken hints. */
  voiceHintsDefault: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyTuning> = {
  explorer: {
    id: 'explorer',
    maxSpeed: 5.6,
    accel: 34,
    decel: 40,
    airControl: 0.9,
    gravity: 34,
    jumpVelocity: 15.2,
    coyoteTime: 0.22,
    jumpBuffer: 0.25,
    jumpCutMultiplier: 0.75,
    maxFallSpeed: 18,
    autoInteract: true,
    autoJumpDefault: true,
    voiceHintsDefault: true,
  },
  junior: {
    id: 'junior',
    maxSpeed: 6.6,
    accel: 38,
    decel: 44,
    airControl: 0.8,
    gravity: 38,
    jumpVelocity: 15,
    coyoteTime: 0.14,
    jumpBuffer: 0.16,
    jumpCutMultiplier: 0.55,
    maxFallSpeed: 22,
    autoInteract: false,
    autoJumpDefault: false,
    voiceHintsDefault: false,
  },
  super: {
    id: 'super',
    maxSpeed: 7.6,
    accel: 44,
    decel: 50,
    airControl: 0.75,
    gravity: 40,
    jumpVelocity: 15.4,
    coyoteTime: 0.1,
    jumpBuffer: 0.12,
    jumpCutMultiplier: 0.5,
    maxFallSpeed: 24,
    autoInteract: false,
    autoJumpDefault: false,
    voiceHintsDefault: false,
  },
};

/** Peak jump height for a tuning, used by level validation and tests. */
export function maxJumpHeight(t: DifficultyTuning): number {
  return (t.jumpVelocity * t.jumpVelocity) / (2 * t.gravity);
}
