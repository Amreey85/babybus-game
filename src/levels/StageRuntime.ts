/**
 * Generic stage runtime: builds the scene from a LevelLayout and runs gameplay
 * (movement, camera, stars, checkpoints, rescue mission, finish, rewards).
 * Future stages reuse this with their own layout and environment.
 */
import {
  Color3,
  Color4,
  DirectionalLight,
  GlowLayer,
  HemisphericLight,
  InstancedMesh,
  Matrix,
  Mesh,
  Scene,
  ShadowGenerator,
  TargetCamera,
  Vector3,
} from '../engine/babylon';
import { RigAnimator } from '../animations/RigAnimator';
import { HEROES } from '../characters/heroes';
import { buildCritter, buildHero, type Rig } from '../characters/models';
import { DIFFICULTIES, maxJumpHeight, type DifficultyTuning, type InputState } from '../core/types';
import type { StageContext, StageController, StageDebugState } from '../core/stageApi';
import { Particles } from '../effects/Particles';
import { MaterialLibrary } from '../engine/materials';
import { createStarMesh } from '../engine/shapes';
import { TownEnvironment } from '../environment/TownEnvironment';
import { t } from '../localization/i18n';
import { BADGE_KITTEN, MEDAL_STAGE1, starRating } from '../progression/rewards';
import { createBody, shouldAutoJump, stepBody, type Body, type Solid } from '../physics/PlatformerPhysics';
import { clamp, damp } from '../utilities/math';
import type { LevelLayout, StarDef } from './types';

type Phase = 'loading' | 'intro' | 'play' | 'respawn' | 'complete';
type KittenState = 'waiting' | 'following' | 'reunited';

const FIXED_DT = 1 / 120;

interface StarRuntime {
  def: StarDef;
  mesh: InstancedMesh;
  collected: boolean;
  popT: number;
}

interface NpcRuntime {
  rig: Rig;
  anim: RigAnimator;
  x: number;
  y: number;
  z: number;
  near: boolean;
  bubbleT: number;
}

export interface StageOptions {
  stageNumber: number;
  music: 'town';
}

export class StageRuntime implements StageController {
  readonly scene: Scene;
  private camera: TargetCamera;
  private mats: MaterialLibrary;
  private env: TownEnvironment;
  private particles: Particles;
  private shadows: ShadowGenerator | null = null;
  private sun: DirectionalLight;
  private tuning: DifficultyTuning;
  private body: Body;
  private heroRig: Rig;
  private heroAnim: RigAnimator;
  private kittenRig: Rig;
  private kittenAnim: RigAnimator;
  private mamaRig: Rig;
  private mamaAnim: RigAnimator;
  private npcs: NpcRuntime[] = [];
  private stars: StarRuntime[] = [];
  private solids: Solid[];
  private moverSolids = new Map<string, Solid>();
  private phase: Phase = 'loading';
  private _paused = false;
  private time = 0;
  private acc = 0;
  private phaseT = 0;
  private respawnPoint: { x: number; y: number };
  private activeCheckpoint: string | null = null;
  private activated = new Set<string>();
  private kittenState: KittenState = 'waiting';
  private kittenPos = new Vector3();
  private trail: Array<{ x: number; y: number }> = [];
  private collected = 0;
  private bonusCollected = 0;
  private readonly totalStars: number;
  private respawns = 0;
  private prevInteract = false;
  private hintsShown = new Set<number>();
  private hintTarget: { x: number; y: number; t: number } | null = null;
  private finishWarnT = 0;
  private camX = 0;
  private camY = 2;
  private camZoom = 0;
  private autoJump: boolean;
  private maxJump: number;
  private completeSent = false;
  private glow: GlowLayer | null = null;
  private introStep = -1;

