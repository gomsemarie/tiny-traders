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
  seedFacilityDefinitions(sqlite);
  seedCharactersAndGacha(sqlite);

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

/** 시설 정의 초기 데이터 */
function seedFacilityDefinitions(sqlite: Database.Database) {
  const count = sqlite.prepare('SELECT COUNT(*) as cnt FROM facility_templates').get() as any;
  if (count.cnt > 0) return;

  const facilities = [
    { id: 'char_zone', name: 'Character Zone', type: 'character_zone', shape: '[[0,0]]', baseCost: 0, description: '1 character placement' },
    { id: 'house', name: 'House', type: 'house', shape: '[[0,0]]', baseCost: 100, description: 'Character buff' },
    { id: 'kitchen', name: 'Kitchen', type: 'kitchen', shape: '[[0,0],[1,0],[0,1],[1,1]]', baseCost: 150, description: 'Cooking job unlock' },
    { id: 'parking', name: 'Parking Lot', type: 'parking', shape: '[[0,0],[1,0],[1,1],[0,1]]', baseCost: 150, description: 'Parking job unlock' },
    { id: 'office', name: 'Office', type: 'office', shape: '[[0,1],[1,0],[1,1],[1,2],[2,1]]', baseCost: 200, description: 'Typing job unlock' },
    { id: 'warehouse', name: 'Warehouse', type: 'warehouse', shape: '[[0,0],[1,0],[2,0]]', baseCost: 120, description: 'Sorting job unlock' },
    { id: 'work_boost', name: 'Job Efficiency', type: 'work_boost', shape: '[[0,0],[1,0]]', baseCost: 100, description: 'Job output boost' },
    { id: 'craft_boost', name: 'Crafting Efficiency', type: 'craft_boost', shape: '[[0,0],[0,1],[1,0]]', baseCost: 100, description: 'Crafting boost' },
    { id: 'train_boost', name: 'Training Efficiency', type: 'train_boost', shape: '[[0,0],[1,0],[2,0]]', baseCost: 100, description: 'Training boost' },
    { id: 'rest', name: 'Rest Facility', type: 'rest', shape: '[[0,0],[1,0],[0,1],[1,1]]', baseCost: 120, description: 'Condition recovery' },
    { id: 'bank', name: 'Bank', type: 'bank', shape: '[[0,0],[1,0]]', baseCost: 150, description: 'Savings unlock' },
    { id: 'hospital', name: 'Hospital', type: 'hospital', shape: '[[0,0],[1,0],[0,1],[1,1]]', baseCost: 200, description: 'Debuff cure' },
    { id: 'walkway', name: 'Walkway', type: 'walkway', shape: '[[0,0]]', baseCost: 10, description: 'Path connection' },
  ];

  const insert = sqlite.prepare(
    'INSERT INTO facility_templates (id, name, type, shape_json, max_level, base_cost, build_time, description, effects_json) VALUES (?, ?, ?, ?, 4, ?, 0, ?, \'{}\')'
  );

  for (const f of facilities) {
    insert.run(f.id, f.name, f.type, f.shape, f.baseCost, f.description);
  }

  console.log(`🌱 Seeded ${facilities.length} facility definitions`);
}

