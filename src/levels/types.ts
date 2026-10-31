import type { Difficulty } from '../core/types';
import type { Solid } from '../physics/PlatformerPhysics';

export type PlatformKind = 'ground' | 'wood' | 'crate' | 'cloud' | 'brick' | 'bounce' | 'invisible';

export interface PlatformDef extends Solid {
  kind: PlatformKind;
}

export interface MoverDef {
  id: string;
  /** Start position (left/bottom). */
  x: number;
  y: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  range: number;
  /** Full cycles per second. */
  speed: number;
}

export interface StarDef {
  id: string;
  x: number;
  y: number;
  bonus?: boolean;
}

export interface CheckpointDef {
  id: string;
  x: number;
  y: number;
}

export interface HintDef {
  x: number;
  y: number;
  icon: 'move' | 'jump' | 'bounce';
  key: 'tut.move' | 'tut.jump' | 'tut.bounce';
}

export interface NpcDef {
  kind: 'duck' | 'bunny' | 'owl';
  x: number;
  y: number;
  z: number;
}

export interface DecorDef {
  houses: Array<{ x: number; z: number; w: number; h: number; wall: string; roof: string; door: string }>;
  trees: Array<{ x: number; z: number; s: number; kind: 'round' | 'pine' }>;
  flowers: Array<{ x: number; z: number; color: string }>;
  fences: Array<{ x: number; z: number; w: number }>;
  lamps: Array<{ x: number; z: number }>;
  bushes: Array<{ x: number; z: number; s: number }>;
  playground: Array<{ kind: 'slide' | 'swing' | 'seesaw'; x: number; z: number }>;
  signs: Array<{ x: number; z: number }>;
  balloons: Array<{ x: number; y: number; z: number; color: string }>;
}

export interface LevelLayout {
  stageId: string;
  difficulty: Difficulty;
  start: { x: number; y: number };
  bounds: { minX: number; maxX: number };
  killY: number;
  platforms: PlatformDef[];
  movers: MoverDef[];
  water: Array<{ x: number; w: number }>;
  stars: StarDef[];
  checkpoints: CheckpointDef[];
  hints: HintDef[];
  npcs: NpcDef[];
  kitten: { x: number; y: number };
  mamaCat: { x: number; y: number };
  finish: { x: number; y: number };
  decor: DecorDef;
}
