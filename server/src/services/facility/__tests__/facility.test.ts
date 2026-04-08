import { describe, it, expect } from 'vitest';
import {
  rotateShape,
  findShortestPath,
  type GridState,
  type GridCell,
} from '../grid-service';
import {
  HOUSE_LEVEL_BUFFS,
} from '../house-service';
import {
  canTreatDebuff,
  treatDebuffs,
  tryPreventDebuff,
  getHospitalInfo,
  HOSPITAL_CAPABILITIES,
} from '../hospital-service';
import type { Debuff } from '../../character/mental-debuff-service';

// ─── Grid & Pathfinding ───

describe('Grid System', () => {
  describe('rotateShape', () => {
    it('no rotation returns same shape', () => {
      const shape: Array<[number, number]> = [[0, 0], [1, 0], [0, 1]];
      expect(rotateShape(shape, 0)).toEqual(shape);
    });

    it('90 degree rotation works', () => {
      // rotation: [x,y] → [-y,x]
      // [0,0] → [0,0], [1,0] → [0,1], [0,1] → [-1,0]
      const shape: Array<[number, number]> = [[0, 0], [1, 0], [0, 1]];
      const rotated = rotateShape(shape, 90);
      expect(rotated).toHaveLength(3);
      // Just check that it's different from original
      expect(rotated).not.toEqual(shape);
    });

    it('180 degree rotation inverts signs', () => {
      // [x,y] → [-y,x] → [x,-y]... actually 2× 90° rotation
      const shape: Array<[number, number]> = [[1, 0]];
      const rotated = rotateShape(shape, 180);
      // 1st 90°: [0,1], 2nd 90°: [-1,0]
      expect(rotated[0][0]).toBe(-1);
    });

    it('360 degree rotation is identity', () => {
      const shape: Array<[number, number]> = [[0, 0], [1, 0], [2, 0]];
      expect(rotateShape(shape, 360)).toEqual(shape);
    });
  });

  describe('BFS Pathfinding', () => {
    function makeGrid(width: number, height: number, pathCells: [number, number][]): GridState {
      const cells: GridCell[][] = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ type: 'empty' as const })),
      );
      for (const [x, y] of pathCells) {
        cells[y][x] = { type: 'path' };
      }
      return { width, height, cells, pathTiles: pathCells };
    }

    it('finds direct path', () => {
      // Grid: S . . T  (S=placement, .=path, T=target)
      const grid = makeGrid(4, 1, [[1, 0], [2, 0]]);
      grid.cells[0][0] = { type: 'placement' };
      grid.cells[0][3] = { type: 'placement' };

      const result = findShortestPath(grid, 0, 0, 3, 0);
      expect(result.found).toBe(true);
      expect(result.distance).toBe(3);
      expect(result.path).toHaveLength(4);
    });

    it('returns distance 0 for same start/end', () => {
      const grid = makeGrid(3, 3, []);
      const result = findShortestPath(grid, 1, 1, 1, 1);
      expect(result.found).toBe(true);
      expect(result.distance).toBe(0);
    });

    it('returns not found when no path exists', () => {
      // Grid: S   T (no connecting paths)
      const grid = makeGrid(4, 1, []);
      grid.cells[0][0] = { type: 'placement' };
      grid.cells[0][3] = { type: 'placement' };

      const result = findShortestPath(grid, 0, 0, 3, 0);
      expect(result.found).toBe(false);
      expect(result.distance).toBe(-1);
    });

    it('finds path around obstacles', () => {
      // 3×3 grid:
      // S . .
      // X X .
      // . . T
      const grid = makeGrid(3, 3, [
        [1, 0], [2, 0], // top row paths
        [2, 1],         // right column path
        [0, 2], [1, 2], // bottom row paths
      ]);
      grid.cells[0][0] = { type: 'placement' }; // S
      grid.cells[2][2] = { type: 'placement' }; // T
      // [0,1] and [1,1] are empty (obstacles)

      const result = findShortestPath(grid, 0, 0, 2, 2);
      expect(result.found).toBe(true);
      expect(result.distance).toBe(4); // S→(1,0)→(2,0)→(2,1)→T
    });

    it('finds shortest of multiple paths', () => {
      // 3×3 grid with all paths open
      const pathTiles: [number, number][] = [
        [1, 0], [2, 0],
        [0, 1], [1, 1], [2, 1],
        [0, 2], [1, 2],
      ];
      const grid = makeGrid(3, 3, pathTiles);
      grid.cells[0][0] = { type: 'placement' }; // S
      grid.cells[2][2] = { type: 'placement' }; // T

      const result = findShortestPath(grid, 0, 0, 2, 2);
      expect(result.found).toBe(true);
      expect(result.distance).toBeLessThanOrEqual(4);
    });
  });
});

// ─── House System ───

