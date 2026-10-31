/**
 * Stage 1 - Welcome to Labrador Town. Pure level data, adapted per age mode.
 * Ground top is y = 0. The hero walks on the z = 0 plane.
 */
import type { Difficulty } from '../../core/types';
import type { CheckpointDef, DecorDef, LevelLayout, MoverDef, PlatformDef, StarDef } from '../types';

const LEVEL_START = -8;
const LEVEL_END = 240;
const GROUND_DEPTH = 8;

const HOUSE_COLOURS = [
  { wall: '#FFE3B3', roof: '#FF7B6B', door: '#7A4B2A' },
  { wall: '#CDEBFF', roof: '#4C8DF6', door: '#F6A13A' },
  { wall: '#FFD6E7', roof: '#E8569A', door: '#6B4FA1' },
  { wall: '#E4F7C9', roof: '#3FB37F', door: '#C2553A' },
  { wall: '#FFF1A8', roof: '#F59E0B', door: '#2F7DBF' },
  { wall: '#E9DDFF', roof: '#8B5CF6', door: '#E86A33' },
];
const FLOWER_COLOURS = ['#FF6FA8', '#FFD43B', '#FF8A3D', '#B77CFF', '#5CC8FF', '#FFFFFF'];

/** Deterministic pseudo-random so the town looks the same every visit. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function buildStage1Layout(difficulty: Difficulty): LevelLayout {
  const gapScale = difficulty === 'explorer' ? 0.55 : difficulty === 'super' ? 1.2 : 1;
  const widen = difficulty === 'explorer' ? 1 : 0;

  // Gaps over the town canal. Centre positions stay fixed; widths scale by age mode.
  const gaps = [
    { c: 59.5, w: 2.6 },
    { c: 104, w: 4.4 },
    { c: 121.5, w: 3 },
    { c: 193.5, w: 3 },
  ].map((g) => ({ x: g.c - (g.w * gapScale) / 2, w: g.w * gapScale }));

  const platforms: PlatformDef[] = [];
  let cursor = LEVEL_START;
  gaps.forEach((g, i) => {
    platforms.push({ id: `ground${i}`, kind: 'ground', x: cursor, y: -GROUND_DEPTH, w: g.x - cursor, h: GROUND_DEPTH });
    cursor = g.x + g.w;
  });
  platforms.push({ id: 'groundEnd', kind: 'ground', x: cursor, y: -GROUND_DEPTH, w: LEVEL_END - cursor, h: GROUND_DEPTH });

  // Invisible walls at both ends of the town.
  platforms.push({ id: 'wallL', kind: 'invisible', x: LEVEL_START - 1, y: -GROUND_DEPTH, w: 1, h: 40 });
  platforms.push({ id: 'wallR', kind: 'invisible', x: LEVEL_END, y: -GROUND_DEPTH, w: 1, h: 40 });

  // Section B - learning to jump.
  platforms.push({ id: 'crate1', kind: 'crate', x: 42, y: 0, w: 1.6, h: 1.2 });
  platforms.push({ id: 'crate2', kind: 'crate', x: 48, y: 0, w: 1.6, h: 1.2 });
  platforms.push({ id: 'crate3', kind: 'crate', x: 49.6, y: 0, w: 1.6, h: 2.3 });
  platforms.push({ id: 'plank1', kind: 'wood', x: 66, y: 1.6, w: 4 + widen, h: 0.45, oneWay: true });

  // Section D - floating platforms over the canal.
  platforms.push({ id: 'plank2', kind: 'wood', x: 87, y: 1.9, w: 4 + widen, h: 0.45, oneWay: true });
  platforms.push({ id: 'plank3', kind: 'wood', x: 93, y: 3.6, w: 4 + widen, h: 0.45, oneWay: true });
  const movers: MoverDef[] = [];
  if (difficulty === 'super') {
    movers.push({ id: 'mover1', x: 101.4, y: 1.3, w: 2.4, h: 0.45, axis: 'x', range: 2.6, speed: 0.22 });
  } else {
    platforms.push({ id: 'island', kind: 'wood', x: 103 - widen / 2, y: 1.2, w: 2 + widen, h: 0.45, oneWay: true });
  }
  platforms.push({ id: 'crate4', kind: 'crate', x: 112, y: 0, w: 1.6, h: 1.2 });

  // Section E - bounce pad and cloud.
  platforms.push({ id: 'bounce1', kind: 'bounce', x: 149.2, y: 0, w: 1.8, h: 0.35, bounce: 22 });
  platforms.push({ id: 'cloud1', kind: 'cloud', x: 152.5, y: 7, w: 4.5 + widen, h: 0.6, oneWay: true });
  platforms.push({ id: 'crate5', kind: 'crate', x: 165, y: 0, w: 1.6, h: 1.2 });
  platforms.push({ id: 'crate6', kind: 'crate', x: 166.6, y: 0, w: 1.6, h: 1.2 });
  platforms.push({ id: 'crate7', kind: 'crate', x: 166.6, y: 1.2, w: 1.6, h: 1.2 });

  // Section F - brick stairs to the finish.
  platforms.push({ id: 'step1', kind: 'brick', x: 202, y: 0, w: 2, h: 1 });
  platforms.push({ id: 'step2', kind: 'brick', x: 204, y: 0, w: 2, h: 2 });
  platforms.push({ id: 'step3', kind: 'brick', x: 206, y: 0, w: 6, h: 3 });

  const stars: StarDef[] = [];
  const add = (x: number, y: number, bonus = false) => stars.push({ id: `s${stars.length}`, x, y, bonus });
  // A - first three stars on flat ground.
  add(8, 1); add(11, 1); add(14, 1);
  // B
  add(42.8, 2.6);
  add(50.4, 3.7);
  add(gaps[0].x - 0.6, 2.2); add(gaps[0].x + gaps[0].w / 2, 3.1); add(gaps[0].x + gaps[0].w + 0.6, 2.2);
  add(68, 2.9);
  // C/D
  add(80, 1);
  add(89, 3.2);
  add(94.2, 4.9); add(96.2, 4.9);
  add(104, 2.8);
  add(gaps[2].x + gaps[2].w / 2 - 0.7, 2.6); add(gaps[2].x + gaps[2].w / 2 + 0.7, 2.6);
  add(112.8, 2.5);
  // E
  add(150.1, 3.5); add(150.1, 5.5);
  add(153.8, 8.4); add(156, 8.4);
  add(167.4, 3.7);
  // F
  add(gaps[3].x + gaps[3].w / 2, 3);
  add(203, 2.3); add(205, 3.3); add(208, 4.3); add(210.5, 4.3);
  add(220, 1);

  if (difficulty === 'super') {
    add(95, 7.6, true);
    add(154.8, 10.6, true);
    add(209, 7.2, true);
  }

  const checkpoints: CheckpointDef[] = [
    { id: 'cp1', x: 78, y: 0 },
    { id: 'cp2', x: 138, y: 0 },
  ];
  if (difficulty === 'explorer') {
    checkpoints.splice(1, 0, { id: 'cpE1', x: 109, y: 0 });
    checkpoints.push({ id: 'cpE2', x: 186, y: 0 });
  }
  if (difficulty !== 'super') checkpoints.push({ id: 'cp3', x: 180, y: 0 });
  checkpoints.sort((a, b) => a.x - b.x);

  return {
    stageId: 'stage1',
    difficulty,
    start: { x: 0, y: 0 },
    bounds: { minX: LEVEL_START + 2, maxX: LEVEL_END - 2 },
    killY: -1.4,
    platforms,
    movers,
    water: gaps,
    stars,
    checkpoints,
    hints: [
      { x: 3.5, y: 0, icon: 'move', key: 'tut.move' },
      { x: 38.5, y: 0, icon: 'jump', key: 'tut.jump' },
      { x: 145.5, y: 0, icon: 'bounce', key: 'tut.bounce' },
    ],
    npcs: [
      { kind: 'duck', x: 22, y: 0, z: 2.2 },
      { kind: 'bunny', x: 73, y: 0, z: 2.2 },
      { kind: 'owl', x: 160, y: 0, z: 2.4 },
      { kind: 'duck', x: 216, y: 0, z: 2.2 },
    ],
    kitten: { x: 131, y: 0 },
    mamaCat: { x: 176, y: 0 },
    finish: { x: 226, y: 0 },
    decor: buildDecor(gaps),
  };
}

function buildDecor(gaps: Array<{ x: number; w: number }>): DecorDef {
  const r = rng(2026);
  const inGap = (x: number, pad = 1) => gaps.some((g) => x > g.x - pad && x < g.x + g.w + pad);
  const decor: DecorDef = {
    houses: [],
    trees: [],
    flowers: [],
    fences: [],
    lamps: [],
    bushes: [],
    playground: [
      { kind: 'slide', x: 143, z: 7 },
      { kind: 'swing', x: 158, z: 8 },
      { kind: 'seesaw', x: 64, z: 6.5 },
    ],
    signs: [],
    balloons: [],
  };
  let hx = -6;
  let i = 0;
  while (hx < 236) {
    const c = HOUSE_COLOURS[i % HOUSE_COLOURS.length];
    const w = 6 + r() * 2.5;
    decor.houses.push({ x: hx + w / 2, z: 11 + r() * 3, w, h: 4.2 + r() * 2.2, ...c });
    hx += w + 4 + r() * 5;
    i++;
  }
  for (let x = -4; x < 236; x += 7 + r() * 6) {
    if (!inGap(x, 2)) decor.trees.push({ x, z: 5 + r() * 2.5, s: 0.9 + r() * 0.5, kind: r() > 0.75 ? 'pine' : 'round' });
  }
  for (let x = -6; x < 238; x += 1.3 + r() * 1.8) {
    if (inGap(x)) continue;
    const z = r() > 0.45 ? -2.2 - r() * 1 : 2.6 + r() * 1.2;
    decor.flowers.push({ x, z, color: FLOWER_COLOURS[Math.floor(r() * FLOWER_COLOURS.length)] });
  }
  for (let x = -6; x < 236; x += 9 + r() * 6) {
    if (!inGap(x, 3)) decor.fences.push({ x, z: 3.6, w: 4 });
  }
  for (let x = 6; x < 236; x += 24) if (!inGap(x, 2)) decor.lamps.push({ x, z: 2.0 });
  for (let x = -2; x < 236; x += 5 + r() * 7) {
    if (!inGap(x, 1.5)) decor.bushes.push({ x, z: 3.0 + r() * 0.6, s: 0.7 + r() * 0.5 });
  }
  decor.bushes.push({ x: 132.6, z: 1.2, s: 1.1 }); // the kitten's hiding bush
  decor.signs.push({ x: -3, z: 1.6 });
  const balloonColours = ['#FF5D73', '#FFD43B', '#4CC9F0', '#9B5DE5', '#06D6A0', '#FF8A3D'];
  for (let k = 0; k < 6; k++) {
    decor.balloons.push({ x: 223.6 + (k % 3) * 0.3 + (k > 2 ? 4.4 : 0), y: 5.6 + (k % 3) * 0.6, z: 0.2, color: balloonColours[k] });
  }
  return decor;
}
