/**
 * 컨디션 시스템
 * - 최대 컨디션 = 체력(stamina) × 10
 * - 활동에 따라 소모 (알바 > 훈련 > 제작)
 * - 자동 휴식 임계값 설정 가능
 * - 컨디션 0% → 돌발 행동 확정 발동 + 강제 휴식
 */
import { eq } from 'drizzle-orm';
import { characters } from '../../db/schema';

/** 활동별 컨디션 소모량 (틱 당) */
export const ACTIVITY_DRAIN_RATES: Record<string, number> = {
  work: 5,      // 알바: 가장 높은 소모
  training: 3,  // 훈련: 중간
  crafting: 2,  // 제작: 가장 낮은 소모
  idle: 0,      // 대기: 소모 없음
  resting: 0,   // 휴식: 소모 없음 (회복)
};

/** 여가시설 레벨별 회복량 (틱 당) */
export const REST_RECOVERY_RATES: Record<number, number> = {
  0: 2,  // 시설 없음: 최소 회복
  1: 3,
  2: 5,
  3: 8,
  4: 12,
};

export interface ConditionState {
  current: number;
  max: number;
  percentage: number;
  isExhausted: boolean;   // 컨디션 0% 도달
  shouldAutoRest: boolean; // 임계값 이하
}

/**
 * 캐릭터의 현재 컨디션 상태 계산
 */
export function getConditionState(
  condition: number,
  stamina: number,
  restThreshold: number = 30, // 기본 임계값 30%
): ConditionState {
  const max = stamina * 10;
  const clamped = Math.max(0, Math.min(condition, max));
  const percentage = max > 0 ? (clamped / max) * 100 : 0;

  return {
    current: clamped,
    max,
    percentage,
    isExhausted: clamped <= 0,
    shouldAutoRest: percentage <= restThreshold && percentage > 0,
  };
}

/**
 * 활동에 따른 컨디션 소모 계산
 * @returns 소모 후 남은 컨디션
 */
export function drainCondition(
  currentCondition: number,
  activity: string,
  toolDrainReduction: number = 0, // 도구에 의한 소모 감소 (0~1)
): number {
  const baseRate = ACTIVITY_DRAIN_RATES[activity] ?? 0;
  if (baseRate === 0) return currentCondition;

  const reduction = Math.max(0, Math.min(1, toolDrainReduction));
  const actualDrain = Math.max(1, Math.round(baseRate * (1 - reduction)));
  return Math.max(0, currentCondition - actualDrain);
}

/**
 * 휴식에 의한 컨디션 회복 계산
 * @returns 회복 후 컨디션
 */
export function recoverCondition(
  currentCondition: number,
  stamina: number,
  facilityLevel: number = 0,
): number {
  const max = stamina * 10;
  const rate = REST_RECOVERY_RATES[Math.min(facilityLevel, 4)] ?? REST_RECOVERY_RATES[0];
  return Math.min(max, currentCondition + rate);
}

/**
 * 컨디션 틱 처리 — 활동에 따라 소모 또는 회복
 * DB에 반영하고 상태 반환
 */
export async function tickCondition(
  db: any,
  characterId: string,
  facilityLevel: number = 0,
  toolDrainReduction: number = 0,
  restThreshold: number = 30,
): Promise<ConditionState & { previousCondition: number }> {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) throw new Error(`Character ${characterId} not found`);

  const previousCondition = char.condition;
  let newCondition: number;

  if (char.activity === 'resting') {
    newCondition = recoverCondition(char.condition, char.stamina, facilityLevel);
  } else {
    newCondition = drainCondition(char.condition, char.activity, toolDrainReduction);
  }

  // DB 업데이트
  await db
    .update(characters)
    .set({ condition: newCondition })
    .where(eq(characters.id, characterId));

  const state = getConditionState(newCondition, char.stamina, restThreshold);

  return { ...state, previousCondition };
}

/**
 * 컨디션 0% 강제 휴식 처리
 * activity를 'resting'으로 변경하고 최소 컨디션 부여
 */
export async function forceRest(
  db: any,
  characterId: string,
): Promise<void> {
  const [char] = await db
    .select()
    .from(characters)
    .where(eq(characters.id, characterId))
    .limit(1);

  if (!char) throw new Error(`Character ${characterId} not found`);

  // 최소 컨디션 = max의 10%
  const minCondition = Math.max(1, Math.round(char.stamina * 10 * 0.1));

  await db
    .update(characters)
    .set({
      condition: minCondition,
      activity: 'resting',
    })
    .where(eq(characters.id, characterId));
}

/**
 * 휴식 임계값 설정 (캐릭터별)
 * characters 테이블에 rest_threshold 컬럼이 없으므로 game_config 또는
 * 별도 저장소를 사용. 여기서는 메모리 캐시로 관리 (Phase 3에서 DB화)
 */
const restThresholdCache = new Map<string, number>();

export function setRestThreshold(characterId: string, threshold: number): void {
  const clamped = Math.max(0, Math.min(100, threshold));
  restThresholdCache.set(characterId, clamped);
}

export function getRestThreshold(characterId: string): number {
  return restThresholdCache.get(characterId) ?? 30; // default 30%
}
