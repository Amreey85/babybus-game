/**
 * Draw-call reduction: bake a flat colour into each part's vertices, then merge
 * the parts into a single mesh that uses one shared vertex-colour material.
 */
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import { Color3, Mesh, type TransformNode } from './babylon';
import type { MaterialLibrary } from './materials';

export interface ColoredPart {
  mesh: Mesh;
  color: string;
}

export function paint(mesh: Mesh, hex: string): void {
  const c = Color3.FromHexString(hex);
  const n = mesh.getTotalVertices();
  const colors = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    colors[i * 4] = c.r;
    colors[i * 4 + 1] = c.g;
    colors[i * 4 + 2] = c.b;
    colors[i * 4 + 3] = 1;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors, false, 4);
}

/**
 * Merge parts that are positioned in the same local space. If `parent` is set,
 * the result is re-attached to it so animation of that node still works.
 */
export function mergeColored(
  name: string,
  parts: ColoredPart[],
  mats: MaterialLibrary,
  opts: { parent?: TransformNode | null; emissive?: number } = {},
): Mesh | null {
  if (!parts.length) return null;
  for (const p of parts) {
    p.mesh.parent = null;
    paint(p.mesh, p.color);
    p.mesh.material = null;
  }
  const merged = Mesh.MergeMeshes(parts.map((p) => p.mesh), true, true);
  if (!merged) return null;
  merged.name = name;
  merged.material = mats.vertexColor(opts.emissive ?? 0.22);
  merged.isPickable = false;
  if (opts.parent) merged.parent = opts.parent;
  return merged;
}

/**
 * Fake ambient occlusion: darken vertex colours near the ground (y = 0) and
 * add a faint warm sky tint at the top, so props sit into the scene.
 */
export function bakeGroundAO(mesh: Mesh, fadeHeight = 1.6, strength = 0.32): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind);
  const col = mesh.getVerticesData(VertexBuffer.ColorKind);
  if (!pos || !col) return;
  const wm = mesh.computeWorldMatrix(true);
  const m = wm.m;
  const out = new Float32Array(col.length);
  for (let i = 0, v = 0; i < pos.length; i += 3, v += 4) {
    const y = pos[i] * m[1] + pos[i + 1] * m[5] + pos[i + 2] * m[9] + m[13];
    const k = Math.min(1, Math.max(0, y / fadeHeight));
    const shade = 1 - strength * (1 - k) * (1 - k);
    const top = Math.min(1, Math.max(0, (y - 3) / 6)) * 0.06;
    out[v] = Math.min(1, col[v] * shade + top);
    out[v + 1] = Math.min(1, col[v + 1] * shade + top * 0.9);
    out[v + 2] = Math.min(1, col[v + 2] * shade + top * 0.7);
    out[v + 3] = col[v + 3];
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, out, false, 4);
}
