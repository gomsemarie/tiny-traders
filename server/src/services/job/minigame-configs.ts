/**
 * 4종 미니게임 서버 사이드 설정
 * - 각 미니게임별 난이도 곡선, 점수 체계, 검증 파라미터
 * - 클라이언트에서 미니게임 플레이 후 서버에서 점수를 검증하는 구조
 */

// ─── 공통 타입 ───

export interface MinigameConfig {
  type: string;
  maxScore: number;           // 이론적 만점
  scoreTiers: ScoreTier[];    // 등급별 보상 배율
  difficultyLevels: DifficultyLevel[];
  validationRules: ValidationRules;
}

export interface ScoreTier {
  name: string;
  minRatio: number;  // 만점 대비 비율 (0~1)
  rewardMultiplier: number;
}

export interface DifficultyLevel {
  level: number;
  unlockScore: number;   // 이 점수 이상이면 다음 난이도
  speedMultiplier: number;
  description: string;
}

export interface ValidationRules {
  maxActionsPerSecond: number;  // 초당 최대 입력 수 (치트 방지)
  minDurationSec: number;       // 최소 플레이 시간
  maxScore: number;             // 서버 허용 최대 점수
}

// ─── 요리 미니게임 ───

export const COOKING_CONFIG: MinigameConfig = {
  type: 'cooking',
  maxScore: 1000,
  scoreTiers: [
    { name: 'S', minRatio: 0.9, rewardMultiplier: 1.5 },
    { name: 'A', minRatio: 0.7, rewardMultiplier: 1.2 },
    { name: 'B', minRatio: 0.5, rewardMultiplier: 1.0 },
    { name: 'C', minRatio: 0.3, rewardMultiplier: 0.7 },
    { name: 'D', minRatio: 0.0, rewardMultiplier: 0.4 },
  ],
  difficultyLevels: [
    { level: 1, unlockScore: 0, speedMultiplier: 1.0, description: '기본: 재료 3종, 단일 주문' },
    { level: 2, unlockScore: 300, speedMultiplier: 1.3, description: '주문 속도 ↑, 재료 5종' },
    { level: 3, unlockScore: 600, speedMultiplier: 1.6, description: '동시 주문 2개, 재료 7종' },
    { level: 4, unlockScore: 850, speedMultiplier: 2.0, description: '동시 주문 3개, 특수 재료' },
  ],
  validationRules: {
    maxActionsPerSecond: 5,
    minDurationSec: 15,
    maxScore: 1200,
  },
};

// ─── 발렛파킹 미니게임 ───

export const PARKING_CONFIG: MinigameConfig = {
  type: 'parking',
  maxScore: 1200,
  scoreTiers: [
    { name: 'S', minRatio: 0.9, rewardMultiplier: 1.5 },
    { name: 'A', minRatio: 0.7, rewardMultiplier: 1.2 },
    { name: 'B', minRatio: 0.5, rewardMultiplier: 1.0 },
    { name: 'C', minRatio: 0.3, rewardMultiplier: 0.7 },
    { name: 'D', minRatio: 0.0, rewardMultiplier: 0.4 },
  ],
  difficultyLevels: [
    { level: 1, unlockScore: 0, speedMultiplier: 1.0, description: '기본: 경차만, 넓은 주차장' },
    { level: 2, unlockScore: 400, speedMultiplier: 1.2, description: 'SUV 등장, 차량 빈도 ↑' },
    { level: 3, unlockScore: 750, speedMultiplier: 1.5, description: '스포츠카 등장, 좁은 공간' },
    { level: 4, unlockScore: 1000, speedMultiplier: 1.8, description: '대형 차량, 복잡 구조' },
  ],
  validationRules: {
    maxActionsPerSecond: 10,  // WASD 연속 입력
    minDurationSec: 15,
    maxScore: 1500,
  },
};

// ─── 타자 미니게임 ───

