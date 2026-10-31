/**
 * Lightweight waving cloth: a subdivided plane whose vertices are displaced
 * every frame by layered sine waves. Pin modes decide which edge stays still.
 *  - 'left': a flag on a pole (left edge pinned).
 *  - 'top': a hanging pennant (top edge pinned).
 *  - 'ends': a banner strung between two posts (left and right edges pinned).
 */
import { Mesh, Scene, VertexData } from './babylon';

export type PinMode = 'left' | 'top' | 'ends';

export class Cloth {
  readonly mesh: Mesh;
  private base: Float32Array;
  private pos: Float32Array;
  private weights: Float32Array;
  private frame = 0;

  constructor(
    name: string,
    scene: Scene,
    readonly width: number,
    readonly height: number,
    private pin: PinMode,
    private opts: { nx?: number; ny?: number; amp?: number; speed?: number; wave?: number; sag?: number; skipFrames?: number } = {},
  ) {
    const nx = opts.nx ?? 14;
    const ny = opts.ny ?? 6;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const weights: number[] = [];
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        const u = i / nx;
        const v = j / ny;
        // Origin is the pinned point: left-centre for flags, top-centre otherwise.
        const x = pin === 'left' ? u * width : (u - 0.5) * width;
        const y = pin === 'left' ? (0.5 - v) * height : -v * height;
        positions.push(x, y, 0);
        uvs.push(u, 1 - v);
        weights.push(pin === 'left' ? u : pin === 'top' ? v : Math.sin(Math.PI * u) * (0.35 + 0.65 * v));
      }
    }
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = j * (nx + 1) + i;
        const b = a + 1;
        const c = a + nx + 1;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const vd = new VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.uvs = uvs;
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    vd.normals = normals;
    this.mesh = new Mesh(name, scene);
    vd.applyToMesh(this.mesh, true);
    this.mesh.isPickable = false;
    this.base = new Float32Array(positions);
    this.pos = new Float32Array(positions);
    this.weights = new Float32Array(weights);
  }

  update(time: number): void {
    const skip = this.opts.skipFrames ?? 0;
    if (skip && this.frame++ % (skip + 1) !== 0) return;
    const amp = this.opts.amp ?? 0.18;
    const sp = this.opts.speed ?? 4;
    const k = (this.opts.wave ?? 2.4) / Math.max(1, this.width);
    const sag = this.opts.sag ?? 0;
    const b = this.base;
    const p = this.pos;
    const w = this.weights;
    const gust = 0.75 + 0.25 * Math.sin(time * 0.6) + 0.15 * Math.sin(time * 1.7);
    for (let n = 0, i = 0; n < w.length; n++, i += 3) {
      const x = b[i];
      const y = b[i + 1];
      const wt = w[n];
      const wave = Math.sin(x * k * 6 - time * sp + y * 1.3) + 0.45 * Math.sin(x * k * 13 - time * sp * 1.7 + y * 2.1);
      p[i] = x;
      p[i + 1] = y - sag * Math.sin(Math.PI * Math.min(1, Math.max(0, x / this.width + 0.5))) * (this.pin === 'ends' ? 1 : 0);
      p[i + 2] = wave * amp * wt * gust;
      if (this.pin === 'left') p[i + 1] += -wt * wt * 0.06 * this.height;
    }
    this.mesh.updateVerticesData('position', p, false, false);
  }
}
