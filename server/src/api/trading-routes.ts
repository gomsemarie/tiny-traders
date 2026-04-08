import type { FastifyInstance } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { getQuote, getAllQuotes, updateQuoteCache } from '../services/trading/quote-service';
import { placeOrder, executeMarketOrder, checkPendingOrders, cancelOrder } from '../services/trading/order-engine';
import { getPortfolio, getRealizedPnl, getAssetAllocation, getTradeHistory } from '../services/trading/portfolio-service';
import { evaluateAutoTrade } from '../services/trading/auto-trade-service';
import { executeDisruptionTrade } from '../services/trading/disruption-trade-service';
import { openSavingsAccount, matureSavingsAccounts, cancelSavingsAccount, getUserSavings } from '../services/bank/bank-service';
import { getPriceHistory } from '../services/trading/price-simulator';
import { orders } from '../db/schema';

export async function tradingRoutes(fastify: FastifyInstance) {
  // Quote endpoints
  fastify.get<{ Params: { symbol: string } }>(
    '/api/quote/:symbol',
    async (request, reply) => {
      const db = (fastify as any).db;
      const quote = await getQuote(db, request.params.symbol);
      if (!quote) return reply.code(404).send({ error: 'Quote not found' });
      return quote;
    },
  );

  fastify.get('/api/quotes', async () => {
    const db = (fastify as any).db;
    return await getAllQuotes(db);
  });

  // Price history endpoint
  fastify.get<{ Params: { symbol: string }; Querystring: { interval?: string; limit?: string } }>(
    '/api/prices/history/:symbol',
    async (request, reply) => {
      const db = (fastify as any).db;
      const interval = request.query.interval || '1m';
      const limit = request.query.limit ? parseInt(request.query.limit) : 100;

      if (!['1m', '5m', '1h', '1d'].includes(interval)) {
        return reply.code(400).send({ error: 'Invalid interval. Must be 1m, 5m, 1h, or 1d' });
      }

      const history = getPriceHistory(db, request.params.symbol, interval, limit);
      return { symbol: request.params.symbol, interval, candles: history };
    },
  );

  // Order endpoints
  fastify.post<{ Body: { userId: string; symbol: string; side: 'buy' | 'sell'; type: string; quantity: number; limitPrice?: number; stopPrice?: number; linkedOrderId?: string } }>(
    '/api/order/place',
    async (request) => {
      const db = (fastify as any).db;
      const result = await placeOrder(db, request.body.userId, {
        symbol: request.body.symbol,
        side: request.body.side,
        type: request.body.type as any,
        quantity: request.body.quantity,
        limitPrice: request.body.limitPrice,
        stopPrice: request.body.stopPrice,
        linkedOrderId: request.body.linkedOrderId,
      });
      return result;
    },
  );

  fastify.post<{ Params: { orderId: string } }>(
    '/api/order/:orderId/execute',
    async (request, reply) => {
      const db = (fastify as any).db;
      const result = await executeMarketOrder(db, request.params.orderId);
      if (!result.success) return reply.code(400).send(result);
      return result;
    },
  );

  fastify.post<{ Params: { orderId: string } }>(
    '/api/order/:orderId/cancel',
    async (request, reply) => {
      const db = (fastify as any).db;
      const result = await cancelOrder(db, request.params.orderId);
      if (!result.success) return reply.code(400).send(result);
      return result;
    },
  );

  fastify.post('/api/orders/check-pending', async () => {
    const db = (fastify as any).db;
    const executedCount = await checkPendingOrders(db);
    return { executedCount };
  });

  fastify.get<{ Params: { userId: string } }>(
    '/api/orders/pending/:userId',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const pendingOrders = await db
          .select()
          .from(orders)
          .where(and(eq(orders.userId, request.params.userId), eq(orders.status, 'pending')));
        return { orders: pendingOrders };
      } catch (error) {
        return reply.code(400).send({ error: String(error) });
      }
    },
  );

  // Portfolio endpoints
  fastify.get<{ Params: { userId: string } }>(
    '/api/portfolio/:userId',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const portfolio = await getPortfolio(db, request.params.userId);
        return portfolio;
      } catch (error) {
        return reply.code(404).send({ error: String(error) });
      }
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    '/api/portfolio/:userId/pnl',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const realizedPnl = await getRealizedPnl(db, request.params.userId);
        return { realizedPnl };
      } catch (error) {
        return reply.code(404).send({ error: String(error) });
      }
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    '/api/portfolio/:userId/allocation',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const allocation = await getAssetAllocation(db, request.params.userId);
        return allocation;
      } catch (error) {
        return reply.code(404).send({ error: String(error) });
      }
    },
  );

  fastify.get<{ Params: { userId: string }; Querystring: { limit?: string } }>(
    '/api/portfolio/:userId/trades',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const limit = request.query.limit ? parseInt(request.query.limit) : 50;
        const trades = await getTradeHistory(db, request.params.userId, limit);
        return { trades };
      } catch (error) {
        return reply.code(404).send({ error: String(error) });
      }
    },
  );

  // Auto-trade endpoints
  fastify.post<{ Body: { stats: Record<string, number>; positions: any[]; quotes: any[] } }>(
    '/api/auto-trade/evaluate',
    async (request) => {
      const decision = evaluateAutoTrade(
        request.body.stats as any,
        request.body.positions,
        request.body.quotes,
      );
      return decision;
    },
  );

  // Disruption trade endpoints
  fastify.post<{ Body: { userId: string; disruptionType: string; luck: number } }>(
    '/api/disruption-trade',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const result = await executeDisruptionTrade(
          db,
          request.body.userId,
          request.body.disruptionType as any,
          request.body.luck,
        );
        return result;
      } catch (error) {
        return reply.code(400).send({ error: String(error) });
      }
    },
  );

  // Savings account endpoints
  fastify.post<{ Body: { userId: string; principal: number; productName: string; interestRate: number; termDays: number } }>(
    '/api/savings/open',
    async (request, reply) => {
      const db = (fastify as any).db;
      const result = await openSavingsAccount(
        db,
        request.body.userId,
        request.body.principal,
        request.body.productName,
        request.body.interestRate,
        request.body.termDays,
      );
      if (result.error) return reply.code(400).send(result);
      return result;
    },
  );

  fastify.post('/api/savings/mature', async () => {
    const db = (fastify as any).db;
    const processedCount = await matureSavingsAccounts(db);
    return { processedCount };
  });

  fastify.post<{ Params: { accountId: string } }>(
    '/api/savings/:accountId/cancel',
    async (request, reply) => {
      const db = (fastify as any).db;
      const result = await cancelSavingsAccount(db, request.params.accountId);
      if (!result.success) return reply.code(400).send(result);
      return result;
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    '/api/savings/:userId',
    async (request, reply) => {
      const db = (fastify as any).db;
      try {
        const accounts = await getUserSavings(db, request.params.userId);
        return { accounts };
      } catch (error) {
        return reply.code(404).send({ error: String(error) });
      }
    },
  );
}
