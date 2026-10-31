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
