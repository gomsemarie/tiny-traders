import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'tiny-traders.db');

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteInstance: Database.Database | null = null;

export function initDatabase() {
  if (dbInstance) return dbInstance;

  // data 디렉토리 자동 생성 (동기)
  const dir = path.dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const sqlite = new Database(DB_PATH);
  sqliteInstance = sqlite;

  // WAL 모드 + 성능 최적화
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('synchronous = NORMAL');
  sqlite.pragma('cache_size = -20000'); // 20MB
  sqlite.pragma('foreign_keys = ON');

  dbInstance = drizzle(sqlite, { schema });

  // 개발 환경: 스키마 기반 테이블 자동 생성
  ensureTables(sqlite);
  seedTradableAssets(sqlite);

  console.log(`📦 Database initialized: ${DB_PATH}`);

  return dbInstance;
}

/** 거래 가능한 자산 초기 데이터 */
function seedTradableAssets(sqlite: Database.Database) {
  const count = sqlite.prepare('SELECT COUNT(*) as cnt FROM tradable_assets').get() as any;
  if (count.cnt > 0) return;

  const assets = [
    { symbol: 'BEAR', name: '곰돌이베어 산업', type: 'stock', category: '제조', fee_rate: 0.001 },
    { symbol: 'TINY', name: '타이니테크', type: 'stock', category: '기술', fee_rate: 0.001 },
    { symbol: 'FISH', name: '물고기수산', type: 'stock', category: '수산', fee_rate: 0.001 },
    { symbol: 'MOON', name: '달나라건설', type: 'stock', category: '건설', fee_rate: 0.001 },
    { symbol: 'STAR', name: '별빛에너지', type: 'stock', category: '에너지', fee_rate: 0.0015 },
    { symbol: 'RICE', name: '쌀쌀농업', type: 'stock', category: '농업', fee_rate: 0.001 },
    { symbol: 'GOLD', name: '골드코인', type: 'crypto', category: '암호화폐', fee_rate: 0.002 },
    { symbol: 'DOGE', name: '도지코인', type: 'crypto', category: '암호화폐', fee_rate: 0.002 },
    { symbol: 'PIXL', name: '픽셀ETF', type: 'etf', category: 'ETF', fee_rate: 0.0005 },
    { symbol: 'SAFE', name: '안전자산ETF', type: 'etf', category: 'ETF', fee_rate: 0.0005 },
  ];

  const insert = sqlite.prepare(
    'INSERT INTO tradable_assets (symbol, name, type, category, fee_rate, is_active) VALUES (?, ?, ?, ?, ?, 1)'
  );
  for (const a of assets) {
    insert.run(a.symbol, a.name, a.type, a.category, a.fee_rate);
  }
  console.log(`🌱 Seeded ${assets.length} tradable assets`);
}

