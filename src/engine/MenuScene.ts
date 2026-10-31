/**
 * Animated 3D backdrop for the title and menu screens: a corner of
 * Labrador Town with the three heroes and the kitten. Also renders hero portraits.
 */
import { applyLook } from './look';
import { Color3, Color4, DirectionalLight, HemisphericLight, Scene, ShadowGenerator, TargetCamera, Vector3 } from './babylon';
import { CreateScreenshotUsingRenderTargetAsync } from '@babylonjs/core/Misc/screenshotTools';
import { RigAnimator } from '../animations/RigAnimator';
import { HEROES, HERO_ORDER } from '../characters/heroes';
import { buildCritter, buildHero, type Rig } from '../characters/models';
import type { HeroId } from '../core/types';
import { TownEnvironment } from '../environment/TownEnvironment';
import { buildStage1Layout } from '../levels/stage1/layout';
import { damp } from '../utilities/math';
import type { EngineHost } from './EngineHost';
import { MaterialLibrary } from './materials';

const HERO_X: Record<HeroId, number> = { pepper: 3.6, biscuit: 6.2, poppy: 8.8 };

export class MenuScene {
  readonly scene: Scene;
  private camera: TargetCamera;
  private heroes = new Map<HeroId, { rig: Rig; anim: RigAnimator }>();
  private kitten: { rig: Rig; anim: RigAnimator };
  private env: TownEnvironment;
  private time = 0;
  private focus: HeroId | null = null;
  private waveIn = 1.5;
  private camX = 6.2;

  constructor(private host: EngineHost) {
    const low = host.quality === 'low';
    const scene = new Scene(host.engine);
    this.scene = scene;
    scene.clearColor = Color4.FromHexString('#8FD3FFFF');
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogColor = Color3.FromHexString('#CDEBFF');
    scene.fogStart = 90;
    scene.fogEnd = 320;
    scene.skipPointerMovePicking = true;
    this.camera = new TargetCamera('menuCam', new Vector3(6.2, 3, -13), scene);
    this.camera.fov = 0.7;
    this.camera.minZ = 0.3;
    this.camera.maxZ = 700;
    const hemi = new HemisphericLight('h', new Vector3(0.2, 1, -0.3), scene);
    const sun = new DirectionalLight('s', new Vector3(0.45, -1, 0.55), scene);
    sun.position.set(-10, 30, -20);
    applyLook(scene, hemi, sun, low);
    const mats = new MaterialLibrary(scene);

    const full = buildStage1Layout('junior');
    const near = (x: number) => x > -40 && x < 50;
    const layout = {
      ...full,
      platforms: full.platforms.filter((p) => p.kind === 'ground' && p.x < 50),
      movers: [],
      water: [],
      stars: [],
      checkpoints: [],
      hints: [],
      npcs: [],
      bounds: { minX: -40, maxX: 50 },
      decor: {
        ...full.decor,
        houses: full.decor.houses.filter((h) => near(h.x)),
        trees: full.decor.trees.filter((t) => near(t.x)),
        flowers: full.decor.flowers.filter((f) => near(f.x)),
        fences: full.decor.fences.filter((f) => near(f.x)),
        lamps: full.decor.lamps.filter((l) => near(l.x)),
        bushes: full.decor.bushes.filter((b) => near(b.x)),
        playground: [],
        signs: [],
        balloons: [],
      },
      finish: { x: 400, y: 0 },
    };
    this.env = new TownEnvironment(scene, mats, layout, low, { welcome: false });

    let shadows: ShadowGenerator | null = null;
    if (!low) {
      shadows = new ShadowGenerator(1024, sun);
      shadows.usePoissonSampling = true;
      shadows.setDarkness(0.45);
    }
    for (const id of HERO_ORDER) {
      const rig = buildHero(scene, mats, HEROES[id], !low);
      rig.root.position.set(HERO_X[id], 0, 0);
      const anim = new RigAnimator(rig);
      this.heroes.set(id, { rig, anim });
      if (shadows) rig.meshes.forEach((m) => shadows!.addShadowCaster(m, false));
    }
    const krig = buildCritter(scene, mats, 'kitten', !low);
    krig.root.position.set(10.6, 0, -0.6);
    this.kitten = { rig: krig, anim: new RigAnimator(krig) };
    mats.freezeAll();
    scene.onBeforeRenderObservable.add(() => this.update());
  }

  /** Highlight one hero (hero select), or none (title). */
  setFocus(id: HeroId | null): void {
    if (id && id !== this.focus) {
      const h = this.heroes.get(id);
      h?.anim.play('hop');
      setTimeout(() => h?.anim.play('wave', 1.4), 450);
    }
    this.focus = id;
  }

  cheer(): void {
    this.heroes.forEach((h, i) => setTimeout(() => h.anim.play('celebrate', 1.6), HERO_ORDER.indexOf(i) * 150));
    this.kitten.anim.play('hop');
  }

  private update(): void {
    const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
    this.time += dt;
    this.waveIn -= dt;
    if (this.waveIn <= 0 && !this.focus) {
      const id = HERO_ORDER[Math.floor(Math.random() * 3)];
      this.heroes.get(id)?.anim.play(Math.random() > 0.5 ? 'wave' : 'hop', 1.4);
      this.waveIn = 2.5 + Math.random() * 2;
    }
    this.heroes.forEach((h, id) => {
      h.anim.facing = 0;
      h.anim.state = 'idle';
      const s = this.focus === id ? 1.12 : 1;
      h.rig.root.scaling.setAll(damp(h.rig.root.scaling.x, s, 8, dt));
      h.anim.update(dt);
    });
    if (Math.sin(this.time * 0.9) > 0.995) this.kitten.anim.play('hop');
    this.kitten.anim.update(dt);
    this.env.update(dt, this.time);
    const tx = this.focus ? HERO_X[this.focus] : 6.2;
    this.camX = damp(this.camX, tx, 3, dt);
    const sway = Math.sin(this.time * 0.25) * 0.6;
    this.camera.position.set(this.camX + sway, 3.1, -12.5);
    this.camera.setTarget(new Vector3(this.camX + sway * 0.5, 1.6, 2));
  }

  /** Render a square close-up of each hero for the selection cards. */
  async portraits(): Promise<Record<HeroId, string>> {
    const out = {} as Record<HeroId, string>;
    await this.scene.whenReadyAsync();
    const cam = new TargetCamera('portraitCam', Vector3.Zero(), this.scene);
    cam.fov = 0.55;
    cam.minZ = 0.3;
    cam.maxZ = 700;
    for (const id of HERO_ORDER) {
      const x = HERO_X[id];
      cam.position.set(x, 1.45, -4.2);
      cam.setTarget(new Vector3(x, 1.15, 0));
      try {
        out[id] = await CreateScreenshotUsingRenderTargetAsync(this.host.engine, cam, { width: 320, height: 320 }, 'image/png', 4, true);
      } catch {
        out[id] = '';
      }
    }
    cam.dispose();
    return out;
  }

  render(): void {
    this.scene.render();
  }

  dispose(): void {
    this.scene.dispose();
  }
}
