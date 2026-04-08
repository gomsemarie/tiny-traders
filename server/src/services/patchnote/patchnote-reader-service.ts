/**
 * 패치노트 조회 서비스
 * - 패치노트 페이지네이션
 * - 최신 버전 조회
 */
import { desc, eq } from 'drizzle-orm';
import { patchNotes } from '../../db/schema';

export interface PatchNote {
  id: string;
  version: string;
  title: string;
  content: string;
  changesJson: unknown;
  createdAt: Date;
}

/**
 * 패치노트 페이지네이션 조회
 */
export async function getPatchNotes(
  db: any,
  limit: number = 10,
  offset: number = 0
): Promise<{ notes: PatchNote[]; total: number }> {
  const notes = await db
    .select()
    .from(patchNotes)
    .orderBy(desc(patchNotes.createdAt))
    .limit(limit)
    .offset(offset);

  // 전체 개수 - SQLite에서 COUNT(*)를 쉽게 하기 위해 직접 쿼리
  const allNotes = await db.select().from(patchNotes);
  const total = allNotes.length;

  return { notes, total };
}

/**
 * 특정 패치노트 조회
 */
export async function getPatchNote(db: any, id: string): Promise<PatchNote | null> {
  const [note] = await db
    .select()
    .from(patchNotes)
    .where(eq(patchNotes.id, id))
    .limit(1);

  return note || null;
}

/**
 * 최신 버전 문자열 반환
 */
export async function getLatestVersion(db: any): Promise<string> {
  const [latest] = await db
    .select()
    .from(patchNotes)
    .orderBy(desc(patchNotes.createdAt))
    .limit(1);

  return latest?.version ?? '0.0.0';
}

/**
 * 특정 버전 이후의 패치노트 조회
 */
export async function getPatchNotesSince(
  db: any,
  version: string
): Promise<PatchNote[]> {
  // 버전 비교는 문자열 기반 (간단한 구현)
  const allNotes = await db
    .select()
    .from(patchNotes)
    .orderBy(desc(patchNotes.createdAt));

  return allNotes.filter((note: any) => note.version > version);
}
