/**
 * 아르바이트 미니게임 프레임워크
 * - 자동 수행 (×1) / 수동 수행 (×10) 이중 구조
 * - 캐릭터 스텟 연동 보상 계산
 * - 시설 해금 체크
 * - 알바 효율 설비 보정
 */

// ─── Types ───

export type JobType = 'cooking' | 'parking' | 'typing' | 'sorting';

export interface JobDefinition {
  type: JobType;
  name: string;
  facility: string;           // 필요 시설 type
  baseReward: number;         // 기본 보상 (자동 ×1 기준)
  manualMultiplier: number;   // 수동 수행 보상 배율 (기본 10)
  durationSec: number;        // 한 판 기본 시간 (초)
  statWeights: StatWeights;   // 스텟 영향 가중치
}

export interface StatWeights {
  stamina: number;     // 체력 → 지속시간/제한시간
  efficiency: number;  // 효율 → 속도/산출량
  precision: number;   // 꼼꼼함 → 정확도/콤보
  luck: number;        // 운 → 추가 보상/보너스 이벤트
}

export interface AutoJobResult {
  jobType: JobType;
  characterId: string;
  baseReward: number;
  statBonus: number;
  facilityBonus: number;
  totalReward: number;
  bonusDropped: boolean;
  bonusItem?: string;
  conditionDrain: number;
}

export interface ManualJobResult {
  jobType: JobType;
  characterId: string;
  score: number;
  maxScore: number;
  scoreRatio: number;
  baseReward: number;
  scoreMultiplier: number;
  manualMultiplier: number;
  statBonus: number;
  facilityBonus: number;
  totalReward: number;
  bonusDropped: boolean;
  bonusItem?: string;
  conditionDrain: number;
}

// ─── Job Definitions ───

export const JOB_DEFINITIONS: Record<JobType, JobDefinition> = {
  cooking: {
    type: 'cooking',
    name: '요리 알바',
    facility: 'kitchen',
    baseReward: 100,
    manualMultiplier: 10,
    durationSec: 45,
    statWeights: {
      stamina: 0.1,
      efficiency: 0.4,
      precision: 0.4,
      luck: 0.1,
    },
  },
  parking: {
    type: 'parking',
    name: '발렛파킹 알바',
    facility: 'parking',
    baseReward: 120,
    manualMultiplier: 10,
    durationSec: 45,
    statWeights: {
      stamina: 0.3,
      efficiency: 0.4,
      precision: 0.1,
      luck: 0.2,
    },
  },
  typing: {
    type: 'typing',
    name: '타자 알바',
    facility: 'office',
    baseReward: 90,
    manualMultiplier: 10,
    durationSec: 40,
    statWeights: {
      stamina: 0.1,
      efficiency: 0.3,
      precision: 0.5,
      luck: 0.1,
    },
  },
  sorting: {
    type: 'sorting',
    name: '분류 작업 알바',
    facility: 'warehouse',
    baseReward: 80,
    manualMultiplier: 10,
    durationSec: 40,
    statWeights: {
      stamina: 0.2,
      efficiency: 0.3,
      precision: 0.4,
      luck: 0.1,
    },
  },
};

// ─── Stat Bonus Calculation ───

/**
 * 스텟 기반 보너스 배율 계산
 * 각 스텟 (1~10)을 가중 합산하여 0.5~2.0 범위의 배율 생성
 */
export function calculateStatBonus(
  stats: { stamina: number; efficiency: number; precision: number; luck: number },
  weights: StatWeights,
): number {
  const weighted =
    stats.stamina * weights.stamina +
    stats.efficiency * weights.efficiency +
    stats.precision * weights.precision +
    stats.luck * weights.luck;

  // weighted range: 1~10, normalize to 0.5~2.0
  const normalized = 0.5 + (weighted - 1) * (1.5 / 9);
  return Math.max(0.5, Math.min(2.0, normalized));
}

/**
 * 운 기반 보너스 아이템 드롭 확률
 * luck 1 → 5%, luck 10 → 30%
 */
export function calculateBonusDropChance(luck: number): number {
  return 0.025 + luck * 0.025 + 0.025; // 5% ~ 30%
}

/**
 * 시설 효율 설비 레벨에 따른 보너스 배율
 * level 0 → 1.0 (보정 없음), level 4 → 1.4
 */
export function calculateFacilityBonus(boostLevel: number): number {
  return 1.0 + Math.min(boostLevel, 4) * 0.1;
}

// ─── Auto Job (×1) ───

/**
 * 자동 수행 보상 계산
 * 기본 보상 × 스텟 보너스 × 시설 효율 보너스
 */
export function calculateAutoJobReward(
  jobType: JobType,
  stats: { stamina: number; efficiency: number; precision: number; luck: number },
  boostLevel: number = 0,
  conditionPercent: number = 100,
): AutoJobResult {
  const def = JOB_DEFINITIONS[jobType];
  const statBonusMul = calculateStatBonus(stats, def.statWeights);
  const facilityBonusMul = calculateFacilityBonus(boostLevel);

  // 컨디션 효율 보정: 100%→1.0, 50%→0.75, 0%→0.5
  const conditionMul = 0.5 + (conditionPercent / 100) * 0.5;

  const base = def.baseReward;
  const statBonus = Math.round(base * (statBonusMul - 1));
  const facilityBonus = Math.round((base + statBonus) * (facilityBonusMul - 1));
  const total = Math.round((base + statBonus + facilityBonus) * conditionMul);

  // 보너스 드롭 판정
  const dropChance = calculateBonusDropChance(stats.luck);
  const bonusDropped = Math.random() < dropChance;

  return {
    jobType,
    characterId: '', // 호출자가 설정
    baseReward: base,
    statBonus,
    facilityBonus,
    totalReward: total,
    bonusDropped,
    bonusItem: bonusDropped ? selectBonusItem(jobType) : undefined,
    conditionDrain: 5, // 알바 컨디션 소모
  };
}

