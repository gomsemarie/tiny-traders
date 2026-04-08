import { describe, it, expect } from 'vitest';
import {
  getConditionState,
  drainCondition,
  recoverCondition,
  ACTIVITY_DRAIN_RATES,
} from '../condition-service';
import {
  calculateDisruptionChance,
  selectSeverity,
  evaluateDisruption,
  isPositiveOutcome,
} from '../disruption-service';
import {
  evaluateDebuffTrigger,
  tickDebuffs,
  calculateCombinedDebuffEffect,
  getAllDebuffDefinitions,
  type Debuff,
} from '../mental-debuff-service';

// ─── Condition System ───

describe('Condition System', () => {
  it('max condition = stamina × 10', () => {
    const s1 = getConditionState(100, 10);
    expect(s1.max).toBe(100);
    expect(s1.percentage).toBe(100);

    const s2 = getConditionState(30, 5);
    expect(s2.max).toBe(50);
    expect(s2.percentage).toBe(60);
  });

  it('clamps condition to [0, max]', () => {
    const s = getConditionState(200, 5); // over max
    expect(s.current).toBe(50);
    expect(s.percentage).toBe(100);

    const s2 = getConditionState(-10, 5); // below 0
    expect(s2.current).toBe(0);
    expect(s2.isExhausted).toBe(true);
  });

  it('detects exhaustion at 0', () => {
    const s = getConditionState(0, 5);
    expect(s.isExhausted).toBe(true);
  });

  it('detects auto-rest threshold', () => {
    // 50 max, 10 current = 20% → below 30% threshold
    const s = getConditionState(10, 5, 30);
    expect(s.shouldAutoRest).toBe(true);

    // 50 max, 20 current = 40% → above 30% threshold
    const s2 = getConditionState(20, 5, 30);
    expect(s2.shouldAutoRest).toBe(false);
  });

  it('does not trigger auto-rest at 0 (exhaustion overrides)', () => {
    const s = getConditionState(0, 5, 30);
    expect(s.shouldAutoRest).toBe(false);
    expect(s.isExhausted).toBe(true);
  });

  it('drains condition by activity', () => {
    const after = drainCondition(100, 'work');
    expect(after).toBe(100 - ACTIVITY_DRAIN_RATES.work);

    const afterIdle = drainCondition(100, 'idle');
    expect(afterIdle).toBe(100);
  });

  it('drain never goes below 0', () => {
    const after = drainCondition(2, 'work');
    expect(after).toBe(0);
  });

  it('tool drain reduction reduces consumption', () => {
    // 50% reduction on work (base 5) → actual drain = 3 (rounded)
    const after = drainCondition(100, 'work', 0.5);
    expect(after).toBeGreaterThan(100 - ACTIVITY_DRAIN_RATES.work);
    expect(after).toBeLessThanOrEqual(100);
  });

  it('recovers condition at rest', () => {
    const after = recoverCondition(30, 5, 0); // facility level 0 → +2
    expect(after).toBe(32);

    const afterMax = recoverCondition(49, 5, 0); // max is 50
    expect(afterMax).toBe(50);
  });

  it('higher facility level = faster recovery', () => {
    const low = recoverCondition(30, 5, 0);
    const high = recoverCondition(30, 5, 4);
    expect(high).toBeGreaterThan(low);
  });
});

// ─── Disruption System ───

describe('Disruption System', () => {
  it('condition 0 = 100% disruption chance', () => {
    const chance = calculateDisruptionChance(0, 5);
    expect(chance).toBe(1.0);
  });

  it('high condition = low disruption chance', () => {
    const chance = calculateDisruptionChance(90, 5);
    expect(chance).toBeLessThan(0.1);
  });

  it('low condition = high disruption chance', () => {
    const chance = calculateDisruptionChance(10, 5);
    expect(chance).toBeGreaterThan(0.3);
  });

  it('high discipline reduces chance', () => {
    const lowDisc = calculateDisruptionChance(50, 1);
    const highDisc = calculateDisruptionChance(50, 10);
    expect(highDisc).toBeLessThan(lowDisc);
  });

  it('debuff state adds +15% chance', () => {
    const normal = calculateDisruptionChance(50, 5, false);
    const debuffed = calculateDisruptionChance(50, 5, true);
    expect(debuffed - normal).toBeCloseTo(0.15, 2);
  });

  it('severity distribution favors strong at low condition + low discipline', () => {
    let strongCount = 0;
    const runs = 1000;
    for (let i = 0; i < runs; i++) {
      const sev = selectSeverity(0, 1); // worst case
      if (sev === 'strong') strongCount++;
    }
    // Should have meaningful strong percentage (>15%)
    expect(strongCount / runs).toBeGreaterThan(0.15);
  });

  it('severity distribution favors weak at high condition + high discipline', () => {
    let weakCount = 0;
    const runs = 1000;
    for (let i = 0; i < runs; i++) {
      const sev = selectSeverity(90, 10);
      if (sev === 'weak') weakCount++;
    }
    expect(weakCount / runs).toBeGreaterThan(0.4);
  });

  it('luck increases positive outcome chance', () => {
    let posCount = 0;
    const runs = 5000;
    for (let i = 0; i < runs; i++) {
      if (isPositiveOutcome(10)) posCount++;
    }
    const posRate = posCount / runs;
    // luck 10 → 55% expected
    expect(posRate).toBeGreaterThan(0.45);
    expect(posRate).toBeLessThan(0.65);
  });

  it('evaluateDisruption returns triggered:false sometimes at high condition', () => {
    let noTrigger = 0;
    const runs = 100;
    for (let i = 0; i < runs; i++) {
      const r = evaluateDisruption(90, 10, 5);
      if (!r.triggered) noTrigger++;
    }
    expect(noTrigger).toBeGreaterThan(80); // most should not trigger
  });

  it('evaluateDisruption always triggers at condition 0', () => {
    let triggerCount = 0;
    const runs = 50;
    for (let i = 0; i < runs; i++) {
      const r = evaluateDisruption(0, 5, 5);
      if (r.triggered) triggerCount++;
    }
    expect(triggerCount).toBe(runs);
  });
});