  constructor(private ctx: StageContext, private layout: LevelLayout, private opts: StageOptions) {
    const engine = ctx.host.engine;
    const low = ctx.lowQuality;
    this.tuning = DIFFICULTIES[ctx.difficulty];
    this.maxJump = maxJumpHeight(this.tuning);
    this.autoJump = ctx.autoJump;

    const scene = new Scene(engine);
    this.scene = scene;
    scene.clearColor = Color4.FromHexString('#8FD3FFFF');
    scene.ambientColor = new Color3(0.3, 0.3, 0.35);
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogColor = Color3.FromHexString('#CDEBFF');
    scene.fogStart = 90;
    scene.fogEnd = 320;
    scene.skipPointerMovePicking = true;
    scene.constantlyUpdateMeshUnderPointer = false;

    this.camera = new TargetCamera('cam', new Vector3(0, 4, -24), scene);
    this.camera.fov = 0.62;
    this.camera.minZ = 0.5;
    this.camera.maxZ = 700;

    const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, -0.3), scene);
    hemi.intensity = 0.78;
    hemi.groundColor = Color3.FromHexString('#B8D9A8');
    hemi.specular = new Color3(0.2, 0.2, 0.2);
    this.sun = new DirectionalLight('sun', new Vector3(0.45, -1, 0.55), scene);
    this.sun.intensity = 0.75;
    this.sun.diffuse = Color3.FromHexString('#FFF4E0');

    this.mats = new MaterialLibrary(scene);
    this.env = new TownEnvironment(scene, this.mats, layout, low);
    this.particles = new Particles(scene, low);

    if (!low) {
      this.sun.autoUpdateExtends = false;
      this.sun.shadowFrustumSize = 34;
      this.sun.shadowMinZ = 1;
      this.sun.shadowMaxZ = 90;
      const sg = new ShadowGenerator(1024, this.sun);
      if (engine.webGLVersion >= 2) {
        sg.usePercentageCloserFiltering = true;
        sg.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
      } else {
        sg.usePoissonSampling = true;
      }
      sg.setDarkness(0.45);
      sg.bias = 0.002;
      this.shadows = sg;
      this.glow = new GlowLayer('glow', scene, { mainTextureRatio: 0.35, blurKernelSize: 24 });
      this.glow.intensity = 0.55;
    }

    // Hero.
    this.heroRig = buildHero(scene, this.mats, HEROES[ctx.hero], !low);
    this.heroAnim = new RigAnimator(this.heroRig);
    this.body = createBody(layout.start.x, layout.start.y);
    this.respawnPoint = { ...layout.start };

    // Kitten, Mama Cat and townsfolk.
    this.kittenRig = buildCritter(scene, this.mats, 'kitten', !low);
    this.kittenAnim = new RigAnimator(this.kittenRig);
    this.kittenPos.set(layout.kitten.x, layout.kitten.y, 0.4);
    this.mamaRig = buildCritter(scene, this.mats, 'mamaCat', !low);
    this.mamaAnim = new RigAnimator(this.mamaRig);
    this.mamaRig.root.position.set(layout.mamaCat.x, layout.mamaCat.y, 0.9);
    for (const n of layout.npcs) {
      const rig = buildCritter(scene, this.mats, n.kind, !low);
      rig.root.position.set(n.x, n.y, n.z);
      this.npcs.push({ rig, anim: new RigAnimator(rig), x: n.x, y: n.y, z: n.z, near: false, bubbleT: 0 });
    }
    if (this.shadows) {
      for (const m of [...this.heroRig.meshes, ...this.kittenRig.meshes, ...this.mamaRig.meshes]) this.shadows.addShadowCaster(m, false);
    }

    // Stars.
    const starProto = createStarMesh('starProto', scene, 0.45, 0.2, 0.16);
    starProto.material = this.mats.color('#FFD23F', { emissive: 0.55, specular: 0.9 });
    starProto.setEnabled(false);
    const bonusProto = createStarMesh('bonusProto', scene, 0.5, 0.22, 0.18);
    bonusProto.material = this.mats.color('#7CF4FF', { emissive: 0.6, specular: 0.9 });
    bonusProto.setEnabled(false);
    for (const s of layout.stars) {
      const mesh = (s.bonus ? bonusProto : starProto).createInstance(`star_${s.id}`);
      mesh.position.set(s.x, s.y, 0);
      mesh.isPickable = false;
      this.stars.push({ def: s, mesh, collected: false, popT: 0 });
    }
    if (this.glow) {
      this.glow.addIncludedOnlyMesh(starProto);
      this.glow.addIncludedOnlyMesh(bonusProto);
    }
    this.totalStars = layout.stars.filter((s) => !s.bonus).length;

    this.solids = [...layout.platforms];
    for (const m of layout.movers) {
      const s: Solid = { id: m.id, x: m.x, y: m.y, w: m.w, h: m.h, oneWay: true };
      this.moverSolids.set(m.id, s);
      this.solids.push(s);
    }

    this.camX = layout.start.x;
    this.placeHero();
    this.mats.freezeAll();
    scene.onBeforeRenderObservable.add(() => this.frame());
  }

  // ---------- lifecycle ----------

  start(): void {
    this.ctx.audio.playMusic(this.opts.music);
    this.ctx.hud.setStars(0, this.totalStars);
    this.ctx.hud.setObjective('obj.stars', 'star');
    this.phase = 'intro';
    this.phaseT = 0;
    this.introStep = -1;
    this.ctx.hud.setIntro(true);
    this.ctx.input.enabled = false;
  }

  skipIntro(): void {
    if (this.phase !== 'intro') return;
    this.beginPlay();
  }

  private beginPlay(): void {
    this.phase = 'play';
    this.phaseT = 0;
    this.ctx.hud.caption(null);
    this.ctx.hud.setIntro(false);
    this.ctx.input.enabled = true;
    this.ctx.input.reset();
    this.heroAnim.play('wave', 1.2);
    this.camX = this.body.x;
    this.camZoom = 0;
  }

  get paused(): boolean {
    return this._paused;
  }

  setPaused(p: boolean): void {
    this._paused = p;
    this.ctx.input.reset();
    if (p) this.ctx.audio.suspend();
    else this.ctx.audio.resume();
  }

  setAutoJump(on: boolean): void {
    this.autoJump = on;
  }

  render(): void {
    if (this._paused) return;
    this.scene.render();
  }

  dispose(): void {
    this.ctx.hud.clearLabels();
    this.ctx.hud.caption(null);
    this.ctx.hud.fade(false);
    this.ctx.input.enabled = true;
    this.scene.dispose();
  }

  // ---------- frame ----------

  private frame(): void {
    if (this._paused) return;
    const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.1);
    this.time += dt;
    this.phaseT += dt;
    this.ctx.host.sampleFps();

    if (this.phase === 'intro') this.updateIntro();
    if (this.phase === 'play') {
      this.acc += dt;
      let steps = 0;
      while (this.acc >= FIXED_DT && steps < 12) {
        this.fixedStep(FIXED_DT);
        this.acc -= FIXED_DT;
        steps++;
      }
      if (steps === 12) this.acc = 0;
      this.updateGameplay(dt);
    } else if (this.phase === 'respawn') {
      if (this.phaseT > 0.55) {
        this.body.x = this.respawnPoint.x;
        this.body.y = this.respawnPoint.y + 0.2;
        this.body.vx = this.body.vy = 0;
        this.trail = [];
        if (this.kittenState === 'following') this.kittenPos.set(this.body.x - 1, this.body.y, 0.4);
        this.camX = this.body.x;
        this.ctx.hud.fade(false);
        this.phase = 'play';
        this.phaseT = 0;
        this.heroAnim.play('hop');
      }
    } else if (this.phase === 'complete') {
      this.updateComplete(dt);
    }

    this.updateMovers(this.phase === 'play' ? 0 : dt);
    this.updateStars(dt);
    this.updateCharacters(dt);
    this.env.update(dt, this.time);
    this.updateCamera(dt);
    this.updateLabels();
  }

  private updateIntro(): void {
    const tt = this.phaseT;
    const steps: Array<[number, () => void]> = [
      [0, () => this.ctx.hud.caption('intro.1')],
      [2.4, () => {
        this.ctx.hud.caption('intro.2');
        this.ctx.audio.play('meow');
        this.kittenAnim.play('hop');
      }],
      [5.0, () => {
        this.ctx.hud.caption('intro.3');
        this.heroAnim.play('wave', 1.6);
      }],
      [7.2, () => this.beginPlay()],
    ];
    for (let i = this.introStep + 1; i < steps.length; i++) {
      if (tt >= steps[i][0]) {
        this.introStep = i;
        steps[i][1]();
      }
    }
    if (this.phase !== 'intro') return;
    // Camera tour: town overview, then the kitten, then back to the hero.
    if (tt < 2.4) {
      this.camX = this.layout.start.x + 6 + tt * 3;
      this.camZoom = 6;
    } else if (tt < 5.0) {
      this.camX = damp(this.camX, this.layout.kitten.x, 3, 1 / 60);
      this.camZoom = damp(this.camZoom, -4, 2, 1 / 60);
    } else {
      this.camX = damp(this.camX, this.body.x, 4, 1 / 60);
      this.camZoom = damp(this.camZoom, -2, 3, 1 / 60);
    }
  }

  private fixedStep(dt: number): void {
    const input: InputState = this.ctx.input.state;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const force = this.autoJump && shouldAutoJump(this.body, dir, this.solids, this.maxJump);
    const prevGround = this.body.groundId;
    // Carry the hero along on moving platforms.
    this.moveSolids(dt, prevGround);
    const ev = stepBody(this.body, input, this.tuning, this.solids, dt, force);
    if (ev.jumped) {
      this.ctx.audio.play('jump');
      this.heroAnim.stretch();
      this.particles.burst('dust', new Vector3(this.body.x, this.body.y + 0.1, 0), 6, '#FFFFFF');
    }
    if (ev.bounced) {
      const pad = this.solids.find((s) => s.bounce && Math.abs(s.x + s.w / 2 - this.body.x) < s.w);
      if (pad) this.env.bounce(pad.id);
      this.ctx.audio.play('bounce');
      this.heroAnim.stretch();
      this.particles.burst('sparkle', new Vector3(this.body.x, this.body.y + 0.3, 0), 14, '#FF5D8F', '#FFD43B');
    }
    if (ev.landed && ev.landSpeed > 6) {
      this.heroAnim.play('land');
      this.ctx.audio.play('land');
      this.particles.burst('dust', new Vector3(this.body.x, this.body.y + 0.1, 0), 10, '#FFFFFF');
    }
    this.body.x = clamp(this.body.x, this.layout.bounds.minX - 4, this.layout.bounds.maxX + 4);
  }

  private moverOffset(id: string, time: number): { x: number; y: number } {
    const m = this.layout.movers.find((mm) => mm.id === id)!;
    const k = (Math.sin(time * m.speed * Math.PI * 2) + 1) / 2;
    return m.axis === 'x' ? { x: m.x + k * m.range, y: m.y } : { x: m.x, y: m.y + k * m.range };
  }

  private moveSolids(dt: number, groundId: string | null): void {
    for (const [id, s] of this.moverSolids) {
      const p = this.moverOffset(id, this.time + dt);
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      s.x = p.x;
      s.y = p.y;
      if (groundId === id) {
        this.body.x += dx;
        this.body.y += dy;
      }
    }
  }

  private updateMovers(_dt: number): void {
    for (const [id, s] of this.moverSolids) {
      const mesh = this.env.movers.get(id);
      if (mesh) mesh.position.set(s.x + s.w / 2, s.y + s.h / 2, 0);
    }
  }

  private updateGameplay(dt: number): void {
    const b = this.body;
    const input = this.ctx.input.state;
    const interactPressed = input.interact && !this.prevInteract;
    this.prevInteract = input.interact;

    // Fell in the canal: gentle splash and respawn, never a game over.
    if (b.y < this.layout.killY) {
      this.ctx.audio.play('splash');
      this.particles.burst('splash', new Vector3(b.x, -1.5, 0), 26, '#BDEBFF', '#FFFFFF');
      this.ctx.hud.toast('hud.splash', 'splash');
      this.ctx.hud.fade(true);
      this.respawns++;
      this.phase = 'respawn';
      this.phaseT = 0;
      return;
    }

    // Trail used by the following kitten.
    this.trail.push({ x: b.x, y: b.y });
    if (this.trail.length > 40) this.trail.shift();

    // Stars.
    const cx = b.x;
    const cy = b.y + b.h / 2;
    for (const s of this.stars) {
      if (s.collected) continue;
      const dx = s.def.x - cx;
      const dy = s.def.y - cy;
      if (dx * dx + dy * dy < 1.05 * 1.05) {
        s.collected = true;
        s.popT = 0.001;
        if (s.def.bonus) this.bonusCollected++;
        else this.collected++;
        this.ctx.audio.play(s.def.bonus ? 'bonus' : 'star');
        this.particles.burst('sparkle', new Vector3(s.def.x, s.def.y, -0.3), 16, s.def.bonus ? '#7CF4FF' : '#FFE066', '#FFFFFF');
        this.ctx.hud.setStars(this.collected, this.totalStars);
      }
    }

    // Checkpoints.
    for (const cp of this.layout.checkpoints) {
      if (this.activated.has(cp.id) || b.x < cp.x - 0.4) continue;
      this.activated.add(cp.id);
      this.activeCheckpoint = cp.id;
      this.respawnPoint = { x: cp.x, y: cp.y };
      const f = this.env.checkpointFlags.get(cp.id);
      if (f) {
        f.lamp.material = this.mats.color('#FFE066', { emissive: 0.9 });
        this.particles.burst('sparkle', new Vector3(cp.x, cp.y + 3.3, 1.2), 24, '#FFE066', '#3A86FF');
      }
      this.ctx.audio.play('checkpoint');
      this.ctx.hud.toast('hud.checkpoint', 'flag');
    }
    this.env.checkpointFlags.forEach((f, id) => {
      const target = this.activated.has(id) ? 2.75 : 0.9;
      f.flag.position.y = damp(f.flag.position.y, target, 4, dt);
      f.flag.rotation.y = this.activated.has(id) ? Math.sin(this.time * 4) * 0.15 : 0;
    });

    // Tutorial hints.
    this.layout.hints.forEach((h, i) => {
      if (this.hintsShown.has(i) || b.x < h.x - 2.5) return;
      this.hintsShown.add(i);
      this.ctx.hud.toast(h.key, h.icon);
      this.ctx.audio.speak(t(h.key));
    });

    // Kitten rescue mission.
    const kd = Math.hypot(this.kittenPos.x - b.x, this.kittenPos.y - b.y);
    if (this.kittenState === 'waiting') {
      const near = kd < 3;
      this.ctx.hud.setInteractHighlight(near);
      if (near && (interactPressed || this.tuning.autoInteract)) {
        this.kittenState = 'following';
        this.ctx.hud.setInteractHighlight(false);
        this.heroAnim.play('interact');
        this.kittenAnim.play('hop');
        this.ctx.audio.play('meow');
        setTimeout(() => this.ctx.audio.play('rescue'), 250);
        this.particles.burst('sparkle', this.kittenPos.add(new Vector3(0, 0.6, -0.3)), 20, '#FF8FB4', '#FFFFFF');
        this.ctx.hud.toast('hud.kittenFound', 'heart');
        this.ctx.hud.setObjective('obj.bring', 'cat');
        this.ctx.audio.speak(t('obj.bring'));
      }
    } else if (this.kittenState === 'following') {
      const mamaD = Math.abs(this.kittenPos.x - this.layout.mamaCat.x);
      if (mamaD < 3.2 || Math.abs(b.x - this.layout.mamaCat.x) < 2.2) this.reunite();
    }

    // Finish line.
    const f = this.layout.finish;
    this.finishWarnT = Math.max(0, this.finishWarnT - dt);
    if (b.x >= f.x - 0.3 && b.onGround) {
      if (this.kittenState === 'reunited') this.beginComplete();
      else if (this.finishWarnT <= 0) {
        this.finishWarnT = 4;
        this.ctx.hud.toast('hud.finishLocked', 'info');
        this.ctx.audio.play('locked');
        this.ctx.audio.speak(t('hud.finishLocked'));
        this.showHint();
      }
    }
    if (this.hintTarget) {
      this.hintTarget.t -= dt;
      if (this.hintTarget.t <= 0) this.hintTarget = null;
    }
  }

  private reunite(): void {
    this.kittenState = 'reunited';
    this.kittenAnim.play('hop');
    this.mamaAnim.play('celebrate', 2.4);
    this.heroAnim.play('rescue');
    this.ctx.audio.play('rescue');
    setTimeout(() => this.ctx.audio.play('badge'), 500);
    const p = new Vector3(this.layout.mamaCat.x, 1.4, 0.4);
    this.particles.burst('sparkle', p, 40, '#FF6F91', '#FFE066');
    this.ctx.hud.toast('hud.badge', 'badge');
    this.ctx.hud.badgePop();
    this.ctx.hud.setObjective('obj.finish', 'flag');
    this.ctx.audio.speak(t('npc.thanks'));
  }

  private beginComplete(): void {
    this.phase = 'complete';
    this.phaseT = 0;
    this.ctx.input.enabled = false;
    this.ctx.hud.setObjective('obj.done', 'party');
    this.ctx.audio.playMusic('victory');
    this.ctx.audio.play('celebrate');
    this.particles.confetti(new Vector3(this.layout.finish.x, 6, -1));
    this.heroAnim.play('celebrate');
  }

  private updateComplete(dt: number): void {
    const b = this.body;
    b.x = damp(b.x, this.layout.finish.x + 1, 3, dt);
    b.vx = 0;
    this.camZoom = damp(this.camZoom, -7, 2, dt);
    if (this.phaseT > 1.2 && this.phaseT - dt <= 1.2) this.particles.confetti(new Vector3(this.layout.finish.x, 6, -1));
    if (this.phaseT > 3.4 && !this.completeSent) {
      this.completeSent = true;
      const rescued = this.kittenState === 'reunited';
      this.ctx.onComplete({
        stageId: this.layout.stageId,
        stageNumber: this.opts.stageNumber,
        stars: this.collected,
        totalStars: this.totalStars,
        bonusStars: this.bonusCollected,
        rescued,
        rating: starRating(this.collected, this.totalStars, rescued),
        badge: rescued ? BADGE_KITTEN : undefined,
        medal: MEDAL_STAGE1,
      });
    }
  }

  private updateStars(dt: number): void {
    for (const s of this.stars) {
      if (s.collected) {
        if (s.popT > 0) {
          s.popT += dt;
          const k = s.popT / 0.35;
          s.mesh.scaling.setAll(1 + k * 0.8);
          s.mesh.position.y = s.def.y + k * 0.8;
          if (k >= 1) {
            s.popT = 0;
            s.mesh.setEnabled(false);
          }
        }
        continue;
      }
      s.mesh.rotation.y = this.time * 2.4 + s.def.x * 0.3;
      s.mesh.position.y = s.def.y + Math.sin(this.time * 3 + s.def.x) * 0.1;
    }
  }

  private placeHero(): void {
    this.heroRig.root.position.set(this.body.x, this.body.y, 0);
  }

  private updateCharacters(dt: number): void {
    const b = this.body;
    this.placeHero();
    const a = this.heroAnim;
    const speedRatio = Math.abs(b.vx) / this.tuning.maxSpeed;
    a.speed = speedRatio;
    a.vy = b.vy;
    if (this.phase === 'intro') a.facing = 0;
    else if (this.phase === 'complete') a.facing = 0;
    else a.facing = Math.abs(b.vx) > 0.2 ? b.facing : a.facing === 0 ? 1 : b.facing;
    if (!b.onGround && this.phase === 'play') a.state = b.vy > 0 ? 'jump' : 'fall';
    else if (speedRatio > 0.1) a.state = b.moveTime > 0.6 ? 'run' : 'walk';
    else a.state = 'idle';
    a.update(dt);

    // Kitten.
    if (this.kittenState === 'following' && this.phase !== 'respawn') {
      const lag = this.trail[Math.max(0, this.trail.length - 30)] ?? { x: b.x, y: b.y };
      const tx = lag.x - b.facing * 0.9;
      const prevX = this.kittenPos.x;
      this.kittenPos.x = damp(this.kittenPos.x, tx, 6, dt);
      this.kittenPos.y = damp(this.kittenPos.y, lag.y, 10, dt);
      const vx = (this.kittenPos.x - prevX) / Math.max(dt, 1e-3);
      this.kittenAnim.speed = Math.min(1.4, Math.abs(vx) / 4);
      this.kittenAnim.state = Math.abs(vx) > 0.4 ? 'walk' : 'idle';
      this.kittenAnim.facing = Math.abs(vx) > 0.4 ? (vx > 0 ? 1 : -1) : 0;
      this.kittenAnim.vy = 0;
    } else if (this.kittenState === 'reunited') {
      this.kittenPos.x = damp(this.kittenPos.x, this.layout.mamaCat.x - 0.9, 4, dt);
      this.kittenPos.y = damp(this.kittenPos.y, this.layout.mamaCat.y, 6, dt);
      this.kittenAnim.state = 'idle';
      this.kittenAnim.facing = 1;
    } else {
      this.kittenAnim.state = 'idle';
      this.kittenAnim.facing = 0;
      if (Math.sin(this.time * 1.3) > 0.995) this.kittenAnim.play('hop');
    }
    this.kittenRig.root.position.copyFrom(this.kittenPos);
    this.kittenAnim.update(dt);

    this.mamaAnim.facing = this.kittenState === 'reunited' ? -1 : 0;
    if (this.kittenState !== 'reunited') this.mamaRig.head.rotation.y = Math.sin(this.time * 1.5) * 0.4;
    this.mamaAnim.update(dt);

    for (const n of this.npcs) {
      const d = Math.abs(n.x - b.x);
      const near = d < 3.8;
      if (near && !n.near && this.phase === 'play') {
        n.anim.play('wave', 1.4);
        n.bubbleT = 1.8;
      }
      n.near = near;
      n.anim.facing = near ? (b.x > n.x ? 1 : -1) : 0;
      n.bubbleT = Math.max(0, n.bubbleT - dt);
      n.anim.update(dt);
    }
  }

  private updateCamera(dt: number): void {
    const b = this.body;
    const { minX, maxX } = this.layout.bounds;
    if (this.phase === 'play' || this.phase === 'respawn' || this.phase === 'complete') {
      const look = b.facing * 1.6 * Math.min(1, Math.abs(b.vx) / this.tuning.maxSpeed);
      this.camX = damp(this.camX, b.x + look, 4.5, dt);
      // Vertical follow with a dead-zone so small hops do not bob the view.
      const targetY = b.onGround || b.y > this.camY + 2.5 || b.y < this.camY - 1.5 ? b.y : this.camY;
      this.camY = damp(this.camY, targetY, 3, dt);
    }
    const viewHalf = 8;
    const x = clamp(this.camX, minX + viewHalf, maxX - viewHalf);
    const dist = 17.5 + this.camZoom;
    const y = Math.max(0, this.camY);
    this.camera.position.set(x, y + 2.9 + this.camZoom * 0.12, -dist);
    this.camera.setTarget(new Vector3(x, y + 2.2, 0));
    // Keep the shadow frustum centred on the action.
    this.sun.position.set(b.x - 20, b.y + 40, -25);
  }

  private project(x: number, y: number, z: number): { x: number; y: number; visible: boolean } {
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const p = Vector3.Project(new Vector3(x, y, z), Matrix.Identity(), this.scene.getTransformMatrix(), this.camera.viewport.toGlobal(w, h));
    const canvas = engine.getRenderingCanvas()!;
    const sx = (p.x / w) * canvas.clientWidth;
    const sy = (p.y / h) * canvas.clientHeight;
    return { x: sx, y: sy, visible: p.z > 0 && p.z < 1 && sx > -50 && sx < canvas.clientWidth + 50 };
  }

  private updateLabels(): void {
    const hud = this.ctx.hud;
    const b = this.body;
    // Kitten bubble / prompt.
    const kp = this.project(this.kittenPos.x, this.kittenPos.y + 1.3, this.kittenPos.z);
    const kittenNear = this.kittenState === 'waiting' && Math.abs(this.kittenPos.x - b.x) < 3;
    hud.label('kitten', {
      ...kp,
      visible: kp.visible && this.kittenState === 'waiting' && this.phase !== 'complete',
      text: kittenNear && !this.tuning.autoInteract ? t('npc.interact') : t('npc.kitten'),
      kind: kittenNear && !this.tuning.autoInteract ? 'prompt' : 'bubble',
    });
    const mp = this.project(this.layout.mamaCat.x, this.layout.mamaCat.y + 2.0, 0.9);
    hud.label('mama', { ...mp, visible: mp.visible && this.kittenState === 'reunited' && this.phase === 'play', text: t('npc.thanks'), kind: 'bubble' });
    this.npcs.forEach((n, i) => {
      const p = this.project(n.x, n.y + 1.9, n.z);
      hud.label(`npc${i}`, { ...p, visible: p.visible && n.bubbleT > 0, text: t('npc.hi'), kind: 'bubble' });
    });
    if (this.hintTarget) {
      const p = this.project(this.hintTarget.x, this.hintTarget.y + 1.2 + Math.abs(Math.sin(this.time * 5)) * 0.4, 0);
      hud.label('hint', { ...p, visible: p.visible, kind: 'arrow' });
    } else hud.label('hint', { x: 0, y: 0, visible: false, kind: 'arrow' });
  }

  /** Point at the next useful thing: kitten, Mama Cat, the next star, or the finish. */
  showHint(): void {
    const b = this.body;
    let target: { x: number; y: number };
    let key: 'obj.kitten' | 'obj.bring' | 'obj.finish' | 'obj.stars';
    if (this.kittenState === 'waiting' && (this.layout.kitten.x - b.x < 40 || b.x > this.layout.kitten.x)) {
      target = { x: this.kittenPos.x, y: this.kittenPos.y + 0.6 };
      key = 'obj.kitten';
    } else if (this.kittenState === 'following') {
      target = { x: this.layout.mamaCat.x, y: this.layout.mamaCat.y + 1 };
      key = 'obj.bring';
    } else {
      const next = this.stars.filter((s) => !s.collected && s.def.x > b.x - 2 && s.def.x < b.x + 25).sort((p, q) => Math.abs(p.def.x - b.x) - Math.abs(q.def.x - b.x))[0];
      if (next && this.kittenState !== 'reunited') {
        target = { x: next.def.x, y: next.def.y };
        key = 'obj.stars';
      } else {
        target = { x: this.layout.finish.x, y: 3 };
        key = this.kittenState === 'reunited' ? 'obj.finish' : 'obj.stars';
      }
    }
    this.hintTarget = { ...target, t: 4 };
    this.ctx.audio.speak(t(key));
  }

  debugState(): StageDebugState {
    return {
      phase: this.phase,
      x: this.body.x,
      y: this.body.y,
      onGround: this.body.onGround,
      stars: this.collected,
      totalStars: this.totalStars,
      bonusStars: this.bonusCollected,
      kitten: this.kittenState,
      checkpoint: this.activeCheckpoint,
      respawns: this.respawns,
      fps: this.scene.getEngine().getFps(),
    };
  }

  debugTeleport(x: number, y: number): void {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.trail = [];
    this.camX = x;
  }
}

export type { Mesh };
