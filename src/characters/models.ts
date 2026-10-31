/**
 * Procedurally built, original 3D cartoon characters made of rounded shapes.
 * Each model faces -z (towards the camera) in its local space, feet at y = 0.
 */
import {
  Color3,
  CreateCapsule,
  CreateCylinder,
  CreateSphere,
  CreateTorus,
  Mesh,
  Scene,
  TransformNode,
} from '../engine/babylon';
import type { MaterialLibrary } from '../engine/materials';
import { mergeColored } from '../engine/merge';
import { createStarMesh } from '../engine/shapes';
import type { HeroDef } from './heroes';

export interface Rig {
  root: TransformNode;
  /** Child of root: facing rotation and squash/stretch live here. */
  visual: TransformNode;
  body: TransformNode;
  head: TransformNode;
  armL: TransformNode;
  armR: TransformNode;
  legL: TransformNode;
  legR: TransformNode;
  eyes: TransformNode[];
  earL: TransformNode;
  earR: TransformNode;
  tail: TransformNode;
  meshes: Mesh[];
}

const OUTLINE = new Color3(0.16, 0.13, 0.25);

class Builder {
  meshes: Mesh[] = [];
  private parts = new Map<TransformNode, Array<{ mesh: Mesh; color: string }>>();
  constructor(private scene: Scene, private mats: MaterialLibrary, private prefix: string) {}

  node(name: string, parent: TransformNode | null, x = 0, y = 0, z = 0): TransformNode {
    const n = new TransformNode(`${this.prefix}_${name}`, this.scene);
    n.parent = parent;
    n.position.set(x, y, z);
    return n;
  }

  private finish(m: Mesh, parent: TransformNode, colour: string, x: number, y: number, z: number): Mesh {
    m.position.set(x, y, z);
    m.isPickable = false;
    let list = this.parts.get(parent);
    if (!list) this.parts.set(parent, (list = []));
    list.push({ mesh: m, color: colour });
    return m;
  }

  /** Merge every node's parts into one vertex-coloured mesh (one draw call per node). */
  bake(): void {
    for (const [node, parts] of this.parts) {
      const merged = mergeColored(`${node.name}_mesh`, parts, this.mats, { parent: node, emissive: 0.24 });
      if (merged) this.meshes.push(merged);
    }
    this.parts.clear();
  }

  ball(parent: TransformNode, colour: string, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, seg = 16): Mesh {
    const m = CreateSphere(`${this.prefix}_s`, { diameter: 1, segments: seg }, this.scene);
    m.scaling.set(sx, sy, sz);
    return this.finish(m, parent, colour, x, y, z);
  }

  capsule(parent: TransformNode, colour: string, x: number, y: number, z: number, radius: number, height: number): Mesh {
    const m = CreateCapsule(`${this.prefix}_c`, { radius, height, tessellation: 14, subdivisions: 2, capSubdivisions: 6 }, this.scene);
    return this.finish(m, parent, colour, x, y, z);
  }

  cyl(parent: TransformNode, colour: string, x: number, y: number, z: number, top: number, bottom: number, height: number, tess = 24): Mesh {
    const m = CreateCylinder(`${this.prefix}_y`, { diameterTop: top, diameterBottom: bottom, height, tessellation: tess }, this.scene);
    return this.finish(m, parent, colour, x, y, z);
  }

  torus(parent: TransformNode, colour: string, x: number, y: number, z: number, diameter: number, thickness: number): Mesh {
    const m = CreateTorus(`${this.prefix}_t`, { diameter, thickness, tessellation: 24 }, this.scene);
    return this.finish(m, parent, colour, x, y, z);
  }

  star(parent: TransformNode, colour: string, x: number, y: number, z: number, size: number): Mesh {
    const m = createStarMesh(`${this.prefix}_star`, this.scene, 0.5, 0.23, 0.12);
    m.scaling.setAll(size);
    return this.finish(m, parent, colour, x, y, z);
  }
}

/** Shared face: eyes with blink pivots, nose, smile, cheeks, brows. */
function buildFace(b: Builder, head: TransformNode, opts: { eyeY: number; eyeX: number; front: number; brow?: string; scale?: number }): TransformNode[] {
  const s = opts.scale ?? 1;
  const eyes: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const eye = b.node('eye', head, side * opts.eyeX, opts.eyeY, -opts.front);
    b.ball(eye, '#FFFFFF', 0, 0, 0, 0.17 * s, 0.21 * s, 0.08 * s);
    b.ball(eye, '#2A1E3B', side * -0.01 * s, -0.012 * s, -0.035 * s, 0.11 * s, 0.14 * s, 0.05 * s);
    b.ball(eye, '#FFFFFF', side * -0.035 * s, 0.03 * s, -0.06 * s, 0.04 * s);
    eyes.push(eye);
    if (opts.brow) {
      const brow = b.capsule(head, opts.brow, side * opts.eyeX, opts.eyeY + 0.15 * s, -opts.front + 0.02, 0.018 * s, 0.13 * s);
      brow.rotation.z = Math.PI / 2 + side * 0.25;
    }
  }
  return eyes;
}

