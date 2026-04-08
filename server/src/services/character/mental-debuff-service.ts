/**
 * 멘탈 디버프 시스템
 * - 투자 손실 연속/누적 시 캐릭터별 디버프 판정
 * - 멘탈(mental) 스텟이 저항 확률과 지속 시간에 영향
 * - 디버프 → 돌발 행동 확률 증가 → 추가 손실의 악순환 구조
 */

/** 디버프 종류 */
export type DebuffType =
  | 'motivation_loss'  // 의욕 저하: 활동 효율 감소
  | 'panic'            // 패닉: 자제력 임시 하락 → 돌발 확률 증가
  | 'burnout'          // 번아웃: 컨디션 회복 속도 감소
  | 'intimidation';    // 위축: 행동력 임시 하락 → 스킬 발동 확률 감소

/** 디버프 인스턴스 */
export interface Debuff {
  type: DebuffType;
  severity: number;         // 1~3 강도
  remainingTicks: number;   // 남은 틱 수
  appliedAt: number;        // 적용 시각 (timestamp)
}

/** 디버프 효과 정의 */
export interface DebuffEffect {
  statModifiers: Partial<Record<string, number>>; // 스텟 보정
  conditionRecoveryMultiplier: number;            // 컨디션 회복 배율 (1.0 = 정상)
  activityEfficiencyMultiplier: number;           // 활동 효율 배율
}

/** 디버프 정의 테이블 */
const DEBUFF_DEFINITIONS: Record<DebuffType, {
  description: string;
  baseDurationTicks: number;  // 기본 지속 틱 수
  getEffect: (severity: number) => DebuffEffect;
}> = {
  motivation_loss: {
    description: '의욕 저하 — 활동 효율 감소',
    baseDurationTicks: 30,
    getEffect: (severity) => ({
      statModifiers: {},
      conditionRecoveryMultiplier: 1.0,
      activityEfficiencyMultiplier: 1.0 - severity * 0.15, // 15/30/45% 감소
    }),
  },
  panic: {
    description: '패닉 — 자제력 임시 하락',
    baseDurationTicks: 20,
    getEffect: (severity) => ({
      statModifiers: { discipline: -severity * 2 }, // -2/-4/-6
      conditionRecoveryMultiplier: 1.0,
      activityEfficiencyMultiplier: 1.0,
    }),
  },
  burnout: {
    description: '번아웃 — 컨디션 회복 속도 감소',
    baseDurationTicks: 40,
    getEffect: (severity) => ({
      statModifiers: {},
      conditionRecoveryMultiplier: 1.0 - severity * 0.2, // 20/40/60% 감소
      activityEfficiencyMultiplier: 1.0,
    }),
  },
  intimidation: {
    description: '위축 — 행동력 임시 하락',
    baseDurationTicks: 25,
    getEffect: (severity) => ({
      statModifiers: { initiative: -severity * 2 }, // -2/-4/-6
      conditionRecoveryMultiplier: 1.0,
      activityEfficiencyMultiplier: 1.0,
    }),
  },
};

/**
 * 투자 손실 기반 디버프 발동 판정
 *
 * @param consecutiveLosses 연속 손실 횟수
 * @param totalLossPercent 총 손실률 (0~100)
 * @param mental 멘탈 스텟 (1~10)
 * @returns 새로 발동할 디버프 또는 null
 */
