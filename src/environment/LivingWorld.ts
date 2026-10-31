/**
 * Ambient life for the town: waving banners and bunting, chimney smoke,
 * birds, butterflies, a windmill, drifting hot-air balloons, sun rays,
 * storybook cottages and drifting petals. Everything here is decoration;
 * nothing affects gameplay or collisions.
 */
import {
  Color3,
  Color4,
  CreateBox,
  CreateCylinder,
  CreateSphere,
  InstancedMesh,
  Mesh,
  ParticleSystem,
  Scene,
  TransformNode,
  Vector3,
  VertexData,
} from '../engine/babylon';
import { Cloth } from '../engine/cloth';
import { MaterialLibrary, particleTexture } from '../engine/materials';
import { bakeGroundAO, mergeColored } from '../engine/merge';
import type { LevelLayout } from '../levels/types';

const BUNTING = ['#FF5D73', '#FFD43B', '#4CC9F0', '#9B5DE5', '#06D6A0', '#FF8A3D'];

interface Pennant { node: InstancedMesh; phase: number }
interface Flyer { node: TransformNode; wings: TransformNode[]; speed: number; phase: number; baseY: number; z: number; flap: number }
interface Butterfly { node: TransformNode; wings: TransformNode[]; anchorX: number; anchorY: number; z: number; phase: number; rx: number; ry: number }
interface Puff { node: InstancedMesh; t: number; life: number; x: number; y: number; z: number; drift: number }

export class LivingWorld {
  private cloths: Cloth[] = [];
  private pennants: Pennant[] = [];
  private birds: Flyer[] = [];
  private butterflies: Butterfly[] = [];
  private puffs: Puff[] = [];
  private spinners: Array<{ node: TransformNode; speed: number }> = [];
  private drifters: Array<{ node: TransformNode; speed: number; baseY: number; phase: number }> = [];
  private petals?: ParticleSystem;
  private petalEmitter = new Vector3(0, 8, 0);
  private sunRays?: Mesh;
  private hasWelcome = false;

  constructor(private scene: Scene, private mats: MaterialLibrary, private layout: LevelLayout, private low: boolean, welcome = true) {
    if (welcome) this.buildWelcomeBanner();
    this.buildBunting();
    this.buildShopBanners();
    this.buildStorybookCottages();
    this.buildChimneySmoke();
    this.buildBirds();
    this.buildButterflies();
    this.buildWindmills();
    this.buildHotAirBalloons();
    this.buildSunRays();
    if (!low) this.buildPetals();
  }

  /** A waving cloth flag pinned on its left edge, for checkpoint poles. */
  makeFlag(name: string, painter: (ctx: CanvasRenderingContext2D, s: number) => void, w = 1.3, h = 0.85): Mesh {
    const c = new Cloth(name, this.scene, w, h, 'left', { nx: 10, ny: 4, amp: 0.12, speed: 6, wave: 2, skipFrames: this.low ? 1 : 0 });
    const m = this.mats.textured(`${name}Tex`, painter, { size: 128, emissive: 0.5 });
    m.backFaceCulling = false;
    c.mesh.material = m;
    this.cloths.push(c);
    return c.mesh;
  }

  /** A banner strung between two posts (e.g. the finish arch). */
  makeStrungBanner(name: string, painter: (ctx: CanvasRenderingContext2D, s: number) => void, w: number, h: number, size = 256): Mesh {
    const c = new Cloth(name, this.scene, w, h, 'ends', { nx: 18, ny: 5, amp: 0.22, speed: 3.2, wave: 1.6, sag: 0.18, skipFrames: this.low ? 1 : 0 });
    const m = this.mats.textured(`${name}Tex`, painter, { size, emissive: 0.55 });
    m.backFaceCulling = false;
    c.mesh.material = m;
    this.cloths.push(c);
    return c.mesh;
  }

