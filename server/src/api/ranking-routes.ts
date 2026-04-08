import type { FastifyInstance } from 'fastify';
import { getSqlite } from '../db';

export async function rankingRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/rankings/wealth
   * Returns top 50 users by net worth (gold + portfolio value)
   */
  fastify.get('/api/rankings/wealth', async () => {
    const sqlite = getSqlite();
    if (!sqlite) throw new Error('Database not initialized');

    // Query: For each user, sum gold + all positions (quantity * current price)
    const rows = sqlite
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.display_name,
          u.gold,
          COALESCE(SUM(p.quantity * qc.price), 0) as portfolio_value
        FROM users u
        LEFT JOIN positions p ON u.id = p.user_id
        LEFT JOIN quote_cache qc ON p.symbol = qc.symbol
        WHERE u.status = 'approved'
        GROUP BY u.id
        ORDER BY (u.gold + COALESCE(SUM(p.quantity * qc.price), 0)) DESC
        LIMIT 50
        `
      )
      .all() as any[];

    const rankings = rows.map((row, index) => ({
      rank: index + 1,
      userId: row.id,
      username: row.username,
      displayName: row.display_name,
      netWorth: Math.round((row.gold + row.portfolio_value) * 100) / 100,
    }));

    return { rankings };
  });

  /**
   * GET /api/rankings/returns
   * Returns top 50 users by cumulative investment returns (sum of realized PnL from trade_history)
   */
  fastify.get('/api/rankings/returns', async () => {
    const sqlite = getSqlite();
    if (!sqlite) throw new Error('Database not initialized');

    // Query: For each user, sum realized PnL from trade_history (sell orders only)
    const rows = sqlite
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.display_name,
          COALESCE(SUM(CASE WHEN th.side = 'sell' THEN th.pnl ELSE 0 END), 0) as total_pnl
        FROM users u
        LEFT JOIN trade_history th ON u.id = th.user_id
        WHERE u.status = 'approved'
        GROUP BY u.id
        HAVING total_pnl != 0 OR u.id IN (
          SELECT DISTINCT user_id FROM trade_history
        )
        ORDER BY total_pnl DESC
        LIMIT 50
        `
      )
      .all() as any[];

    const rankings = rows.map((row, index) => {
      const totalPnl = Math.round(row.total_pnl * 100) / 100;
      // Calculate return percentage: totalPnl / initial gold
      // For simplicity, assume all users start with 10000 gold
      const returnPercent = Math.round((totalPnl / 10000) * 10000) / 100; // as percentage
      return {
        rank: index + 1,
        userId: row.id,
        username: row.username,
        displayName: row.display_name,
        totalPnl,
        returnPercent,
      };
    });

    return { rankings };
  });

  /**
   * GET /api/rankings/work
   * Returns top 50 users by cumulative work income (placeholder)
   */
  fastify.get('/api/rankings/work', async () => {
    // TODO: Implement work income ranking when work system is finalized
    return {
      rankings: [
        { rank: 1, userId: 'placeholder', username: 'placeholder', displayName: '대기 중', workIncome: 0 },
      ],
    };
  });

  /**
   * GET /api/rankings/collection
   * Returns top 50 users by character collection count (placeholder)
   */
  fastify.get('/api/rankings/collection', async () => {
    // TODO: Implement collection ranking when needed
    return {
      rankings: [
        { rank: 1, userId: 'placeholder', username: 'placeholder', displayName: '대기 중', collectionCount: 0 },
      ],
    };
  });
}
