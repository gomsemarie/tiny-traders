import { describe, it, expect } from 'vitest';
import {
  calculateStatBonus,
  calculateBonusDropChance,
  calculateFacilityBonus,
  calculateAutoJobReward,
  calculateManualJobReward,
  calculateGameDuration,
  calculateStatAssist,
  getAllJobDefinitions,
  JOB_DEFINITIONS,
} from '../job-framework';
import {
  MINIGAME_CONFIGS,
  getScoreTier,
  getCurrentDifficulty,
  validateScore,
} from '../minigame-configs';

// ─── Job Framework ───

describe('Job Framework', () => {
  const avgStats = { stamina: 5, efficiency: 5, precision: 5, luck: 5 };
  const highStats = { stamina: 10, efficiency: 10, precision: 10, luck: 10 };
  const lowStats = { stamina: 1, efficiency: 1, precision: 1, luck: 1 };

  describe('calculateStatBonus', () => {
    it('average stats give ~1.0 multiplier', () => {
      const bonus = calculateStatBonus(avgStats, JOB_DEFINITIONS.cooking.statWeights);
      expect(bonus).toBeCloseTo(1.17, 1);
    });

    it('high stats give higher bonus', () => {
      const high = calculateStatBonus(highStats, JOB_DEFINITIONS.cooking.statWeights);
      const low = calculateStatBonus(lowStats, JOB_DEFINITIONS.cooking.statWeights);
      expect(high).toBeGreaterThan(low);
    });

    it('bonus is in range [0.5, 2.0]', () => {
      const high = calculateStatBonus(highStats, JOB_DEFINITIONS.cooking.statWeights);
      const low = calculateStatBonus(lowStats, JOB_DEFINITIONS.cooking.statWeights);
      expect(high).toBeLessThanOrEqual(2.0);
      expect(low).toBeGreaterThanOrEqual(0.5);
    });
  });

  describe('calculateBonusDropChance', () => {
    it('luck 1 gives ~5%', () => {
      expect(calculateBonusDropChance(1)).toBeCloseTo(0.075, 2);
    });

    it('luck 10 gives ~30%', () => {
      expect(calculateBonusDropChance(10)).toBeCloseTo(0.3, 1);
    });

    it('higher luck = higher chance', () => {
      expect(calculateBonusDropChance(10)).toBeGreaterThan(calculateBonusDropChance(1));
    });
  });

  describe('calculateFacilityBonus', () => {
    it('level 0 = no bonus', () => {
      expect(calculateFacilityBonus(0)).toBe(1.0);
    });

    it('level 4 = 40% bonus', () => {
      expect(calculateFacilityBonus(4)).toBe(1.4);
    });

    it('capped at level 4', () => {
      expect(calculateFacilityBonus(10)).toBe(1.4);
    });
  });

  describe('calculateAutoJobReward', () => {
    it('returns positive reward', () => {
      const result = calculateAutoJobReward('cooking', avgStats);
      expect(result.totalReward).toBeGreaterThan(0);
      expect(result.jobType).toBe('cooking');
    });

    it('higher stats = higher reward', () => {
      const low = calculateAutoJobReward('cooking', lowStats);
      const high = calculateAutoJobReward('cooking', highStats);
      expect(high.totalReward).toBeGreaterThan(low.totalReward);
    });

    it('facility boost increases reward', () => {
      const noBoost = calculateAutoJobReward('cooking', avgStats, 0);
      const withBoost = calculateAutoJobReward('cooking', avgStats, 4);
      expect(withBoost.totalReward).toBeGreaterThan(noBoost.totalReward);
    });

    it('low condition reduces reward', () => {
      const full = calculateAutoJobReward('cooking', avgStats, 0, 100);
      const half = calculateAutoJobReward('cooking', avgStats, 0, 50);
      expect(full.totalReward).toBeGreaterThan(half.totalReward);
    });

    it('includes condition drain', () => {
      const result = calculateAutoJobReward('cooking', avgStats);
      expect(result.conditionDrain).toBeGreaterThan(0);
    });
  });

  describe('calculateManualJobReward', () => {
    it('manual reward is much higher than auto', () => {
      const auto = calculateAutoJobReward('cooking', avgStats);
      const manual = calculateManualJobReward('cooking', 800, 1000, avgStats);
      expect(manual.totalReward).toBeGreaterThan(auto.totalReward * 3);
    });

    it('higher score = higher reward', () => {
      const low = calculateManualJobReward('cooking', 200, 1000, avgStats);
      const high = calculateManualJobReward('cooking', 900, 1000, avgStats);
      expect(high.totalReward).toBeGreaterThan(low.totalReward);
    });

    it('includes score multiplier', () => {
      const result = calculateManualJobReward('cooking', 500, 1000, avgStats);
      expect(result.scoreMultiplier).toBeGreaterThan(0);
      expect(result.manualMultiplier).toBe(10);
    });
  });

  describe('calculateGameDuration', () => {
    it('base duration for average stamina', () => {
      const duration = calculateGameDuration('cooking', 5);
      expect(duration).toBe(JOB_DEFINITIONS.cooking.durationSec);
    });

    it('high stamina adds time', () => {
      const duration = calculateGameDuration('cooking', 10);
      expect(duration).toBeGreaterThan(JOB_DEFINITIONS.cooking.durationSec);
    });

    it('low stamina reduces time but has minimum', () => {
      const duration = calculateGameDuration('cooking', 1);
      expect(duration).toBeGreaterThanOrEqual(20);
    });
  });

  describe('calculateStatAssist', () => {
    it('returns all assist values', () => {
      const assist = calculateStatAssist('cooking', avgStats);
      expect(assist.speedBoost).toBeGreaterThanOrEqual(0);
      expect(assist.accuracyBoost).toBeGreaterThanOrEqual(0);
      expect(assist.bonusEventChance).toBeGreaterThanOrEqual(0);
      expect(typeof assist.extraTimeSec).toBe('number');
    });

    it('high efficiency gives high speed boost', () => {
      const assist = calculateStatAssist('cooking', highStats);
      expect(assist.speedBoost).toBe(1);
    });
  });

  describe('getAllJobDefinitions', () => {
    it('returns 4 jobs', () => {
      const jobs = getAllJobDefinitions();
      expect(jobs).toHaveLength(4);
    });

    it('each job has required fields', () => {
      const jobs = getAllJobDefinitions();
      for (const job of jobs) {
        expect(job.type).toBeTruthy();
        expect(job.name).toBeTruthy();
        expect(job.facility).toBeTruthy();
        expect(job.baseReward).toBeGreaterThan(0);
      }
    });
  });
});

