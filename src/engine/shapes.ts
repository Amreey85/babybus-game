/** Custom geometry that the stock builders do not provide. */
import { Mesh, Scene, VertexData } from './babylon';

/** A puffy faceted 5-point star, centred on the origin, facing -z. */
export function createStarMesh(name: string, scene: Scene, outer = 0.5, inner = 0.23, depth = 0.17): Mesh {
  const ring: Array<[number, number]> = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    ring.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const pushTri = (a: number[], b: number[], c: number[]) => {
    // Face normal; flip winding so it points away from the star centre.
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const centroid = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    let tri = [a, b, c];
    if (n[0] * centroid[0] + n[1] * centroid[1] + n[2] * centroid[2] < 0) {
      tri = [a, c, b];
      n = n.map((x) => -x);
    }
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const base = positions.length / 3;
    for (const p of tri) {
      positions.push(p[0], p[1], p[2]);
      normals.push(n[0] / len, n[1] / len, n[2] / len);
    }
    // Babylon is left-handed: reverse to match its front-face convention.
    indices.push(base, base + 2, base + 1);
  };
  for (const z of [-depth, depth]) {
    const c = [0, 0, z];
    for (let i = 0; i < 10; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % 10];
      pushTri(c, [p[0], p[1], 0], [q[0], q[1], 0]);
    }
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = normals;
  vd.uvs = new Array((positions.length / 3) * 2).fill(0);
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh);
  return mesh;
}
