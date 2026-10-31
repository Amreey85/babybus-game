/**
 * Procedural animation for character rigs: idle, blink, walk, run, jump,
 * fall, land, wave, interact, rescue and celebrate, with smooth blending.
 */
import type { Rig } from '../characters/models';
import { damp } from '../utilities/math';

export type LoopState = 'idle' | 'walk' | 'run' | 'jump' | 'fall';
export type OneShot = 'land' | 'wave' | 'interact' | 'rescue' | 'celebrate' | 'hop';

interface Pose {
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  legLx: number;
  legRx: number;
  bodyY: number;
  bodyLean: number;
  headX: number;
  headZ: number;
  earZ: number;
}

const ZERO: Pose = { armLx: 0, armLz: -0.18, armRx: 0, armRz: 0.18, legLx: 0, legRx: 0, bodyY: 0, bodyLean: 0, headX: 0, headZ: 0, earZ: 0 };

export class RigAnimator {
  state: LoopState = 'idle';
  private shot: OneShot | null = null;
  private shotTime = 0;
  private shotDuration = 0;
  private t = Math.random() * 10;
  private phase = 0;
  private blinkIn = 1 + Math.random() * 2;
  private blinkT = 0;
  private squashV = 0;
  private squash = 0;
  private pose: Pose = { ...ZERO };
  private baseBodyY: number;
  private baseEarZ: [number, number];
  private baseScale: number;
  private yaw = 0;
  /** Target facing: 1 right, -1 left, 0 towards camera. */
  facing: 1 | 0 | -1 = 0;
  /** 0..1 horizontal speed ratio, drives stride. */
  speed = 0;
  /** Vertical velocity, drives ear flop. */
  vy = 0;
  /** Extra spin for celebrations. */
  private spin = 0;

  constructor(private rig: Rig) {
    this.baseBodyY = rig.body.position.y;
    this.baseEarZ = [rig.earL.rotation.z, rig.earR.rotation.z];
    this.baseScale = rig.visual.scaling.x;
  }

  play(shot: OneShot, duration?: number): void {
    this.shot = shot;
    this.shotTime = 0;
    this.shotDuration =
      duration ?? { land: 0.22, wave: 1.6, interact: 0.6, rescue: 1.6, celebrate: 3.2, hop: 0.5 }[shot];
    if (shot === 'land') this.squashV = -7;
  }

  get busy(): boolean {
    return this.shot !== null && this.shot !== 'land';
  }

  /** Trigger a little jump stretch. */
  stretch(): void {
    this.squashV = 6;
  }

