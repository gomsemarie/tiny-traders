import type { FastifyInstance } from 'fastify';
import {
  sendMessage,
  getMessages,
  getWhispers,
} from '../services/chat/chat-service';
import {
  getRankings,
  getUserRank,
} from '../services/ranking/ranking-service';
import {
  checkAchievements,
  getUserAchievements,
  checkTitles,
  equipTitle,
  getUserTitles,
} from '../services/achievement/achievement-service';
import {
  createListing,
  buyListing,
  cancelListing,
  getActiveListings,
} from '../services/market/market-service';

export async function socialRoutes(fastify: FastifyInstance) {
  // ─── CHAT ROUTES ───
  fastify.post<{ Body: { senderId: string; content: string; type?: string; recipientId?: string } }>(
    '/api/chat/message',
    async (request) => {
      const db = (fastify as any).db;
      const { senderId, content, type = 'normal', recipientId } = request.body;
      const message = await sendMessage(db, senderId, content, type as any, recipientId);
      return message;
    },
  );

  fastify.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/chat/global',
    async (request) => {
      const db = (fastify as any).db;
      const limit = parseInt(request.query.limit || '50', 10);
      const offset = parseInt(request.query.offset || '0', 10);
      const messages = await getMessages(db, limit, offset);
      return { messages };
    },
  );

  fastify.get<{ Params: { userId1: string; userId2: string }; Querystring: { limit?: string } }>(
    '/api/chat/whispers/:userId1/:userId2',
    async (request) => {
      const db = (fastify as any).db;
      const { userId1, userId2 } = request.params;
      const limit = parseInt(request.query.limit || '50', 10);
      const whispers = await getWhispers(db, userId1, userId2, limit);
      return { whispers };
    },
  );

  // ─── RANKING ROUTES ───
  fastify.get<{ Querystring: { type?: string; limit?: string } }>(
    '/api/rankings',
    async (request) => {
      const db = (fastify as any).db;
      const type = (request.query.type || 'gold') as 'net_worth' | 'gold' | 'level';
      const limit = parseInt(request.query.limit || '100', 10);
      const rankings = await getRankings(db, type, limit);
      return { rankings };
    },
  );

  fastify.get<{ Params: { userId: string }; Querystring: { type?: string } }>(
    '/api/rankings/:userId/position',
    async (request) => {
      const db = (fastify as any).db;
      const type = (request.query.type || 'gold') as 'net_worth' | 'gold' | 'level';
      const rank = await getUserRank(db, request.params.userId, type);
      return { rank };
    },
  );

  // ─── ACHIEVEMENT ROUTES ───
  fastify.post<{ Body: { userId: string; stats: Record<string, number> } }>(
    '/api/achievements/check',
    async (request) => {
      const db = (fastify as any).db;
      const { userId, stats } = request.body;
      const newAchievements = await checkAchievements(db, userId, stats);
      return { newAchievements };
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    '/api/achievements/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const achievements = await getUserAchievements(db, request.params.userId);
      return { achievements };
    },
  );

  // ─── TITLE ROUTES ───
  fastify.post<{ Body: { userId: string; stats: Record<string, number> } }>(
    '/api/titles/check',
    async (request) => {
      const db = (fastify as any).db;
      const { userId, stats } = request.body;
      await checkTitles(db, userId, stats);
      return { success: true };
    },
  );

  fastify.post<{ Body: { userId: string; titleId: string } }>(
    '/api/titles/:titleId/equip',
    async (request) => {
      const db = (fastify as any).db;
      const success = await equipTitle(db, request.body.userId, request.body.titleId);
      return { success };
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    '/api/titles/:userId',
    async (request) => {
      const db = (fastify as any).db;
      const titles = await getUserTitles(db, request.params.userId);
      return { titles };
    },
  );

  // ─── MARKET ROUTES ───
  fastify.post<{ Body: { sellerId: string; type: string; targetId: string; price: number } }>(
    '/api/market/listing',
    async (request) => {
      const db = (fastify as any).db;
      const { sellerId, type, targetId, price } = request.body;
      const listingId = await createListing(
        db,
        sellerId,
        type as any,
        targetId,
        price,
      );
      return { listingId };
    },
  );

  fastify.post<{ Params: { listingId: string }; Body: { buyerId: string } }>(
    '/api/market/listing/:listingId/buy',
    async (request) => {
      const db = (fastify as any).db;
      const success = await buyListing(db, request.params.listingId, request.body.buyerId);
      return { success };
    },
  );

  fastify.post<{ Params: { listingId: string } }>(
    '/api/market/listing/:listingId/cancel',
    async (request) => {
      const db = (fastify as any).db;
      const success = await cancelListing(db, request.params.listingId);
      return { success };
    },
  );

  fastify.get<{ Querystring: { type?: string; limit?: string } }>(
    '/api/market/listings',
    async (request) => {
      const db = (fastify as any).db;
      const type = request.query.type as 'character' | 'item' | undefined;
      const limit = parseInt(request.query.limit || '100', 10);
      const listings = await getActiveListings(db, type, limit);
      return { listings };
    },
  );
}
