import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/** 대출 요청 */
export const loanRequests = sqliteTable('loan_requests', {
  id: text('id').primaryKey(),
  borrowerId: text('borrower_id').notNull().references(() => users.id),
  lenderId: text('lender_id').references(() => users.id), // null = 아직 미수락
  amount: real('amount').notNull(),
  interestRate: real('interest_rate').notNull(), // 이자율 (0.05 = 5%)
  termDays: integer('term_days').notNull(),
  collateralType: text('collateral_type', { enum: ['none', 'facility'] }),
  collateralId: text('collateral_id'), // 담보 시설 ID
  status: text('status', { enum: ['open', 'active', 'repaid', 'defaulted', 'collecting'] }).notNull().default('open'),
  repaidAmount: real('repaid_amount').notNull().default(0),
  defaultCount: integer('default_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  dueAt: integer('due_at', { mode: 'timestamp' }),
});

/** 적금 */
export const savingsAccounts = sqliteTable('savings_accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  productName: text('product_name').notNull(),
  principal: real('principal').notNull(),
  interestRate: real('interest_rate').notNull(),
  termDays: integer('term_days').notNull(),
  status: text('status', { enum: ['active', 'matured', 'cancelled'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  maturesAt: integer('matures_at', { mode: 'timestamp' }).notNull(),
});

/** 채팅 메시지 */
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id),
  recipientId: text('recipient_id'), // null = 전체 채팅
  content: text('content').notNull(),
  type: text('type', { enum: ['normal', 'whisper', 'system', 'emote'] }).notNull().default('normal'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 칭호 정의 (관리자) */
export const titleDefinitions = sqliteTable('title_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  conditionJson: text('condition_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  // e.g. { type: 'net_worth_gte', value: 1000000 }
});

/** 유저 보유 칭호 */
export const userTitles = sqliteTable('user_titles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  titleId: text('title_id').notNull().references(() => titleDefinitions.id),
  isEquipped: integer('is_equipped', { mode: 'boolean' }).notNull().default(false),
  earnedAt: integer('earned_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 업적 정의 (관리자) */
export const achievementDefinitions = sqliteTable('achievement_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  iconKey: text('icon_key'),
  conditionJson: text('condition_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  rewardJson: text('reward_json', { mode: 'json' }).$type<Record<string, unknown>>(),
});

/** 유저 업적 달성 */
export const userAchievements = sqliteTable('user_achievements', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  achievementId: text('achievement_id').notNull().references(() => achievementDefinitions.id),
  completedAt: integer('completed_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 주기적 이벤트 이력 */
export const eventHistory = sqliteTable('event_history', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['investment', 'labor', 'facility', 'character', 'economy', 'special'] }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  effectJson: text('effect_json', { mode: 'json' }).$type<Record<string, unknown>>(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  endsAt: integer('ends_at', { mode: 'timestamp' }).notNull(),
});

/** 패치노트 */
export const patchNotes = sqliteTable('patch_notes', {
  id: text('id').primaryKey(),
  version: text('version').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  changesJson: text('changes_json', { mode: 'json' }).$type<Array<{ type: string; table: string; description: string }>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 관리자 변경 이력 (자동 패치노트용) */
export const adminChangeLogs = sqliteTable('admin_change_logs', {
  id: text('id').primaryKey(),
  adminId: text('admin_id').notNull().references(() => users.id),
  tableName: text('table_name').notNull(),
  action: text('action', { enum: ['create', 'update', 'delete'] }).notNull(),
  recordId: text('record_id').notNull(),
  diffJson: text('diff_json', { mode: 'json' }).$type<Record<string, unknown>>(),
  patchNoteId: text('patch_note_id'), // null = 아직 번들링 안됨
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 게임 설정 (관리자 설정) */
export const gameConfig = sqliteTable('game_config', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).$type<unknown>().notNull(),
  description: text('description'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