  update(dt: number): void {
    this.t += dt;
    const r = this.rig;
    const p: Pose = { ...ZERO };
    const sp = Math.min(1.4, this.speed);

    switch (this.state) {
      case 'idle': {
        const br = Math.sin(this.t * 2.2);
        p.bodyY = br * 0.012;
        p.armLz = -0.2 - br * 0.04;
        p.armRz = 0.2 + br * 0.04;
        p.headZ = Math.sin(this.t * 0.9) * 0.06;
        p.headX = Math.sin(this.t * 0.7) * 0.03;
        break;
      }
      case 'walk':
      case 'run': {
        const run = this.state === 'run';
        this.phase += dt * (run ? 15 : 10) * Math.max(0.5, sp);
        const s = Math.sin(this.phase);
        const amp = run ? 0.95 : 0.7;
        p.legLx = s * amp;
        p.legRx = -s * amp;
        p.armLx = -s * amp * 0.9;
        p.armRx = s * amp * 0.9;
        p.armLz = run ? -0.35 : -0.22;
        p.armRz = run ? 0.35 : 0.22;
        p.bodyY = Math.abs(Math.cos(this.phase)) * (run ? 0.08 : 0.05);
        p.bodyLean = run ? 0.18 : 0.08;
        p.headX = run ? -0.08 : 0;
        break;
      }
      case 'jump':
        p.armLz = -1.4;
        p.armRz = 1.4;
        p.legLx = 0.7;
        p.legRx = -0.25;
        p.headX = -0.1;
        break;
      case 'fall':
        p.armLz = -1.9 + Math.sin(this.t * 18) * 0.15;
        p.armRz = 1.9 - Math.sin(this.t * 18) * 0.15;
        p.legLx = 0.3;
        p.legRx = -0.3;
        p.headX = 0.1;
        break;
    }

    if (this.shot) {
      this.shotTime += dt;
      const k = this.shotTime;
      switch (this.shot) {
        case 'wave':
          p.armRz = 2.7 + Math.sin(k * 12) * 0.35;
          p.armRx = 0;
          p.headZ = 0.12;
          break;
        case 'interact':
          p.armLx = 1.35;
          p.armRx = 1.35;
          p.armLz = -0.1;
          p.armRz = 0.1;
          p.bodyLean = 0.25;
          break;
        case 'rescue':
          p.armLz = -2.6;
          p.armRz = 2.6;
          p.bodyY = Math.abs(Math.sin(k * 9)) * 0.25;
          p.headX = -0.15;
          break;
        case 'hop':
          p.bodyY = Math.sin(Math.min(1, k / this.shotDuration) * Math.PI) * 0.35;
          p.armLz = -1.2;
          p.armRz = 1.2;
          break;
        case 'celebrate':
          p.armLz = -2.7 + Math.sin(k * 14) * 0.2;
          p.armRz = 2.7 - Math.sin(k * 14) * 0.2;
          p.bodyY = Math.abs(Math.sin(k * 6)) * 0.55;
          p.legLx = 0.4;
          p.legRx = -0.4;
          this.spin = k < 1.1 ? (k / 1.1) * Math.PI * 2 : 0;
          break;
        case 'land':
          break;
      }
      if (this.shotTime >= this.shotDuration) {
        this.shot = null;
        this.spin = 0;
      }
    }

    // Blend joints.
    const L = 16;
    for (const key of Object.keys(p) as Array<keyof Pose>) this.pose[key] = damp(this.pose[key], p[key], L, dt);
    const q = this.pose;
    r.armL.rotation.x = q.armLx;
    r.armL.rotation.z = q.armLz;
    r.armR.rotation.x = q.armRx;
    r.armR.rotation.z = q.armRz;
    r.legL.rotation.x = q.legLx;
    r.legR.rotation.x = q.legRx;
    r.body.position.y = this.baseBodyY + q.bodyY;
    r.body.rotation.x = q.bodyLean;
    r.head.rotation.x = q.headX;
    r.head.rotation.z = q.headZ;
    const flop = Math.max(-0.5, Math.min(0.5, -this.vy * 0.04));
    r.earL.rotation.z = this.baseEarZ[0] - flop;
    r.earR.rotation.z = this.baseEarZ[1] + flop;
    r.tail.rotation.y = Math.sin(this.t * (this.state === 'idle' ? 5 : 12)) * 0.5;

    // Squash and stretch spring.
    this.squashV += (-this.squash * 220 - this.squashV * 16) * dt;
    this.squash += this.squashV * dt;
    const s = Math.max(-0.35, Math.min(0.35, this.squash * 0.12));
    const b = this.baseScale;
    r.visual.scaling.set(b * (1 - s * 0.5), b * (1 + s), b * (1 - s * 0.5));

    // Facing.
    const targetYaw = this.facing === 1 ? -1.05 : this.facing === -1 ? 1.05 : 0;
    this.yaw = damp(this.yaw, targetYaw, 12, dt);
    r.visual.rotation.y = this.yaw + this.spin;

    // Blink.
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.14;
      this.blinkIn = 2 + Math.random() * 3;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    const lid = this.blinkT > 0 ? 0.12 : 1;
    for (const e of r.eyes) e.scaling.y = lid;
  }
}