export function buildHero(scene: Scene, mats: MaterialLibrary, def: HeroDef, outline: boolean): Rig {
  const b = new Builder(scene, mats, `hero_${def.id}`);
  const root = b.node('root', null);
  const visual = b.node('visual', root);
  const body = b.node('body', visual, 0, 0.36, 0);

  // Legs (pivot at hip).
  const legs: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const leg = b.node('leg', body, side * 0.13, 0.02, 0);
    b.capsule(leg, def.trousers, 0, -0.17, 0, 0.1, 0.34);
    b.ball(leg, '#3A2A2A', 0, -0.33, -0.05, 0.22, 0.13, 0.3);
    legs.push(leg);
  }
  // Torso.
  b.capsule(body, def.shirt, 0, 0.27, 0, 0.27, 0.64);
  b.torus(body, '#5A3A26', 0, 0.06, 0, 0.5, 0.07);
  b.ball(body, def.accent, 0, 0.06, -0.255, 0.1, 0.08, 0.05);
  b.star(body, '#FFD43B', -0.12, 0.33, -0.255, 0.15);
  if (def.scarf) {
    const scarf = b.cyl(body, def.scarf, 0, 0.42, -0.2, 0.22, 0.02, 0.2, 3);
    scarf.rotation.x = -0.25;
    b.torus(body, def.scarf, 0, 0.55, 0, 0.36, 0.08);
  } else {
    b.torus(body, def.shirt, 0, 0.55, 0, 0.36, 0.08);
  }
  // Tail.
  const tail = b.node('tail', body, 0, 0.12, 0.24);
  const tailMesh = b.capsule(tail, def.fur, 0, 0.12, 0.05, 0.06, 0.32);
  tailMesh.rotation.x = -0.7;
  // Arms (pivot at shoulder).
  const arms: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const arm = b.node('arm', body, side * 0.31, 0.46, 0);
    b.capsule(arm, def.shirt, side * 0.02, -0.15, 0, 0.085, 0.34);
    b.ball(arm, def.fur, side * 0.03, -0.33, 0, 0.19);
    arm.rotation.z = side * 0.18;
    arms.push(arm);
  }
  // Head.
  const head = b.node('head', body, 0, 0.62, 0);
  b.ball(head, def.fur, 0, 0.36, 0, 0.92, 0.84, 0.84, 24);
  b.ball(head, def.muzzle, 0, 0.24, -0.3, 0.5, 0.36, 0.38);
  b.ball(head, '#2A1E3B', 0, 0.33, -0.48, 0.15, 0.11, 0.11);
  b.ball(head, '#FFFFFF', -0.03, 0.36, -0.535, 0.04, 0.025, 0.02);
  const smile = b.torus(head, '#7A2E3A', 0, 0.2, -0.46, 0.14, 0.028);
  smile.rotation.x = Math.PI / 2 - 0.3;
  smile.scaling.set(1, 1, 0.5);
  for (const side of [-1, 1]) b.ball(head, '#FF9FB5', side * 0.27, 0.24, -0.3, 0.13, 0.08, 0.06);
  const eyes = buildFace(b, head, { eyeY: 0.47, eyeX: 0.155, front: 0.34, brow: def.furDark });

  // Ears.
  const ears: TransformNode[] = [];
  for (const side of [-1, 1]) {
    let ear: TransformNode;
    if (def.earStyle === 'pointy') {
      ear = b.node('ear', head, side * 0.24, 0.66, 0.02);
      const cone = b.cyl(ear, def.ear, 0, 0.16, 0, 0.0, 0.24, 0.36, 16);
      cone.scaling.z = 0.55;
      b.ball(ear, '#F2B9B9', 0, 0.1, -0.05, 0.1, 0.2, 0.04);
      ear.rotation.z = -side * 0.28;
    } else {
      const long = def.earStyle === 'long';
      ear = b.node('ear', head, side * 0.4, 0.58, 0.02);
      b.ball(ear, def.ear, side * 0.05, long ? -0.26 : -0.2, 0, 0.26, long ? 0.62 : 0.5, 0.12);
      ear.rotation.z = side * 0.32;
    }
    ears.push(ear);
  }

  // Hats.
  if (def.hat === 'cowboy') {
    const brim = b.cyl(head, def.hatColour, 0, 0.72, 0.02, 1.08, 1.08, 0.05, 32);
    brim.scaling.z = 0.82;
    b.cyl(head, def.hatColour, 0, 0.88, 0.04, 0.46, 0.56, 0.32, 24);
    b.cyl(head, def.hatBand, 0, 0.78, 0.04, 0.58, 0.58, 0.07, 24);
    b.star(head, '#FFD43B', 0, 0.9, -0.26, 0.2);
  } else if (def.hat === 'cap') {
    b.ball(head, def.hatColour, 0, 0.66, 0.02, 0.86, 0.46, 0.84, 20);
    const visor = b.cyl(head, def.hatColour, 0, 0.66, -0.38, 0.5, 0.5, 0.04, 24);
    visor.scaling.z = 0.6;
    visor.rotation.x = 0.18;
    b.cyl(head, def.hatBand, 0, 0.7, 0.02, 0.82, 0.82, 0.06, 24);
    b.star(head, '#FFD43B', 0, 0.78, -0.4, 0.18);
  } else {
    const beret = b.ball(head, def.hatColour, 0.06, 0.74, 0.02, 0.9, 0.3, 0.86, 20);
    beret.rotation.z = -0.15;
    b.ball(head, def.hatBand, 0.12, 0.9, 0.02, 0.1);
    b.star(head, '#FFD43B', -0.12, 0.74, -0.42, 0.16);
  }
  if (def.bow) {
    b.ball(head, def.bow, 0.3, 0.68, -0.08, 0.16, 0.12, 0.08);
    b.ball(head, def.bow, 0.44, 0.7, -0.04, 0.16, 0.12, 0.08);
    b.ball(head, '#FF8A3D', 0.37, 0.69, -0.08, 0.07);
  }

  b.bake();
  if (outline) {
    for (const m of b.meshes) {
      m.renderOutline = true;
      m.outlineColor = OUTLINE;
      m.outlineWidth = 0.012;
    }
  }
  return { root, visual, body, head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], eyes, earL: ears[0], earR: ears[1], tail, meshes: b.meshes };
}

