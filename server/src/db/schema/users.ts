import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/** 유저 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  status: text('status', { enum: ['pending', 'approved', 'rejected'] }).notNull().default('pending'),
  isAdmin: integer('is_admin', { mode: 'boolean' }).notNull().default(false),
  gold: real('gold').notNull().default(10000), // 초기 시드머니
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
  rejectedReason: text('rejected_reason'),
});

/** 유저 설정 */
export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id').primaryKey().references(() => users.id),
  watchlist: text('watchlist', { mode: 'json' }).$type<string[]>().default([]),
  uiPreferences: text('ui_preferences', { mode: 'json' }).$type<Record<string, unknown>>().default({}),
});
