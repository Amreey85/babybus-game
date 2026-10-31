/**
 * Deterministic 2D platformer physics on the gameplay plane (x right, y up).
 * Pure TypeScript with no rendering dependency so it can be unit tested.
 */
import type { DifficultyTuning, InputState } from '../core/types';
import { approach } from '../utilities/math';

export interface Solid {
  id: string;
  /** Left edge. */
  x: number;
  /** Bottom edge. */
  y: number;
  w: number;
  h: number;
  /** Can be jumped through from below and only blocks from above. */
  oneWay?: boolean;
  /** Upward velocity applied on landing (bounce pad). */
  bounce?: number;
}

export interface Body {
  /** Centre x. */
  x: number;
  /** Feet y. */
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
  groundId: string | null;
  coyote: number;
  jumpBuffer: number;
  jumpHeld: boolean;
  /** True while rising from a player-initiated jump (enables variable height). */
  jumping: boolean;
  facing: 1 | -1;
  /** Seconds spent continuously moving at speed (drives walk -> run). */
  moveTime: number;
}

export interface StepEvents {
  jumped: boolean;
  landed: boolean;
  /** Downward speed at landing, for squash and dust effects. */
  landSpeed: number;
  bounced: boolean;
  bumpedHead: boolean;
}

const EPS = 0.001;

export function createBody(x: number, y: number): Body {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    w: 0.8,
    h: 1.5,
    onGround: false,
    groundId: null,
    coyote: 0,
    jumpBuffer: 0,
    jumpHeld: false,
    jumping: false,
    facing: 1,
    moveTime: 0,
  };
}

const overlapsX = (b: Body, s: Solid): boolean => b.x + b.w / 2 > s.x + EPS && b.x - b.w / 2 < s.x + s.w - EPS;

/** Advance the body by dt seconds. Mutates body, returns frame events. */
export function stepBody(
  b: Body,
  input: InputState,
  t: DifficultyTuning,
  solids: readonly Solid[],
  dt: number,
  forceJump = false,
): StepEvents {
  const ev: StepEvents = { jumped: false, landed: false, landSpeed: 0, bounced: false, bumpedHead: false };
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  // Horizontal acceleration / deceleration.
  const target = dir * t.maxSpeed;
  const rate = (dir !== 0 ? t.accel : t.decel) * (b.onGround ? 1 : t.airControl);
  b.vx = approach(b.vx, target, rate * dt);
  if (dir !== 0) b.facing = dir > 0 ? 1 : -1;
  b.moveTime = Math.abs(b.vx) > t.maxSpeed * 0.8 ? b.moveTime + dt : 0;

  // Jump buffering and coyote time.
  const pressed = (input.jump && !b.jumpHeld) || forceJump;
  b.jumpBuffer = pressed ? t.jumpBuffer : Math.max(0, b.jumpBuffer - dt);
  b.coyote = b.onGround ? t.coyoteTime : Math.max(0, b.coyote - dt);
  if (b.jumpBuffer > 0 && b.coyote > 0) {
    b.vy = t.jumpVelocity;
    b.jumping = true;
    b.onGround = false;
    b.groundId = null;
    b.coyote = 0;
    b.jumpBuffer = 0;
    ev.jumped = true;
  }
  // Variable jump height: releasing early cuts the rise (once).
  if (b.jumping && !input.jump && !forceJump && b.vy > 0) {
    b.vy *= t.jumpCutMultiplier;
    b.jumping = false;
  }
  if (b.vy <= 0) b.jumping = false;
  b.jumpHeld = input.jump;

  // Gravity with a gentle apex hang for readability.
  const hang = input.jump && Math.abs(b.vy) < 2.5 ? 0.6 : 1;
  b.vy = Math.max(b.vy - t.gravity * hang * dt, -t.maxFallSpeed);

  // Resolve X.
  b.x += b.vx * dt;
  for (const s of solids) {
    if (s.oneWay) continue;
    const feet = b.y;
    const head = b.y + b.h;
    if (head <= s.y + EPS || feet >= s.y + s.h - EPS) continue;
    if (!overlapsX(b, s)) continue;
    if (b.vx > 0 || (b.vx === 0 && b.x < s.x + s.w / 2)) b.x = s.x - b.w / 2;
    else b.x = s.x + s.w + b.w / 2;
    b.vx = 0;
  }

  // Resolve Y.
  const prevFeet = b.y;
  const prevHead = b.y + b.h;
  b.y += b.vy * dt;
  let grounded = false;
  for (const s of solids) {
    if (!overlapsX(b, s)) continue;
    const top = s.y + s.h;
    if (b.vy <= 0 && prevFeet >= top - 0.05 && b.y <= top) {
      // Landing on top.
      if (!b.onGround) {
        ev.landed = true;
        ev.landSpeed = -b.vy;
      }
      b.y = top;
      if (s.bounce) {
        b.vy = s.bounce;
        b.jumping = false;
        ev.bounced = true;
        grounded = false;
        b.groundId = null;
        continue;
      }
      b.vy = 0;
      grounded = true;
      b.groundId = s.id;
    } else if (!s.oneWay && b.vy > 0 && prevHead <= s.y + 0.05 && b.y + b.h > s.y) {
      b.y = s.y - b.h;
      b.vy = 0;
      b.jumping = false;
      ev.bumpedHead = true;
    }
  }
  if (ev.bounced) grounded = false;
  b.onGround = grounded;
  if (!grounded) b.groundId = null;
  return ev;
}

/** True if any solid's top surface supports point (x, y) within tolerance. */
export function hasSupportAt(x: number, y: number, solids: readonly Solid[], drop = 0.6): boolean {
  for (const s of solids) {
    const top = s.y + s.h;
    if (x >= s.x && x <= s.x + s.w && top <= y + 0.05 && top >= y - drop) return true;
  }
  return false;
}

/**
 * Auto-jump assist for younger players: jump when walking towards a gap
 * or a low obstacle the hero can clear.
 */
export function shouldAutoJump(b: Body, dir: number, solids: readonly Solid[], maxJump: number): boolean {
  if (!b.onGround || dir === 0) return false;
  const ahead = b.x + dir * (b.w / 2 + 0.45);
  if (!hasSupportAt(ahead, b.y, solids, 1.2)) return true;
  for (const s of solids) {
    if (s.oneWay) continue;
    const top = s.y + s.h;
    if (ahead >= s.x && ahead <= s.x + s.w && s.y < b.y + b.h && top > b.y + 0.1 && top - b.y <= maxJump - 0.2) {
      return true;
    }
  }
  return false;
}
