/**
 * Builds the Labrador Town scenery from level data: sky, hills, ground,
 * platforms, canal water, houses, trees, flowers, playground and finish arch.
 * Static meshes are frozen; animated decor is updated in update().
 */
import {
  Color3,
  CreateBox,
  CreateCylinder,
  CreateDisc,
  CreatePlane,
  CreateSphere,
  CreateTorus,
  DynamicTexture,
  InstancedMesh,
  Mesh,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
} from '../engine/babylon';
import {
  MaterialLibrary,
  drawStarPath,
  paintBrick,
  paintCloudPlatform,
  paintCrate,
  paintGrassTop,
  paintSky,
  paintSoil,
  paintWood,
  roundRect,
} from '../engine/materials';
import type { HintDef, LevelLayout, MoverDef, PlatformDef } from '../levels/types';
import { bakeGroundAO, mergeColored } from '../engine/merge';
import { LivingWorld } from './LivingWorld';

const Z_FRONT = -3.5;
const Z_BACK = 4.5;
const DEPTH = Z_BACK - Z_FRONT;
const Z_MID = (Z_FRONT + Z_BACK) / 2;

export interface Sway {
  node: TransformNode | InstancedMesh | Mesh;
  amp: number;
  speed: number;
  phase: number;
  axis: 'z' | 'x';
}

export class TownEnvironment {
  readonly shadowReceivers: Mesh[] = [];
  readonly movers = new Map<string, Mesh>();
  readonly bouncePads = new Map<string, TransformNode>();
  readonly checkpointFlags = new Map<string, { flag: Mesh; pole: TransformNode; lamp: Mesh }>();
  private sways: Sway[] = [];
  private clouds: Array<{ node: TransformNode; speed: number }> = [];
  private balloons: Array<{ node: Mesh; phase: number; baseY: number }> = [];
  private waterTex: Texture[] = [];
  private bounceAnim = new Map<string, number>();
  private staticMeshes: Mesh[] = [];
  finishFlag!: Mesh;
  private life!: LivingWorld;

  constructor(private scene: Scene, private mats: MaterialLibrary, private layout: LevelLayout, private lowQuality: boolean, opts: { welcome?: boolean } = {}) {
    this.buildSky();
    this.buildBackground();
    this.buildPlatforms();
    this.buildWater();
    this.buildHouses();
    this.buildTrees();
    this.buildFlowersAndBushes();
    this.buildFencesLamps();
    this.buildPlayground();
    this.buildHints(layout.hints);
    this.life = new LivingWorld(scene, mats, layout, lowQuality, opts.welcome ?? true);
    this.buildCheckpoints();
    this.buildFinish();
    this.buildClouds();
    for (const m of this.staticMeshes) {
      m.freezeWorldMatrix();
      m.doNotSyncBoundingInfo = true;
      m.isPickable = false;
    }
  }

  /** Merge colour-material parts into one vertex-coloured mesh. */
  private mergeParts(name: string, meshes: Mesh[], emissive = 0.25, ao = 0): Mesh {
    const parts = meshes.map((m) => ({ mesh: m, color: (m.material as StandardMaterial).diffuseColor.toHexString() }));
    const merged = mergeColored(name, parts, this.mats, { emissive })!;
    if (ao > 0) bakeGroundAO(merged, ao);
    return merged;
  }

  private track(m: Mesh, receive = false): Mesh {
    m.isPickable = false;
    this.staticMeshes.push(m);
    if (receive) {
      m.receiveShadows = true;
      this.shadowReceivers.push(m);
    }
    return m;
  }

  private buildSky(): void {
    const sky = CreatePlane('sky', { width: 1400, height: 420 }, this.scene);
    sky.position.set(110, 60, 260);
    const mat = new StandardMaterial('skyMat', this.scene);
    const tex = new DynamicTexture('skyTex', { width: 16, height: 256 }, this.scene, false);
    paintSky(tex.getContext() as unknown as CanvasRenderingContext2D, 256);
    tex.update(true);
    mat.emissiveTexture = tex;
    mat.disableLighting = true;
    mat.fogEnabled = false;
    sky.material = mat;
    this.track(sky);
    // Sun.
    const sun = CreateDisc('sun', { radius: 14, tessellation: 48 }, this.scene);
    sun.position.set(40, 85, 250);
    const sm = new StandardMaterial('sunMat', this.scene);
    sm.emissiveColor = Color3.FromHexString('#FFF3B0');
    sm.disableLighting = true;
    sun.material = sm;
    this.track(sun);
  }

