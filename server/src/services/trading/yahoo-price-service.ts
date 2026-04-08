import yahooFinance from 'yahoo-finance2';
import { getSqlite } from '../../db/index';

interface YahooQuote {
  symbol: string;
  price: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  volume?: number | null;
  changePercent?: number | null;
  timestamp: number;
}

// Cache for yahoo prices to handle API rate limits and failures
const yahooCache = new Map<string, { quote: YahooQuote; fetchedAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache

/**
 * Fetch quotes from Yahoo Finance for given symbols
 * Returns cached values if API is down or rate limited
 */
export async function fetchYahooQuotes(symbols: string[]): Promise<YahooQuote[]> {
  const now = Date.now();
  const quotes: YahooQuote[] = [];
  const symbolsToFetch: string[] = [];

  // Check cache first
  for (const symbol of symbols) {
    const cached = yahooCache.get(symbol);
    if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
      quotes.push(cached.quote);
    } else {
      symbolsToFetch.push(symbol);
    }
  }

  // Fetch uncached symbols
  if (symbolsToFetch.length > 0) {
    try {
      const results = await yahooFinance.quote(symbolsToFetch) as any;

      // Handle both single and multiple results
      const resultArray = Array.isArray(results) ? results : [results];

      for (const result of resultArray) {
        if (!result) continue;

        const quote: YahooQuote = {
          symbol: result.symbol || '',
          price: result.regularMarketPrice || null,
          open: result.regularMarketOpen || undefined,
          high: result.fiftyTwoWeekHigh || undefined,
          low: result.fiftyTwoWeekLow || undefined,
          volume: result.regularMarketVolume || undefined,
          changePercent: result.regularMarketChangePercent || undefined,
          timestamp: now,
        };

        quotes.push(quote);

        // Cache the result
        yahooCache.set(quote.symbol, { quote, fetchedAt: now });
      }
    } catch (error) {
      console.error('[Yahoo Price Service] Error fetching quotes:', error);

      // Fallback: use cached values or return null prices
      for (const symbol of symbolsToFetch) {
        const cached = yahooCache.get(symbol);
        if (cached) {
          quotes.push(cached.quote);
        } else {
          // No price available - return null price
          quotes.push({
            symbol,
            price: null,
            timestamp: now,
          });
        }
      }
    }
  }

  return quotes;
}

/**
 * Update quote_cache table with yahoo prices
 * This is called periodically to keep prices fresh
 */
export async function updateYahooQuoteCache(_db: any, yahooSymbols: string[]): Promise<number> {
  if (yahooSymbols.length === 0) {
    return 0;
  }

  const sqlite = getSqlite();
  if (!sqlite) {
    console.error('[Yahoo Price Service] No SQLite instance');
    return 0;
  }

  try {
    const quotes = await fetchYahooQuotes(yahooSymbols);

    const upsertQuote = sqlite.prepare(
      `INSERT INTO quote_cache (symbol, price, open, high, low, volume, change_percent, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(symbol) DO UPDATE SET
         price = excluded.price,
         open = excluded.open,
         high = excluded.high,
         low = excluded.low,
         volume = excluded.volume,
         change_percent = excluded.change_percent,
         updated_at = excluded.updated_at`
    );

    let updated = 0;
    for (const quote of quotes) {
      if (quote.price !== null) {
        upsertQuote.run(
          quote.symbol,
          quote.price,
          quote.open || null,
          quote.high || null,
          quote.low || null,
          quote.volume || null,
          quote.changePercent || null,
          Math.floor(quote.timestamp / 1000),
        );
        updated++;
      }
    }

    console.log(`[Yahoo Price Service] Updated ${updated} yahoo quotes`);
    return updated;
  } catch (error) {
    console.error('[Yahoo Price Service] Error updating quotes:', error);
    return 0;
  }
}

/**
 * Get list of yahoo-type assets from database
 */
export function getYahooAssets(sqlite: any): string[] {
  try {
    const assets = sqlite
      .prepare("SELECT symbol FROM tradable_assets WHERE data_source = 'yahoo' AND is_active = 1")
      .all() as any[];

    return assets.map((a: any) => a.symbol);
  } catch (error) {
    console.error('[Yahoo Price Service] Error fetching yahoo assets:', error);
    return [];
  }
}

/**
 * Initialize yahoo price fetching (called on server startup)
 */
export function initYahooPriceFetching(): void {
  const sqlite = getSqlite();
  if (!sqlite) {
    console.error('[Yahoo Price Service] No SQLite instance available');
    return;
  }

  // Fetch yahoo prices every 30 seconds
  setInterval(async () => {
    try {
      const yahooSymbols = getYahooAssets(sqlite);
      if (yahooSymbols.length > 0) {
        await updateYahooQuoteCache(null, yahooSymbols);
      }
    } catch (error) {
      console.error('[Yahoo Price Service] Error in periodic fetch:', error);
    }
  }, 30 * 1000);

  console.log('[Yahoo Price Service] Initialized with 30s interval');
}
