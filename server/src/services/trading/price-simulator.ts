import { getSqlite } from '../../db/index';

interface PriceState {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  type: 'stock' | 'crypto' | 'etf' | 'forex';
  volatility: number;
  timestamp: number;
}

interface CandleRow {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  interval: string;
  timestamp: number; // unix seconds
}

// In-memory price state for all assets
const priceState = new Map<string, PriceState>();
let simulatorInterval: NodeJS.Timeout | null = null;

/** Initialize base prices and start the simulation loop */
export function initPriceSimulator(_db: any): void {
  const sqlite = getSqlite();
  if (!sqlite) {
    console.error('[Price Simulator] No SQLite instance available');
    return;
  }

  // Get all active assets from database
  const assets = sqlite.prepare('SELECT symbol, name, type FROM tradable_assets WHERE is_active = 1').all() as any[];

  if (assets.length === 0) {
    console.log('[Price Simulator] No tradable assets found');
    return;
  }

  // Prepare upsert statement
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

  // Initialize base prices for each asset
  for (const asset of assets) {
    const volatility = getVolatilityForType(asset.type);
    const basePrice = getBasePriceForType(asset.type);
    const now = Date.now();

    priceState.set(asset.symbol, {
      symbol: asset.symbol,
      price: basePrice,
      open: basePrice,
      high: basePrice * 1.02,
      low: basePrice * 0.98,
      volume: Math.floor(Math.random() * 100000) + 10000,
      type: asset.type as any,
      volatility,
      timestamp: now,
    });

    // Initialize quote cache
    upsertQuote.run(
      asset.symbol, basePrice, basePrice, basePrice * 1.02, basePrice * 0.98,
      0, 0, Math.floor(now / 1000)
    );
  }

  console.log(`[Price Simulator] Initialized ${priceState.size} assets with base prices`);

  // Start the simulation loop - generate new ticks every 3 seconds
  if (simulatorInterval) clearInterval(simulatorInterval);

  simulatorInterval = setInterval(() => {
    updatePrices();
  }, 3000);

  console.log('[Price Simulator] Loop started (tick every 3s)');
}

/** Stop the price simulator */
export function stopPriceSimulator(): void {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
    console.log('[Price Simulator] Stopped');
  }
}

/** Get current quotes for all assets (used by websocket) */
export function getLatestQuotes(): any[] {
  const quotes: any[] = [];
  for (const [symbol, state] of priceState) {
    const changePercent = state.open > 0 ? ((state.price - state.open) / state.open) * 100 : 0;
    quotes.push({
      symbol,
      price: state.price,
      open: state.open,
      high: state.high,
      low: state.low,
      volume: state.volume,
      changePercent,
      timestamp: state.timestamp,
    });
  }
  return quotes;
}

/** Fetch price history (OHLCV candles) from database */
export function getPriceHistory(
  _db: any,
  symbol: string,
  interval: string = '1m',
  limit: number = 100
): CandleRow[] {
  const sqlite = getSqlite();
  if (!sqlite) return [];

  try {
    const stmt = sqlite.prepare(
      `SELECT id, symbol, open, high, low, close, volume, interval, timestamp
       FROM price_history
       WHERE symbol = ? AND interval = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    );

    const rows = stmt.all(symbol, interval, limit) as CandleRow[];
    // Return in chronological order for the chart
    return rows.reverse();
  } catch (error) {
    console.error('[Price Simulator] Error fetching price history:', error);
    return [];
  }
}

// ============= Private helpers =============

/** Generate geometric Brownian motion with mean reversion */
function updatePrices(): void {
  const sqlite = getSqlite();
  if (!sqlite) return;

  const now = Date.now();
  const minuteKey = Math.floor(now / 60000);

  const candlesToInsert: CandleRow[] = [];

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

  for (const [symbol, state] of priceState) {
    // Generate random walk using geometric Brownian motion
    const randomReturn = (Math.random() - 0.5) * state.volatility;
    const drift = -0.0001; // Slight mean reversion
    const newPrice = state.price * Math.exp(drift + randomReturn);

    // Update OHLV tracking
    const newHigh = Math.max(state.high, newPrice);
    const newLow = Math.min(state.low, newPrice);
    const newVolume = state.volume + Math.floor(Math.random() * 1000) + 100;
    const changePercent = state.open > 0 ? ((newPrice - state.open) / state.open) * 100 : 0;

    // Every minute: save candle to price_history and reset OHLC
    if (Math.floor(state.timestamp / 60000) !== minuteKey) {
      candlesToInsert.push({
        symbol,
        open: state.open,
        high: state.high,
        low: state.low,
        close: newPrice,
        volume: state.volume,
        interval: '1m',
        timestamp: Math.floor(state.timestamp / 1000),
      });

      // Reset for next minute
      priceState.set(symbol, {
        ...state,
        price: newPrice,
        open: newPrice,
        high: newPrice,
        low: newPrice,
        volume: 0,
        timestamp: now,
      });
    } else {
      // Update state within the same minute
      priceState.set(symbol, {
        ...state,
        price: newPrice,
        high: newHigh,
        low: newLow,
        volume: newVolume,
        timestamp: now,
      });
    }

    // Update quote cache in database
    upsertQuote.run(
      symbol, newPrice, state.open, newHigh, newLow,
      newVolume, changePercent, Math.floor(now / 1000)
    );
  }

  // Batch insert completed candles
  if (candlesToInsert.length > 0) {
    try {
      const insertCandle = sqlite.prepare(
        `INSERT INTO price_history (symbol, open, high, low, close, volume, interval, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      const insertMany = sqlite.transaction((candles: CandleRow[]) => {
        for (const c of candles) {
          insertCandle.run(c.symbol, c.open, c.high, c.low, c.close, c.volume, c.interval, c.timestamp);
        }
      });

      insertMany(candlesToInsert);
    } catch (error) {
      console.error('[Price Simulator] Error inserting candles:', error);
    }
  }
}

/** Get volatility based on asset type */
function getVolatilityForType(type: string): number {
  switch (type) {
    case 'stock':  return 0.02;  // 2%
    case 'crypto': return 0.05;  // 5%
    case 'etf':    return 0.008; // 0.8%
    case 'forex':  return 0.003; // 0.3%
    default:       return 0.02;
  }
}

/** Get base price range for asset type */
function getBasePriceForType(type: string): number {
  switch (type) {
    case 'stock':  return Math.random() * 150 + 50;   // 50-200
    case 'crypto': return Math.random() * 4900 + 100;  // 100-5000
    case 'etf':    return Math.random() * 200 + 100;   // 100-300
    case 'forex':  return 1200 + Math.random() * 200;  // 1200-1400
    default:       return 100;
  }
}