export function evaluateDebuffTrigger(
  consecutiveLosses: number,
  totalLossPercent: number,
  mental: number,
): Debuff | null {
  // 최소 2연패부터 판정
  if (consecutiveLosses < 2) return null;

  // 기본 발동 확률: 연패 수 × 10% + 손실률 × 0.5%
  const baseChance = consecutiveLosses * 0.10 + totalLossPercent * 0.005;

  // 멘탈 저항: mental 10 → 80% 저항, mental 1 → 0% 저항
  const resistance = (mental - 1) * (0.80 / 9); // 0~0.8
  const finalChance = Math.max(0, baseChance * (1 - resistance));

  // 판정
  if (Math.random() >= finalChance) return null;

  // 디버프 종류 랜덤 선택 (가중치)
  const type = selectDebuffType();

  // 강도: 연패 수 + 손실률 기반
  const severity = calculateSeverity(consecutiveLosses, totalLossPercent);

  // 지속 시간: 기본 × (1 - 멘탈 보정)
  // mental 10 → 기본의 40%, mental 1 → 기본의 120%
  const def = DEBUFF_DEFINITIONS[type];
  const durationMultiplier = 1.2 - mental * 0.08;
  const duration = Math.max(5, Math.round(def.baseDurationTicks * durationMultiplier));

  return {
    type,
    severity,
    remainingTicks: duration,
    appliedAt: Date.now(),
  };
}

/**
 * 디버프 종류 랜덤 선택 (가중치 기반)
 */
function selectDebuffType(): DebuffType {
  const weights: [DebuffType, number][] = [
    ['motivation_loss', 30],
    ['panic', 25],
    ['burnout', 25],
    ['intimidation', 20],
  ];
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;

  for (const [type, w] of weights) {
    roll -= w;
    if (roll <= 0) return type;
  }

  return 'motivation_loss';
}

/**
 * 강도 계산 (1~3)
 */
function calculateSeverity(consecutiveLosses: number, totalLossPercent: number): number {
  const score = consecutiveLosses * 2 + totalLossPercent / 10;
  if (score >= 15) return 3;
  if (score >= 8) return 2;
  return 1;
}

/**
 * 디버프 틱 처리 — 남은 시간 감소, 만료 제거
 */
export function tickDebuffs(debuffs: Debuff[]): Debuff[] {
  return debuffs
    .map((d) => ({ ...d, remainingTicks: d.remainingTicks - 1 }))
    .filter((d) => d.remainingTicks > 0);
}

/**
 * 활성 디버프의 통합 효과 계산
 */
export function calculateCombinedDebuffEffect(debuffs: Debuff[]): DebuffEffect {
  const combined: DebuffEffect = {
    statModifiers: {},
    conditionRecoveryMultiplier: 1.0,
    activityEfficiencyMultiplier: 1.0,
  };

  for (const debuff of debuffs) {
    const def = DEBUFF_DEFINITIONS[debuff.type];
    const effect = def.getEffect(debuff.severity);

    // 스텟 보정 합산
    for (const [stat, mod] of Object.entries(effect.statModifiers)) {
      combined.statModifiers[stat] = (combined.statModifiers[stat] ?? 0) + (mod ?? 0);
    }

    // 배율은 곱 적용
    combined.conditionRecoveryMultiplier *= effect.conditionRecoveryMultiplier;
    combined.activityEfficiencyMultiplier *= effect.activityEfficiencyMultiplier;
  }

  // 배율 최소 0.1으로 클램프
  combined.conditionRecoveryMultiplier = Math.max(0.1, combined.conditionRecoveryMultiplier);
  combined.activityEfficiencyMultiplier = Math.max(0.1, combined.activityEfficiencyMultiplier);

  return combined;
}

/**
 * 캐릭터가 현재 디버프 상태인지 확인 (돌발 행동 확률 보정용)
 */
export function hasActiveDebuff(debuffs: Debuff[]): boolean {
  return debuffs.length > 0;
}

/**
 * 특정 디버프 존재 여부 확인
 */
export function hasDebuffOfType(debuffs: Debuff[], type: DebuffType): boolean {
  return debuffs.some((d) => d.type === type);
}

/**
 * 디버프 정보 조회 (API 응답용)
 */
export function getDebuffInfo(type: DebuffType) {
  const def = DEBUFF_DEFINITIONS[type];
  return {
    type,
    description: def.description,
    baseDurationTicks: def.baseDurationTicks,
  };
}

/**
 * 모든 디버프 정보
 */
export function getAllDebuffDefinitions() {
  return Object.entries(DEBUFF_DEFINITIONS).map(([type, def]) => ({
    type,
    description: def.description,
    baseDurationTicks: def.baseDurationTicks,
  }));
}