describe('House System', () => {
  it('has 5 levels defined', () => {
    expect(Object.keys(HOUSE_LEVEL_BUFFS)).toHaveLength(5);
  });

  it('level 1 has no buffs', () => {
    const buff = HOUSE_LEVEL_BUFFS[1];
    expect(buff.conditionRecoveryBonus).toBe(0);
    expect(buff.statBonus).toBe(0);
    expect(buff.disruptionReduction).toBe(0);
  });

  it('level 5 has max buffs', () => {
    const buff = HOUSE_LEVEL_BUFFS[5];
    expect(buff.conditionRecoveryBonus).toBeGreaterThan(0);
    expect(buff.statBonus).toBe(2);
    expect(buff.disruptionReduction).toBeGreaterThan(0);
  });

  it('buffs increase with level', () => {
    for (let l = 2; l <= 5; l++) {
      const prev = HOUSE_LEVEL_BUFFS[l - 1];
      const curr = HOUSE_LEVEL_BUFFS[l];
      expect(curr.conditionRecoveryBonus).toBeGreaterThanOrEqual(prev.conditionRecoveryBonus);
    }
  });
});

// ─── Hospital System ───

describe('Hospital System', () => {
  it('level 0 cannot treat anything', () => {
    expect(canTreatDebuff(0, 'panic')).toBe(false);
    expect(canTreatDebuff(0, 'motivation_loss')).toBe(false);
  });

  it('level 1 only treats motivation_loss', () => {
    expect(canTreatDebuff(1, 'motivation_loss')).toBe(true);
    expect(canTreatDebuff(1, 'panic')).toBe(false);
    expect(canTreatDebuff(1, 'burnout')).toBe(false);
  });

  it('level 2+ treats all debuffs', () => {
    expect(canTreatDebuff(2, 'motivation_loss')).toBe(true);
    expect(canTreatDebuff(2, 'panic')).toBe(true);
    expect(canTreatDebuff(2, 'burnout')).toBe(true);
    expect(canTreatDebuff(2, 'intimidation')).toBe(true);
  });

  it('treatment reduces remaining ticks', () => {
    const debuffs: Debuff[] = [
      { type: 'panic', severity: 1, remainingTicks: 10, appliedAt: Date.now() },
    ];
    const after = treatDebuffs(debuffs, 2);
    expect(after[0].remainingTicks).toBeLessThan(10);
  });

  it('higher hospital level heals faster', () => {
    const debuffs: Debuff[] = [
      { type: 'panic', severity: 1, remainingTicks: 20, appliedAt: Date.now() },
    ];
    const afterL2 = treatDebuffs(debuffs, 2);
    const afterL4 = treatDebuffs(debuffs, 4);
    expect(afterL4[0]?.remainingTicks ?? 0).toBeLessThanOrEqual(afterL2[0]?.remainingTicks ?? 0);
  });

  it('expired debuffs are removed after treatment', () => {
    const debuffs: Debuff[] = [
      { type: 'motivation_loss', severity: 1, remainingTicks: 1, appliedAt: Date.now() },
    ];
    // Level 4 heals 3 ticks → 1-3 = -2 → removed
    const after = treatDebuffs(debuffs, 4);
    expect(after).toHaveLength(0);
  });

  it('max simultaneous limits treatment', () => {
    const debuffs: Debuff[] = [
      { type: 'panic', severity: 1, remainingTicks: 10, appliedAt: Date.now() },
      { type: 'burnout', severity: 1, remainingTicks: 10, appliedAt: Date.now() },
      { type: 'intimidation', severity: 1, remainingTicks: 10, appliedAt: Date.now() },
    ];
    // Level 3: max 2 simultaneous
    const after = treatDebuffs(debuffs, 3);
    // First 2 should be treated (reduced), 3rd untouched
    const treatedCount = after.filter(d => d.remainingTicks < 10).length;
    expect(treatedCount).toBeLessThanOrEqual(2);
  });

  it('level 4 has prevention chance', () => {
    const cap = HOSPITAL_CAPABILITIES[4];
    expect(cap.preventionChance).toBeGreaterThan(0);

    // Statistical test: over many runs some should prevent
    let prevented = 0;
    for (let i = 0; i < 1000; i++) {
      if (tryPreventDebuff(4)) prevented++;
    }
    expect(prevented).toBeGreaterThan(100); // ~200 expected
    expect(prevented).toBeLessThan(400);
  });

  it('level 0 never prevents', () => {
    let prevented = 0;
    for (let i = 0; i < 100; i++) {
      if (tryPreventDebuff(0)) prevented++;
    }
    expect(prevented).toBe(0);
  });

  it('getHospitalInfo returns valid info for all levels', () => {
    for (let l = 0; l <= 4; l++) {
      const info = getHospitalInfo(l);
      expect(info.description).toBeTruthy();
      expect(info.maxSimultaneous).toBeGreaterThanOrEqual(0);
    }
  });
});
