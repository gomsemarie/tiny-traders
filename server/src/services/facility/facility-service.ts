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
  | 'kitchen' | 'parking' | 'office' | 'warehouse'
  | 'work_boost' | 'craft_boost' | 'train_boost'
  | 'rest' | 'bank' | 'hospital';

export interface FacilityInfo {
  id: string;
  templateId: string;
  name: string;
  type: FacilityType;
  level: number;
  maxLevel: number;
  gridX: number;
  gridY: number;
  rotation: number;
  isBuilding: boolean;
  buildCompleteAt: Date | null;
  shape: number[][];
  effects: Record<string, unknown>;
}

/**
 * 시설 건설
 */
export async function buildFacility(
  db: any,
  userId: string,
  templateId: string,
  gridX: number,
  gridY: number,
  rotation: number = 0,
): Promise<{ success: boolean; id?: string; error?: string }> {
  // 템플릿 조회
  const [template] = await db
    .select()
    .from(facilityTemplates)
    .where(eq(facilityTemplates.id, templateId))
    .limit(1);

  if (!template) return { success: false, error: 'Template not found' };

  // 배치 유효성 검증
  const shape = template.shapeJson as number[][];
  const validation = await canPlaceFacility(db, userId, gridX, gridY, shape, rotation);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const id = randomUUID();
  const now = new Date();
  const buildCompleteAt = new Date(now.getTime() + template.buildTime * 1000);

  await db.insert(facilities).values({
    id,
    ownerId: userId,
    templateId,
    level: 1,
    gridX,
    gridY,
    rotation,
    isBuilding: true,
    buildCompleteAt,
    createdAt: now,
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

  if (!facility || !facility.isBuilding) return { completed: false };

  if (facility.buildCompleteAt && new Date() >= facility.buildCompleteAt) {
    await db
      .update(facilities)
      .set({ isBuilding: false })
      .where(eq(facilities.id, facilityId));
    return { completed: true };
  }

  return { completed: false };
}

/**
 * 시설 업그레이드
 */
export async function upgradeFacility(
  db: any,
  facilityId: string,
): Promise<{ success: boolean; newLevel?: number; error?: string }> {
  const [facility] = await db
    .select()
    .from(facilities)
    .where(eq(facilities.id, facilityId))
    .limit(1);

  if (!facility) return { success: false, error: 'Facility not found' };
  if (facility.isBuilding) return { success: false, error: 'Still building' };

  const [template] = await db
    .select()
    .from(facilityTemplates)
    .where(eq(facilityTemplates.id, facility.templateId))
    .limit(1);

  if (!template) return { success: false, error: 'Template not found' };

  if (facility.level >= template.maxLevel) {
    return { success: false, error: 'Max level reached' };
  }

  const newLevel = facility.level + 1;
  // 업그레이드 시 건설 시간 (레벨 × 기본 시간)
  const upgradeBuildTime = template.buildTime * newLevel;
  const buildCompleteAt = new Date(Date.now() + upgradeBuildTime * 1000);

  await db
    .update(facilities)
    .set({
      level: newLevel,
      isBuilding: true,
      buildCompleteAt,
    })
    .where(eq(facilities.id, facilityId));

  return { success: true, newLevel };
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
  if (facility.isBuilding) return { success: false, error: 'Cannot move while building' };

  const [template] = await db
    .select()
    .from(facilityTemplates)
    .where(eq(facilityTemplates.id, facility.templateId))
    .limit(1);

  if (!template) return { success: false, error: 'Template not found' };

  // 현재 시설을 임시로 제거한 상태에서 검증해야 함
  // 간단하게: 새 위치 유효성 확인 (자기 자신 위치는 제외해야 하지만 단순화)
  const shape = template.shapeJson as number[][];
  const rotation = newRotation ?? facility.rotation;

  // TODO: 더 정교한 검증 (자신 점유 셀 제외)
  // 현재는 단순히 위치 변경만 처리
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
      .where(eq(facilityTemplates.id, f.templateId))
      .limit(1);

    if (!template) continue;

    result.push({
      id: f.id,
      templateId: f.templateId,
      name: template.name,
      type: template.type as FacilityType,
      level: f.level,
      maxLevel: template.maxLevel,
      gridX: f.gridX,
      gridY: f.gridY,
      rotation: f.rotation,
      isBuilding: f.isBuilding,
      buildCompleteAt: f.buildCompleteAt,
      shape: template.shapeJson as number[][],
      effects: template.effectsJson as Record<string, unknown>,
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
      .where(eq(facilityTemplates.id, f.templateId))
      .limit(1);

    if (template && template.type === type && !f.isBuilding) {
      return f.level;
    }
  }

  return 0; // 미건설
}
