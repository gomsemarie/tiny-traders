/**
 * 정신병원 시스템
 * - 멘탈 디버프 치료
 * - 등급별 치료 가능 디버프 종류, 동시 치료 수, 치료 시간
 * - 최고급 등급: 디버프 예방 효과
 */
import type { Debuff, DebuffType } from '../character/mental-debuff-service';

/** 정신병원 등급별 능력 */
export interface HospitalCapability {
  treatable: DebuffType[] | 'all';  // 치료 가능 디버프
  maxSimultaneous: number;           // 동시 치료 가능 캐릭터 수
  healSpeedMultiplier: number;       // 치료 속도 배율 (높을수록 빨리)
  preventionChance: number;          // 디버프 예방 확률 (0~1)
  description: string;
}

export const HOSPITAL_CAPABILITIES: Record<number, HospitalCapability> = {
  0: { // 미건설
    treatable: [],
    maxSimultaneous: 0,
    healSpeedMultiplier: 0,
    preventionChance: 0,
    description: '정신병원 없음 — 디버프 치료 불가',
  },
  1: { // 기본
    treatable: ['motivation_loss'],
    maxSimultaneous: 1,
    healSpeedMultiplier: 1.0,
    preventionChance: 0,
    description: '기본 — 의욕 저하만 치료, 1명씩',
  },
  2: { // 중급
    treatable: 'all',
    maxSimultaneous: 1,
    healSpeedMultiplier: 1.5,
    preventionChance: 0,
    description: '중급 — 전종 치료, 1명씩, 치료 속도 ↑',
  },
  3: { // 고급
    treatable: 'all',
    maxSimultaneous: 2,
    healSpeedMultiplier: 2.0,
    preventionChance: 0,
    description: '고급 — 전종 치료, 2명 동시, 치료 속도 ↑↑',
  },
  4: { // 최고급
    treatable: 'all',
    maxSimultaneous: 9, // 전원
    healSpeedMultiplier: 3.0,
    preventionChance: 0.2,
    description: '최고급 — 전원 동시 치료, 속도 ↑↑↑, 20% 예방',
  },
};

/**
 * 디버프 치료 가능 여부 확인
 */
export function canTreatDebuff(
  hospitalLevel: number,
  debuffType: DebuffType,
): boolean {
  const cap = HOSPITAL_CAPABILITIES[hospitalLevel];
  if (!cap || hospitalLevel === 0) return false;

  if (cap.treatable === 'all') return true;
  return cap.treatable.includes(debuffType);
}

/**
 * 치료 시뮬레이션 — 디버프 틱을 가속 소모
 * @returns 치료 후 남은 디버프 목록
 */
export function treatDebuffs(
  debuffs: Debuff[],
  hospitalLevel: number,
  currentTreatmentCount: number = 0,
): Debuff[] {
  const cap = HOSPITAL_CAPABILITIES[hospitalLevel];
  if (!cap || hospitalLevel === 0) return debuffs;

  const availableSlots = Math.max(0, cap.maxSimultaneous - currentTreatmentCount);
  if (availableSlots <= 0) return debuffs;

  // 치료 가능한 디버프만 필터
  const treatable = debuffs.filter((d) => canTreatDebuff(hospitalLevel, d.type));
  const nonTreatable = debuffs.filter((d) => !canTreatDebuff(hospitalLevel, d.type));

  // 슬롯 수만큼 치료 가속
  const treated = treatable.slice(0, availableSlots).map((d) => ({
    ...d,
    remainingTicks: Math.max(0, d.remainingTicks - Math.round(cap.healSpeedMultiplier)),
  }));

  const untreated = treatable.slice(availableSlots);

  // 만료된 디버프 제거
  const remaining = [...treated, ...untreated, ...nonTreatable].filter(
    (d) => d.remainingTicks > 0,
  );

  return remaining;
}

/**
 * 디버프 예방 판정 (최고급 병원)
 * @returns true면 디버프 발동 차단
 */
export function tryPreventDebuff(hospitalLevel: number): boolean {
  const cap = HOSPITAL_CAPABILITIES[hospitalLevel];
  if (!cap || cap.preventionChance <= 0) return false;

  return Math.random() < cap.preventionChance;
}

/**
 * 병원 정보 조회 (API 응답용)
 */
export function getHospitalInfo(level: number): HospitalCapability {
  return HOSPITAL_CAPABILITIES[Math.min(level, 4)] ?? HOSPITAL_CAPABILITIES[0];
}
