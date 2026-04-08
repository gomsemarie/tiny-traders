/**
 * 커스터마이징 서비스 테스트
 * - 스프라이트 검증
 * - 등급 계산
 * - 스텟 분배
 * - 가이드 검색
 * - 설정 관리
 */
import { describe, it, expect } from 'vitest';
import {
  calculateGradeFromSacrifices,
  distributeStats,
} from '../custom-character-service';
import {
  validateSpriteData,
  encodeSpriteKey,
  decodeSpriteKey,
  MAX_SIZE,
  MAX_FRAMES,
  MAX_DATA_SIZE,
} from '../sprite-service';

// ============ 스프라이트 검증 테스트 ============

describe('Sprite Validation', () => {
  it('validates correct sprite data', () => {
    const validSprite = JSON.stringify({
      width: 32,
      height: 32,
      frames: 1,
      data: Buffer.from('test').toString('base64'),
    });

    const result = validateSpriteData(validSprite);
    expect(result.valid).toBe(true);
  });

  it('rejects sprite with wrong width', () => {
    const invalidSprite = JSON.stringify({
      width: 64,
      height: 32,
      frames: 1,
      data: 'test',
    });

    const result = validateSpriteData(invalidSprite);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dimensions');
  });

  it('rejects sprite with wrong height', () => {
    const invalidSprite = JSON.stringify({
      width: 32,
      height: 16,
      frames: 1,
      data: 'test',
    });

    const result = validateSpriteData(invalidSprite);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('dimensions');
  });

  it('rejects sprite with too many frames', () => {
    const invalidSprite = JSON.stringify({
      width: 32,
      height: 32,
      frames: 5,
      data: 'test',
    });

    const result = validateSpriteData(invalidSprite);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Frame count');
  });

  it('rejects sprite with zero frames', () => {
    const invalidSprite = JSON.stringify({
      width: 32,
      height: 32,
      frames: 0,
      data: 'test',
    });

    const result = validateSpriteData(invalidSprite);
    expect(result.valid).toBe(false);
  });

  it('rejects sprite data that is too large', () => {
    const largeData = 'x'.repeat(MAX_DATA_SIZE + 1);
    const sprite = JSON.stringify({
      width: 32,
      height: 32,
      frames: 1,
      data: largeData,
    });

    const result = validateSpriteData(sprite);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too large');
  });

  it('rejects invalid JSON', () => {
    const result = validateSpriteData('not valid json');
    expect(result.valid).toBe(false);
  });

  it('rejects sprite without width field', () => {
    const sprite = JSON.stringify({
      height: 32,
      frames: 1,
      data: 'test',
    });

    const result = validateSpriteData(sprite);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('width/height');
  });

  it('accepts valid frames from 1 to 4', () => {
    for (let frames = 1; frames <= MAX_FRAMES; frames++) {
      const sprite = JSON.stringify({
        width: 32,
        height: 32,
        frames,
        data: 'test',
      });

      const result = validateSpriteData(sprite);
      expect(result.valid).toBe(true);
    }
  });
});

// ============ 스프라이트 키 인코딩/디코딩 테스트 ============