export const TYPING_CONFIG: MinigameConfig = {
  type: 'typing',
  maxScore: 800,
  scoreTiers: [
    { name: 'S', minRatio: 0.9, rewardMultiplier: 1.5 },
    { name: 'A', minRatio: 0.7, rewardMultiplier: 1.2 },
    { name: 'B', minRatio: 0.5, rewardMultiplier: 1.0 },
    { name: 'C', minRatio: 0.3, rewardMultiplier: 0.7 },
    { name: 'D', minRatio: 0.0, rewardMultiplier: 0.4 },
  ],
  difficultyLevels: [
    { level: 1, unlockScore: 0, speedMultiplier: 1.0, description: '기본: 짧은 단어' },
    { level: 2, unlockScore: 250, speedMultiplier: 1.2, description: '긴 문장, 숫자 포함' },
    { level: 3, unlockScore: 500, speedMultiplier: 1.5, description: '특수문자 혼합' },
    { level: 4, unlockScore: 700, speedMultiplier: 1.8, description: '코드 스니펫 타이핑' },
  ],
  validationRules: {
    maxActionsPerSecond: 15,  // 빠른 타이핑
    minDurationSec: 10,
    maxScore: 1000,
  },
};

// ─── 분류 작업 미니게임 ───

export const SORTING_CONFIG: MinigameConfig = {
  type: 'sorting',
  maxScore: 900,
  scoreTiers: [
    { name: 'S', minRatio: 0.9, rewardMultiplier: 1.5 },
    { name: 'A', minRatio: 0.7, rewardMultiplier: 1.2 },
    { name: 'B', minRatio: 0.5, rewardMultiplier: 1.0 },
    { name: 'C', minRatio: 0.3, rewardMultiplier: 0.7 },
    { name: 'D', minRatio: 0.0, rewardMultiplier: 0.4 },
  ],
  difficultyLevels: [
    { level: 1, unlockScore: 0, speedMultiplier: 1.0, description: '기본: A/D 2분류, 느린 벨트' },
    { level: 2, unlockScore: 300, speedMultiplier: 1.3, description: '벨트 속도 ↑, 유사 색상' },
    { level: 3, unlockScore: 600, speedMultiplier: 1.6, description: 'A/S/D 3분류 전환' },
    { level: 4, unlockScore: 800, speedMultiplier: 2.0, description: '고속 벨트, 3분류 + 특수 상자' },
  ],
  validationRules: {
    maxActionsPerSecond: 8,
    minDurationSec: 15,
    maxScore: 1100,
  },
};

// ─── Config Access ───

export const MINIGAME_CONFIGS: Record<string, MinigameConfig> = {
  cooking: COOKING_CONFIG,
  parking: PARKING_CONFIG,
  typing: TYPING_CONFIG,
  sorting: SORTING_CONFIG,
};

/**
 * 점수에 해당하는 등급 반환
 */
export function getScoreTier(config: MinigameConfig, score: number): ScoreTier {
  const ratio = config.maxScore > 0 ? score / config.maxScore : 0;
  for (const tier of config.scoreTiers) {
    if (ratio >= tier.minRatio) return tier;
  }
  return config.scoreTiers[config.scoreTiers.length - 1];
}

/**
 * 점수에 해당하는 난이도 레벨 반환
 */
export function getCurrentDifficulty(config: MinigameConfig, score: number): DifficultyLevel {
  let current = config.difficultyLevels[0];
  for (const level of config.difficultyLevels) {
    if (score >= level.unlockScore) current = level;
  }
  return current;
}

/**
 * 서버 사이드 점수 검증
 */
export function validateScore(
  config: MinigameConfig,
  score: number,
  durationSec: number,
  actionCount: number,
): { valid: boolean; reason?: string } {
  if (score > config.validationRules.maxScore) {
    return { valid: false, reason: 'Score exceeds maximum' };
  }

  if (durationSec < config.validationRules.minDurationSec) {
    return { valid: false, reason: 'Game duration too short' };
  }

  const aps = durationSec > 0 ? actionCount / durationSec : Infinity;
  if (aps > config.validationRules.maxActionsPerSecond) {
    return { valid: false, reason: 'Actions per second exceeds limit' };
  }

  return { valid: true };
}