// ─── Manual Job (×10) ───

/**
 * 수동 수행(미니게임) 보상 계산
 * 기본 보상 × 수동 배율 × 점수 비율 × 스텟 보너스 × 시설 효율 보너스
 */
export function calculateManualJobReward(
  jobType: JobType,
  score: number,
  maxScore: number,
  stats: { stamina: number; efficiency: number; precision: number; luck: number },
  boostLevel: number = 0,
  conditionPercent: number = 100,
): ManualJobResult {
  const def = JOB_DEFINITIONS[jobType];
  const statBonusMul = calculateStatBonus(stats, def.statWeights);
  const facilityBonusMul = calculateFacilityBonus(boostLevel);

  // 점수 비율 (0~1) → 배율 (0.3~1.5)
  const scoreRatio = maxScore > 0 ? Math.min(1, score / maxScore) : 0;
  const scoreMultiplier = 0.3 + scoreRatio * 1.2;

  const conditionMul = 0.5 + (conditionPercent / 100) * 0.5;

  const base = def.baseReward;
  const manualBase = Math.round(base * def.manualMultiplier * scoreMultiplier);
  const statBonus = Math.round(manualBase * (statBonusMul - 1));
  const facilityBonus = Math.round((manualBase + statBonus) * (facilityBonusMul - 1));
  const total = Math.round((manualBase + statBonus + facilityBonus) * conditionMul);

  const dropChance = calculateBonusDropChance(stats.luck);
  // 수동 시 점수 높으면 드롭 확률 추가
  const adjustedDropChance = dropChance + scoreRatio * 0.1;
  const bonusDropped = Math.random() < adjustedDropChance;

  return {
    jobType,
    characterId: '',
    score,
    maxScore,
    scoreRatio,
    baseReward: base,
    scoreMultiplier,
    manualMultiplier: def.manualMultiplier,
    statBonus,
    facilityBonus,
    totalReward: total,
    bonusDropped,
    bonusItem: bonusDropped ? selectBonusItem(jobType) : undefined,
    conditionDrain: 5,
  };
}

// ─── Game Duration ───

/**
 * 미니게임 제한 시간 계산 (체력 스텟 보정)
 * 기본 시간 + 체력 보정 (체력 5 기준, 1당 ±2초)
 */
export function calculateGameDuration(jobType: JobType, stamina: number): number {
  const def = JOB_DEFINITIONS[jobType];
  const bonusSec = (stamina - 5) * 2;
  return Math.max(20, def.durationSec + bonusSec);
}

// ─── Stat Assist (미니게임 내 보정값) ───

/**
 * 미니게임 내 스텟 어시스트 값 계산
 * 클라이언트에 전달하여 미니게임 난이도 보정에 사용
 */
export function calculateStatAssist(
  jobType: JobType,
  stats: { stamina: number; efficiency: number; precision: number; luck: number },
): {
  speedBoost: number;      // 처리 속도 보정 (0~1)
  accuracyBoost: number;   // 정확도 보정 (0~1)
  bonusEventChance: number; // 보너스 이벤트 확률 (0~1)
  extraTimeSec: number;    // 추가 시간 (초)
} {
  const def = JOB_DEFINITIONS[jobType];

  return {
    speedBoost: Math.min(1, (stats.efficiency - 1) / 9),
    accuracyBoost: Math.min(1, (stats.precision - 1) / 9),
    bonusEventChance: Math.min(0.5, 0.05 + stats.luck * 0.05),
    extraTimeSec: Math.max(0, (stats.stamina - 5) * 2),
  };
}

// ─── Helpers ───

/** 보너스 아이템 선택 (알바별 드롭 테이블) */
function selectBonusItem(jobType: JobType): string {
  const dropTables: Record<JobType, string[]> = {
    cooking: ['gacha_shard', 'cooking_material', 'premium_ingredient'],
    parking: ['gacha_shard', 'tip_bonus', 'vip_voucher'],
    typing: ['gacha_shard', 'document_material', 'rare_contract'],
    sorting: ['gacha_shard', 'sorting_badge', 'rare_package'],
  };

  const items = dropTables[jobType];
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * 알바 해금 여부 체크 (시설 타입 매핑)
 */
export function getRequiredFacility(jobType: JobType): string {
  return JOB_DEFINITIONS[jobType].facility;
}

/**
 * 전체 알바 정보 조회 (API용)
 */
export function getAllJobDefinitions() {
  return Object.values(JOB_DEFINITIONS).map((def) => ({
    type: def.type,
    name: def.name,
    facility: def.facility,
    baseReward: def.baseReward,
    manualMultiplier: def.manualMultiplier,
    durationSec: def.durationSec,
  }));
}