  private buildWelcomeBanner(): void {
    this.hasWelcome = true;
    const x = this.layout.start.x + 9;
    const z = 1.8;
    const postMat = this.mats.color('#8D5A3B');
    for (const side of [-1, 1]) {
      const post = CreateCylinder('wbPost', { diameter: 0.28, height: 6.2, tessellation: 10 }, this.scene);
      post.position.set(x + side * 4.4, 3.1, z);
      post.material = postMat;
      post.isPickable = false;
      const knob = CreateSphere('wbKnob', { diameter: 0.5, segments: 10 }, this.scene);
      knob.position.set(x + side * 4.4, 6.3, z);
      knob.material = this.mats.color('#FFD43B', { emissive: 0.5 });
      knob.isPickable = false;
    }
    const banner = this.makeStrungBanner('welcome', (ctx, s) => {
      const w = s;
      const h = s;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#FFF6D6');
      g.addColorStop(1, '#FFE08A');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#FF8A3D';
      ctx.fillRect(0, 0, w, h * 0.08);
      ctx.fillRect(0, h * 0.92, w, h * 0.08);
      // Scalloped trim.
      ctx.fillStyle = '#FF5D73';
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.arc((i + 0.5) * (w / 16), h * 0.08, w / 32, 0, Math.PI);
        ctx.fill();
      }
      const word = 'LABRADOR TOWN';
      ctx.font = `700 ${Math.round(h * 0.42)}px Fredoka, "Arial Rounded MT Bold", sans-serif`;
      ctx.textBaseline = 'middle';
      const total = ctx.measureText(word).width;
      const scale = Math.min(1, (w * 0.92) / total);
      ctx.save();
      ctx.translate(w / 2, h * 0.53);
      ctx.scale(scale, 1);
      let cx = -total / 2;
      [...word].forEach((ch, i) => {
        const cw = ctx.measureText(ch).width;
        ctx.lineWidth = h * 0.06;
        ctx.strokeStyle = '#2A1E3B';
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, cx, (i % 2 ? -1 : 1) * h * 0.02);
        ctx.fillStyle = BUNTING[i % BUNTING.length];
        ctx.fillText(ch, cx, (i % 2 ? -1 : 1) * h * 0.02);
        cx += cw;
      });
      ctx.restore();
    }, 8.4, 1.5, 512);
    banner.position.set(x, 5.9, z - 0.05);
  }

  private pennantProto(color: string): Mesh {
    const m = new Mesh(`pennant_${color}`, this.scene);
    const vd = new VertexData();
    vd.positions = [-0.22, 0, 0, 0.22, 0, 0, 0, -0.5, 0];
    vd.indices = [0, 1, 2];
    const n: number[] = [];
    VertexData.ComputeNormals(vd.positions, vd.indices, n);
    vd.normals = n;
    vd.applyToMesh(m);
    const mat = this.mats.color(color, { emissive: 0.55 }).clone(`pennantMat_${color}`);
    mat.backFaceCulling = false;
    mat.twoSidedLighting = true;
    m.material = mat;
    m.isPickable = false;
    m.setEnabled(false);
    return m;
  }

  private stringBunting(protos: Mesh[], ax: number, ay: number, bx: number, by: number, z: number, sag: number, spacing = 0.7): void {
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(2, Math.floor(len / spacing));
    // The string itself.
    const pts: Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      pts.push(new Vector3(ax + (bx - ax) * u, ay + (by - ay) * u - Math.sin(Math.PI * u) * sag, z));
    }
    const segs: Mesh[] = [];
    for (let i = 0; i < 24; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const seg = CreateCylinder('bString', { diameter: 0.035, height: Vector3.Distance(a, b), tessellation: 3 }, this.scene);
      seg.position = a.add(b).scale(0.5);
      seg.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
      segs.push(seg);
    }
    const string = Mesh.MergeMeshes(segs, true, true);
    if (string) {
      string.material = this.mats.color('#FFFFFF');
      string.isPickable = false;
      string.freezeWorldMatrix();
    }
    for (let i = 1; i < n; i++) {
      const u = i / n;
      const inst = protos[(this.pennants.length + i) % protos.length].createInstance('pennant');
      inst.position.set(ax + (bx - ax) * u, ay + (by - ay) * u - Math.sin(Math.PI * u) * sag, z);
      inst.isPickable = false;
      this.pennants.push({ node: inst, phase: (ax + (bx - ax) * u) * 0.9 });
    }
  }

  private buildBunting(): void {
    const protos = BUNTING.map((c) => this.pennantProto(c));
    const lamps = this.layout.decor.lamps;
    for (let i = 0; i < lamps.length - 1; i++) {
      const a = lamps[i];
      const b = lamps[i + 1];
      if (b.x - a.x > 30) continue;
      this.stringBunting(protos, a.x, 3.35, b.x, 3.35, a.z, 1.1, this.low ? 1.1 : 0.75);
    }
    // Over the welcome banner and across the finish arch.
    const sx = this.layout.start.x + 9;
    if (this.hasWelcome) this.stringBunting(protos, sx - 4.4, 6.5, sx + 4.4, 6.5, 1.75, 0.5);
    const f = this.layout.finish.x;
    this.stringBunting(protos, f - 0.1, 5.2, f - 7, 3.4, -1.6, 0.4);
    this.stringBunting(protos, f + 0.1, 5.2, f + 7, 3.4, -1.6, 0.4);
  }

  /** Small vertical cloth banners hanging from some house fronts. */
  private buildShopBanners(): void {
    const icons = ['star', 'paw', 'heart', 'flower'];
    this.layout.decor.houses.forEach((h, i) => {
      if (i % 2 === 1) return;
      const col = BUNTING[i % BUNTING.length];
      const icon = icons[i % icons.length];
      const c = new Cloth(`shop${i}`, this.scene, 0.9, 1.7, 'top', { nx: 4, ny: 8, amp: 0.1, speed: 2.4, wave: 3, skipFrames: this.low ? 2 : 1 });
      const m = this.mats.textured(`shop_${icon}_${col}`, (ctx, s) => {
        ctx.fillStyle = col;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(s * 0.08, 0, s * 0.06, s);
        ctx.fillRect(s * 0.86, 0, s * 0.06, s);
        ctx.fillStyle = '#FFFFFF';
        ctx.translate(s / 2, s * 0.45);
        drawIcon(ctx, icon, s * 0.28);
      }, { size: 128, emissive: 0.5 });
      m.backFaceCulling = false;
      c.mesh.material = m;
      c.mesh.position.set(h.x - h.w / 2 + 0.4, h.h * 0.92, h.z - 2.45);
      const rod = CreateCylinder('rod', { diameter: 0.08, height: 1.3, tessellation: 6 }, this.scene);
      rod.rotation.z = Math.PI / 2;
      rod.position.set(h.x - h.w / 2 + 0.4, h.h * 0.92 + 0.05, h.z - 2.45);
      rod.material = this.mats.color('#5B4F73');
      rod.isPickable = false;
      this.cloths.push(c);
    });
  }

  /** A back row of storybook cottages: mushroom houses and pointy-roof towers. */
  private buildStorybookCottages(): void {
    const parts: Mesh[] = [];
    const { minX, maxX } = this.layout.bounds;
    const caps = ['#FF6B6B', '#FF9F43', '#F368E0', '#54A0FF', '#1DD1A1'];
    let k = 0;
    for (let x = minX + 6; x < maxX; x += this.low ? 34 : 22) {
      const z = 19 + (k % 3) * 2.5;
      const mushroom = k % 2 === 0;
      const col = caps[k % caps.length];
      if (mushroom) {
        const stem = CreateCylinder('mStem', { diameterTop: 3.2, diameterBottom: 3.8, height: 4, tessellation: 18 }, this.scene);
        stem.position.set(x, 2, z);
        stem.material = this.mats.color('#FFF1D6');
        const cap = CreateSphere('mCap', { diameter: 6.4, segments: 16, slice: 0.5 }, this.scene);
        cap.scaling.y = 0.75;
        cap.position.set(x, 3.9, z);
        cap.material = this.mats.color(col);
        parts.push(stem, cap);
        for (let s = 0; s < 6; s++) {
          const a = (s / 6) * Math.PI * 2 + k;
          const dot = CreateSphere('mDot', { diameter: 0.7 + (s % 2) * 0.3, segments: 8 }, this.scene);
          dot.scaling.y = 0.45;
          dot.position.set(x + Math.cos(a) * 2.2, 5.2 + (s % 3) * 0.25, z + Math.sin(a) * 2.2 - 0.4);
          dot.material = this.mats.color('#FFFFFF');
          parts.push(dot);
        }
        const door = CreateCylinder('mDoor', { diameter: 1.2, height: 0.1, tessellation: 16 }, this.scene);
        door.rotation.x = Math.PI / 2;
        door.scaling.set(1, 1, 1.6);
        door.position.set(x, 0.9, z - 1.86);
        door.material = this.mats.color('#B5651D');
        const win = CreateCylinder('mWin', { diameter: 0.8, height: 0.1, tessellation: 16 }, this.scene);
        win.rotation.x = Math.PI / 2;
        win.position.set(x + 0.95, 2.6, z - 1.72);
        win.material = this.mats.color('#9EE0FF');
        parts.push(door, win);
      } else {
        const body = CreateCylinder('tBody', { diameter: 3, height: 5, tessellation: 16 }, this.scene);
        body.position.set(x, 2.5, z);
        body.material = this.mats.color(k % 4 === 1 ? '#FFE3A3' : '#D7F5C3');
        const roof = CreateCylinder('tRoof', { diameterTop: 0, diameterBottom: 4, height: 3.8, tessellation: 16 }, this.scene);
        roof.position.set(x, 6.9, z);
        roof.material = this.mats.color(col);
        const tip = CreateSphere('tTip', { diameter: 0.5, segments: 8 }, this.scene);
        tip.position.set(x, 8.9, z);
        tip.material = this.mats.color('#FFD43B');
        const door = CreateBox('tDoor', { width: 1, height: 1.7, depth: 0.1 }, this.scene);
        door.position.set(x, 0.85, z - 1.5);
        door.material = this.mats.color('#8D5A3B');
        const win = CreateCylinder('tWin', { diameter: 0.75, height: 0.1, tessellation: 16 }, this.scene);
        win.rotation.x = Math.PI / 2;
        win.position.set(x, 3.4, z - 1.5);
        win.material = this.mats.color('#9EE0FF');
        parts.push(body, roof, tip, door, win);
      }
      k++;
    }
    const merged = mergeColored('cottages', parts.map((m) => ({ mesh: m, color: (m.material as unknown as { diffuseColor: Color3 }).diffuseColor.toHexString() })), this.mats, { emissive: 0.32 });
    if (merged) {
      bakeGroundAO(merged, 2.5);
      merged.isPickable = false;
      merged.freezeWorldMatrix();
    }
  }

  private buildChimneySmoke(): void {
    const proto = CreateSphere('puff', { diameter: 1, segments: 8 }, this.scene);
    const mat = this.mats.color('#FFFFFF', { emissive: 0.85 });
    mat.alpha = 0.8;
    proto.material = mat;
    proto.isPickable = false;
    proto.setEnabled(false);
    const per = this.low ? 2 : 4;
    this.layout.decor.houses.forEach((h, i) => {
      if (this.low && i % 2) return;
      for (let p = 0; p < per; p++) {
        const node = proto.createInstance('puff');
        node.isPickable = false;
        this.puffs.push({ node, t: (p / per) * 3.2, life: 3.2, x: h.x + h.w * 0.25, y: h.h + 2.2, z: h.z + 0.6, drift: 0.5 + (i % 3) * 0.2 });
      }
    });
  }

  private makeWingedNode(name: string, body: string, wing: string, size: number, wingShape: 'bird' | 'butterfly'): { node: TransformNode; wings: TransformNode[] } {
    const node = new TransformNode(name, this.scene);
    const wings: TransformNode[] = [];
    if (wingShape === 'bird') {
      const b = CreateSphere(`${name}Body`, { diameter: size * 0.5, segments: 6 }, this.scene);
      b.scaling.set(1.6, 0.8, 0.8);
      b.parent = node;
      b.material = this.mats.color(body, { emissive: 0.35 });
      b.isPickable = false;
    }
    for (const side of [-1, 1]) {
      const pivot = new TransformNode(`${name}W`, this.scene);
      pivot.parent = node;
      const w = new Mesh(`${name}Wing`, this.scene);
      const vd = new VertexData();
      if (wingShape === 'bird') {
        vd.positions = [-0.2 * size, 0, 0, 0.25 * size, 0, 0, 0, 0, side * 0.9 * size];
      } else {
        vd.positions = [0, 0, 0, 0.45 * size, 0, side * 0.5 * size, -0.1 * size, 0, side * 0.6 * size, -0.4 * size, 0, side * 0.35 * size];
      }
      vd.indices = wingShape === 'bird' ? [0, 1, 2] : [0, 1, 2, 0, 2, 3];
      const n: number[] = [];
      VertexData.ComputeNormals(vd.positions, vd.indices, n);
      vd.normals = n;
      vd.applyToMesh(w);
      const m = this.mats.color(wing, { emissive: 0.5 }).clone(`${name}WingMat`);
      m.backFaceCulling = false;
      m.twoSidedLighting = true;
      w.material = m;
      w.parent = pivot;
      w.isPickable = false;
      pivot.metadata = side;
      wings.push(pivot);
    }
    return { node, wings };
  }

  private buildBirds(): void {
    const count = this.low ? 4 : 8;
    for (let i = 0; i < count; i++) {
      const { node, wings } = this.makeWingedNode(`bird${i}`, '#3D405B', i % 3 === 0 ? '#5B6BBF' : '#3D405B', 1, 'bird');
      const z = 16 + (i % 4) * 5;
      this.birds.push({ node, wings, speed: 2.4 + (i % 3) * 0.6, phase: i * 1.7, baseY: 11 + (i % 4) * 1.6, z, flap: 9 + (i % 3) * 2 });
      node.position.set(this.layout.start.x - 10 + i * 6, 11, z);
    }
  }

  private buildButterflies(): void {
    const colours = ['#FF8FB4', '#FFD43B', '#7CC8FF', '#B388FF', '#FFA94D'];
    const flowers = this.layout.decor.flowers;
    const count = this.low ? 4 : 10;
    for (let i = 0; i < count; i++) {
      const f = flowers[Math.floor((i / count) * flowers.length)] ?? { x: i * 20, z: 2 };
      const { node, wings } = this.makeWingedNode(`bfly${i}`, '#2A1E3B', colours[i % colours.length], 0.55, 'butterfly');
      this.butterflies.push({ node, wings, anchorX: f.x, anchorY: 1.2 + (i % 3) * 0.5, z: f.z < 0 ? f.z + 0.4 : f.z - 0.4, phase: i * 2.3, rx: 1.4 + (i % 3) * 0.5, ry: 0.5 + (i % 2) * 0.3 });
    }
  }

  private buildWindmills(): void {
    const { minX, maxX } = this.layout.bounds;
    for (let x = minX + 40; x < maxX + 20; x += 95) {
      const z = 46;
      const tower = CreateCylinder('wmTower', { diameterTop: 2.2, diameterBottom: 4, height: 10, tessellation: 12 }, this.scene);
      tower.position.set(x, 5, z);
      tower.material = this.mats.color('#FFF1D6', { emissive: 0.35 });
      const roof = CreateCylinder('wmRoof', { diameterTop: 0, diameterBottom: 3, height: 2.4, tessellation: 12 }, this.scene);
      roof.position.set(x, 11.2, z);
      roof.material = this.mats.color('#E26D5C', { emissive: 0.35 });
      for (const m of [tower, roof]) {
        m.isPickable = false;
        m.freezeWorldMatrix();
      }
      const hub = new TransformNode('wmHub', this.scene);
      hub.position.set(x, 9.6, z - 1.8);
      const sailParts: Mesh[] = [];
      for (let b = 0; b < 4; b++) {
        const a = (b * Math.PI) / 2;
        const sail = CreateBox('wmSail', { width: 1.3, height: 5.2, depth: 0.12 }, this.scene);
        sail.rotation.z = a;
        sail.position.set(Math.cos(a) * 0.45 - Math.sin(a) * 2.8, Math.sin(a) * 0.45 + Math.cos(a) * 2.8, 0);
        sail.material = this.mats.color(b % 2 ? '#FFFFFF' : '#FFD9E2');
        sailParts.push(sail);
      }
      const cap = CreateSphere('wmCap', { diameter: 0.9, segments: 8 }, this.scene);
      cap.material = this.mats.color('#FFD43B');
      sailParts.push(cap);
      const sails = mergeColored('wmSails', sailParts.map((m) => ({ mesh: m, color: (m.material as unknown as { diffuseColor: Color3 }).diffuseColor.toHexString() })), this.mats, { emissive: 0.45 });
      if (sails) {
        sails.parent = hub;
        sails.isPickable = false;
      }
      this.spinners.push({ node: hub, speed: -0.9 });
    }
  }

  private buildHotAirBalloons(): void {
    const { minX } = this.layout.bounds;
    const colours = [['#FF5D73', '#FFD43B'], ['#4CC9F0', '#FFFFFF'], ['#9B5DE5', '#06D6A0']];
    colours.forEach(([a, b], i) => {
      const node = new TransformNode(`hab${i}`, this.scene);
      const envelope = CreateSphere('habEnv', { diameter: 5, segments: 16 }, this.scene);
      envelope.scaling.set(1, 1.15, 1);
      envelope.parent = node;
      envelope.material = this.mats.textured(`habStripes${i}`, (ctx, s) => {
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = k % 2 ? a : b;
          ctx.fillRect((k * s) / 8, 0, s / 8, s);
        }
      }, { size: 64, emissive: 0.45 });
      const basket = CreateCylinder('habBasket', { diameterTop: 1.2, diameterBottom: 1, height: 0.9, tessellation: 10 }, this.scene);
      basket.parent = node;
      basket.position.y = -4;
      basket.material = this.mats.color('#A0673A', { emissive: 0.3 });
      for (const m of [envelope, basket]) m.isPickable = false;
      const baseY = 22 + i * 5;
      node.position.set(minX + 30 + i * 80, baseY, 70 + i * 12);
      this.drifters.push({ node, speed: 0.6 + i * 0.25, baseY, phase: i * 2 });
    });
  }

  private buildSunRays(): void {
    const rays = new Mesh('sunRays', this.scene);
    const pos: number[] = [];
    const idx: number[] = [];
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const a1 = a - 0.09;
      const a2 = a + 0.09;
      const base = pos.length / 3;
      pos.push(Math.cos(a1) * 16, Math.sin(a1) * 16, 0.5, Math.cos(a2) * 16, Math.sin(a2) * 16, 0.5, Math.cos(a) * 27, Math.sin(a) * 27, 0.5);
      idx.push(base, base + 1, base + 2);
    }
    const vd = new VertexData();
    vd.positions = pos;
    vd.indices = idx;
    vd.applyToMesh(rays);
    const m = this.mats.color('#FFE680', { emissive: 1 });
    m.disableLighting = true;
    m.alpha = 0.55;
    m.backFaceCulling = false;
    rays.material = m;
    rays.position.set(40, 85, 250.5);
    rays.isPickable = false;
    this.sunRays = rays;
  }

  private buildPetals(): void {
    const tex = particleTexture(this.scene, 'pPetal', (ctx, s) => {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(s / 2, s / 2, s * 0.42, s * 0.24, 0.6, 0, Math.PI * 2);
      ctx.fill();
    });
    const ps = new ParticleSystem('petals', 120, this.scene);
    ps.particleTexture = tex;
    ps.emitter = this.petalEmitter;
    ps.minEmitBox = new Vector3(-16, 0, -2);
    ps.maxEmitBox = new Vector3(16, 4, 6);
    ps.color1 = new Color4(1, 0.72, 0.85, 0.95);
    ps.color2 = new Color4(1, 0.93, 0.6, 0.9);
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.12;
    ps.maxSize = 0.24;
    ps.minLifeTime = 5;
    ps.maxLifeTime = 8;
    ps.emitRate = 6;
    ps.direction1 = new Vector3(0.6, -0.3, 0);
    ps.direction2 = new Vector3(1.2, -0.6, 0.2);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1;
    ps.gravity = new Vector3(0.15, -0.25, 0);
    ps.minAngularSpeed = -2;
    ps.maxAngularSpeed = 2;
    ps.blendMode = ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    this.petals = ps;
  }

  update(dt: number, time: number, camX: number): void {
    for (const c of this.cloths) {
      // Only animate cloth near the camera.
      if (Math.abs(c.mesh.getAbsolutePosition().x - camX) < 30) c.update(time);
    }
    for (const p of this.pennants) {
      if (Math.abs(p.node.position.x - camX) > 26) continue;
      p.node.rotation.x = Math.sin(time * 3.4 + p.phase) * 0.45 + 0.15;
      p.node.rotation.z = Math.sin(time * 2.1 + p.phase * 1.3) * 0.12;
    }
    for (const p of this.puffs) {
      p.t += dt;
      if (p.t > p.life) p.t -= p.life;
      const k = p.t / p.life;
      p.node.position.set(p.x + k * p.drift * 2 + Math.sin(time + p.x) * 0.15, p.y + k * 3.2, p.z);
      const s = (0.35 + k * 1.1) * Math.sin(Math.PI * Math.min(1, k * 1.3 + 0.05));
      p.node.scaling.setAll(Math.max(0.01, s));
    }
    for (const b of this.birds) {
      b.node.position.x += b.speed * dt;
      if (b.node.position.x > camX + 45) b.node.position.x = camX - 45 - (b.phase % 10);
      if (b.node.position.x < camX - 60) b.node.position.x = camX - 40;
      b.node.position.y = b.baseY + Math.sin(time * 0.9 + b.phase) * 0.8;
      b.node.position.z = b.z;
      const flap = Math.sin(time * b.flap + b.phase);
      // Glide now and then.
      const glide = Math.sin(time * 0.4 + b.phase) > 0.6 ? 0.2 : 1;
      for (const w of b.wings) w.rotation.x = (w.metadata as number) * flap * 0.8 * glide;
    }
    for (const f of this.butterflies) {
      if (Math.abs(f.anchorX - camX) > 22) {
        // Re-home near the hero, onto the nearest flower ahead or behind.
        const flowers = this.layout.decor.flowers;
        const pick = flowers[Math.floor(Math.random() * flowers.length)];
        if (pick && Math.abs(pick.x - camX) < 18) {
          f.anchorX = pick.x;
          f.z = pick.z < 0 ? pick.z + 0.4 : pick.z - 0.4;
        }
      }
      const t = time * 0.7 + f.phase;
      f.node.position.set(f.anchorX + Math.sin(t) * f.rx, f.anchorY + Math.sin(t * 2.3) * f.ry + 0.2 * Math.sin(time * 9 + f.phase), f.z + Math.cos(t * 1.3) * 0.4);
      f.node.rotation.y = Math.cos(t) > 0 ? 1.15 : -1.15;
      const flap = Math.abs(Math.sin(time * 16 + f.phase));
      for (const w of f.wings) w.rotation.x = (w.metadata as number) * (flap * 1.2 - 0.2);
    }
    for (const s of this.spinners) s.node.rotation.z += s.speed * dt;
    const { minX, maxX } = this.layout.bounds;
    for (const d of this.drifters) {
      d.node.position.x += d.speed * dt;
      if (d.node.position.x > maxX + 120) d.node.position.x = minX - 80;
      d.node.position.y = d.baseY + Math.sin(time * 0.35 + d.phase) * 1.2;
      d.node.rotation.z = Math.sin(time * 0.5 + d.phase) * 0.04;
    }
    if (this.sunRays) {
      this.sunRays.rotation.z = time * 0.08;
      const s = 1 + Math.sin(time * 1.3) * 0.05;
      this.sunRays.scaling.set(s, s, 1);
    }
    if (this.petals) this.petalEmitter.set(camX - 6, 7.5, -1);
  }
}

function drawIcon(ctx: CanvasRenderingContext2D, icon: string, r: number): void {
  ctx.beginPath();
  if (icon === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  } else if (icon === 'heart') {
    ctx.moveTo(0, r * 0.8);
    ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.4);
    ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.8);
    ctx.fill();
  } else if (icon === 'paw') {
    ctx.ellipse(0, r * 0.3, r * 0.55, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [x, y] of [[-0.6, -0.35], [-0.22, -0.75], [0.22, -0.75], [0.6, -0.35]]) {
      ctx.beginPath();
      ctx.arc(x * r, y * r, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#FFD43B';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}
