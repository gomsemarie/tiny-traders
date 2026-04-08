import { eq } from 'drizzle-orm';
import { positions, users, tradableAssets, orders } from '../../db/schema';
import { getQuote, getAllQuotes } from './quote-service';
import { placeOrder } from './order-engine';
import { randomUUID } from 'crypto';

export type DisruptionType = 'impulse_buy' | 'panic_sell' | 'all_in';

export interface DisruptionTradeResult {
  type: DisruptionType;
  action: string;
  symbol?: string;
  quantity?: number;
  amount?: number;
  success: boolean;
  message: string;
}

/**
 * Execute a disruption-driven trade
 * Based on character's mental/luck disruption effect
 */
export async function executeDisruptionTrade(
  db: any,
  userId: string,
  disruptionType: DisruptionType,
  luck: number,
): Promise<DisruptionTradeResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return {
      type: disruptionType,
      action: 'failed',
      success: false,
      message: 'User not found',
    };
  }

  // Get all active quotes
  const { quotes: allQuotes } = await getAllQuotes(db);

  if (allQuotes.length === 0) {
    return {
      type: disruptionType,
      action: 'failed',
      success: false,
      message: 'No active quotes available',
    };
  }

  if (disruptionType === 'impulse_buy') {
    return await handleImpulseBuy(db, userId, user, allQuotes, luck);
  } else if (disruptionType === 'panic_sell') {
    return await handlePanicSell(db, userId, user, allQuotes, luck);
  } else if (disruptionType === 'all_in') {
    return await handleAllIn(db, userId, user, allQuotes, luck);
  }

  return {
    type: disruptionType,
    action: 'unknown',
    success: false,
    message: 'Unknown disruption type',
  };
}

/**
 * Impulse buy: pick random active symbol, small buy (5-10% of gold)
 */
async function handleImpulseBuy(
  db: any,
  userId: string,
  user: any,
  allQuotes: any[],
  luck: number,
): Promise<DisruptionTradeResult> {
  // Luck influences symbol selection quality
  // High luck = pick better symbol, low luck = more random
  const selectedQuote =
    luck > 5
      ? allQuotes.reduce((best, current) =>
          Math.random() > 0.5 ? current : best,
        ) // Semi-smart selection
      : allQuotes[Math.floor(Math.random() * allQuotes.length)]; // Random

  // Buy 5-10% of gold
  const percentToBuy = 0.05 + Math.random() * 0.05; // 5-10%
  const goldToSpend = user.gold * percentToBuy;

  // Quantity = gold / price
  const quantity = Math.floor(goldToSpend / selectedQuote.price);

  if (quantity <= 0) {
    return {
      type: 'impulse_buy',
      action: 'failed',
      symbol: selectedQuote.symbol,
      amount: goldToSpend,
      success: false,
      message: 'Insufficient gold for even 1 share',
    };
  }

  // Place market buy order
  const orderResult = await placeOrder(db, userId, {
    symbol: selectedQuote.symbol,
    side: 'buy',
    type: 'market',
    quantity,
    isAutoTrade: true,
  });

  if (orderResult.error) {
    return {
      type: 'impulse_buy',
      action: 'failed',
      symbol: selectedQuote.symbol,
      quantity,
      success: false,
      message: orderResult.error,
    };
  }

  return {
    type: 'impulse_buy',
    action: 'bought',
    symbol: selectedQuote.symbol,
    quantity,
    amount: goldToSpend,
    success: true,
    message: `Impulse bought ${quantity} of ${selectedQuote.symbol}`,
  };
}

/**
 * Panic sell: sell 20-50% of a random holding
 */
async function handlePanicSell(
  db: any,
  userId: string,
  user: any,
  allQuotes: any[],
  luck: number,
): Promise<DisruptionTradeResult> {
  // Get user's positions
  const userPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.userId, userId));

  if (userPositions.length === 0) {
    return {
      type: 'panic_sell',
      action: 'no_positions',
      success: false,
      message: 'No positions to panic sell',
    };
  }

  // Select random position
  const selectedPosition = userPositions[Math.floor(Math.random() * userPositions.length)];

  // Sell 20-50% of position
  const sellPercent = 0.2 + Math.random() * 0.3; // 20-50%
  const quantity = Math.max(1, Math.floor(selectedPosition.quantity * sellPercent));

  // Place market sell order
  const orderResult = await placeOrder(db, userId, {
    symbol: selectedPosition.symbol,
    side: 'sell',
    type: 'market',
    quantity,
    isAutoTrade: true,
  });

  if (orderResult.error) {
    return {
      type: 'panic_sell',
      action: 'failed',
      symbol: selectedPosition.symbol,
      quantity,
      success: false,
      message: orderResult.error,
    };
  }

  return {
    type: 'panic_sell',
    action: 'sold',
    symbol: selectedPosition.symbol,
    quantity,
    success: true,
    message: `Panic sold ${quantity} of ${selectedPosition.symbol}`,
  };
}

/**
 * All-in: invest up to 30% of total assets into random symbol
 */
async function handleAllIn(
  db: any,
  userId: string,
  user: any,
  allQuotes: any[],
  luck: number,
): Promise<DisruptionTradeResult> {
  // Calculate total asset value
  const userPositions = await db
    .select()
    .from(positions)
    .where(eq(positions.userId, userId));

  let totalAssetValue = user.gold;
  for (const pos of userPositions) {
    const quote = allQuotes.find((q) => q.symbol === pos.symbol);
    const price = quote?.price ?? pos.avgPrice;
    totalAssetValue += pos.quantity * price;
  }

  // Invest up to 30% into one symbol
  const investAmount = totalAssetValue * 0.3;

  // Luck influences symbol selection
  const selectedQuote =
    luck > 5
      ? allQuotes.reduce((best, current) =>
          Math.random() > 0.5 ? current : best,
        ) // Semi-smart selection
      : allQuotes[Math.floor(Math.random() * allQuotes.length)]; // Random

  const quantity = Math.floor(investAmount / selectedQuote.price);

  if (quantity <= 0) {
    return {
      type: 'all_in',
      action: 'insufficient_funds',
      symbol: selectedQuote.symbol,
      amount: investAmount,
      success: false,
      message: 'Not enough liquid gold for all-in',
    };
  }

  // Check if user has enough gold
  if (user.gold < quantity * selectedQuote.price) {
    return {
      type: 'all_in',
      action: 'insufficient_funds',
      symbol: selectedQuote.symbol,
      quantity,
      amount: quantity * selectedQuote.price,
      success: false,
      message: `Insufficient gold (need ${quantity * selectedQuote.price}, have ${user.gold})`,
    };
  }

  // Place market buy order
  const orderResult = await placeOrder(db, userId, {
    symbol: selectedQuote.symbol,
    side: 'buy',
    type: 'market',
    quantity,
    isAutoTrade: true,
  });

  if (orderResult.error) {
    return {
      type: 'all_in',
      action: 'failed',
      symbol: selectedQuote.symbol,
      quantity,
      amount: investAmount,
      success: false,
      message: orderResult.error,
    };
  }

  return {
    type: 'all_in',
    action: 'all_in_buy',
    symbol: selectedQuote.symbol,
    quantity,
    amount: investAmount,
    success: true,
    message: `All-in: bought ${quantity} of ${selectedQuote.symbol} (30% of assets)`,
  };
}
