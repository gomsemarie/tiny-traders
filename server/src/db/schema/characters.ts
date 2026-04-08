import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/** 캐릭터 템플릿 (관리자가 정의) */
export const characterTemplates = sqliteTable('character_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  grade: text('grade', { enum: ['N', 'R', 'SR', 'SSR', 'UR'] }).notNull(),
  spriteKey: text('sprite_key').notNull(),

  // 7 스텟 기본값
  stamina: integer('stamina').notNull().default(5),
  efficiency: integer('efficiency').notNull().default(5),
  precision: integer('precision').notNull().default(5),
  mental: integer('mental').notNull().default(5),
  initiative: integer('initiative').notNull().default(5),
  discipline: integer('discipline').notNull().default(5),
  luck: integer('luck').notNull().default(5),

  // 고유 스킬 ID
  skillId: text('skill_id'),
  // 성향
  trait: text('trait', { enum: ['yolo', 'steady', 'neutral'] }).notNull().default('neutral'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 플레이어 보유 캐릭터 (인스턴스) */
export const characters = sqliteTable('characters', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  templateId: text('template_id').notNull().references(() => characterTemplates.id),
  nickname: text('nickname'),
  level: integer('level').notNull().default(1),
  experience: integer('experience').notNull().default(0),
  condition: real('condition').notNull().default(100), // 컨디션 (0~100)

  // 현재 스텟 (레벨업으로 변동)
  stamina: integer('stamina').notNull(),
  efficiency: integer('efficiency').notNull(),
  precision: integer('precision').notNull(),
  mental: integer('mental').notNull(),
  initiative: integer('initiative').notNull(),
  discipline: integer('discipline').notNull(),
  luck: integer('luck').notNull(),

  // 배치 상태
  slotIndex: integer('slot_index'), // null이면 미배치
  activity: text('activity', { enum: ['idle', 'work', 'craft', 'train', 'rest'] }).notNull().default('idle'),

  // 장비
  toolItemId: text('tool_item_id'),
  identity1Id: text('identity1_id'),
  identity2Id: text('identity2_id'),
  identity3Id: text('identity3_id'),

  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 스킬 정의 (관리자) */
export const skills = sqliteTable('skills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['buff', 'debuff', 'double_edged', 'trigger'] }).notNull(),
  scope: text('scope', { enum: ['self', 'next_n', 'all', 'random'] }).notNull(),
  scopeValue: integer('scope_value'), // next_n일 때 N값
  effectJson: text('effect_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
});

/** 뽑기 배너 */
export const gachaBanners = sqliteTable('gacha_banners', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['normal', 'premium', 'limited'] }).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  ratesJson: text('rates_json', { mode: 'json' }).$type<Record<string, number>>().notNull(), // grade -> rate
  featuredIds: text('featured_ids', { mode: 'json' }).$type<string[]>().default([]),
  startsAt: integer('starts_at', { mode: 'timestamp' }),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
});