/** 캐릭터 템플릿 + 스킬 + 뽑기 배너 초기 데이터 */
function seedCharactersAndGacha(sqlite: Database.Database) {
  const templateCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM character_templates').get() as any;
  if (templateCount.cnt > 0) return;

  // ── 스킬 정의 ──
  const insertSkill = sqlite.prepare(
    `INSERT INTO skills (id, name, description, type, scope, scope_value, effect_json) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const skillData = [
    { id: 'sk_focus', name: '집중 근무', desc: '알바 수익 15% 증가', type: 'buff', scope: 'self', scopeValue: null, effect: '{"workBonus":0.15}' },
    { id: 'sk_mentor', name: '멘토링', desc: '인접 2칸 캐릭터 효율 +1 (임시)', type: 'buff', scope: 'next_n', scopeValue: 2, effect: '{"statBoost":{"efficiency":1}}' },
    { id: 'sk_gamble', name: '도박사의 직감', desc: '투자 수익 ×1.3 but 돌발 확률 ×1.5', type: 'double_edged', scope: 'self', scopeValue: null, effect: '{"investBonus":0.3,"disruptionMult":1.5}' },
  ];
  for (const s of skillData) {
    insertSkill.run(s.id, s.name, s.desc, s.type, s.scope, s.scopeValue, s.effect);
  }

  // ── 캐릭터 템플릿 3종 ──
  // 기획서 기준: N(21~28), R(29~36), SR(37~45)
  // 초반 밸런스를 낮은 편으로 잡아야 하므로 범위 하단~중간으로 설정
  const insertTemplate = sqlite.prepare(
    `INSERT INTO character_templates (id, name, grade, sprite_key, stamina, efficiency, precision, mental, initiative, discipline, luck, skill_id, trait, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const now = Date.now();
  const templates = [
    // N등급 "신입 사원" — 일꾼형 (합계 25, 낮은 편)
    // 체력/효율 약간 높고, 투자 스텟 낮음. 안정적인 알바 캐릭터.
    {
      id: 'tpl_rookie', name: '신입 사원', grade: 'N', sprite: 'char_rookie',
      stamina: 5, efficiency: 4, precision: 4, mental: 3, initiative: 3, discipline: 3, luck: 3,
      skillId: 'sk_focus', trait: 'steady',
    },
    // R등급 "떡잎 트레이더" — 겜블러형 (합계 31)
    // 행동력/운 높지만 자제력/꼼꼼함 낮음. 스킬은 자주 터지지만 돌발도 잦음.
    {
      id: 'tpl_trader', name: '떡잎 트레이더', grade: 'R', sprite: 'char_trader',
      stamina: 3, efficiency: 4, precision: 3, mental: 5, initiative: 6, discipline: 3, luck: 7,
      skillId: 'sk_gamble', trait: 'yolo',
    },
    // SR등급 "장인 아저씨" — 제작 특화 (합계 38)
    // 꼼꼼함/운 높아서 고품질 아이템 제작에 유리. 멘탈/체력도 괜찮음.
    {
      id: 'tpl_artisan', name: '장인 아저씨', grade: 'SR', sprite: 'char_artisan',
      stamina: 5, efficiency: 4, precision: 8, mental: 5, initiative: 4, discipline: 5, luck: 7,
      skillId: 'sk_mentor', trait: 'steady',
    },
  ];

  for (const t of templates) {
    insertTemplate.run(
      t.id, t.name, t.grade, t.sprite,
      t.stamina, t.efficiency, t.precision, t.mental, t.initiative, t.discipline, t.luck,
      t.skillId, t.trait, now,
    );
  }

  // ── 뽑기 배너 2개 ──
  const insertBanner = sqlite.prepare(
    `INSERT INTO gacha_banners (id, name, type, is_active, rates_json, featured_ids, starts_at, ends_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)`
  );

  // 일반 배너: N 60%, R 30%, SR 10% (초반이라 SSR/UR 빠짐)
  insertBanner.run(
    'banner_normal',
    '일반 뽑기',
    'normal',
    JSON.stringify({ N: 0.60, R: 0.30, SR: 0.10 }),
    JSON.stringify([]),
    null,
    null,
  );

  // 프리미엄 배너: N 40%, R 35%, SR 25% — 장인 아저씨 픽업
  insertBanner.run(
    'banner_premium',
    '장인의 부름 (픽업)',
    'premium',
    JSON.stringify({ N: 0.40, R: 0.35, SR: 0.25 }),
    JSON.stringify(['tpl_artisan']),
    null,
    null,
  );

  console.log('🌱 Seeded 3 character templates, 3 skills, 2 gacha banners');
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
    data_source TEXT NOT NULL DEFAULT 'virtual',
    volatility REAL DEFAULT 0.02,
    initial_price REAL DEFAULT 100,
    is_active INTEGER NOT NULL DEFAULT 1
  )`);

  // Add new columns if they don't exist (migration)
  try {
    sqlite.exec(`ALTER TABLE tradable_assets ADD COLUMN data_source TEXT NOT NULL DEFAULT 'virtual'`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE tradable_assets ADD COLUMN volatility REAL DEFAULT 0.02`);
  } catch { /* column already exists */ }
  try {
    sqlite.exec(`ALTER TABLE tradable_assets ADD COLUMN initial_price REAL DEFAULT 100`);
  } catch { /* column already exists */ }

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
    build_time INTEGER NOT NULL DEFAULT 0,
    description TEXT DEFAULT '',
    effects_json TEXT NOT NULL DEFAULT '{}'
  )`);

  // facility_templates 마이그레이션 (기존 테이블에 새 컬럼 추가)
  try { sqlite.exec(`ALTER TABLE facility_templates ADD COLUMN description TEXT DEFAULT ''`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facility_templates ADD COLUMN effects_json TEXT NOT NULL DEFAULT '{}'`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facility_templates ADD COLUMN build_time INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facility_templates ADD COLUMN max_level INTEGER NOT NULL DEFAULT 4`); } catch { /* already exists */ }

  sqlite.exec(`CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    definition_id TEXT NOT NULL REFERENCES facility_templates(id),
    grade INTEGER NOT NULL DEFAULT 1,
    grid_x INTEGER NOT NULL,
    grid_y INTEGER NOT NULL,
    rotation INTEGER NOT NULL DEFAULT 0,
    is_collateral INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL
  )`);

  // facilities 마이그레이션 (기존 테이블에 새 컬럼 추가)
  try { sqlite.exec(`ALTER TABLE facilities ADD COLUMN definition_id TEXT NOT NULL DEFAULT ''`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facilities ADD COLUMN grade INTEGER NOT NULL DEFAULT 1`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facilities ADD COLUMN rotation INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facilities ADD COLUMN is_collateral INTEGER NOT NULL DEFAULT 0`); } catch { /* already exists */ }
  try { sqlite.exec(`ALTER TABLE facilities ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`); } catch { /* already exists */ }

  sqlite.exec(`CREATE TABLE IF NOT EXISTS user_grids (
    user_id TEXT PRIMARY KEY REFERENCES users(id),
    grid_width INTEGER NOT NULL DEFAULT 8,
    grid_height INTEGER NOT NULL DEFAULT 8
  )`);

  sqlite.exec(`CREATE TABLE IF NOT EXISTS walkways (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    x INTEGER NOT NULL,
    y INTEGER NOT NULL
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
    is_overdue INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    due_at INTEGER
  );`);

  // Add new columns if they don't exist (migration)
  try {
    sqlite.exec(`ALTER TABLE loan_requests ADD COLUMN is_overdue INTEGER NOT NULL DEFAULT 0`);
  } catch { /* column already exists */ }

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
