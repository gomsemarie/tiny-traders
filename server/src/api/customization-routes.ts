/**
 * 커스터마이징 API 라우트
 * - 커스텀 캐릭터 생성
 * - 스텟 재롤링
 * - 가이드 조회
 * - 패치노트 조회
 * - 게임 설정 조회
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { initDatabase } from '../db';
import {
  createCustomCharacter,
  rerollStats,
  calculateGradeFromSacrifices,
} from '../services/customization/custom-character-service';
import { validateSpriteData, encodeSpriteKey } from '../services/customization/sprite-service';
import {
  getGuidePages,
  getGuidePage,
  searchGuides,
  getGuidesByCategory,
  createGuidePage,
  updateGuidePage,
  deleteGuidePage,
} from '../services/guide/guide-service';
import {
  getPatchNotes,
  getPatchNote,
  getLatestVersion,
} from '../services/patchnote/patchnote-reader-service';
import {
  getConfig,
  setConfig,
  getAllConfigs,
  getBalancePreset,
} from '../services/config/balance-service';

export async function customizationRoutes(fastify: FastifyInstance) {
  const db = initDatabase();

  // ============ 커스텀 캐릭터 API ============

  // 커스텀 캐릭터 생성
  fastify.post<{
    Body: {
      name: string;
      spriteData: string;
      sacrificeCharIds: string[];
      skillInheritFromId?: string;
    };
  }>('/api/customization/characters', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as {
      name: string;
      spriteData: string;
      sacrificeCharIds: string[];
      skillInheritFromId?: string;
    };
    const { name, spriteData, sacrificeCharIds, skillInheritFromId } = body;
    const userId = (request as any).user?.id;

    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
    if (!name || !spriteData || !sacrificeCharIds.length) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    // 스프라이트 검증
    const spriteValidation = validateSpriteData(spriteData);
    if (!spriteValidation.valid) {
      return reply.status(400).send({ error: spriteValidation.error });
    }

    const spriteKey = encodeSpriteKey(userId, name);

    const result = await createCustomCharacter(
      db,
      userId,
      name,
      spriteKey,
      sacrificeCharIds,
      skillInheritFromId
    );

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      characterId: result.characterId,
      templateId: result.templateId,
      message: 'Custom character created successfully',
    });
  });

  // 스텟 재롤링
  fastify.post<{
    Params: { characterId: string };
  }>('/api/customization/characters/:characterId/reroll', async (request: FastifyRequest, reply: FastifyReply) => {
    const { characterId } = request.params as { characterId: string };
    const userId = (request as any).user?.id;

    if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

    const result = await rerollStats(db, characterId);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({
      stats: result.stats,
      message: 'Stats rerolled successfully',
    });
  });

  // 등급 계산 미리보기
  fastify.post<{
    Body: { sacrificeGrades: string[] };
  }>('/api/customization/grade-preview', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { sacrificeGrades: string[] };
    const { sacrificeGrades } = body;

    if (!Array.isArray(sacrificeGrades)) {
      return reply.status(400).send({ error: 'sacrificeGrades must be an array' });
    }

    const finalGrade = calculateGradeFromSacrifices(sacrificeGrades as any);

    return reply.send({
      finalGrade,
      sacrificeCount: sacrificeGrades.length,
    });
  });

  // ============ 가이드 API ============

  // 모든 가이드 페이지 조회
  fastify.get('/api/guides', async (request: FastifyRequest, reply: FastifyReply) => {
    const pages = await getGuidePages(db);
    return reply.send(pages);
  });

  // 특정 가이드 페이지 조회
  fastify.get<{ Params: { id: string } }>(
    '/api/guides/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const page = await getGuidePage(db, id);

      if (!page) {
        return reply.status(404).send({ error: 'Guide page not found' });
      }

      return reply.send(page);
    }
  );

  // 가이드 검색
  fastify.get<{ Querystring: { q: string } }>(
    '/api/guides/search',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { q } = request.query as { q: string };

      if (!q) {
        return reply.status(400).send({ error: 'Search query required' });
      }

      const results = await searchGuides(db, q);
      return reply.send(results);
    }
  );

  // 카테고리별 가이드 조회
  fastify.get<{ Params: { category: string } }>(
    '/api/guides/category/:category',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { category } = request.params as { category: string };
      const pages = await getGuidesByCategory(db, category as any);
      return reply.send(pages);
    }
  );

  // 가이드 페이지 생성 (관리자용)
  fastify.post<{
    Body: {
      title: string;
      category: string;
      content: string;
      sortOrder?: number;
    };
  }>('/api/guides', async (request: FastifyRequest, reply: FastifyReply) => {
    const isAdmin = (request as any).user?.isAdmin;

    if (!isAdmin) return reply.status(403).send({ error: 'Forbidden' });

    const body = request.body as {
      title: string;
      category: string;
      content: string;
      sortOrder?: number;
    };
    const { title, category, content, sortOrder } = body;

    if (!title || !category || !content) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const result = await createGuidePage(db, title, category as any, content, sortOrder);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.status(201).send({
      id: result.id,
      message: 'Guide page created',
    });
  });

  // 가이드 페이지 수정 (관리자용)
  fastify.patch<{
    Params: { id: string };
    Body: Partial<{
      title: string;
      category: string;
      content: string;
      sortOrder: number;
    }>;
  }>('/api/guides/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const isAdmin = (request as any).user?.isAdmin;

    if (!isAdmin) return reply.status(403).send({ error: 'Forbidden' });

    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      title: string;
      category: string;
      content: string;
      sortOrder: number;
    }>;
    // Cast category to proper type if provided
    const updates = {
      ...body,
      category: body.category as any,
    };
    const result = await updateGuidePage(db, id, updates);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Guide page updated' });
  });

  // 가이드 페이지 삭제 (관리자용)
  fastify.delete<{ Params: { id: string } }>(
    '/api/guides/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const isAdmin = (request as any).user?.isAdmin;

      if (!isAdmin) return reply.status(403).send({ error: 'Forbidden' });

      const { id } = request.params as { id: string };
      const result = await deleteGuidePage(db, id);

      if (!result.success) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({ message: 'Guide page deleted' });
    }
  );

  // ============ 패치노트 API ============

  // 패치노트 목록 (페이지네이션)
  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/patchnotes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const limit = parseInt((request.query as any).limit ?? '10', 10);
      const offset = parseInt((request.query as any).offset ?? '0', 10);

      const { notes, total } = await getPatchNotes(db, limit, offset);

      return reply.send({
        notes,
        total,
        limit,
        offset,
      });
    }
  );

  // 특정 패치노트 조회
  fastify.get<{ Params: { id: string } }>(
    '/api/patchnotes/:id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const note = await getPatchNote(db, id);

      if (!note) {
        return reply.status(404).send({ error: 'Patch note not found' });
      }

      return reply.send(note);
    }
  );

  // 최신 버전 조회
  fastify.get('/api/patchnotes/version/latest', async (request: FastifyRequest, reply: FastifyReply) => {
    const version = await getLatestVersion(db);
    return reply.send({ version });
  });

  // ============ 게임 설정 API ============

  // 모든 설정 조회 (관리자용)
  fastify.get('/api/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const isAdmin = (request as any).user?.isAdmin;

    if (!isAdmin) return reply.status(403).send({ error: 'Forbidden' });

    const configs = await getAllConfigs(db);
    return reply.send(configs);
  });

  // 특정 설정 조회
  fastify.get<{ Params: { key: string } }>(
    '/api/config/:key',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { key } = request.params as { key: string };
      const value = await getConfig(db, key);

      if (value === null) {
        return reply.status(404).send({ error: 'Config key not found' });
      }

      return reply.send({ key, value });
    }
  );

  // 설정 저장/수정 (관리자용)
  fastify.post<{
    Body: {
      key: string;
      value: string;
      description?: string;
    };
  }>('/api/config', async (request: FastifyRequest, reply: FastifyReply) => {
    const isAdmin = (request as any).user?.isAdmin;

    if (!isAdmin) return reply.status(403).send({ error: 'Forbidden' });

    const body = request.body as {
      key: string;
      value: string;
      description?: string;
    };
    const { key, value, description } = body;

    if (!key || !value) {
      return reply.status(400).send({ error: 'Missing required fields' });
    }

    const result = await setConfig(db, key, value, description);

    if (!result.success) {
      return reply.status(400).send({ error: result.error });
    }

    return reply.send({ message: 'Config updated' });
  });

  // 밸런스 프리셋 조회
  fastify.get('/api/balance', async (request: FastifyRequest, reply: FastifyReply) => {
    const preset = await getBalancePreset(db);
    return reply.send(preset);
  });
}
