import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/** 거래 가능 종목 목록 (관리자 관리) */
export const tradableAssets = sqliteTable('tradable_assets', {
  symbol: text('symbol').primaryKey(), // e.g. AAPL, BTC-USD, USDKRW=X
  name: text('name').notNull(),
  type: text('type', { enum: ['stock', 'etf', 'crypto', 'forex'] }).notNull(),
  category: text('category'), // 관리자 분류
  feeRate: real('fee_rate').notNull().default(0.001), // 수수료율 (0.1%)
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

/** 시세 캐시 (서버 polling 결과) */
export const quoteCache = sqliteTable('quote_cache', {
  symbol: text('symbol').primaryKey().references(() => tradableAssets.symbol),
  price: real('price').notNull(),
  open: real('open'),
  high: real('high'),
  low: real('low'),
  volume: real('volume'),
  changePercent: real('change_percent'),
  week52High: real('week52_high'),
  week52Low: real('week52_low'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 보유 포지션 (포트폴리오) */
export const positions = sqliteTable('positions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  symbol: text('symbol').notNull().references(() => tradableAssets.symbol),
  quantity: real('quantity').notNull(),
  avgPrice: real('avg_price').notNull(), // 평균 매입가
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 주문 */
export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  symbol: text('symbol').notNull().references(() => tradableAssets.symbol),
  side: text('side', { enum: ['buy', 'sell'] }).notNull(),
  type: text('type', { enum: ['market', 'limit', 'stop_loss', 'take_profit', 'oco'] }).notNull(),
  quantity: real('quantity').notNull(),
  limitPrice: real('limit_price'), // 지정가
  stopPrice: real('stop_price'), // 손절/익절 가격
  status: text('status', { enum: ['pending', 'filled', 'cancelled', 'expired'] }).notNull().default('pending'),
  filledPrice: real('filled_price'),
  filledAt: integer('filled_at', { mode: 'timestamp' }),
  fee: real('fee'),
  // OCO 연결
  linkedOrderId: text('linked_order_id'),
  // 캐릭터 자동매매 여부
  isAutoTrade: integer('is_auto_trade', { mode: 'boolean' }).notNull().default(false),
  characterId: text('character_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 거래 이력 */
export const tradeHistory = sqliteTable('trade_history', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  orderId: text('order_id').notNull().references(() => orders.id),
  symbol: text('symbol').notNull(),
  side: text('side', { enum: ['buy', 'sell'] }).notNull(),
  quantity: real('quantity').notNull(),
  price: real('price').notNull(),
  fee: real('fee').notNull().default(0),
  pnl: real('pnl'), // 매도 시 실현 손익
  executedAt: integer('executed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 가격 이력 (OHLCV 캔들) */
export const priceHistory = sqliteTable('price_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull().references(() => tradableAssets.symbol),
  open: real('open').notNull(),
  high: real('high').notNull(),
  low: real('low').notNull(),
  close: real('close').notNull(),
  volume: integer('volume').notNull().default(0),
  interval: text('interval', { enum: ['1m', '5m', '1h', '1d'] }).notNull().default('1m'),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});
