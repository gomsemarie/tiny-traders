/**
 * 커스텀 캐릭터 생성 서비스
 * - 제물 캐릭터를 통한 등급 결정
 * - 커스텀 캐릭터 생성 및 스텟 롤링
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { characters, characterTemplates } from '../../db/schema';

export type Grade = 'N' | 'R' | 'SR' | 'SSR' | 'UR';

const GRADE_RANGES: Record<Grade, [number, number]> = {
  N: [21, 28],
  R: [29, 36],
  SR: [37, 45],
  SSR: [46, 55],
  UR: [56, 63],
};

const GRADE_ORDER: Grade[] = ['N', 'R', 'SR', 'SSR', 'UR'];

/**
 * 제물 캐릭터들의 등급 정보를 바탕으로 최종 등급 결정
 * - 1개: N, 2개: R, 3개: SR, 4개: SSR, 5개+: UR
 * - 더 높은 등급의 제물이 있으면 1단계 상향
 */
export function calculateGradeFromSacrifices(sacrificeGrades: Grade[]): Grade {
  if (sacrificeGrades.length === 0) return 'N';

  // 기본 등급 결정 (개수 기반)
  let baseGradeIndex: number;
  if (sacrificeGrades.length === 1) baseGradeIndex = 0; // N
  else if (sacrificeGrades.length === 2) baseGradeIndex = 1; // R
  else if (sacrificeGrades.length === 3) baseGradeIndex = 2; // SR
  else if (sacrificeGrades.length === 4) baseGradeIndex = 3; // SSR
  else baseGradeIndex = 4; // UR

  // 제물 중 가장 높은 등급 찾기
  const maxSacrificeGradeIndex = Math.max(
    ...sacrificeGrades.map((g) => GRADE_ORDER.indexOf(g))
  );

  // 제물의 최고 등급이 기본 등급보다 높으면 1단계 상향
  let finalGradeIndex = baseGradeIndex;
  if (maxSacrificeGradeIndex > baseGradeIndex) {
    finalGradeIndex = Math.min(baseGradeIndex + 1, 4); // 최대 UR
  }

  return GRADE_ORDER[finalGradeIndex];
}

/**
 * 주어진 등급 범위 내에서 랜덤 스텟 분배
 */
export function distributeStats(grade: Grade): Record<string, number> {
  const [min, max] = GRADE_RANGES[grade];
  const statTotal = Math.floor(Math.random() * (max - min + 1)) + min;

  const stats = {
    stamina: 1,
    efficiency: 1,
    precision: 1,
    mental: 1,
    initiative: 1,
    discipline: 1,
    luck: 1,
  };

  let remaining = statTotal - 7;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (remaining > 0 && iterations < MAX_ITERATIONS) {
    const keys = Object.keys(stats) as (keyof typeof stats)[];
    const idx = Math.floor(Math.random() * keys.length);
    const key = keys[idx];

    if (stats[key] < 10) {
      stats[key]++;
      remaining--;
    }
    iterations++;
  }

  return stats;
}

/**
 * 커스텀 캐릭터 생성
 * 1. 제물 캐릭터들 소멸
 * 2. 등급 결정
 * 3. 스텟 분배
 * 4. 템플릿 및 캐릭터 인스턴스 생성
 */
export async function createCustomCharacter(
  db: any,
  userId: string,
  name: string,
  spriteKey: string,
  sacrificeCharIds: string[],
  skillInheritFromId?: string
): Promise<{ success: boolean; characterId?: string; templateId?: string; error?: string }> {
  try {
    // 제물 캐릭터들 조회 및 검증
    const sacrifices = await db
      .select()
      .from(characters)
      .where(eq(characters.ownerId, userId));

    // 실제로 제물로 쓸 캐릭터들 필터링
    const actualSacrifices = sacrifices.filter((c: any) => sacrificeCharIds.includes(c.id));

    if (actualSacrifices.length !== sacrificeCharIds.length) {
      return { success: false, error: 'Some sacrifice characters not found' };
    }

    // 제물 캐릭터들의 템플릿에서 등급 정보 추출
    const sacrificeTemplateIds = actualSacrifices.map((c: any) => c.templateId);
    const sacrificeTemplates = await db
      .select()
      .from(characterTemplates);

    const sacrificeGrades = sacrificeTemplates.map((t: any) => t.grade as Grade);

    // 최종 등급 계산
    const finalGrade = calculateGradeFromSacrifices(sacrificeGrades);

    // 스텟 분배
    const stats = distributeStats(finalGrade);

    // 스킬 ID 결정 (있으면 상속, 없으면 null)
    const skillId = skillInheritFromId || null;

    // 템플릿 생성
    const templateId = randomUUID();
    await db.insert(characterTemplates).values({
      id: templateId,
      name,
      grade: finalGrade,
      spriteKey,
      stamina: stats.stamina,
      efficiency: stats.efficiency,
      precision: stats.precision,
      mental: stats.mental,
      initiative: stats.initiative,
      discipline: stats.discipline,
      luck: stats.luck,
      skillId,
      trait: 'neutral',
      createdAt: new Date(),
    });

    // 캐릭터 인스턴스 생성
    const characterId = randomUUID();
    await db.insert(characters).values({
      id: characterId,
      ownerId: userId,
      templateId,
      nickname: name,
      level: 1,
      experience: 0,
      condition: 100,
      stamina: stats.stamina,
      efficiency: stats.efficiency,
      precision: stats.precision,
      mental: stats.mental,
      initiative: stats.initiative,
      discipline: stats.discipline,
      luck: stats.luck,
      slotIndex: null,
      activity: 'idle',
      createdAt: new Date(),
    });

    // 제물 캐릭터들 소멸 (삭제)
    for (const char of actualSacrifices) {
      await db
        .delete(characters)
        .where(eq(characters.id, char.id));
    }

    return { success: true, characterId, templateId };
  } catch (error) {
    console.error('createCustomCharacter error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 캐릭터의 스텟 재롤링
 * 같은 등급 범위 내에서 새로운 분배로 재설정
 */
export async function rerollStats(
  db: any,
  characterId: string
): Promise<{ success: boolean; stats?: Record<string, number>; error?: string }> {
  try {
    // 캐릭터와 템플릿 조회
    const [character] = await db
      .select()
      .from(characters)
      .where(eq(characters.id, characterId))
      .limit(1);

    if (!character) {
      return { success: false, error: 'Character not found' };
    }

    const [template] = await db
      .select()
      .from(characterTemplates)
      .where(eq(characterTemplates.id, character.templateId))
      .limit(1);

    if (!template) {
      return { success: false, error: 'Template not found' };
    }

    // 새로운 스텟 분배
    const newStats = distributeStats(template.grade as Grade);

    // 캐릭터 및 템플릿 업데이트
    await db
      .update(characters)
      .set({
        stamina: newStats.stamina,
        efficiency: newStats.efficiency,
        precision: newStats.precision,
        mental: newStats.mental,
        initiative: newStats.initiative,
        discipline: newStats.discipline,
        luck: newStats.luck,
      })
      .where(eq(characters.id, characterId));

    await db
      .update(characterTemplates)
      .set({
        stamina: newStats.stamina,
        efficiency: newStats.efficiency,
        precision: newStats.precision,
        mental: newStats.mental,
        initiative: newStats.initiative,
        discipline: newStats.discipline,
        luck: newStats.luck,
      })
      .where(eq(characterTemplates.id, character.templateId));

    return { success: true, stats: newStats };
  } catch (error) {
    console.error('rerollStats error:', error);
    return { success: false, error: String(error) };
  }
}