  private buildBackground(): void {
    const { minX, maxX } = this.layout.bounds;
    const lawn = CreateBox('lawn', { width: maxX - minX + 260, height: 1, depth: 140 }, this.scene);
    lawn.position.set((minX + maxX) / 2, -0.52, Z_BACK + 70);
    lawn.material = this.mats.color('#86D66A', { emissive: 0.25 });
    this.track(lawn, true);
    // Path in front of the houses.
    const path = CreateBox('path', { width: maxX - minX + 40, height: 0.05, depth: 2.2 }, this.scene);
    path.position.set((minX + maxX) / 2, -0.01, 8.6);
    path.material = this.mats.color('#F4DDB0', { emissive: 0.3 });
    this.track(path, true);
    // Rolling hills in layers for parallax depth.
    const hillColours = ['#7CCB63', '#69BD57', '#9ADB7A', '#B5E58F'];
    const step = this.lowQuality ? 34 : 24;
    let k = 0;
    const bg: Mesh[] = [];
    for (let x = minX - 80; x < maxX + 120; x += step) {
      const z = 55 + (k % 3) * 22;
      const r = 26 + ((k * 7) % 5) * 5;
      const hill = CreateSphere('hill', { diameter: 1, segments: 16 }, this.scene);
      hill.scaling.set(r * 2.2, r * 0.9, r);
      hill.position.set(x, -r * 0.18, z);
      hill.material = this.mats.color(hillColours[k % hillColours.length], { emissive: 0.32 });
      bg.push(hill);
      k++;
    }
    // Distant mountains, softly tinted by distance.
    for (let x = minX - 120; x < maxX + 200; x += 70) {
      const m = CreateCylinder('mtn', { diameterTop: 0, diameterBottom: 90, height: 55, tessellation: 6 }, this.scene);
      m.position.set(x, 18, 170);
      m.material = this.mats.color('#B4D0F4', { emissive: 0.6 });
      bg.push(m);
      const cap = CreateCylinder('mtnCap', { diameterTop: 0, diameterBottom: 26, height: 16, tessellation: 6 }, this.scene);
      cap.position.set(x, 37.5, 169);
      cap.material = this.mats.color('#FFFFFF', { emissive: 0.7 });
      bg.push(cap);
    }
    this.track(this.mergeParts('background', bg, 0.42));
  }

  private platformMaterial(p: { kind: string; w: number; h: number }): StandardMaterial {
    switch (p.kind) {
      case 'wood':
        return this.mats.textured('wood', paintWood, { uScale: Math.max(1, Math.round(p.w / 2)) });
      case 'crate':
        return this.mats.textured('crate', paintCrate);
      case 'brick':
        return this.mats.textured('brick', paintBrick, { uScale: Math.max(1, Math.round(p.w / 2)), vScale: Math.max(1, Math.round(p.h)) });
      case 'cloud':
        return this.mats.textured('cloudPlat', paintCloudPlatform, { emissive: 0.5 });
      default:
        return this.mats.color('#C98A4E');
    }
  }

  private buildPlatforms(): void {
    const grassTop = this.mats.textured('grassTop', paintGrassTop, { uScale: 6, vScale: 1, emissive: 0.22 });
    for (const p of this.layout.platforms) this.buildPlatform(p, grassTop);
    for (const m of this.layout.movers) this.buildMover(m);
  }

