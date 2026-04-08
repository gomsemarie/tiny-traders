import type { FastifyInstance } from 'fastify';
import { getActiveEvent, getEventHistory } from '../services/event/event-service';

export async function eventRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/events/active
   * Returns the currently active event or null
   */
  fastify.get('/api/events/active', async () => {
    const event = getActiveEvent();
    return { event };
  });

  /**
   * GET /api/events/history?limit=20
   * Returns recent event history
   */
  fastify.get('/api/events/history', async (request) => {
    const query = request.query as Record<string, any>;
    const limit = Math.min(Number(query.limit) || 20, 100);
    const history = getEventHistory(limit);
    return { history };
  });
}