// ─── Mental Debuff System ───

describe('Mental Debuff System', () => {
  it('does not trigger on 0 or 1 consecutive losses', () => {
    const d0 = evaluateDebuffTrigger(0, 0, 5);
    expect(d0).toBeNull();
    const d1 = evaluateDebuffTrigger(1, 10, 5);
    expect(d1).toBeNull();
  });

  it('high mental resists debuff more often', () => {
    let triggerLow = 0;
    let triggerHigh = 0;
    const runs = 2000;

    for (let i = 0; i < runs; i++) {
      if (evaluateDebuffTrigger(5, 30, 1) !== null) triggerLow++;
      if (evaluateDebuffTrigger(5, 30, 10) !== null) triggerHigh++;
    }

    expect(triggerLow).toBeGreaterThan(triggerHigh);
  });

  it('triggered debuff has valid structure', () => {
    // Force high chance: many losses, low mental
    let debuff: ReturnType<typeof evaluateDebuffTrigger> = null;
    for (let i = 0; i < 100 && !debuff; i++) {
      debuff = evaluateDebuffTrigger(10, 50, 1);
    }
    // should eventually trigger
    expect(debuff).not.toBeNull();
    expect(debuff!.type).toBeDefined();
    expect(debuff!.severity).toBeGreaterThanOrEqual(1);
    expect(debuff!.severity).toBeLessThanOrEqual(3);
    expect(debuff!.remainingTicks).toBeGreaterThan(0);
  });

  it('high mental reduces debuff duration', () => {
    // Collect durations
    const durationsLow: number[] = [];
    const durationsHigh: number[] = [];

    for (let i = 0; i < 500; i++) {
      const d = evaluateDebuffTrigger(8, 40, 1);
      if (d) durationsLow.push(d.remainingTicks);
    }
    for (let i = 0; i < 500; i++) {
      const d = evaluateDebuffTrigger(8, 40, 10);
      if (d) durationsHigh.push(d.remainingTicks);
    }

    if (durationsLow.length > 0 && durationsHigh.length > 0) {
      const avgLow = durationsLow.reduce((a, b) => a + b, 0) / durationsLow.length;
      const avgHigh = durationsHigh.reduce((a, b) => a + b, 0) / durationsHigh.length;
      expect(avgLow).toBeGreaterThan(avgHigh);
    }
  });

  it('tickDebuffs reduces remaining ticks and removes expired', () => {
    const debuffs: Debuff[] = [
      { type: 'panic', severity: 1, remainingTicks: 2, appliedAt: Date.now() },
      { type: 'burnout', severity: 2, remainingTicks: 1, appliedAt: Date.now() },
    ];

    const after1 = tickDebuffs(debuffs);
    expect(after1).toHaveLength(1);
    expect(after1[0].type).toBe('panic');
    expect(after1[0].remainingTicks).toBe(1);

    const after2 = tickDebuffs(after1);
    expect(after2).toHaveLength(0);
  });

  it('calculateCombinedDebuffEffect merges effects', () => {
    const debuffs: Debuff[] = [
      { type: 'panic', severity: 1, remainingTicks: 10, appliedAt: Date.now() },
      { type: 'motivation_loss', severity: 2, remainingTicks: 10, appliedAt: Date.now() },
    ];

    const effect = calculateCombinedDebuffEffect(debuffs);

    // panic severity 1 → discipline -2
    expect(effect.statModifiers.discipline).toBe(-2);
    // motivation_loss severity 2 → efficiency multiplier 0.70
    expect(effect.activityEfficiencyMultiplier).toBeCloseTo(0.70, 2);
  });

  it('getAllDebuffDefinitions returns all 4 types', () => {
    const defs = getAllDebuffDefinitions();
    expect(defs).toHaveLength(4);
    const types = defs.map((d) => d.type);
    expect(types).toContain('motivation_loss');
    expect(types).toContain('panic');
    expect(types).toContain('burnout');
    expect(types).toContain('intimidation');
  });
});
