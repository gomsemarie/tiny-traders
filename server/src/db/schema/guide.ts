import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/** 가이드 페이지 */
export const guidePages = sqliteTable('guide_pages', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category', { enum: ['gameplay', 'characters', 'investment', 'facilities', 'social', 'faq'] }).notNull(),
  content: text('content').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
