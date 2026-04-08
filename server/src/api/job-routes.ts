import type { FastifyInstance } from 'fastify';
import { getCharacterDetail } from '../services/character/character-service';

export async function jobRoutes(fastify: FastifyInstance) {
  // Get all job definitions
  fastify.get('/api/jobs', async () => {
    const { getAllJobDefinitions } = await import('../services/job/job-framework');
    return { jobs: getAllJobDefinitions() };
  });

  // Get minigame config for a job type
  fastify.get<{ Params: { type: string } }>(
    '/api/jobs/:type/config',
    async (request, reply) => {
      const { MINIGAME_CONFIGS } = await import('../services/job/minigame-configs');
      const config = MINIGAME_CONFIGS[request.params.type];
      if (!config) return reply.code(404).send({ error: 'Job type not found' });
      return config;
    },
  );

  // Start minigame session (get stat assists + duration)
  fastify.post<{
    Params: { type: string };
    Body: { characterId: string };
  }>(
    '/api/jobs/:type/start',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.body.characterId);
      if (!detail) return reply.code(404).send({ error: 'Character not found' });

      const { calculateStatAssist, calculateGameDuration, getRequiredFacility } =
        await import('../services/job/job-framework');

      const jobType = request.params.type as any;
      const stats = {
        stamina: detail.stamina,
        efficiency: detail.efficiency,
        precision: detail.precision,
        luck: detail.luck,
      };

      return {
        jobType,
        requiredFacility: getRequiredFacility(jobType),
        duration: calculateGameDuration(jobType, detail.stamina),
        statAssist: calculateStatAssist(jobType, stats),
      };
    },
  );

  // Auto job tick (자동 수행)
  fastify.post<{
    Params: { type: string };
    Body: { characterId: string; boostLevel?: number };
  }>(
    '/api/jobs/:type/auto',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.body.characterId);
      if (!detail) return reply.code(404).send({ error: 'Character not found' });

      const { calculateAutoJobReward } = await import('../services/job/job-framework');
      const { getConditionState } = await import(
        '../services/character/condition-service'
      );

      const condState = getConditionState(detail.condition, detail.stamina);
      const stats = {
        stamina: detail.stamina,
        efficiency: detail.efficiency,
        precision: detail.precision,
        luck: detail.luck,
      };

      const result = calculateAutoJobReward(
        request.params.type as any,
        stats,
        request.body.boostLevel ?? 0,
        condState.percentage,
      );

      result.characterId = request.body.characterId;
      return result;
    },
  );

  // Submit manual minigame result (수동 수행)
  fastify.post<{
    Params: { type: string };
    Body: {
      characterId: string;
      score: number;
      durationSec: number;
      actionCount: number;
      boostLevel?: number;
    };
  }>(
    '/api/jobs/:type/submit',
    async (request, reply) => {
      const db = (fastify as any).db;
      const detail = await getCharacterDetail(db, request.body.characterId);
      if (!detail) return reply.code(404).send({ error: 'Character not found' });

      const { MINIGAME_CONFIGS, validateScore, getScoreTier } = await import(
        '../services/job/minigame-configs'
      );
      const { calculateManualJobReward } = await import('../services/job/job-framework');
      const { getConditionState } = await import(
        '../services/character/condition-service'
      );

      const config = MINIGAME_CONFIGS[request.params.type];
      if (!config) return reply.code(404).send({ error: 'Job type not found' });

      // 점수 검증
      const validation = validateScore(
        config,
        request.body.score,
        request.body.durationSec,
        request.body.actionCount,
      );

      if (!validation.valid) {
        return reply.code(400).send({ error: validation.reason });
      }

      const condState = getConditionState(detail.condition, detail.stamina);
      const stats = {
        stamina: detail.stamina,
        efficiency: detail.efficiency,
        precision: detail.precision,
        luck: detail.luck,
      };

      const result = calculateManualJobReward(
        request.params.type as any,
        request.body.score,
        config.maxScore,
        stats,
        request.body.boostLevel ?? 0,
        condState.percentage,
      );

      result.characterId = request.body.characterId;
      const tier = getScoreTier(config, request.body.score);

      return { ...result, tier: tier.name };
    },
  );
}