/** 스키마에 정의된 테이블이 없으면 생성 */
function ensureTables(sqlite: Database.Database) {
  // Users
  sqlite.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    status TEXT NOT NULL DEFAULT 'pending',
    is_admin INTEGER NOT NULL DEFAULT 0,
    gold REAL NOT NULL DEFAULT 10000,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER,
    rejected_reason TEXT
  )`);

  // 기존 users 테이블에 새 컬럼 없으면 추가 (마이그레이션)
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE users ADD COLUMN rejected_reason TEXT`);
  } catch { /* column already exists */ }

  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_settings (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    watchlist TEXT DEFAULT '[]',
    ui_preferences TEXT DEFAULT '{}'
  )`);

  // Characters
  sqlite.exec(`CREATE TABLE IF NOT EXISTS character_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    sprite_key TEXT NOT NULL,
    stamina INTEGER NOT NULL DEFAULT 5,
    efficiency INTEGER NOT NULL DEFAULT 5,
    precision INTEGER NOT NULL DEFAULT 5,
    mental INTEGER NOT NULL DEFAULT 5,
    initiative INTEGER NOT NULL DEFAULT 5,
    discipline INTEGER NOT NULL DEFAULT 5,
    luck INTEGER NOT NULL DEFAULT 5,
    skill_id TEXT,
    trait TEXT NOT NULL DEFAULT 'neutral',
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    template_id TEXT NOT NULL REFERENCES character_templates(id),
    nickname TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    experience INTEGER NOT NULL DEFAULT 0,
    condition REAL NOT NULL DEFAULT 100,
    stamina INTEGER NOT NULL,
    efficiency INTEGER NOT NULL,
    precision INTEGER NOT NULL,
    mental INTEGER NOT NULL,
    initiative INTEGER NOT NULL,
    discipline INTEGER NOT NULL,
    luck INTEGER NOT NULL,
    slot_index INTEGER,
    activity TEXT NOT NULL DEFAULT 'idle',
    tool_item_id TEXT,
    identity1_id TEXT,
    identity2_id TEXT,
    identity3_id TEXT,
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    scope TEXT NOT NULL,
    scope_value INTEGER,
    effect_json TEXT NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS gacha_banners (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    rates_json TEXT NOT NULL,
    featured_ids TEXT DEFAULT '[]',
    starts_at INTEGER,
    ends_at INTEGER
  )`);

  // Investment
  sqlite.exec(`CREATE TABLE IF NOT EXISTS tradable_assets (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT,
    fee_rate REAL NOT NULL DEFAULT 0.001,
    is_active INTEGER NOT NULL DEFAULT 1
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS quote_cache (
    symbol TEXT PRIMARY KEY REFERENCES tradable_assets(symbol),
    price REAL NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    volume REAL,
    change_percent REAL,
    week52_high REAL,
    week52_low REAL,
    updated_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    symbol TEXT NOT NULL REFERENCES tradable_assets(symbol),
    quantity REAL NOT NULL,
    avg_price REAL NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    symbol TEXT NOT NULL REFERENCES tradable_assets(symbol),
    side TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity REAL NOT NULL,
    limit_price REAL,
    stop_price REAL,
    status TEXT NOT NULL DEFAULT 'pending',
    filled_price REAL,
    filled_at INTEGER,
    fee REAL,
    linked_order_id TEXT,
    is_auto_trade INTEGER NOT NULL DEFAULT 0,
    character_id TEXT,
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS trade_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    order_id TEXT NOT NULL REFERENCES orders(id),
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,
    quantity REAL NOT NULL,
    price REAL NOT NULL,
    fee REAL NOT NULL DEFAULT 0,
    pnl REAL,
    executed_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL REFERENCES tradable_assets(symbol),
    open REAL NOT NULL,
    high REAL NOT NULL,
    low REAL NOT NULL,
    close REAL NOT NULL,
    volume INTEGER NOT NULL DEFAULT 0,
    interval TEXT NOT NULL DEFAULT '1m',
    timestamp INTEGER NOT NULL
  )`);

  // Facilities
  sqlite.exec(`CREATE TABLE IF NOT EXISTS facility_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    shape_json TEXT NOT NULL,
    max_level INTEGER NOT NULL DEFAULT 4,
    base_cost INTEGER NOT NULL,
    build_time INTEGER NOT NULL,
    effects_json TEXT NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    template_id TEXT NOT NULL REFERENCES facility_templates(id),
    level INTEGER NOT NULL DEFAULT 1,
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    rotation INTEGER NOT NULL DEFAULT 0,
    is_building INTEGER NOT NULL DEFAULT 0,
    build_complete_at INTEGER,
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_grids (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    width INTEGER NOT NULL DEFAULT 8,
    height INTEGER NOT NULL DEFAULT 8,
    path_tiles_json TEXT DEFAULT '[]'
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS placement_zones (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    character_id TEXT
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS houses (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    level INTEGER NOT NULL DEFAULT 1,
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    assigned_character_id TEXT
  )`);

  // Items
  sqlite.exec(`CREATE TABLE IF NOT EXISTS item_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    rarity TEXT NOT NULL DEFAULT 'common',
    effect_json TEXT,
    recipe_json TEXT,
    sell_price REAL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS inventory (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    item_id TEXT NOT NULL REFERENCES item_templates(id),
    quantity INTEGER NOT NULL DEFAULT 1
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS market_listings (
    id TEXT PRIMARY KEY,
    seller_id TEXT NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    price REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  )`);

  // Social
  sqlite.exec(`CREATE TABLE IF NOT EXISTS loan_requests (
    id TEXT PRIMARY KEY,
    borrower_id TEXT NOT NULL REFERENCES users(id),
    lender_id TEXT REFERENCES users(id),
    amount REAL NOT NULL,
    interest_rate REAL NOT NULL,
    term_days INTEGER NOT NULL,
    collateral_type TEXT,
    collateral_id TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    repaid_amount REAL NOT NULL DEFAULT 0,
    default_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    due_at INTEGER
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS savings_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    product_name TEXT NOT NULL,
    principal REAL NOT NULL,
    interest_rate REAL NOT NULL,
    term_days INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    matures_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    sender_id TEXT NOT NULL REFERENCES users(id),
    recipient_id TEXT,
    content TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'normal',
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS title_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    condition_json TEXT NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_titles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title_id TEXT NOT NULL REFERENCES title_definitions(id),
    is_equipped INTEGER NOT NULL DEFAULT 0,
    earned_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS achievement_definitions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_key TEXT,
    condition_json TEXT NOT NULL,
    reward_json TEXT
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    achievement_id TEXT NOT NULL REFERENCES achievement_definitions(id),
    completed_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS event_history (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    effect_json TEXT,
    started_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS patch_notes (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    changes_json TEXT,
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS admin_change_logs (
    id TEXT PRIMARY KEY,
    admin_id TEXT NOT NULL REFERENCES users(id),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    record_id TEXT NOT NULL,
    diff_json TEXT,
    patch_note_id TEXT,
    created_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS game_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at INTEGER NOT NULL
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS guide_pages (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
}

export function getSqlite(): Database.Database | null {
  return sqliteInstance;
}

export type DB = NonNullable<typeof dbInstance>;
