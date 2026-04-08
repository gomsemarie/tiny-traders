/**
 * 돌발 행동 시스템
 * - 컨디션 기반 발동 확률 곡선
 * - 자제력(discipline)이 확률과 강도에 영향
 * - 운(luck)이 긍정적 결과 확률에 영향
 * - 멘탈 디버프 상태에서 추가 확률 보정
 */

/** 돌발 행동 유형 */
export type DisruptionType =
  | 'impulse_buy'      // 돌발 매수 (중)
  | 'panic_sell'       // 공포 매도 (중)
  | 'recommendation'   // 종목 추천 강요 (약)
  | 'work_skip'        // 알바 땡땡이 (약)
  | 'craft_fail'       // 제작 실패 (약)
  | 'all_in';          // 올인 시도 (강)

/** 강도 등급 */
export type DisruptionSeverity = 'weak' | 'medium' | 'strong';

/** 돌발 행동 결과 */
export interface DisruptionResult {
  triggered: boolean;
  type?: DisruptionType;
  severity?: DisruptionSeverity;
  isPositive?: boolean;        // 운에 의한 긍정적 결과 여부
  description?: string;
}

/** 돌발 행동 정의 */
interface DisruptionDef {
  type: DisruptionType;
  severity: DisruptionSeverity;
  weight: number;           // 등급 내 가중치
  description: string;
}

const DISRUPTION_TABLE: DisruptionDef[] = [
  { type: 'recommendation', severity: 'weak', weight: 35, description: '종목 추천 강요' },
  { type: 'work_skip', severity: 'weak', weight: 35, description: '알바 땡땡이' },
  { type: 'craft_fail', severity: 'weak', weight: 30, description: '제작 실패' },
  { type: 'impulse_buy', severity: 'medium', weight: 50, description: '돌발 매수' },
  { type: 'panic_sell', severity: 'medium', weight: 50, description: '공포 매도' },
  { type: 'all_in', severity: 'strong', weight: 100, description: '올인 시도' },
];

/**
 * 컨디션 + 자제력 기반 돌발 확률 계산
 *
 * 확률 곡선:
 * - 컨디션 100~70%: 매우 낮은 확률 (기본 1~5%)
 * - 컨디션 70~30%: 점진적 상승 (5~25%)
 * - 컨디션 30~1%: 높은 확률 (25~60%)
 * - 컨디션 0%: 확정 발동 (100%)
 *
 * 자제력 보정: discipline 1~10
 * - 높을수록 확률 감소 (최대 -50%)
 * - 낮을수록 확률 증가 (최대 +30%)
 */
export function calculateDisruptionChance(
  conditionPercent: number,
  discipline: number,
  hasDebuff: boolean = false,
): number {
  // 컨디션 0% = 확정
  if (conditionPercent <= 0) return 1.0;

  // 기본 확률 곡선 (조건 기반)
  let baseChance: number;
  if (conditionPercent > 70) {
    // 100~70%: 1~5%
    baseChance = 0.01 + (1 - conditionPercent / 100) * 0.133; // linear 1%→5%
  } else if (conditionPercent > 30) {
    // 70~30%: 5~25%
    const t = (70 - conditionPercent) / 40;
    baseChance = 0.05 + t * 0.20;
  } else {
    // 30~1%: 25~60%
    const t = (30 - conditionPercent) / 30;
    baseChance = 0.25 + t * 0.35;
  }

  // 자제력 보정 (discipline 5가 기준)
  // discipline 10 → ×0.5, discipline 1 → ×1.3
  const disciplineMultiplier = 1.0 - (discipline - 5) * 0.1;
  const clampedMultiplier = Math.max(0.5, Math.min(1.3, disciplineMultiplier));

  let chance = baseChance * clampedMultiplier;

  // 멘탈 디버프 상태 → +15% 추가 보정
  if (hasDebuff) {
    chance += 0.15;
  }

  return Math.max(0, Math.min(1.0, chance));
}

/**
 * 강도 등급 선택
 * 컨디션 낮을수록 + 자제력 낮을수록 → 강한 등급 확률 ↑
 */
export function selectSeverity(
  conditionPercent: number,
  discipline: number,
): DisruptionSeverity {
  // 강한 등급 확률
  let strongChance: number;
  let mediumChance: number;

  if (conditionPercent <= 0) {
    // 컨디션 0%: 강한 등급 비율 ↑
    strongChance = 0.3 + (10 - discipline) * 0.03;
    mediumChance = 0.4;
  } else if (conditionPercent < 30) {
    strongChance = 0.15 + (10 - discipline) * 0.02;
    mediumChance = 0.35;
  } else {
    strongChance = 0.05 + (10 - discipline) * 0.01;
    mediumChance = 0.30;
  }

  strongChance = Math.max(0, Math.min(0.6, strongChance));
  mediumChance = Math.max(0.1, Math.min(0.5, mediumChance));

  const roll = Math.random();
  if (roll < strongChance) return 'strong';
  if (roll < strongChance + mediumChance) return 'medium';
  return 'weak';
}

/**
 * 주어진 강도의 돌발 행동 중 하나 선택 (가중치 기반)
 */
export function selectDisruptionType(severity: DisruptionSeverity): DisruptionDef {
  const candidates = DISRUPTION_TABLE.filter((d) => d.severity === severity);
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const c of candidates) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }

  return candidates[candidates.length - 1];
}

/**
 * 운(luck) 기반 긍정적 결과 판정
 * luck 1 → 10%, luck 10 → 55%
 */
export function isPositiveOutcome(luck: number): boolean {
  const chance = 0.05 + luck * 0.05;
  return Math.random() < Math.min(0.55, chance);
}

/**
 * 돌발 행동 전체 판정
 */
export function evaluateDisruption(
  conditionPercent: number,
  discipline: number,
  luck: number,
  hasDebuff: boolean = false,
): DisruptionResult {
  const chance = calculateDisruptionChance(conditionPercent, discipline, hasDebuff);
  const triggered = Math.random() < chance;

  if (!triggered) {
    return { triggered: false };
  }

  const severity = selectSeverity(conditionPercent, discipline);
  const disruption = selectDisruptionType(severity);
  const positive = isPositiveOutcome(luck);

  return {
    triggered: true,
    type: disruption.type,
    severity: disruption.severity,
    isPositive: positive,
    description: disruption.description,
  };
}

/**
 * 외부에서 사용하기 위한 확률만 조회
 */
export function getDisruptionInfo(
  conditionPercent: number,
  discipline: number,
  luck: number,
  hasDebuff: boolean = false,
) {
  return {
    chance: calculateDisruptionChance(conditionPercent, discipline, hasDebuff),
    positiveOutcomeChance: Math.min(0.55, 0.05 + luck * 0.05),
  };
}