  private buildPlatform(p: PlatformDef, grassTop: StandardMaterial): void {
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    switch (p.kind) {
      case 'invisible':
        return;
      case 'ground': {
        const soil = CreateBox(`soil_${p.id}`, { width: p.w, height: p.h, depth: DEPTH }, this.scene);
        soil.position.set(cx, cy - 0.05, Z_MID);
        soil.material = this.mats.textured('soil', paintSoil, { uScale: Math.max(1, Math.round(p.w / 3)), vScale: 1 });
        this.track(soil, true);
        const top = CreateBox(`grass_${p.id}`, { width: p.w + 0.1, height: 0.3, depth: DEPTH + 0.1 }, this.scene);
        top.position.set(cx, p.y + p.h - 0.12, Z_MID);
        const gm = this.mats.textured('grassTop', paintGrassTop, { uScale: Math.max(1, Math.round(p.w / 4)), vScale: 2, emissive: 0.22 });
        top.material = gm ?? grassTop;
        this.track(top, true);
        // Rounded grass lip along the front edge.
        const lip = CreateCylinder(`lip_${p.id}`, { diameter: 0.5, height: p.w + 0.1, tessellation: 12 }, this.scene);
        lip.rotation.z = Math.PI / 2;
        lip.position.set(cx, p.y + p.h - 0.12, Z_FRONT);
        lip.material = this.mats.color('#5BC24C');
        this.track(lip, true);
        return;
      }
      case 'cloud': {
        const base = CreateBox(`cloudbase_${p.id}`, { width: p.w, height: p.h * 0.6, depth: 2.2 }, this.scene);
        base.position.set(cx, cy, 0);
        base.material = this.platformMaterial(p);
        this.track(base, true);
        const puffs = Math.ceil(p.w / 0.9);
        for (let i = 0; i < puffs; i++) {
          const s = CreateSphere('puff', { diameter: 1, segments: 10 }, this.scene);
          const r = 0.9 + (i % 2) * 0.35;
          s.scaling.set(r, r * 0.7, r * 1.4);
          s.position.set(p.x + 0.4 + (i * (p.w - 0.8)) / Math.max(1, puffs - 1), cy - 0.05 + (i % 2) * 0.08, 0);
          s.material = this.mats.color('#FFFFFF', { emissive: 0.55 });
          this.track(s);
        }
        return;
      }
      case 'bounce': {
        const node = new TransformNode(`bounce_${p.id}`, this.scene);
        node.position.set(cx, p.y, 0);
        const base = CreateCylinder('bbase', { diameterTop: p.w, diameterBottom: p.w + 0.2, height: 0.3, tessellation: 24 }, this.scene);
        base.parent = node;
        base.position.y = 0.15;
        base.material = this.mats.color('#3A86FF');
        const top = CreateCylinder('btop', { diameter: p.w - 0.1, height: 0.18, tessellation: 24 }, this.scene);
        top.parent = node;
        top.position.y = 0.36;
        top.material = this.mats.color('#FF5D8F', { emissive: 0.3 });
        const ring = CreateTorus('bring', { diameter: p.w - 0.1, thickness: 0.12, tessellation: 24 }, this.scene);
        ring.parent = node;
        ring.position.y = 0.36;
        ring.material = this.mats.color('#FFFFFF');
        for (const m of [base, top, ring]) m.isPickable = false;
        this.bouncePads.set(p.id, node);
        return;
      }
      default: {
        const box = CreateBox(`plat_${p.id}`, { width: p.w, height: p.h, depth: p.kind === 'wood' ? 2.4 : p.kind === 'brick' ? 3 : 1.6 }, this.scene);
        box.position.set(cx, cy, 0);
        box.material = this.platformMaterial(p);
        this.track(box, true);
        if (p.kind === 'wood') {
          for (const side of [0, 1]) {
            const post = CreateCylinder('post', { diameter: 0.18, height: 0.5, tessellation: 8 }, this.scene);
            post.position.set(p.x + 0.3 + side * (p.w - 0.6), p.y - 0.1, 1.0);
            post.material = this.mats.color('#9C5B2A');
            this.track(post);
            const bulb = CreateSphere('bulb', { diameter: 0.28, segments: 8 }, this.scene);
            bulb.position.set(p.x + 0.3 + side * (p.w - 0.6), p.y + p.h + 0.12, -1.05);
            bulb.material = this.mats.color('#FFD43B', { emissive: 0.6 });
            this.track(bulb);
          }
        }
      }
    }
  }

  private buildMover(m: MoverDef): void {
    const box = CreateBox(`mover_${m.id}`, { width: m.w, height: m.h, depth: 2.4 }, this.scene);
    box.position.set(m.x + m.w / 2, m.y + m.h / 2, 0);
    box.material = this.mats.color('#FFB703', { emissive: 0.3 });
    box.receiveShadows = true;
    box.isPickable = false;
    for (const side of [-1, 1]) {
      const prop = CreateCylinder('prop', { diameter: 0.5, height: 0.12, tessellation: 16 }, this.scene);
      prop.parent = box;
      prop.position.set(side * (m.w / 2 - 0.35), -0.25, 0);
      prop.material = this.mats.color('#8338EC');
    }
    this.movers.set(m.id, box);
  }

  private buildWater(): void {
    for (const w of this.layout.water) {
      const water = CreateBox(`water`, { width: w.w + 0.2, height: 0.3, depth: DEPTH + 0.6 }, this.scene);
      water.position.set(w.x + w.w / 2, -1.75, Z_MID);
      const tex = new DynamicTexture('waterTex', { width: 128, height: 128 }, this.scene, true);
      const ctx = tex.getContext() as unknown as CanvasRenderingContext2D;
      ctx.fillStyle = '#3FB8F5';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 4;
      for (let y = 16; y < 128; y += 32) {
        ctx.beginPath();
        for (let x = 0; x <= 128; x += 8) ctx.lineTo(x, y + Math.sin((x / 128) * Math.PI * 4) * 5);
        ctx.stroke();
      }
      tex.update(true);
      tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE;
      const mat = new StandardMaterial('waterMat', this.scene);
      const t = tex;
      t.uScale = Math.max(1, w.w / 2);
      t.vScale = 3;
      mat.diffuseTexture = t;
      mat.emissiveColor = new Color3(0.25, 0.35, 0.45);
      mat.specularColor = new Color3(0.6, 0.6, 0.6);
      mat.alpha = 0.92;
      water.material = mat;
      water.isPickable = false;
      this.waterTex.push(t);
      // Canal wall back panel so the gap reads as a stream, not a hole.
      const bed = CreateBox('bed', { width: w.w + 0.2, height: 0.4, depth: DEPTH + 0.6 }, this.scene);
      bed.position.set(w.x + w.w / 2, -2.4, Z_MID);
      bed.material = this.mats.color('#2D7FB8');
      this.track(bed);
      // Lily pads.
      const pad = CreateDisc('lily', { radius: 0.35, tessellation: 12 }, this.scene);
      pad.rotation.x = Math.PI / 2;
      pad.position.set(w.x + w.w * 0.3, -1.58, 2.5);
      pad.material = this.mats.color('#4CAF50');
      this.track(pad);
    }
  }

