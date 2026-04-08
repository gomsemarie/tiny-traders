import { eq } from 'drizzle-orm';
import { quoteCache, tradableAssets } from '../../db/schema';

/** Quote data interface - matches what yahoo-finance2 would return */
export interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  changePercent?: number;
  week52High?: number;
  week52Low?: number;
  updatedAt: Date;
}

/**
 * Get cached quote for a symbol
 */
export async function getQuote(db: any, symbol: string): Promise<QuoteData | null> {
  const rows = await db
    .select()
    .from(quoteCache)
    .innerJoin(tradableAssets, eq(quoteCache.symbol, tradableAssets.symbol))
    .where(eq(quoteCache.symbol, symbol))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const q = row.quote_cache;
  const a = row.tradable_assets;
  const change = q.open && q.open > 0 ? q.price - q.open : 0;

  return {
    symbol: q.symbol,
    name: a.name,
    price: q.price,
    change,
    open: q.open,
    high: q.high,
    low: q.low,
    volume: q.volume,
    changePercent: q.changePercent,
    week52High: q.week52High,
    week52Low: q.week52Low,
    updatedAt: q.updatedAt,
  };
}

/**
 * Get all active asset quotes with caching
 */
export async function getAllQuotes(db: any): Promise<{ quotes: QuoteData[] }> {
  const rows = await db
    .select()
    .from(quoteCache)
    .innerJoin(tradableAssets, eq(quoteCache.symbol, tradableAssets.symbol))
    .where(eq(tradableAssets.isActive, true));

  const quotes = rows.map((row: any) => {
    const q = row.quote_cache;
    const a = row.tradable_assets;
    const change = q.open && q.open > 0 ? q.price - q.open : 0;
    return {
      symbol: q.symbol,
      name: a.name,
      price: q.price,
      change,
      open: q.open,
      high: q.high,
      low: q.low,
      volume: q.volume,
      changePercent: q.changePercent,
      week52High: q.week52High,
      week52Low: q.week52Low,
      updatedAt: q.updatedAt,
    };
  });

  return { quotes };
}

/**
 * Update or insert quote in cache
 */
export async function updateQuoteCache(db: any, symbol: string, data: Partial<QuoteData>): Promise<void> {
  const existing = await getQuote(db, symbol);

  if (existing) {
    await db
      .update(quoteCache)
      .set({
        price: data.price ?? existing.price,
        open: data.open ?? existing.open,
        high: data.high ?? existing.high,
        low: data.low ?? existing.low,
        volume: data.volume ?? existing.volume,
        changePercent: data.changePercent ?? existing.changePercent,
        week52High: data.week52High ?? existing.week52High,
        week52Low: data.week52Low ?? existing.week52Low,
        updatedAt: new Date(),
      })
      .where(eq(quoteCache.symbol, symbol));
  } else {
    await db.insert(quoteCache).values({
      symbol,
      price: data.price ?? 0,
      open: data.open,
      high: data.high,
      low: data.low,
      volume: data.volume,
      changePercent: data.changePercent,
      week52High: data.week52High,
      week52Low: data.week52Low,
      updatedAt: new Date(),
    });
  }
}