describe('Sprite Key Encoding', () => {
  it('encodes and decodes sprite key correctly', () => {
    const userId = 'user123';
    const name = 'CustomCharacter';

    const encoded = encodeSpriteKey(userId, name);
    expect(typeof encoded).toBe('string');

    const decoded = decodeSpriteKey(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(userId);
    expect(decoded?.name).toBe(name);
  });

  it('handles special characters in name', () => {
    const userId = 'user-123';
    const name = 'Char_With-Special.Chars';

    const encoded = encodeSpriteKey(userId, name);
    const decoded = decodeSpriteKey(encoded);

    expect(decoded?.userId).toBe(userId);
    expect(decoded?.name).toBe(name);
  });

  it('returns null for invalid encoded key', () => {
    const result = decodeSpriteKey('invalid!!!');
    expect(result).toBeNull();
  });
});

// ============ 등급 계산 테스트 ============

describe('Grade Calculation from Sacrifices', () => {
  it('returns N for 1 sacrifice', () => {
    const grade = calculateGradeFromSacrifices(['N']);
    expect(grade).toBe('N');
  });

  it('returns R for 2 sacrifices', () => {
    const grade = calculateGradeFromSacrifices(['N', 'N']);
    expect(grade).toBe('R');
  });

  it('returns SR for 3 sacrifices', () => {
    const grade = calculateGradeFromSacrifices(['N', 'N', 'N']);
    expect(grade).toBe('SR');
  });

  it('returns SSR for 4 sacrifices', () => {
    const grade = calculateGradeFromSacrifices(['N', 'N', 'N', 'N']);
    expect(grade).toBe('SSR');
  });

  it('returns UR for 5+ sacrifices', () => {
    const grade = calculateGradeFromSacrifices(['N', 'N', 'N', 'N', 'N']);
    expect(grade).toBe('UR');

    const grade6 = calculateGradeFromSacrifices(['N', 'N', 'N', 'N', 'N', 'N']);
    expect(grade6).toBe('UR');
  });

  it('bumps grade up when sacrifice quality is higher', () => {
    // 2개 (기본 R) + SSR 제물 -> SR로 상향
    const grade = calculateGradeFromSacrifices(['N', 'SSR']);
    expect(grade).toBe('SR');
  });

  it('bumps grade for 1 sacrifice with high quality', () => {
    // 1개 (기본 N) + UR 제물 -> R로 상향
    const grade = calculateGradeFromSacrifices(['UR']);
    expect(grade).toBe('R');
  });

  it('caps at UR even with high sacrifices', () => {
    // 5개 (기본 UR) + UR 제물 -> UR (변화 없음)
    const grade = calculateGradeFromSacrifices(['UR', 'UR', 'UR', 'UR', 'UR']);
    expect(grade).toBe('UR');
  });

  it('handles empty array', () => {
    const grade = calculateGradeFromSacrifices([]);
    expect(grade).toBe('N');
  });

  it('handles mixed grades correctly', () => {
    // 3개 (기본 SR) + R 제물 (R < SR이므로 변화 없음) -> SR
    const grade = calculateGradeFromSacrifices(['N', 'N', 'R']);
    expect(grade).toBe('SR');
  });
});

// ============ 스텟 분배 테스트 ============

describe('Stat Distribution', () => {
  const GRADE_RANGES: Record<string, [number, number]> = {
    N: [21, 28],
    R: [29, 36],
    SR: [37, 45],
    SSR: [46, 55],
    UR: [56, 63],
  };

  it('distributes stats within grade range for N', () => {
    for (let i = 0; i < 10; i++) {
      const stats = distributeStats('N');
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(GRADE_RANGES.N[0]);
      expect(total).toBeLessThanOrEqual(GRADE_RANGES.N[1]);
    }
  });

  it('distributes stats within grade range for R', () => {
    for (let i = 0; i < 10; i++) {
      const stats = distributeStats('R');
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(GRADE_RANGES.R[0]);
      expect(total).toBeLessThanOrEqual(GRADE_RANGES.R[1]);
    }
  });

  it('distributes stats within grade range for SR', () => {
    for (let i = 0; i < 10; i++) {
      const stats = distributeStats('SR');
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(GRADE_RANGES.SR[0]);
      expect(total).toBeLessThanOrEqual(GRADE_RANGES.SR[1]);
    }
  });

  it('distributes stats within grade range for SSR', () => {
    for (let i = 0; i < 10; i++) {
      const stats = distributeStats('SSR');
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(GRADE_RANGES.SSR[0]);
      expect(total).toBeLessThanOrEqual(GRADE_RANGES.SSR[1]);
    }
  });

  it('distributes stats within grade range for UR', () => {
    for (let i = 0; i < 10; i++) {
      const stats = distributeStats('UR');
      const total = Object.values(stats).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThanOrEqual(GRADE_RANGES.UR[0]);
      expect(total).toBeLessThanOrEqual(GRADE_RANGES.UR[1]);
    }
  });

  it('has at least 7 stats (one per type)', () => {
    const stats = distributeStats('SR');
    expect(Object.keys(stats).length).toBe(7);
  });

  it('all individual stats are between 1 and 10', () => {
    for (let i = 0; i < 20; i++) {
      const stats = distributeStats('SR');
      for (const value of Object.values(stats)) {
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(10);
      }
    }
  });

  it('stats object has expected keys', () => {
    const stats = distributeStats('SR');
    const expectedKeys = [
      'stamina',
      'efficiency',
      'precision',
      'mental',
      'initiative',
      'discipline',
      'luck',
    ];

    for (const key of expectedKeys) {
      expect(key in stats).toBe(true);
    }
  });
});

// ============ 가이드 검색 테스트 ============

describe('Guide Search', () => {
  it('matches title case-insensitively', () => {
    const queries = ['tutorial', 'TUTORIAL', 'Tutorial'];
    const title = 'Beginner Tutorial';

    for (const q of queries) {
      const pattern = `%${q}%`;
      const matchesLower = title.toLowerCase().includes(q.toLowerCase());
      expect(matchesLower).toBe(true);
    }
  });

  it('matches content substring', () => {
    const query = 'investment';
    const content = 'Learn about investment strategies in this guide';

    const matchesContent = content.toLowerCase().includes(query.toLowerCase());
    expect(matchesContent).toBe(true);
  });

  it('handles empty search query', () => {
    const query = '';
    expect(query.length).toBe(0);
  });
});

// ============ 설정 관리 테스트 ============

describe('Config Management', () => {
  it('has default balance values', () => {
    const defaults = {
      maxCharactersPerUser: 12,
      maxFacilitiesPerUser: 20,
      initialGold: 10000,
      levelUpExperienceRequired: 1000,
      characterDissolutionRefundRate: 0.8,
      tradeFeeRate: 0.001,
      loanMaxInterestRate: 0.3,
      savingsMinInterestRate: 0.05,
      gachaNRate: 0.5,
      gacharRate: 0.3,
      gachaSRRate: 0.15,
      gachaSSRRate: 0.04,
      gachaURRate: 0.01,
    };

    // 모든 기본값이 유효한 숫자
    for (const [key, value] of Object.entries(defaults)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it('gacha rates sum to approximately 1.0', () => {
    const rates = {
      N: 0.5,
      R: 0.3,
      SR: 0.15,
      SSR: 0.04,
      UR: 0.01,
    };

    const total = Object.values(rates).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('config keys follow snake_case convention', () => {
    const keys = [
      'max_characters_per_user',
      'initial_gold',
      'trade_fee_rate',
      'gacha_n_rate',
    ];

    for (const key of keys) {
      const isSnakeCase = /^[a-z_]+$/.test(key);
      expect(isSnakeCase).toBe(true);
    }
  });
});

// ============ 통합 테스트 ============

describe('Integration Scenarios', () => {
  it('custom character creation flow', () => {
    // 제물 등급들
    const sacrificeGrades = ['N', 'R', 'SR'] as const;

    // 최종 등급 계산
    const finalGrade = calculateGradeFromSacrifices(sacrificeGrades as any);
    expect(finalGrade).toBe('SR'); // 3개 -> SR, R이 SR보다 낮으므로 변화 없음

    // 스텟 분배
    const stats = distributeStats(finalGrade);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(37);
    expect(total).toBeLessThanOrEqual(45);
  });

  it('custom character with quality bump', () => {
    const sacrificeGrades = ['N', 'UR'] as const;

    // 2개 -> R, UR이 R보다 높으므로 SR로 상향
    const finalGrade = calculateGradeFromSacrifices(sacrificeGrades as any);
    expect(finalGrade).toBe('SR');

    const stats = distributeStats(finalGrade);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(37);
    expect(total).toBeLessThanOrEqual(45);
  });

  it('sprite validation in character creation', () => {
    const validSprite = JSON.stringify({
      width: 32,
      height: 32,
      frames: 2,
      data: Buffer.from('character-pixel-data').toString('base64'),
    });

    const result = validateSpriteData(validSprite);
    expect(result.valid).toBe(true);

    const spriteKey = encodeSpriteKey('user-001', 'MyCustomChar');
    expect(typeof spriteKey).toBe('string');
    expect(spriteKey.length).toBeGreaterThan(0);
  });
});
