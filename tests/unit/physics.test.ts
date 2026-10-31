import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, EMPTY_INPUT, type InputState } from '../../src/core/types';
import { createBody, hasSupportAt, shouldAutoJump, stepBody, type Solid } from '../../src/physics/PlatformerPhysics';

const T = DIFFICULTIES.junior;
const DT = 1 / 120;
const floor: Solid = { id: 'floor', x: -50, y: -5, w: 100, h: 5 };
const input = (p: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...p });

function run(body: ReturnType<typeof createBody>, solids: Solid[], seconds: number, inp: InputState | ((t: number) => InputState)) {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(stepBody(body, typeof inp === 'function' ? inp(t) : inp, T, solids, DT));
  return events;
}

describe('platformer physics', () => {
  it('lands on the ground and stays there', () => {
    const b = createBody(0, 3);
    run(b, [floor], 1, input());
    expect(b.onGround).toBe(true);
    expect(b.y).toBeCloseTo(0, 5);
    expect(b.groundId).toBe('floor');
  });

  it('accelerates to max speed and decelerates to a stop', () => {
    const b = createBody(0, 0);
    run(b, [floor], 1, input({ right: true }));
    expect(b.vx).toBeCloseTo(T.maxSpeed, 3);
    expect(b.facing).toBe(1);
    run(b, [floor], 1, input());
    expect(b.vx).toBe(0);
  });

  it('jumps to roughly the predicted height', () => {
    const b = createBody(0, 0);
    run(b, [floor], 0.05, input());
    let peak = 0;
    run(b, [floor], 1.2, (t) => {
      peak = Math.max(peak, b.y);
      return input({ jump: t < 1 });
    });
    const predicted = (T.jumpVelocity * T.jumpVelocity) / (2 * T.gravity);
    expect(peak).toBeGreaterThan(predicted * 0.95);
    expect(peak).toBeLessThan(predicted * 1.35); // apex hang adds a little
  });

  it('variable jump: a tap jumps lower than a hold', () => {
    const tap = createBody(0, 0);
    const hold = createBody(0, 0);
    run(tap, [floor], 0.05, input());
    run(hold, [floor], 0.05, input());
    let pTap = 0;
    let pHold = 0;
    run(tap, [floor], 1, (t) => ((pTap = Math.max(pTap, tap.y)), input({ jump: t < 0.05 })));
    run(hold, [floor], 1, () => ((pHold = Math.max(pHold, hold.y)), input({ jump: true })));
    expect(pTap).toBeLessThan(pHold * 0.8);
  });

  it('coyote time allows a jump just after walking off a ledge', () => {
    const ledge: Solid = { id: 'ledge', x: -10, y: -1, w: 10, h: 1 };
    const b = createBody(-0.5, 0);
    b.onGround = true;
    b.vx = T.maxSpeed;
    // Walk off the edge.
    run(b, [ledge], 0.2, input({ right: true }));
    expect(b.onGround).toBe(false);
    const ev = stepBody(b, input({ right: true, jump: true }), T, [ledge], DT);
    expect(ev.jumped).toBe(true);
  });

  it('no jump long after leaving a ledge', () => {
    const ledge: Solid = { id: 'ledge', x: -10, y: -1, w: 10, h: 1 };
    const b = createBody(-0.5, 0);
    b.onGround = true;
    run(b, [ledge], 0.5, input({ right: true }));
    const ev = stepBody(b, input({ right: true, jump: true }), T, [ledge], DT);
    expect(ev.jumped).toBe(false);
  });

  it('jump buffering: pressing jump just before landing still jumps', () => {
    const b = createBody(0, 0.6);
    b.vy = -5;
    stepBody(b, input({ jump: true }), T, [floor], DT); // press in the air
    let jumped = false;
    run(b, [floor], 0.12, () => input({ jump: true })).forEach((e) => (jumped ||= e.jumped));
    expect(jumped).toBe(true);
  });

  it('walls block horizontal movement', () => {
    const wall: Solid = { id: 'wall', x: 2, y: 0, w: 1, h: 3 };
    const b = createBody(0, 0);
    run(b, [floor, wall], 1, input({ right: true }));
    expect(b.x).toBeCloseTo(2 - b.w / 2, 3);
  });

  it('one-way platforms can be jumped through from below and stood on', () => {
    const plank: Solid = { id: 'plank', x: -1, y: 2, w: 2, h: 0.4, oneWay: true };
    const b = createBody(0, 0);
    run(b, [floor, plank], 0.05, input());
    run(b, [floor, plank], 1.5, (t) => input({ jump: t < 0.6 }));
    expect(b.onGround).toBe(true);
    expect(b.groundId).toBe('plank');
    expect(b.y).toBeCloseTo(2.4, 3);
  });

  it('solid ceilings stop upward movement', () => {
    const ceiling: Solid = { id: 'ceil', x: -2, y: 2, w: 4, h: 1 };
    const b = createBody(0, 0);
    run(b, [floor, ceiling], 0.05, input());
    const events = run(b, [floor, ceiling], 0.4, input({ jump: true }));
    expect(events.some((e) => e.bumpedHead)).toBe(true);
    expect(b.y + b.h).toBeLessThanOrEqual(2 + 1e-6);
  });

  it('bounce pads launch the hero upward', () => {
    const pad: Solid = { id: 'pad', x: -1, y: 0, w: 2, h: 0.3, bounce: 20 };
    const b = createBody(0, 1);
    const events = run(b, [floor, pad], 0.3, input());
    expect(events.some((e) => e.bounced)).toBe(true);
    expect(b.vy).toBeGreaterThan(5);
  });

  it('walking into a low bounce pad steps onto it and launches', () => {
    const pad: Solid = { id: 'pad', x: 2, y: 0, w: 1.8, h: 0.35, bounce: 22 };
    const b = createBody(0, 0);
    run(b, [floor], 0.2, input());
    let peak = 0;
    run(b, [floor, pad], 1.5, () => { peak = Math.max(peak, b.y); return input({ right: true }); });
    expect(peak).toBeGreaterThan(5);
  });

  it('taller crates still block walking', () => {
    const crate: Solid = { id: 'crate', x: 2, y: 0, w: 1.6, h: 1.2 };
    const b = createBody(0, 0);
    run(b, [floor, crate], 2, input({ right: true }));
    expect(b.x).toBeLessThan(2);
    expect(b.y).toBeCloseTo(0, 3);
  });

  it('works when moving and jumping at the same time', () => {
    const b = createBody(0, 0);
    run(b, [floor], 0.05, input());
    run(b, [floor], 0.3, input({ right: true, jump: true }));
    expect(b.x).toBeGreaterThan(0.5);
    expect(b.y).toBeGreaterThan(1);
  });
});