  private buildHouses(): void {
    const winMat = this.mats.color('#9EE0FF', { emissive: 0.45, specular: 0.8 });
    const frame = this.mats.color('#FFFFFF');
    const parts: Mesh[] = [];
    for (const h of this.layout.decor.houses) {
      const body = CreateBox('house', { width: h.w, height: h.h, depth: 4.5 }, this.scene);
      body.position.set(h.x, h.h / 2, h.z);
      body.material = this.mats.color(h.wall, { emissive: 0.28 });
      parts.push(body);
      const roof = CreateCylinder('roof', { diameter: 1, height: 5.2, tessellation: 3 }, this.scene);
      roof.rotation.x = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.scaling.set(h.w * 0.68 + 0.6, 1, 2.9);
      roof.position.set(h.x, h.h + 0.85, h.z);
      roof.material = this.mats.color(h.roof, { emissive: 0.25 });
      roof.rotation.z = Math.PI;
      parts.push(roof);
      const door = CreateBox('door', { width: 1.2, height: 2, depth: 0.1 }, this.scene);
      door.position.set(h.x, 1, h.z - 2.27);
      door.material = this.mats.color(h.door);
      parts.push(door);
      const knob = CreateSphere('knob', { diameter: 0.14, segments: 6 }, this.scene);
      knob.position.set(h.x + 0.38, 1, h.z - 2.34);
      knob.material = this.mats.color('#FFD43B');
      parts.push(knob);
      for (const side of [-1, 1]) {
        const wx = h.x + side * (h.w / 2 - 1.2);
        const fr = CreateBox('wframe', { width: 1.3, height: 1.3, depth: 0.1 }, this.scene);
        fr.position.set(wx, h.h * 0.55, h.z - 2.27);
        fr.material = frame;
        parts.push(fr);
        const win = CreateBox('win', { width: 1.05, height: 1.05, depth: 0.1 }, this.scene);
        win.position.set(wx, h.h * 0.55, h.z - 2.32);
        win.material = winMat;
        parts.push(win);
        const box = CreateBox('flowerbox', { width: 1.3, height: 0.25, depth: 0.35 }, this.scene);
        box.position.set(wx, h.h * 0.55 - 0.75, h.z - 2.4);
        box.material = this.mats.color('#C9772E');
        parts.push(box);
      }
      const chimney = CreateBox('chimney', { width: 0.7, height: 1.6, depth: 0.7 }, this.scene);
      chimney.position.set(h.x + h.w * 0.25, h.h + 1.3, h.z + 0.6);
      chimney.material = this.mats.color('#E26D5C');
      parts.push(chimney);
    }
    this.track(this.mergeParts('houses', parts, 0.3, 2.2), true);
  }

  private buildTrees(): void {
    const trunkMat = this.mats.color('#A0673A');
    const proto = {
      round: (() => {
        const n = new Mesh('treeRoundProto', this.scene);
        const trunk = CreateCylinder('trunk', { diameterTop: 0.35, diameterBottom: 0.5, height: 2.2, tessellation: 10 }, this.scene);
        trunk.position.y = 1.1;
        trunk.material = trunkMat;
        const leaves = [
          [0, 2.9, 0, 2.4],
          [-0.7, 2.5, 0.1, 1.6],
          [0.75, 2.6, -0.1, 1.7],
          [0.1, 3.6, 0, 1.6],
        ].map(([x, y, z, d]) => {
          const s = CreateSphere('leaf', { diameter: d, segments: 10 }, this.scene);
          s.position.set(x, y, z);
          s.material = this.mats.color('#52C25A', { emissive: 0.25 });
          return s;
        });
        const m = this.mergeParts('treeRound', [trunk, ...leaves], 0.25, 2.4);
        m.setEnabled(false);
        n.dispose();
        return m;
      })(),
      pine: (() => {
        const trunk = CreateCylinder('trunk', { diameter: 0.4, height: 1.4, tessellation: 8 }, this.scene);
        trunk.position.y = 0.7;
        trunk.material = trunkMat;
        const tiers = [0, 1, 2].map((i) => {
          const c = CreateCylinder('tier', { diameterTop: 0, diameterBottom: 2.6 - i * 0.6, height: 1.6, tessellation: 12 }, this.scene);
          c.position.y = 1.6 + i * 0.9;
          c.material = this.mats.color('#2FA35A', { emissive: 0.25 });
          return c;
        });
        const m = this.mergeParts('treePine', [trunk, ...tiers], 0.25, 2.4);
        m.setEnabled(false);
        return m;
      })(),
    };
    let i = 0;
    for (const t of this.layout.decor.trees) {
      const inst = proto[t.kind].createInstance(`tree${i++}`);
      inst.position.set(t.x, 0, t.z);
      inst.scaling.setAll(t.s);
      inst.isPickable = false;
      this.sways.push({ node: inst, amp: 0.035, speed: 1.2 + (i % 5) * 0.15, phase: i, axis: 'z' });
    }
  }

