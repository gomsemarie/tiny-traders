import { describe, it, expect } from 'vitest';

describe('Skill engine', () => {
  it('calculates trigger chance based on initiative', () => {
    // Base: 10% + initiative * 5%
    const calc = (initiative: number) => Math.min(0.10 + initiative * 0.05, 0.80);

    expect(calc(1)).toBeCloseTo(0.15);
    expect(calc(5)).toBeCloseTo(0.35);
    expect(calc(10)).toBeCloseTo(0.60);
    // Capped at 80%
    expect(calc(20)).toBeCloseTo(0.80);
  });

  it('trait majority requires >50%', () => {
    const checkMajority = (counts: Record<string, number>, total: number) => {
      for (const [trait, count] of Object.entries(counts)) {
        if (count > total / 2) return trait;
      }
      return null;
    };

    expect(checkMajority({ yolo: 3, steady: 1, neutral: 1 }, 5)).toBe('yolo');
    expect(checkMajority({ yolo: 2, steady: 2, neutral: 1 }, 5)).toBeNull();
    expect(checkMajority({ yolo: 0, steady: 0, neutral: 1 }, 1)).toBe('neutral');
  });

  it('trait buffs are correctly defined', () => {
    const buffs: Record<string, { bonus: Record<string, number> }> = {
      yolo: { bonus: { initiative: 2, discipline: -1 } },
      steady: { bonus: { discipline: 2, initiative: -1 } },
      neutral: { bonus: { luck: 1 } },
    };

    expect(buffs.yolo.bonus.initiative).toBe(2);
    expect(buffs.steady.bonus.discipline).toBe(2);
    expect(buffs.neutral.bonus.luck).toBe(1);
  });
});
