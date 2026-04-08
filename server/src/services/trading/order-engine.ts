import { eq, and, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { orders, positions, users, tradeHistory, tradableAssets } from '../../db/schema';
import { getQuote } from './quote-service';

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'oco';
export type OrderStatus = 'pending' | 'filled' | 'cancelled' | 'expired';

export interface PlaceOrderParams {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  linkedOrderId?: string;
  isAutoTrade?: boolean;
  characterId?: string;
}

/**
 * Place an order (market or limit)
 * For buy: validate user has enough gold
 * For sell: validate user has position
 */
export async function placeOrder(
  db: any,
  userId: string,
  params: PlaceOrderParams,
): Promise<{ orderId: string; error?: string }> {
  // Validate asset exists and is active
  const [asset] = await db
    .select()
    .from(tradableAssets)
    .where(eq(tradableAssets.symbol, params.symbol))
    .limit(1);

  if (!asset || !asset.isActive) {
    return { orderId: '', error: 'Asset not found or inactive' };
  }

  // Get current user
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return { orderId: '', error: 'User not found' };
  }

  // For buy orders, check if user has enough gold
  if (params.side === 'buy') {
    const quote = await getQuote(db, params.symbol);
    if (!quote) {
      return { orderId: '', error: 'Quote not available for symbol' };
    }

    const executionPrice = params.type === 'limit' ? params.limitPrice ?? quote.price : quote.price;
    const estimatedCost = params.quantity * executionPrice;

    if (user.gold < estimatedCost) {
      return { orderId: '', error: 'Insufficient gold' };
    }
  }

  // For sell orders, check if user has position
  if (params.side === 'sell') {
    const [position] = await db
      .select()
      .from(positions)
      .where(and(eq(positions.userId, userId), eq(positions.symbol, params.symbol)))
      .limit(1);

    if (!position || position.quantity < params.quantity) {
      return { orderId: '', error: 'Insufficient position' };
    }
  }

  // Create order
  const orderId = randomUUID();
  await db.insert(orders).values({
    id: orderId,
    userId,
    symbol: params.symbol,
    side: params.side,
    type: params.type,
    quantity: params.quantity,
    limitPrice: params.limitPrice,
    stopPrice: params.stopPrice,
    linkedOrderId: params.linkedOrderId,
    isAutoTrade: params.isAutoTrade ?? false,
    characterId: params.characterId,
    status: 'pending',
  });

  // Market orders should be executed immediately
  if (params.type === 'market') {
    const result = await executeMarketOrder(db, orderId);
    if (!result.success) {
      return { orderId, error: result.error };
    }
  }

  return { orderId };
}

/**
 * Execute a market order immediately at current cached price
 */