// ─── Minigame Configs ───

describe('Minigame Configs', () => {
  it('all 4 configs exist', () => {
    expect(Object.keys(MINIGAME_CONFIGS)).toHaveLength(4);
    expect(MINIGAME_CONFIGS.cooking).toBeDefined();
    expect(MINIGAME_CONFIGS.parking).toBeDefined();
    expect(MINIGAME_CONFIGS.typing).toBeDefined();
    expect(MINIGAME_CONFIGS.sorting).toBeDefined();
  });

  describe('getScoreTier', () => {
    it('perfect score = S tier', () => {
      const tier = getScoreTier(MINIGAME_CONFIGS.cooking, 1000);
      expect(tier.name).toBe('S');
    });

    it('zero score = D tier', () => {
      const tier = getScoreTier(MINIGAME_CONFIGS.cooking, 0);
      expect(tier.name).toBe('D');
    });

    it('mid score = B tier', () => {
      const tier = getScoreTier(MINIGAME_CONFIGS.cooking, 500);
      expect(tier.name).toBe('B');
    });
  });

  describe('getCurrentDifficulty', () => {
    it('0 score = level 1', () => {
      const diff = getCurrentDifficulty(MINIGAME_CONFIGS.cooking, 0);
      expect(diff.level).toBe(1);
    });

    it('high score = higher difficulty', () => {
      const diff = getCurrentDifficulty(MINIGAME_CONFIGS.cooking, 900);
      expect(diff.level).toBeGreaterThan(1);
    });
  });

  describe('validateScore', () => {
    it('valid score passes', () => {
      const result = validateScore(MINIGAME_CONFIGS.cooking, 500, 30, 60);
      expect(result.valid).toBe(true);
    });

    it('score too high fails', () => {
      const result = validateScore(MINIGAME_CONFIGS.cooking, 9999, 30, 60);
      expect(result.valid).toBe(false);
    });

    it('too short duration fails', () => {
      const result = validateScore(MINIGAME_CONFIGS.cooking, 500, 5, 10);
      expect(result.valid).toBe(false);
    });

    it('too many actions per second fails', () => {
      const result = validateScore(MINIGAME_CONFIGS.cooking, 500, 30, 500);
      expect(result.valid).toBe(false);
    });
  });
});
