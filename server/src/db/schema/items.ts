import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/** 아이템 정의 (관리자) */
export const itemTemplates = sqliteTable('item_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: ['tool', 'identity', 'consumable'] }).notNull(),
  rarity: text('rarity', { enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] }).notNull().default('common'),
  effectJson: text('effect_json', { mode: 'json' }).$type<Record<string, unknown>>(),
  // 제작 레시피 (null이면 제작 불가, 드롭/구매만)
  recipeJson: text('recipe_json', { mode: 'json' }).$type<{ materials: Record<string, number>; craftTime: number } | null>(),
  sellPrice: real('sell_price'),
});

/** 유저 인벤토리 */
export const inventory = sqliteTable('inventory', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  itemId: text('item_id').notNull().references(() => itemTemplates.id),
  quantity: integer('quantity').notNull().default(1),
});

/** 마켓 게시글 (캐릭터/아이템) */
export const marketListings = sqliteTable('market_listings', {
  id: text('id').primaryKey(),
  sellerId: text('seller_id').notNull().references(() => users.id),
  type: text('type', { enum: ['character', 'item'] }).notNull(),
  targetId: text('target_id').notNull(), // 캐릭터 ID 또는 인벤토리 ID
  price: real('price').notNull(),
  status: text('status', { enum: ['active', 'sold', 'cancelled'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