export type CritterKind = 'kitten' | 'mamaCat' | 'duck' | 'bunny' | 'owl';

/** Friendly supporting animals. Same rig shape as heroes so one animator can drive them. */
export function buildCritter(scene: Scene, mats: MaterialLibrary, kind: CritterKind, outline: boolean): Rig {
  const b = new Builder(scene, mats, `critter_${kind}_${Math.random().toString(36).slice(2, 6)}`);
  const root = b.node('root', null);
  const visual = b.node('visual', root);
  const scale = kind === 'kitten' ? 0.55 : kind === 'mamaCat' ? 0.95 : 0.85;
  visual.scaling.setAll(scale);
  const body = b.node('body', visual, 0, 0.32, 0);
  const pal = {
    kitten: { fur: '#FFA94D', dark: '#E8832A', belly: '#FFE8CC', cloth: '#4CC9F0' },
    mamaCat: { fur: '#FFE1B0', dark: '#E8B87A', belly: '#FFF6E6', cloth: '#FF6F91' },
    duck: { fur: '#FFE14D', dark: '#F5C518', belly: '#FFF3A8', cloth: '#5CB85C' },
    bunny: { fur: '#FFFFFF', dark: '#EADFE6', belly: '#FFF5F8', cloth: '#9B8CFF' },
    owl: { fur: '#B98A62', dark: '#8E6444', belly: '#F2DCC2', cloth: '#3FA7D6' },
  }[kind];

  const legs: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const leg = b.node('leg', body, side * 0.13, 0, 0);
    const footColour = kind === 'duck' || kind === 'owl' ? '#FF9F1C' : pal.fur;
    b.capsule(leg, footColour, 0, -0.14, 0, 0.08, 0.28);
    b.ball(leg, footColour, 0, -0.28, -0.05, 0.2, 0.1, 0.26);
    legs.push(leg);
  }
  b.ball(body, pal.cloth, 0, 0.26, 0, 0.66, 0.66, 0.58);
  b.ball(body, pal.belly, 0, 0.24, -0.2, 0.42, 0.44, 0.24);
  if (kind === 'mamaCat') b.ball(body, '#FFFFFF', 0, 0.18, -0.24, 0.44, 0.4, 0.14);
  const arms: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const arm = b.node('arm', body, side * 0.3, 0.38, 0);
    if (kind === 'duck' || kind === 'owl') {
      const wing = b.ball(arm, pal.dark, side * 0.04, -0.12, 0.02, 0.14, 0.36, 0.26);
      wing.rotation.z = side * 0.3;
    } else {
      b.capsule(arm, pal.fur, side * 0.02, -0.12, 0, 0.07, 0.28);
    }
    arm.rotation.z = side * 0.2;
    arms.push(arm);
  }
  const tail = b.node('tail', body, 0, 0.12, 0.26);
  if (kind === 'kitten' || kind === 'mamaCat') {
    const tm = b.capsule(tail, pal.dark, 0, 0.2, 0.06, 0.06, 0.5);
    tm.rotation.x = -0.4;
  } else if (kind === 'bunny') {
    b.ball(tail, '#FFFFFF', 0, 0.02, 0.02, 0.2);
  } else {
    const tm = b.ball(tail, pal.dark, 0, 0.04, 0.02, 0.22, 0.12, 0.2);
    tm.rotation.x = 0.4;
  }
  const head = b.node('head', body, 0, 0.56, 0);
  b.ball(head, pal.fur, 0, 0.3, 0, 0.82, 0.74, 0.76, 22);
  let eyes: TransformNode[];
  if (kind === 'duck') {
    const beak = b.ball(head, '#FF9F1C', 0, 0.22, -0.38, 0.36, 0.12, 0.26);
    beak.rotation.x = 0.1;
    eyes = buildFace(b, head, { eyeY: 0.4, eyeX: 0.15, front: 0.3 });
    b.ball(head, '#5CB85C', 0, 0.62, 0.02, 0.6, 0.18, 0.56);
  } else if (kind === 'owl') {
    for (const side of [-1, 1]) b.ball(head, pal.belly, side * 0.15, 0.36, -0.28, 0.3, 0.32, 0.12);
    b.cyl(head, '#FF9F1C', 0, 0.24, -0.38, 0.0, 0.1, 0.14, 8).rotation.x = Math.PI;
    eyes = buildFace(b, head, { eyeY: 0.37, eyeX: 0.15, front: 0.36, scale: 1.25 });
    b.ball(head, '#2A1E3B', 0, 0.72, 0, 0.42, 0.06, 0.42);
    b.cyl(head, '#2A1E3B', 0, 0.8, 0, 0.26, 0.3, 0.16, 16);
  } else {
    b.ball(head, pal.belly, 0, 0.2, -0.28, 0.4, 0.26, 0.26);
    b.ball(head, '#FF7A9C', 0, 0.27, -0.4, 0.1, 0.07, 0.07);
    eyes = buildFace(b, head, { eyeY: 0.38, eyeX: 0.15, front: 0.31 });
    for (const side of [-1, 1]) b.ball(head, '#FFB3C6', side * 0.25, 0.2, -0.26, 0.12, 0.07, 0.05);
    if (kind === 'kitten' || kind === 'mamaCat') {
      for (const side of [-1, 1]) {
        const w = b.capsule(head, '#FFFFFF', side * 0.22, 0.22, -0.36, 0.008, 0.22);
        w.rotation.z = Math.PI / 2 + side * 0.15;
      }
    }
  }
  const ears: TransformNode[] = [];
  for (const side of [-1, 1]) {
    const ear = b.node('ear', head, side * 0.22, 0.6, 0);
    if (kind === 'bunny') {
      b.capsule(ear, pal.fur, 0, 0.28, 0, 0.09, 0.62);
      b.capsule(ear, '#FFB3C6', 0, 0.28, -0.06, 0.05, 0.48);
      ear.rotation.z = -side * 0.12;
    } else if (kind === 'kitten' || kind === 'mamaCat') {
      const cone = b.cyl(ear, pal.fur, 0, 0.1, 0, 0, 0.26, 0.26, 4);
      cone.rotation.y = Math.PI / 4;
      b.cyl(ear, '#FFB3C6', 0, 0.08, -0.05, 0, 0.14, 0.16, 4).rotation.y = Math.PI / 4;
      ear.rotation.z = -side * 0.25;
    } else if (kind === 'owl') {
      const tuft = b.cyl(ear, pal.dark, 0, 0.12, 0, 0, 0.14, 0.22, 6);
      tuft.rotation.z = -side * 0.3;
    }
    ears.push(ear);
  }
  if (kind === 'mamaCat') {
    b.ball(head, '#FF6F91', 0.22, 0.62, -0.05, 0.16, 0.12, 0.08);
    b.ball(head, '#FF6F91', 0.34, 0.66, -0.02, 0.16, 0.12, 0.08);
  }
  if (kind === 'kitten') b.torus(body, '#FF4D6D', 0, 0.52, 0, 0.34, 0.06);

  b.bake();
  if (outline) {
    for (const m of b.meshes) {
      m.renderOutline = true;
      m.outlineColor = OUTLINE;
      m.outlineWidth = 0.012;
    }
  }
  return { root, visual, body, head, armL: arms[0], armR: arms[1], legL: legs[0], legR: legs[1], eyes, earL: ears[0], earR: ears[1], tail, meshes: b.meshes };
}
