/**
 * 집 시스템
 * - 캐릭터별 개별 집 건설
 * - 등급별 버프 (컨디션 회복, 스텟 보정, 돌발 확률 감소)
 * - 최대 9채 (캐릭터 슬롯과 연동)
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { houses } from '../../db/schema';

/** 집 등급별 버프 정의 */
export interface HouseBuff {
  conditionRecoveryBonus: number;   // 추가 회복량
  conditionMaxBonus: number;        // 컨디션 최대량 추가
  statBonus: number;                // 전 스텟 임시 보정
  disruptionReduction: number;      // 돌발 확률 감소 (0~1)
  description: string;
}

export const HOUSE_LEVEL_BUFFS: Record<number, HouseBuff> = {
  1: { // 허름한 집
    conditionRecoveryBonus: 0,
    conditionMaxBonus: 0,
    statBonus: 0,
    disruptionReduction: 0,
    description: '허름한 집 — 버프 없음',
  },
  2: { // 일반 집
    conditionRecoveryBonus: 1,
    conditionMaxBonus: 0,
    statBonus: 0,
    disruptionReduction: 0,
    description: '일반 집 — 컨디션 회복 소폭 ↑',
  },
  3: { // 좋은 집
    conditionRecoveryBonus: 2,
    conditionMaxBonus: 5,
    statBonus: 0,
    disruptionReduction: 0,
    description: '좋은 집 — 컨디션 회복 ↑ + 최대량 ↑',
  },
  4: { // 고급 집
    conditionRecoveryBonus: 3,
    conditionMaxBonus: 5,
    statBonus: 1,
    disruptionReduction: 0,
    description: '고급 집 — 컨디션 회복 ↑ + 전 스텟 +1',
  },
  5: { // 최고급 집
    conditionRecoveryBonus: 5,
    conditionMaxBonus: 10,
    statBonus: 2,
    disruptionReduction: 0.1,
    description: '최고급 집 — 컨디션 대폭 ↑ + 전 스텟 +2 + 돌발 ↓',
  },
};

/**
 * 집 건설
 */
export async function buildHouse(
  db: any,
  userId: string,
  gridX: number,
  gridY: number,
): Promise<{ success: boolean; id?: string; error?: string }> {
  // 기존 집 수 확인 (최대 9채)
  const existingHouses = await db
    .select()
    .from(houses)
    .where(eq(houses.ownerId, userId));

  if (existingHouses.length >= 9) {
    return { success: false, error: 'Max 9 houses' };
  }

  const id = randomUUID();
  await db.insert(houses).values({
    id,
    ownerId: userId,
    level: 1,
    gridX,
    gridY,
    assignedCharacterId: null,
  });

  return { success: true, id };
}

/**
 * 집 업그레이드 (다운그레이드 불가)
 */
export async function upgradeHouse(
  db: any,
  houseId: string,
): Promise<{ success: boolean; newLevel?: number; error?: string }> {
  const [house] = await db
    .select()
    .from(houses)
    .where(eq(houses.id, houseId))
    .limit(1);

  if (!house) return { success: false, error: 'House not found' };

  const maxLevel = 5;
  if (house.level >= maxLevel) {
    return { success: false, error: 'Max level reached' };
  }

  const newLevel = house.level + 1;
  await db
    .update(houses)
    .set({ level: newLevel })
    .where(eq(houses.id, houseId));

  return { success: true, newLevel };
}

/**
 * 집에 캐릭터 배정
 */
export async function assignCharacterToHouse(
  db: any,
  houseId: string,
  characterId: string | null,
): Promise<{ success: boolean; error?: string }> {
  const [house] = await db
    .select()
    .from(houses)
    .where(eq(houses.id, houseId))
    .limit(1);

  if (!house) return { success: false, error: 'House not found' };

  await db
    .update(houses)
    .set({ assignedCharacterId: characterId })
    .where(eq(houses.id, houseId));

  return { success: true };
}

/**
 * 캐릭터에게 적용되는 집 버프 조회
 */
export async function getHouseBuffForCharacter(
  db: any,
  characterId: string,
): Promise<HouseBuff | null> {
  const allHouses = await db.select().from(houses);
  const house = allHouses.find((h: any) => h.assignedCharacterId === characterId);

  if (!house) return null;

  return HOUSE_LEVEL_BUFFS[house.level] ?? HOUSE_LEVEL_BUFFS[1];
}

/**
 * 유저의 모든 집 목록
 */
export async function getUserHouses(db: any, userId: string) {
  const userHouses = await db
    .select()
    .from(houses)
    .where(eq(houses.ownerId, userId));

  return userHouses.map((h: any) => ({
    ...h,
    buff: HOUSE_LEVEL_BUFFS[h.level] ?? HOUSE_LEVEL_BUFFS[1],
  }));
}
