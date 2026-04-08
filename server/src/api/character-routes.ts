import type { FastifyInstance } from 'fastify';
import {
  getUserCharacters,
  getCharacterDetail,
  levelUpCharacter,
  disposeCharacter,
} from '../services/character/character-service';
import { rollGacha, getActiveBanners } from '../services/character/gacha-service';

export async function characterRoutes(fastify: FastifyInstance) {
  // Get user's characters
  fastify.get<{ Params: { userId: string } }>(
    '/api/characters/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const characters = await getUserCharacters(db, request.params.userId);
      return { characters };
    },
  );

  // Get character detail
  fastify.get<{ Params: { id: string } }>(
    '/api/character/:id',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });
      return detail;
    },
  );

  // Level up
  fastify.post<{ Params: { id: string } }>(
    '/api/character/:id/levelup',
    async (request, reply) => {
      const db = (fastify as any).db;
      const success = await levelUpCharacter(db, request.params.id);
      if (!success) return reply.code(400).send({ error: 'Cannot level up (max level or stat cap)' });
      return { success: true };
    },
  );

  // Dispose character
  fastify.delete<{ Params: { id: string } }>(
    '/api/character/:id',
    async (request) => {
      const db = (fastify as any).db;
      await disposeCharacter(db, request.params.id);
      return { success: true };
    },
  );

  // Get active gacha banners
  fastify.get('/api/gacha/banners', async () => {
    const db = (fastify as any).db;
    const banners = await getActiveBanners(db);
    return { banners };
  });

  // Roll gacha
  fastify.post<{ Body: { userId: string; bannerId: string } }>(
    '/api/gacha/roll',
    async (request) => {
      const db = (fastify as any).db;
      const { userId, bannerId } = request.body;
      const result = await rollGacha(db, userId, bannerId);
      return result;
    },
  );

  // Equip tool
  fastify.post<{ Params: { id: string }; Body: { inventoryItemId: string } }>(
    '/api/character/:id/equip/tool',
    async (request) => {
      const db = (fastify as any).db;
      const { equipTool } = await import('../services/character/equipment-service');
      return equipTool(db, request.params.id, request.body.inventoryItemId);
    },
  );

  // Equip identity
  fastify.post<{ Params: { id: string }; Body: { inventoryItemId: string; slot: number } }>(
    '/api/character/:id/equip/identity',
    async (request) => {
      const db = (fastify as any).db;
      const { equipIdentity } = await import('../services/character/equipment-service');
      return equipIdentity(db, request.params.id, request.body.inventoryItemId, request.body.slot as 1 | 2 | 3);
    },
  );

  // Unequip
  fastify.post<{ Params: { id: string }; Body: { slotType: string } }>(
    '/api/character/:id/unequip',
    async (request) => {
      const db = (fastify as any).db;
      const { unequipSlot } = await import('../services/character/equipment-service');
      await unequipSlot(db, request.params.id, request.body.slotType as any);
      return { success: true };
    },
  );

  // Get effective stats (with equipment bonuses)
  fastify.get<{ Params: { id: string } }>(
    '/api/character/:id/stats',
    async (request) => {
      const db = (fastify as any).db;
      const { getEffectiveStats } = await import('../services/character/equipment-service');
      return getEffectiveStats(db, request.params.id);
    },
  );

  // Get trait buff status
  fastify.get<{ Params: { userId: string } }>(
    '/api/characters/:userId/trait-buff',
    async (request) => {
      const db = (fastify as any).db;
      const { evaluateTraitBuff } = await import('../services/character/trait-service');
      return evaluateTraitBuff(db, request.params.userId);
    },
  );

  // ─── Phase 2-3: Condition / Disruption / Mental Debuff ───

  // Get condition state
  fastify.get<{ Params: { id: string } }>(
    '/api/character/:id/condition',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });

      const { getConditionState, getRestThreshold } = await import(
        '../services/character/condition-service'
      );
      const threshold = getRestThreshold(request.params.id);
      const state = getConditionState(detail.condition, detail.stamina, threshold);
      return { ...state, restThreshold: threshold };
    },
  );

  // Set rest threshold
  fastify.post<{ Params: { id: string }; Body: { threshold: number } }>(
    '/api/character/:id/condition/threshold',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });

      const { setRestThreshold } = await import(
        '../services/character/condition-service'
      );
      setRestThreshold(request.params.id, request.body.threshold);
      return { success: true, threshold: request.body.threshold };
    },
  );

  // Tick condition (debug/admin — normally called by game loop)
  fastify.post<{
    Params: { id: string };
    Body: { facilityLevel?: number; toolDrainReduction?: number };
  }>(
    '/api/character/:id/condition/tick',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });

      const { tickCondition, getRestThreshold } = await import(
        '../services/character/condition-service'
      );
      const threshold = getRestThreshold(request.params.id);
      const result = await tickCondition(
        db,
        request.params.id,
        request.body.facilityLevel ?? 0,
        request.body.toolDrainReduction ?? 0,
        threshold,
      );
      return result;
    },
  );

  // Evaluate disruption chance (preview without rolling)
  fastify.get<{ Params: { id: string } }>(
    '/api/character/:id/disruption/info',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });

      const { getConditionState } = await import(
        '../services/character/condition-service'
      );
      const { getDisruptionInfo } = await import(
        '../services/character/disruption-service'
      );
      const condState = getConditionState(detail.condition, detail.stamina);
      // TODO: pass actual debuff state from in-memory store
      const info = getDisruptionInfo(
        condState.percentage,
        detail.discipline,
        detail.luck,
        false,
      );
      return { conditionPercent: condState.percentage, ...info };
    },
  );

  // Roll disruption (debug/admin — normally called by game loop)
  fastify.post<{ Params: { id: string }; Body: { hasDebuff?: boolean } }>(
    '/api/character/:id/disruption/roll',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });

      const { getConditionState } = await import(
        '../services/character/condition-service'
      );
      const { evaluateDisruption } = await import(
        '../services/character/disruption-service'
      );
      const condState = getConditionState(detail.condition, detail.stamina);
      const result = evaluateDisruption(
        condState.percentage,
        detail.discipline,
        detail.luck,
        request.body.hasDebuff ?? false,
      );
      return result;
    },
  );

  // Evaluate mental debuff trigger
  fastify.post<{
    Params: { id: string };
    Body: { consecutiveLosses: number; totalLossPercent: number };
  }>(
    '/api/character/:id/debuff/evaluate',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.params.id);
      if (!detail) return reply.code(404).send({ error: 'Not found' });

      const { evaluateDebuffTrigger } = await import(
        '../services/character/mental-debuff-service'
      );
      const debuff = evaluateDebuffTrigger(
        request.body.consecutiveLosses,
        request.body.totalLossPercent,
        detail.mental,
      );
      return { triggered: debuff !== null, debuff };
    },
  );

  // Get all debuff definitions
  fastify.get('/api/debuffs/definitions', async () => {
    const { getAllDebuffDefinitions } = await import(
      '../services/character/mental-debuff-service'
    );
    return { definitions: getAllDebuffDefinitions() };
  });
}
