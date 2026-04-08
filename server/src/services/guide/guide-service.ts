/**
 * 가이드 페이지 서비스
 * - 가이드 페이지 CRUD
 * - 카테고리별 조회
 * - 검색 기능
 */
import { eq, like, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { guidePages } from '../../db/schema';

export interface GuidePage {
  id: string;
  title: string;
  category: 'gameplay' | 'characters' | 'investment' | 'facilities' | 'social' | 'faq';
  content: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 모든 가이드 페이지 조회 (정렬 순서대로)
 */
export async function getGuidePages(db: any): Promise<GuidePage[]> {
  return db
    .select()
    .from(guidePages)
    .orderBy(asc(guidePages.sortOrder), asc(guidePages.createdAt));
}

/**
 * 특정 가이드 페이지 조회
 */
export async function getGuidePage(db: any, id: string): Promise<GuidePage | null> {
  const [page] = await db
    .select()
    .from(guidePages)
    .where(eq(guidePages.id, id))
    .limit(1);

  return page || null;
}

/**
 * 제목 또는 내용으로 가이드 검색
 */
export async function searchGuides(
  db: any,
  query: string
): Promise<GuidePage[]> {
  const searchPattern = `%${query}%`;

  return db
    .select()
    .from(guidePages)
    .where(
      like(guidePages.title, searchPattern) ||
        like(guidePages.content, searchPattern)
    )
    .orderBy(asc(guidePages.sortOrder), asc(guidePages.createdAt));
}

/**
 * 카테고리별 가이드 조회
 */
export async function getGuidesByCategory(
  db: any,
  category: GuidePage['category']
): Promise<GuidePage[]> {
  return db
    .select()
    .from(guidePages)
    .where(eq(guidePages.category, category))
    .orderBy(asc(guidePages.sortOrder), asc(guidePages.createdAt));
}

/**
 * 가이드 페이지 생성
 */
export async function createGuidePage(
  db: any,
  title: string,
  category: GuidePage['category'],
  content: string,
  sortOrder: number = 0
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const id = randomUUID();
    const now = new Date();

    await db.insert(guidePages).values({
      id,
      title,
      category,
      content,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id };
  } catch (error) {
    console.error('createGuidePage error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 가이드 페이지 수정
 */
export async function updateGuidePage(
  db: any,
  id: string,
  updates: Partial<Omit<GuidePage, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getGuidePage(db, id);
    if (!existing) {
      return { success: false, error: 'Guide page not found' };
    }

    await db
      .update(guidePages)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(guidePages.id, id));

    return { success: true };
  } catch (error) {
    console.error('updateGuidePage error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * 가이드 페이지 삭제
 */
export async function deleteGuidePage(
  db: any,
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const existing = await getGuidePage(db, id);
    if (!existing) {
      return { success: false, error: 'Guide page not found' };
    }

    await db.delete(guidePages).where(eq(guidePages.id, id));

    return { success: true };
  } catch (error) {
    console.error('deleteGuidePage error:', error);
    return { success: false, error: String(error) };
  }
}
