import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { users } from './users';

/** 시설 템플릿 (관리자 정의) */
export const facilityTemplates = sqliteTable('facility_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: [
    'character_zone', 'house', 'kitchen', 'parking', 'office', 'warehouse',
    'work_boost', 'craft_boost', 'train_boost',
    'rest', 'bank', 'hospital', 'walkway',
  ] }).notNull(),
  shapeJson: text('shape_json', { mode: 'json' }).$type<Array<[number, number]>>().notNull(), // 테트리스 모양 좌표
  maxLevel: integer('max_level').notNull().default(4),
  baseCost: integer('base_cost').notNull(),
  buildTime: integer('build_time').notNull().default(0), // 초 단위, 0 for instant
  description: text('description').default(''),
  effectsJson: text('effects_json', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
});

/** 유저 보유 시설 (인스턴스) */
export const facilities = sqliteTable('facilities', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  definitionId: text('definition_id').notNull().references(() => facilityTemplates.id),
  grade: integer('grade').notNull().default(1),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  rotation: integer('rotation').notNull().default(0), // 0, 90, 180, 270
  isCollateral: integer('is_collateral', { mode: 'boolean' }).notNull().default(false),
  status: text('status', { enum: ['active', 'building', 'damaged'] }).notNull().default('active'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/** 유저 부지 (그리드) */
export const userGrids = sqliteTable('user_grids', {
  userId: text('user_id').primaryKey().references(() => users.id),
  gridWidth: integer('grid_width').notNull().default(8),
  gridHeight: integer('grid_height').notNull().default(8),
});

/** 보도 타일 */
export const walkways = sqliteTable('walkways', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  x: integer('x').notNull(),
  y: integer('y').notNull(),
});

/** 캐릭터 배치 구역 */
export const placementZones = sqliteTable('placement_zones', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  characterId: text('character_id'), // null이면 빈 구역
});

/** 집 (캐릭터 개인) */
export const houses = sqliteTable('houses', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull().references(() => users.id),
  level: integer('level').notNull().default(1),
  gridX: integer('grid_x').notNull(),
  gridY: integer('grid_y').notNull(),
  assignedCharacterId: text('assigned_character_id'),
});