export async function executeMarketOrder(db: any, orderId: string): Promise<{ success: boolean; error?: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Order is not pending' };
  }

  const quote = await getQuote(db, order.symbol);
  if (!quote) {
    return { success: false, error: 'Quote not available' };
  }

  const executionPrice = quote.price;
  const fee = order.quantity * executionPrice * 0.001; // Default fee rate

  // Get asset fee rate
  const [asset] = await db
    .select()
    .from(tradableAssets)
    .where(eq(tradableAssets.symbol, order.symbol))
    .limit(1);
  const feeRate = asset?.feeRate ?? 0.001;
  const actualFee = order.quantity * executionPrice * feeRate;

  try {
    // Update order
    await db
      .update(orders)
      .set({
        status: 'filled',
        filledPrice: executionPrice,
        filledAt: new Date(),
        fee: actualFee,
      })
      .where(eq(orders.id, orderId));

    // Create trade history record
    await db.insert(tradeHistory).values({
      id: randomUUID(),
      userId: order.userId,
      orderId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: executionPrice,
      fee: actualFee,
    });

    if (order.side === 'buy') {
      // Get current user gold and deduct cost
      const [currentUser] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
      const newGold = currentUser.gold - (order.quantity * executionPrice + actualFee);
      await db.update(users).set({ gold: newGold }).where(eq(users.id, order.userId));

      // Update or create position
      const [position] = await db
        .select()
        .from(positions)
        .where(and(eq(positions.userId, order.userId), eq(positions.symbol, order.symbol)))
        .limit(1);

      if (position) {
        const newAvgPrice =
          (position.avgPrice * position.quantity + executionPrice * order.quantity) /
          (position.quantity + order.quantity);
        await db
          .update(positions)
          .set({
            quantity: position.quantity + order.quantity,
            avgPrice: newAvgPrice,
            updatedAt: new Date(),
          })
          .where(eq(positions.id, position.id));
      } else {
        await db.insert(positions).values({
          id: randomUUID(),
          userId: order.userId,
          symbol: order.symbol,
          quantity: order.quantity,
          avgPrice: executionPrice,
        });
      }
    } else if (order.side === 'sell') {
      // Get current user gold and add proceeds
      const [currentUser] = await db.select().from(users).where(eq(users.id, order.userId)).limit(1);
      const gainAmount = order.quantity * executionPrice - actualFee;
      const newGold = currentUser.gold + gainAmount;
      await db.update(users).set({ gold: newGold }).where(eq(users.id, order.userId));

      const [position] = await db
        .select()
        .from(positions)
        .where(and(eq(positions.userId, order.userId), eq(positions.symbol, order.symbol)))
        .limit(1);

      if (position) {
        if (position.quantity > order.quantity) {
          await db
            .update(positions)
            .set({
              quantity: position.quantity - order.quantity,
              updatedAt: new Date(),
            })
            .where(eq(positions.id, position.id));
        } else {
          // Delete position if fully sold
          await db.delete(positions).where(eq(positions.id, position.id));
        }

        // Record PnL
        const pnl = order.quantity * (executionPrice - position.avgPrice) - actualFee;
        await db
          .update(tradeHistory)
          .set({ pnl })
          .where(eq(tradeHistory.orderId, orderId));
      }
    }

    // Handle OCO: if this order has a linked order, cancel it
    if (order.linkedOrderId) {
      await db
        .update(orders)
        .set({ status: 'cancelled' })
        .where(eq(orders.id, order.linkedOrderId));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Check all pending limit/stop orders and execute if price conditions met
 */
export async function checkPendingOrders(db: any): Promise<number> {
  const pendingOrders = await db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.status, 'pending'),
        or(
          eq(orders.type, 'limit'),
          eq(orders.type, 'stop_loss'),
          eq(orders.type, 'take_profit'),
        ),
      ),
    );

  let executedCount = 0;

  for (const order of pendingOrders) {
    const quote = await getQuote(db, order.symbol);
    if (!quote) continue;

    let shouldExecute = false;

    if (order.type === 'limit') {
      if (order.side === 'buy' && quote.price <= (order.limitPrice ?? quote.price)) {
        shouldExecute = true;
      } else if (order.side === 'sell' && quote.price >= (order.limitPrice ?? quote.price)) {
        shouldExecute = true;
      }
    } else if (order.type === 'stop_loss') {
      if (quote.price <= (order.stopPrice ?? quote.price)) {
        shouldExecute = true;
      }
    } else if (order.type === 'take_profit') {
      if (quote.price >= (order.stopPrice ?? quote.price)) {
        shouldExecute = true;
      }
    }

    if (shouldExecute) {
      const result = await executeMarketOrder(db, order.id);
      if (result.success) {
        executedCount++;
      }
    }
  }

  return executedCount;
}

/**
 * Cancel a pending order
 */
export async function cancelOrder(db: any, orderId: string): Promise<{ success: boolean; error?: string }> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);

  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  if (order.status !== 'pending') {
    return { success: false, error: 'Only pending orders can be cancelled' };
  }

  await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId));

  return { success: true };
}
