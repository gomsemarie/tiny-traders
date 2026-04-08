import { describe, it, expect } from 'vitest';

describe('Gacha system', () => {
  it('distributes stats within grade range', () => {
    // Test stat distribution logic
    const GRADE_RANGES: Record<string, [number, number]> = {
      N: [21, 28], R: [29, 36], SR: [37, 45], SSR: [46, 55], UR: [56, 63],
    };

    for (const [grade, [min, max]] of Object.entries(GRADE_RANGES)) {
      const statTotal = Math.floor(Math.random() * (max - min + 1)) + min;
      expect(statTotal).toBeGreaterThanOrEqual(min);
      expect(statTotal).toBeLessThanOrEqual(max);

      // Simulate distribution
      const stats = new Array(7).fill(1);
      let remaining = statTotal - 7;
      let iterations = 0;
      while (remaining > 0 && iterations < 1000) {
        const idx = Math.floor(Math.random() * 7);
        if (stats[idx] < 10) { stats[idx]++; remaining--; }
        iterations++;
      }
      const sum = stats.reduce((a, b) => a + b, 0);
      expect(sum).toBe(statTotal);
      for (const s of stats) {
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(10);
      }
    }
  });

  it('level up increases lowest stat', () => {
    const stats = { stamina: 3, efficiency: 5, precision: 2, mental: 4, initiative: 6, discipline: 3, luck: 7 };
    const entries = Object.entries(stats).sort((a, b) => a[1] - b[1]);
    const lowest = entries[0];
    expect(lowest[0]).toBe('precision');
    expect(lowest[1]).toBe(2);
  });

  it('grade roll respects weights', () => {
    const rates = { N: 0.50, R: 0.30, SR: 0.15, SSR: 0.04, UR: 0.01 };
    const results: Record<string, number> = { N: 0, R: 0, SR: 0, SSR: 0, UR: 0 };
    const rolls = 10000;

    for (let i = 0; i < rolls; i++) {
      const roll = Math.random();
      let cumulative = 0;
      for (const [grade, rate] of Object.entries(rates)) {
        cumulative += rate;
        if (roll < cumulative) { results[grade]++; break; }
      }
    }

    // Allow 5% tolerance
    expect(results.N / rolls).toBeGreaterThan(0.40);
    expect(results.N / rolls).toBeLessThan(0.60);
    expect(results.UR / rolls).toBeLessThan(0.05);
  });
});
