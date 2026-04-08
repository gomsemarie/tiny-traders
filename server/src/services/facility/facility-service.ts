/**
 * 시설 서비스
 * - 시설 건설/업그레이드/철거
 * - 테트리스형 모양 배치 검증
 * - 건설 시간 처리
 */
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { facilityTemplates, facilities } from '../../db/schema';
import { canPlaceFacility, rotateShape } from './grid-service';

export type FacilityType =
  | 'character_zone' | 'house' | 'kitchen' | 'parking' | 'office' | 'warehouse'
  | 'work_boost' | 'craft_boost' | 'train_boost'
  | 'rest' | 'bank' | 'hospital' | 'walkway';

export interface FacilityInfo {
  id: string;
  definitionId: string;
  name: string;
  type: FacilityType;
  grade: number;
  maxGrade: number;
  gridX: number;
  gridY: number;
  rotation: number;
  status: 'active' | 'building' | 'damaged';
  shape: Array<[number, number]>;
  effects: Record<string, unknown>;
  isCollateral: boolean;
}

/**
 * 시설 건설
 */
export async function buildFacility(
  db: any,
  userId: string,
  definitionId: string,
  gridX: number,
  gridY: number,
  rotation: number = 0,
): Promise<{ success: boolean; id?: string; error?: string }> {
  // 템플릿 조회
  const [template] = await db
    .select()
    .from(facilityTemplates)
    .where(eq(facilityTemplates.id, definitionId))
    .limit(1);

  if (!template) return { success: false, error: 'Template not found' };

  // 배치 유효성 검증
  const shape = template.shapeJson as Array<[number, number]>;
  const validation = await canPlaceFacility(db, userId, gridX, gridY, shape, rotation);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const id = randomUUID();
  const now = new Date();
  const status = template.buildTime > 0 ? 'building' : 'active';

  await db.insert(facilities).values({
    id,
    ownerId: userId,
    definitionId,
    grade: 1,
    gridX,
    gridY,
    rotation,
    status,
    createdAt: now,
    isCollateral: false,
  });

  return { success: true, id };
}

/**
 * 건설 완료 확인 및 처리
 */
export async function checkBuildCompletion(
  db: any,
  facilityId: string,
): Promise<{ completed: boolean }> {
  const [facility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  if (!facility || facility.status !== 'building') return { completed: false };

  // For now, building is instant (buildTime = 0), so just mark as active
  await db
    .update(facilities)
    .set({ status: 'active' })
    .where(eq(facilities.id, facilityId));

  return { completed: true };
}

/**
 * 시설 업그레이드
 */
export async function upgradeFacility(
  db: any,
  facilityId: string,
): Promise<{ success: boolean; newGrade?: number; error?: string }> {
  const [facility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  if (!facility) return { success: false, error: 'Facility not found' };
  if (facility.status === 'building') return { success: false, error: 'Still building' };

  const [template] = await db
    .select()
    .from(facilityTemplates)
    .where(eq(facilityTemplates.id, facility.definitionId))
    .limit(1);

  if (!template) return { success: false, error: 'Template not found' };

  if (facility.grade >= template.maxLevel) {
    return { success: false, error: 'Max grade reached' };
  }

  const newGrade = facility.grade + 1;
  const newStatus = template.buildTime > 0 ? 'building' : 'active';

  await db
    .update(facilities)
    .set({
      grade: newGrade,
      status: newStatus,
    })
    .where(eq(facilities.id, facilityId));

  return { success: true, newGrade };
}

/**
 * 시설 철거
 */
export async function demolishFacility(
  db: any,
  facilityId: string,
): Promise<{ success: boolean; error?: string }> {
  const [facility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  if (!facility) return { success: false, error: 'Facility not found' };

  await db.delete(facilities).where(eq(facilities.id, facilityId));
  return { success: true };
}

/**
 * 시설 이동 (재배치)
 */
export async function moveFacility(
  db: any,
  facilityId: string,
  newGridX: number,
  newGridY: number,
  newRotation?: number,
): Promise<{ success: boolean; error?: string }> {
  const [facility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  if (!facility) return { success: false, error: 'Facility not found' };
  if (facility.status === 'building') return { success: false, error: 'Cannot move while building' };

  const [template] = await db
    .select()
    .from(facilityTemplates)
    .where(eq(facilityTemplates.id, facility.definitionId))
    .limit(1);

  if (!template) return { success: false, error: 'Template not found' };

  const shape = template.shapeJson as Array<[number, number]>;
  const rotation = newRotation ?? facility.rotation;

  // Validate placement at new location
  const validation = await canPlaceFacility(db, facility.ownerId, newGridX, newGridY, shape, rotation);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  await db
    .update(facilities)
    .set({
      gridX: newGridX,
      gridY: newGridY,
      rotation,
    })
    .where(eq(facilities.id, facilityId));

  return { success: true };
}

/**
 * 유저의 모든 시설 목록 조회
 */
export async function getUserFacilities(
  db: any,
  userId: string,
): Promise<FacilityInfo[]> {
  const userFacs = await db
    .select()
    .from(facilities)
    .where(eq(facilities.ownerId, userId));

  const result: FacilityInfo[] = [];

  for (const f of userFacs) {
    const [template] = await db
      .select()
      .from(facilityTemplates)
      .where(eq(facilityTemplates.id, f.definitionId))
      .limit(1);

    if (!template) continue;

    result.push({
      id: f.id,
      definitionId: f.definitionId,
      name: template.name,
      type: template.type as FacilityType,
      grade: f.grade,
      maxGrade: template.maxLevel,
      gridX: f.gridX,
      gridY: f.gridY,
      rotation: f.rotation,
      status: f.status as 'active' | 'building' | 'damaged',
      shape: template.shapeJson as Array<[number, number]>,
      effects: template.effectsJson as Record<string, unknown>,
      isCollateral: f.isCollateral,
    });
  }

  return result;
}

/**
 * 특정 타입 시설의 레벨 조회 (시스템 해금 체크용)
 */
export async function getFacilityLevelByType(
  db: any,
  userId: string,
  type: FacilityType,
): Promise<number> {
  const userFacs = await db
    .select()
    .from(facilities)
    .where(eq(facilities.ownerId, userId));

  for (const f of userFacs) {
    const [template] = await db
      .select()
      .from(facilityTemplates)
      .where(eq(facilityTemplates.id, f.definitionId))
      .limit(1);

    if (template && template.type === type && f.status === 'active') {
      return f.grade;
    }
  }

  return 0; // 미건설
}