  private buildFlowersAndBushes(): void {
    const protos = new Map<string, Mesh>();
    const stemMat = this.mats.color('#3FA34D');
    const getProto = (colour: string) => {
      let p = protos.get(colour);
      if (p) return p;
      const stem = CreateCylinder('stem', { diameter: 0.05, height: 0.45, tessellation: 5 }, this.scene);
      stem.position.y = 0.22;
      stem.material = stemMat;
      const petals: Mesh[] = [];
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const pt = CreateSphere('petal', { diameter: 0.16, segments: 6 }, this.scene);
        pt.position.set(Math.cos(a) * 0.1, 0.5 + Math.sin(a) * 0.1, -0.02);
        pt.scaling.z = 0.5;
        pt.material = this.mats.color(colour, { emissive: 0.35 });
        petals.push(pt);
      }
      const centre = CreateSphere('centre', { diameter: 0.11, segments: 6 }, this.scene);
      centre.position.set(0, 0.5, -0.05);
      centre.material = this.mats.color('#FFB703', { emissive: 0.4 });
      p = this.mergeParts('flower', [stem, ...petals, centre], 0.35);
      p.setEnabled(false);
      protos.set(colour, p);
      return p;
    };
    const flowers = this.lowQuality ? this.layout.decor.flowers.filter((_, i) => i % 2 === 0) : this.layout.decor.flowers;
    flowers.forEach((f, i) => {
      const inst = getProto(f.color).createInstance(`flower${i}`);
      inst.position.set(f.x, 0.02, f.z);
      inst.scaling.setAll(1.3);
      inst.isPickable = false;
      this.sways.push({ node: inst, amp: 0.18, speed: 2 + (i % 4) * 0.4, phase: i * 0.7, axis: 'z' });
    });
    const bushProto = (() => {
      const parts = [
        [0, 0.45, 0, 1.2],
        [-0.55, 0.35, 0.05, 0.9],
        [0.55, 0.35, 0.05, 0.9],
      ].map(([x, y, z, d]) => {
        const s = CreateSphere('bush', { diameter: d, segments: 10 }, this.scene);
        s.position.set(x, y, z);
        s.material = this.mats.color('#45B649', { emissive: 0.25 });
        return s;
      });
      const berry = CreateSphere('berry', { diameter: 0.14, segments: 6 }, this.scene);
      berry.position.set(0.2, 0.75, -0.5);
      berry.material = this.mats.color('#FF4D6D', { emissive: 0.4 });
      const m = this.mergeParts('bush', [...parts, berry], 0.25, 0.9);
      m.setEnabled(false);
      return m;
    })();
    this.layout.decor.bushes.forEach((b, i) => {
      const inst = bushProto.createInstance(`bush${i}`);
      inst.position.set(b.x, 0, b.z);
      inst.scaling.setAll(b.s);
      inst.isPickable = false;
      this.sways.push({ node: inst, amp: 0.03, speed: 1.6, phase: i, axis: 'x' });
    });
  }

  private buildFencesLamps(): void {
    const fenceProto = (() => {
      const parts: Mesh[] = [];
      for (let i = 0; i < 5; i++) {
        const picket = CreateBox('picket', { width: 0.22, height: 1.1, depth: 0.1 }, this.scene);
        picket.position.set(-1.8 + i * 0.9, 0.55, 0);
        picket.material = this.mats.color('#FFFFFF');
        const tip = CreateCylinder('tip', { diameterTop: 0, diameterBottom: 0.31, height: 0.2, tessellation: 4 }, this.scene);
        tip.position.set(-1.8 + i * 0.9, 1.2, 0);
        tip.rotation.y = Math.PI / 4;
        tip.material = this.mats.color('#FFFFFF');
        parts.push(picket, tip);
      }
      for (const y of [0.35, 0.8]) {
        const rail = CreateBox('rail', { width: 4, height: 0.12, depth: 0.08 }, this.scene);
        rail.position.set(0, y, 0.07);
        rail.material = this.mats.color('#F3E9DC');
        parts.push(rail);
      }
      const m = this.mergeParts('fence', parts, 0.3, 0.9);
      m.setEnabled(false);
      return m;
    })();
    this.layout.decor.fences.forEach((f, i) => {
      const inst = fenceProto.createInstance(`fence${i}`);
      inst.position.set(f.x, 0, f.z);
      inst.isPickable = false;
    });
    const lampProto = (() => {
      const pole = CreateCylinder('pole', { diameter: 0.14, height: 3, tessellation: 8 }, this.scene);
      pole.position.y = 1.5;
      pole.material = this.mats.color('#3D405B');
      const head = CreateSphere('lampHead', { diameter: 0.5, segments: 10 }, this.scene);
      head.position.y = 3.15;
      head.material = this.mats.color('#FFF3B0', { emissive: 0.8 });
      const cap = CreateCylinder('lampCap', { diameterTop: 0.1, diameterBottom: 0.6, height: 0.25, tessellation: 10 }, this.scene);
      cap.position.y = 3.45;
      cap.material = this.mats.color('#3D405B');
      const m = this.mergeParts('lamp', [pole, head, cap], 0.35);
      m.setEnabled(false);
      return m;
    })();
    this.layout.decor.lamps.forEach((l, i) => {
      const inst = lampProto.createInstance(`lamp${i}`);
      inst.position.set(l.x, 0, l.z);
      inst.isPickable = false;
    });
  }

  private buildPlayground(): void {
    for (const p of this.layout.decor.playground) {
      const parts: Mesh[] = [];
      if (p.kind === 'slide') {
        const ladder = CreateBox('ladder', { width: 0.9, height: 3, depth: 0.2 }, this.scene);
        ladder.position.set(p.x - 1.5, 1.5, p.z);
        ladder.material = this.mats.color('#3A86FF');
        const deck = CreateBox('deck', { width: 1.4, height: 0.2, depth: 1.4 }, this.scene);
        deck.position.set(p.x - 1, 3, p.z);
        deck.material = this.mats.color('#FFBE0B');
        const slide = CreateBox('slide', { width: 4.2, height: 0.15, depth: 1.1 }, this.scene);
        slide.rotation.z = -0.62;
        slide.position.set(p.x + 0.9, 1.65, p.z);
        slide.material = this.mats.color('#FF006E');
        const roof = CreateCylinder('sroof', { diameterTop: 0, diameterBottom: 2, height: 1.2, tessellation: 4 }, this.scene);
        roof.position.set(p.x - 1, 4.6, p.z);
        roof.rotation.y = Math.PI / 4;
        roof.material = this.mats.color('#8338EC');
        const pole = CreateCylinder('spole', { diameter: 0.15, height: 1.4, tessellation: 6 }, this.scene);
        pole.position.set(p.x - 1, 3.7, p.z);
        pole.material = this.mats.color('#FFFFFF');
        parts.push(ladder, deck, slide, roof, pole);
      } else if (p.kind === 'swing') {
        for (const side of [-1, 1]) {
          const leg = CreateCylinder('sleg', { diameter: 0.18, height: 3.4, tessellation: 8 }, this.scene);
          leg.position.set(p.x + side * 1.6, 1.6, p.z);
          leg.rotation.z = side * 0.12;
          leg.material = this.mats.color('#FB5607');
          parts.push(leg);
        }
        const bar = CreateCylinder('sbar', { diameter: 0.18, height: 3.4, tessellation: 8 }, this.scene);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(p.x, 3.3, p.z);
        bar.material = this.mats.color('#FB5607');
        parts.push(bar);
        const swing = new TransformNode('swingPivot', this.scene);
        swing.position.set(p.x, 3.3, p.z);
        for (const side of [-1, 1]) {
          const rope = CreateCylinder('rope', { diameter: 0.05, height: 2.2, tessellation: 4 }, this.scene);
          rope.parent = swing;
          rope.position.set(side * 0.45, -1.1, 0);
          rope.material = this.mats.color('#7A5C3E');
        }
        const seat = CreateBox('seat', { width: 1.1, height: 0.12, depth: 0.5 }, this.scene);
        seat.parent = swing;
        seat.position.y = -2.2;
        seat.material = this.mats.color('#3A86FF');
        this.sways.push({ node: swing, amp: 0.35, speed: 1.6, phase: 0, axis: 'x' });
      } else {
        const base = CreateCylinder('sbase', { diameterTop: 0.2, diameterBottom: 0.8, height: 0.7, tessellation: 4 }, this.scene);
        base.position.set(p.x, 0.35, p.z);
        base.material = this.mats.color('#FFBE0B');
        parts.push(base);
        const plank = CreateBox('seesaw', { width: 4.4, height: 0.15, depth: 0.5 }, this.scene);
        plank.position.set(p.x, 0.75, p.z);
        plank.material = this.mats.color('#06D6A0');
        this.sways.push({ node: plank, amp: 0.22, speed: 1.4, phase: 0, axis: 'z' });
      }
      if (parts.length) this.track(this.mergeParts('playground', parts, 0.25, 1.4), true);
    }
  }

  private signTexture(name: string, draw: (ctx: CanvasRenderingContext2D, s: number) => void): StandardMaterial {
    return this.mats.textured(name, (ctx, s) => {
      ctx.fillStyle = '#FFF6E0';
      ctx.fillRect(0, 0, s, s);
      ctx.strokeStyle = '#C9772E';
      ctx.lineWidth = s * 0.06;
      roundRect(ctx, s * 0.05, s * 0.05, s * 0.9, s * 0.9, s * 0.12);
      ctx.stroke();
      draw(ctx, s);
    }, { size: 256, emissive: 0.55 });
  }

  private buildHints(hints: HintDef[]): void {
    const drawArrow = (ctx: CanvasRenderingContext2D, s: number, up: boolean) => {
      ctx.save();
      ctx.translate(s / 2, s / 2);
      if (up) ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      ctx.moveTo(-s * 0.3, -s * 0.1);
      ctx.lineTo(s * 0.05, -s * 0.1);
      ctx.lineTo(s * 0.05, -s * 0.25);
      ctx.lineTo(s * 0.33, 0);
      ctx.lineTo(s * 0.05, s * 0.25);
      ctx.lineTo(s * 0.05, s * 0.1);
      ctx.lineTo(-s * 0.3, s * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };
    for (const h of hints) {
      const mat = this.signTexture(`sign_${h.icon}`, (ctx, s) => {
        if (h.icon === 'move') drawArrow(ctx, s, false);
        else if (h.icon === 'jump') drawArrow(ctx, s, true);
        else {
          ctx.strokeStyle = '#3A86FF';
          ctx.lineWidth = s * 0.06;
          ctx.beginPath();
          for (let i = 0; i <= 40; i++) {
            const y = s * 0.78 - i * s * 0.012;
            const x = s / 2 + Math.sin(i * 0.9) * s * 0.18;
            if (i) ctx.lineTo(x, y);
            else ctx.moveTo(x, y);
          }
          ctx.stroke();
          drawArrow(ctx, s * 0.9, true);
        }
      });
      const post = CreateCylinder('signPost', { diameter: 0.16, height: 1.4, tessellation: 6 }, this.scene);
      post.position.set(h.x, 0.7, 1.4);
      post.material = this.mats.color('#9C5B2A');
      this.track(post);
      const board = CreatePlane('signBoard', { size: 1.5 }, this.scene);
      board.position.set(h.x, 1.9, 1.3);
      board.material = mat;
      this.track(board);
      const back = CreateBox('signBack', { width: 1.6, height: 1.6, depth: 0.08 }, this.scene);
      back.position.set(h.x, 1.9, 1.36);
      back.material = this.mats.color('#C9772E');
      this.track(back);
    }
    // Town welcome sign with a star.
    for (const s of this.layout.decor.signs) {
      const mat = this.signTexture('welcome', (ctx, size) => {
        ctx.fillStyle = '#FFD43B';
        drawStarPath(ctx, size / 2, size / 2, size * 0.32, size * 0.13);
        ctx.fill();
        ctx.strokeStyle = '#E8832A';
        ctx.lineWidth = 6;
        ctx.stroke();
      });
      const post = CreateCylinder('signPost', { diameter: 0.2, height: 2, tessellation: 6 }, this.scene);
      post.position.set(s.x, 1, s.z);
      post.material = this.mats.color('#9C5B2A');
      this.track(post);
      const board = CreatePlane('welcomeBoard', { size: 1.8 }, this.scene);
      board.position.set(s.x, 2.6, s.z - 0.06);
      board.material = mat;
      this.track(board);
    }
  }

  private buildCheckpoints(): void {
    for (const cp of this.layout.checkpoints) {
      const pole = new TransformNode(`cp_${cp.id}`, this.scene);
      pole.position.set(cp.x, cp.y, 1.6);
      const stick = CreateCylinder('cpPole', { diameter: 0.14, height: 3.2, tessellation: 10 }, this.scene);
      stick.parent = pole;
      stick.position.y = 1.6;
      stick.material = this.mats.color('#E0E0E0', { specular: 0.6 });
      const base = CreateCylinder('cpBase', { diameterTop: 0.5, diameterBottom: 0.8, height: 0.3, tessellation: 16 }, this.scene);
      base.parent = pole;
      base.position.y = 0.15;
      base.material = this.mats.color('#3A86FF');
      const lamp = CreateSphere('cpLamp', { diameter: 0.36, segments: 10 }, this.scene);
      lamp.parent = pole;
      lamp.position.y = 3.3;
      lamp.material = this.mats.color('#9AA5B1');
      const flag = this.life.makeFlag(`cpFlag_${cp.id}`, (ctx, s) => {
        ctx.fillStyle = '#3A86FF';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#74B3FF';
        ctx.fillRect(0, s * 0.8, s, s * 0.2);
        ctx.fillStyle = '#FFD43B';
        drawStarPath(ctx, s / 2, s / 2, s * 0.3, s * 0.12);
        ctx.fill();
      });
      flag.parent = pole;
      flag.position.set(0.07, 0.9, 0);
      for (const m of [stick, base, lamp, flag]) m.isPickable = false;
      this.checkpointFlags.set(cp.id, { flag, pole, lamp });
    }
  }

  private buildFinish(): void {
    const f = this.layout.finish;
    const parts: Mesh[] = [];
    for (const side of [-1, 1]) {
      const post = CreateCylinder('fPost', { diameter: 0.45, height: 5, tessellation: 12 }, this.scene);
      post.position.set(f.x, 2.5, side * 2.4 + 0.5);
      post.material = this.mats.textured('candy', (ctx, s) => {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#FF4D6D';
        for (let i = -s; i < s * 2; i += s / 4) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i + s / 8, 0);
          ctx.lineTo(i + s / 8 + s / 2, s);
          ctx.lineTo(i + s / 2, s);
          ctx.fill();
        }
      }, { size: 128, vScale: 4, emissive: 0.35 });
      parts.push(post);
    }
    const merged = Mesh.MergeMeshes(parts, true, true);
    if (merged) this.track(merged, true);
    const arch = CreateTorus('fArch', { diameter: 4.8, thickness: 0.4, tessellation: 32 }, this.scene);
    arch.rotation.y = Math.PI / 2;
    arch.rotation.z = Math.PI / 2;
    arch.scaling.set(1, 1, 1);
    arch.position.set(f.x, 5, 0.5);
    arch.material = this.mats.color('#FFD43B', { emissive: 0.4 });
    this.track(arch);
    const banner = this.life.makeStrungBanner('finishBanner', (ctx, s) => {
      const cell = s / 16;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#2A1E3B' : '#FFFFFF';
        ctx.fillRect(x * cell, y * cell, cell, cell);
        ctx.fillRect(x * cell, s - (y + 1) * cell, cell, cell);
      }
      ctx.fillStyle = '#FFD43B';
      ctx.fillRect(0, cell * 4, s, s - cell * 8);
      ctx.font = `700 ${Math.round(s * 0.3)}px Fredoka, "Arial Rounded MT Bold", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = s * 0.03;
      ctx.strokeStyle = '#2A1E3B';
      ctx.strokeText('FINISH', s / 2, s / 2);
      ctx.fillStyle = '#FF5D73';
      ctx.fillText('FINISH', s / 2, s / 2);
    }, 5.2, 1.5, 256);
    banner.position.set(f.x, 6.4, -1.9);
    this.finishFlag = banner;
    for (const b of this.layout.decor.balloons) {
      const balloon = CreateSphere('balloon', { diameter: 1, segments: 12 }, this.scene);
      balloon.scaling.set(0.7, 0.85, 0.7);
      balloon.position.set(b.x, b.y, b.z - 2.3);
      balloon.material = this.mats.color(b.color, { emissive: 0.35, specular: 0.8 });
      balloon.isPickable = false;
      const string = CreateCylinder('bstring', { diameter: 0.02, height: 1.2, tessellation: 3 }, this.scene);
      string.parent = balloon;
      string.position.y = -1.1;
      string.material = this.mats.color('#FFFFFF');
      this.balloons.push({ node: balloon, phase: b.x + b.y, baseY: b.y });
    }
  }

  private buildClouds(): void {
    const proto = (() => {
      const parts = [
        [0, 0, 0, 3],
        [-1.6, -0.3, 0.2, 2.2],
        [1.7, -0.25, 0.1, 2.4],
        [0.7, 0.8, 0.3, 2],
      ].map(([x, y, z, d]) => {
        const s = CreateSphere('cloud', { diameter: d, segments: 10 }, this.scene);
        s.position.set(x, y, z);
        s.material = this.mats.color('#FFFFFF', { emissive: 0.75 });
        return s;
      });
      const m = this.mergeParts('cloud', parts, 0.75);
      m.setEnabled(false);
      return m;
    })();
    const { minX, maxX } = this.layout.bounds;
    const count = this.lowQuality ? 10 : 18;
    for (let i = 0; i < count; i++) {
      const c = proto.createInstance(`cloud${i}`);
      const z = 30 + (i % 4) * 18;
      c.position.set(minX + ((maxX - minX + 80) * i) / count, 12 + (i % 3) * 4 + z * 0.08, z);
      c.scaling.setAll(1 + (i % 3) * 0.4);
      c.isPickable = false;
      this.clouds.push({ node: c, speed: 0.4 + (i % 3) * 0.25 });
    }
  }

  bounce(id: string): void {
    this.bounceAnim.set(id, 0.4);
  }

  update(dt: number, time: number, camX = 0): void {
    this.life.update(dt, time, camX);
    for (const c of this.clouds) {
      c.node.position.y += Math.sin(time * 0.5 + c.node.position.z) * 0.004;
      const br = 1 + Math.sin(time * 0.7 + c.node.position.x * 0.1) * 0.03;
      c.node.scaling.y = c.node.scaling.x * br;
    }
    for (const s of this.sways) {
      const v = Math.sin(time * s.speed + s.phase) * s.amp;
      if (s.axis === 'z') s.node.rotation.z = v;
      else s.node.rotation.x = v;
    }
    const { minX, maxX } = this.layout.bounds;
    for (const c of this.clouds) {
      c.node.position.x += c.speed * dt;
      if (c.node.position.x > maxX + 60) c.node.position.x = minX - 60;
    }
    for (const b of this.balloons) b.node.position.y = b.baseY + Math.sin(time * 1.5 + b.phase) * 0.18;
    for (const t of this.waterTex) t.uOffset = (t.uOffset + dt * 0.08) % 1;
    for (const [id, tLeft] of this.bounceAnim) {
      const node = this.bouncePads.get(id);
      if (!node) continue;
      const left = tLeft - dt;
      const k = Math.max(0, left / 0.4);
      node.scaling.y = 1 - Math.sin(k * Math.PI * 3) * 0.3 * k;
      if (left <= 0) {
        this.bounceAnim.delete(id);
        node.scaling.y = 1;
      } else this.bounceAnim.set(id, left);
    }
  }
}