describe('auto-jump assist', () => {
  it('jumps at the edge of a gap', () => {
    const a: Solid = { id: 'a', x: -10, y: -1, w: 10, h: 1 };
    const b = createBody(-0.6, 0);
    b.onGround = true;
    expect(shouldAutoJump(b, 1, [a], 3)).toBe(true);
    expect(shouldAutoJump(b, -1, [a], 3)).toBe(false);
  });

  it('jumps in front of a low obstacle but not on open ground', () => {
    const crate: Solid = { id: 'c', x: 1, y: 0, w: 1.5, h: 1.2 };
    const b = createBody(0.3, 0);
    b.onGround = true;
    expect(shouldAutoJump(b, 1, [floor, crate], 3)).toBe(true);
    const c = createBody(-5, 0);
    c.onGround = true;
    expect(shouldAutoJump(c, 1, [floor, crate], 3)).toBe(false);
  });

  it('does not jump when standing still or in the air', () => {
    const b = createBody(0, 0);
    b.onGround = true;
    expect(shouldAutoJump(b, 0, [floor], 3)).toBe(false);
    b.onGround = false;
    expect(shouldAutoJump(b, 1, [floor], 3)).toBe(false);
  });

  it('hasSupportAt finds surfaces below a point', () => {
    expect(hasSupportAt(0, 0, [floor])).toBe(true);
    expect(hasSupportAt(60, 0, [floor])).toBe(false);
  });
});
