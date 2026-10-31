import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, maxJumpHeight, type Difficulty } from '../../src/core/types';
import { buildStage1Layout } from '../../src/levels/stage1/layout';
import { STAGES, isPlayable } from '../../src/levels/registry';

const MODES: Difficulty[] = ['explorer', 'junior', 'super'];
const BODY_REACH = 1.5; // the hero's body height

describe('Stage 1 layout', () => {
  for (const mode of MODES) {
    describe(mode, () => {
      const L = buildStage1Layout(mode);
      const tune = DIFFICULTIES[mode];
      const jump = maxJumpHeight(tune);
      const airTime = (2 * tune.jumpVelocity) / tune.gravity;
      const maxGap = airTime * tune.maxSpeed;
      const surfaces = [...L.platforms.filter((p) => p.kind !== 'invisible'), ...L.movers.map((m) => ({ ...m, kind: 'wood' as const, bounce: undefined }))];

      it('every gap can be jumped (with a stepping platform where needed)', () => {
        for (const g of L.water) {
          const island = surfaces.some((p) => p.x < g.x + g.w && p.x + p.w > g.x && p.kind !== 'ground');
          expect(g.w < maxGap * 0.85 || island, `gap at ${g.x.toFixed(1)} width ${g.w.toFixed(1)}`).toBe(true);
        }
      });

      it('every star is reachable from some surface or bounce pad', () => {
        for (const s of L.stars) {
          const reachable = surfaces.some((p) => {
            const top = p.y + p.h;
            const horiz = s.x >= p.x - 4 && s.x <= p.x + p.w + 4;
            const lift = p.bounce ? (p.bounce * p.bounce) / (2 * tune.gravity) : jump;
            return horiz && s.y - top <= lift + BODY_REACH && s.y >= top - 3;
          });
          expect(reachable, `star ${s.id} at (${s.x}, ${s.y})`).toBe(true);
        }
      });

      it('has checkpoints in order, the kitten before Mama Cat, and the finish last', () => {
        const xs = L.checkpoints.map((c) => c.x);
        expect([...xs].sort((a, b) => a - b)).toEqual(xs);
        expect(L.checkpoints.length).toBeGreaterThanOrEqual(mode === 'explorer' ? 4 : 2);
        expect(L.kitten.x).toBeLessThan(L.mamaCat.x);
        expect(L.mamaCat.x).toBeLessThan(L.finish.x);
        expect(L.finish.x).toBeLessThan(L.bounds.maxX);
      });

      it('nothing important sits over water', () => {
        const overWater = (x: number) => L.water.some((g) => x > g.x && x < g.x + g.w);
        expect(overWater(L.kitten.x)).toBe(false);
        expect(overWater(L.mamaCat.x)).toBe(false);
        expect(overWater(L.finish.x)).toBe(false);
        for (const c of L.checkpoints) expect(overWater(c.x), c.id).toBe(false);
      });

      it('has a sensible number of stars', () => {
        const main = L.stars.filter((s) => !s.bonus);
        expect(main.length).toBe(28);
        expect(L.stars.filter((s) => s.bonus).length).toBe(mode === 'super' ? 3 : 0);
        expect(new Set(L.stars.map((s) => s.id)).size).toBe(L.stars.length);
      });
    });
  }

  it('Little Explorer has narrower gaps than Super Sheriff', () => {
    const e = buildStage1Layout('explorer').water;
    const s = buildStage1Layout('super').water;
    e.forEach((g, i) => expect(g.w).toBeLessThan(s[i].w));
  });

  it('layout is deterministic', () => {
    expect(JSON.stringify(buildStage1Layout('junior'))).toBe(JSON.stringify(buildStage1Layout('junior')));
  });
});

describe('stage registry', () => {
  it('has 15 stages in 3 worlds, only Stage 1 playable for now', () => {
    expect(STAGES).toHaveLength(15);
    expect(STAGES.filter((s) => s.world === 1)).toHaveLength(5);
    expect(STAGES.filter(isPlayable).map((s) => s.number)).toEqual([1]);
  });
});
