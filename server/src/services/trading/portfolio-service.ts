import { eq, and, sum } from 'drizzle-orm';
import { positions, tradeHistory, users, quoteCache, tradableAssets } from '../../db/schema';
import { getQuote } from './quote-service';

export interface PositionWithValue {
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  pnlPercent: number;
  pnlValue: number;
}

export interface Portfolio {
  userId: string;
  gold: number;
  totalValue: number;
  pnl: number;
  positions: PositionWithValue[];
}

export interface AssetAllocation {
  cash: number;
  byType: Record<string, number>; // 'stock', 'etf', 'crypto', 'forex'
  byAsset: Record<string, number>; // symbol -> value
}

export interface TradeRecord {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  fee: number;
  pnl: number | null;
  executedAt: Date;
}

/**
 * Get full portfolio for a user with unrealized PnL
 */
export async function getPortfolio(db: any, userId: string): Promise<Portfolio> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const userPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.userId, userId));

  const positionsWithValue: PositionWithValue[] = [];
  let totalUnrealizedPnL = 0;

  for (const pos of userPositions) {
    const quote = await getQuote(db, pos.symbol);
    const currentPrice = quote?.price ?? pos.avgPrice;
    const marketValue = pos.quantity * currentPrice;
    const pnlValue = marketValue - pos.quantity * pos.avgPrice;
    const pnlPercent = pos.avgPrice !== 0 ? (pnlValue / (pos.quantity * pos.avgPrice)) * 100 : 0;

    positionsWithValue.push({
      symbol: pos.symbol,
      quantity: pos.quantity,
      averagePrice: pos.avgPrice,
      currentPrice,
      pnlPercent,
      pnlValue,
    });

    totalUnrealizedPnL += pnlValue;
  }

  const realizedPnL = await getRealizedPnl(db, userId);
  const totalValue = positionsWithValue.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0) + user.gold;

  return {
    userId,
    gold: user.gold,
    totalValue,
    pnl: totalUnrealizedPnL + realizedPnL,
    positions: positionsWithValue,
  };
}

/**
 * Sum realized PnL from all completed trades
 */
export async function getRealizedPnl(db: any, userId: string): Promise<number> {
  const result = await db
    .select({ total: sum(tradeHistory.pnl) })
    .from(tradeHistory)
    .where(eq(tradeHistory.userId, userId));

  return result[0]?.total ?? 0;
}

/**
 * Get asset allocation breakdown
 */
export async function getAssetAllocation(db: any, userId: string): Promise<AssetAllocation> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const userPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.userId, userId));

  const byType: Record<string, number> = {};
  const byAsset: Record<string, number> = {};

  for (const pos of userPositions) {
    const quote = await getQuote(db, pos.symbol);
    const currentPrice = quote?.price ?? pos.avgPrice;
    const value = pos.quantity * currentPrice;
    byAsset[pos.symbol] = value;

    // Get asset type
    const [asset] = await db
      .select()
      .from(tradableAssets)
      .where(eq(tradableAssets.symbol, pos.symbol))
      .limit(1);

    if (asset) {
      byType[asset.type] = (byType[asset.type] ?? 0) + value;
    }
  }

  return {
    cash: user.gold,
    byType,
    byAsset,
  };
}

/**
 * Get recent trade history
 */
export async function getTradeHistory(db: any, userId: string, limit: number = 50): Promise<TradeRecord[]> {
  const trades = await db
    .select()
    .from(tradeHistory)
    .where(eq(tradeHistory.userId, userId))
    .orderBy(tradeHistory.executedAt)
    .limit(limit);

  return trades.map((t: any) => ({
    id: t.id,
    symbol: t.symbol,
    side: t.side,
    quantity: t.quantity,
    price: t.price,
    fee: t.fee,
    pnl: t.pnl,
    executedAt: t.executedAt,
  }));
}
