import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../scenes/main-scene';
import { useAuthStore } from '../stores/auth-store';
import { useCharacters } from '../api/characters';
import CharacterCard from '../modules/character/character-card';
import CharacterDetailPanel from '../modules/character/character-detail-panel';
import GachaPanel from '../modules/character/gacha-panel';
import AdminTableEditor from '../modules/admin/admin-table-editor';
import UserManagement from '../modules/admin/user-management';
import { TABLE_COLUMNS, TABLE_PK } from '../modules/admin/columns';
import TradingWindow from '../modules/trading/trading-window';
import BankingWindow from '../modules/banking/banking-window';
import RankingWindow from '../modules/ranking/ranking-window';
import WindowFrame, { getSpawnOffset, type ScreenMode, type WindowDef } from '../components/window-frame';
import EventBanner from '../modules/events/event-banner';
import FacilityGridWindow from '../modules/facility/facility-grid-window';
import MinigameWindow from '../modules/minigames/minigame-window';
import ShopWindow from '../modules/shop/shop-window';
import PixelEditor from '../modules/editor/pixel-editor';

/* ─── Admin table nav ─── */
const ADMIN_TABLES = [
  { key: 'character_templates', label: '캐릭터' },
  { key: 'skills', label: '스킬' },
  { key: 'item_templates', label: '아이템' },
  { key: 'gacha_banners', label: '뽑기' },
  { key: 'facility_templates', label: '시설' },
  { key: 'game_config', label: '설정' },
  { key: 'tradable_assets', label: '투자종목' },
  { key: 'event_history', label: '이벤트' },
  { key: 'title_definitions', label: '칭호' },
  { key: 'achievement_definitions', label: '업적' },
  { key: 'patch_notes', label: '패치노트' },
];

/* ─── Window definitions ─── */
type WinId = 'game' | 'characters' | 'gacha' | 'trading' | 'banking' | 'ranking' | 'facility' | 'minigame' | 'shop' | 'editor' | 'admin-data' | 'admin-members';

const WIN_DEFS: Record<WinId, WindowDef> = {
  // game: canvas 480×360 + padding 12*2 + top info ~28 + titlebar 32 + border 2 ≈ 518×436
  game:           { id: 'game',          title: '게임',       defaultWidth: 518, defaultHeight: 436, minWidth: 360, minHeight: 280 },
  // characters: card grid + optional detail sidebar 260
  characters:     { id: 'characters',    title: '캐릭터',     defaultWidth: 640, defaultHeight: 420, minWidth: 380, minHeight: 260 },
  // gacha: banner list + roll button + result — compact
  gacha:          { id: 'gacha',         title: '뽑기',       defaultWidth: 360, defaultHeight: 380, minWidth: 300, minHeight: 280 },
  // trading: chart + orderbook + stocklist — needs width
  trading:        { id: 'trading',       title: '투자',       defaultWidth: 880, defaultHeight: 560, minWidth: 680, minHeight: 380 },
  // banking: product list + account table — moderate
  banking:        { id: 'banking',       title: '은행',       defaultWidth: 560, defaultHeight: 440, minWidth: 420, minHeight: 320 },
  // ranking: simple list
  ranking:        { id: 'ranking',       title: '랭킹',       defaultWidth: 360, defaultHeight: 440, minWidth: 300, minHeight: 300 },
  // facility: 8×8 grid (256px) + controls + sidebar
  facility:       { id: 'facility',      title: '시설',       defaultWidth: 640, defaultHeight: 480, minWidth: 460, minHeight: 360 },
  // minigame: 2×2 job selection or game canvas
  minigame:       { id: 'minigame',      title: '알바',       defaultWidth: 480, defaultHeight: 400, minWidth: 360, minHeight: 300 },
  // shop: NPC shop with item categories
  shop:           { id: 'shop',          title: '상점',       defaultWidth: 640, defaultHeight: 480, minWidth: 480, minHeight: 360 },
  // editor: pixel art editor 32×32
  editor:         { id: 'editor',        title: '도트 에디터', defaultWidth: 720, defaultHeight: 560, minWidth: 600, minHeight: 480 },
  // admin data: tab bar + toolbar + data grid — needs width for columns
  'admin-data':   { id: 'admin-data',    title: '데이터 관리', defaultWidth: 860, defaultHeight: 520, minWidth: 500, minHeight: 300 },
  // admin members: user list table
  'admin-members':{ id: 'admin-members', title: '회원 관리',   defaultWidth: 600, defaultHeight: 420, minWidth: 380, minHeight: 260 },
};

const NAV_ITEMS: Array<{ id: WinId; label: string; adminOnly?: boolean }> = [
  { id: 'game', label: '게임' },
  { id: 'characters', label: '캐릭터' },
  { id: 'gacha', label: '뽑기' },
  { id: 'trading', label: '투자' },
  { id: 'ranking', label: '랭킹' },
  { id: 'banking', label: '은행' },
  { id: 'facility', label: '시설' },
  { id: 'minigame', label: '알바' },
  { id: 'shop', label: '상점' },
  { id: 'editor', label: '도트 에디터' },
  { id: 'admin-data', label: '데이터 관리', adminOnly: true },
  { id: 'admin-members', label: '회원 관리', adminOnly: true },
];

/* ─── Phaser ─── */
const GAME_W = 480;
const GAME_H = 360;
const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, width: GAME_W, height: GAME_H,
  pixelArt: true, backgroundColor: '#f0f4f8',
  scene: [MainScene], scale: { mode: Phaser.Scale.NONE },
};

/* ═══════════════════════════════════════════════
   Panel Contents (each memo'd for isolation)
   ═══════════════════════════════════════════════ */

const GamePanel = memo(() => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (containerRef.current && !gameRef.current) {
      gameRef.current = new Phaser.Game({ ...GAME_CONFIG, parent: containerRef.current });
    }
    return () => { gameRef.current?.destroy(true); gameRef.current = null; };
  }, []);

  return (
    <div style={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {user && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{user.displayName}님의 마을</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '2px 7px', borderRadius: 4 }}>
            {user.gold.toLocaleString()} G
          </span>
        </div>
      )}
      <div style={{ width: GAME_W, height: GAME_H, borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb', background: '#f0f4f8', flexShrink: 0 }}>
        <div ref={containerRef} />
      </div>
    </div>
  );
});

const CharacterPanel = memo(() => {
  const user = useAuthStore((s) => s.user);
  const { data, isLoading } = useCharacters(user?.id ?? '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const characters = data?.characters ?? [];
  const selected = characters.find((c) => c.id === selectedId);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 8px', fontSize: 12, color: '#9ca3af' }}>{characters.length}명 보유</div>
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px 16px' }}>
          {isLoading ? (
            <p style={{ color: '#9ca3af', fontSize: 13 }}>로딩 중...</p>
          ) : characters.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>
              보유 중인 캐릭터가 없습니다.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
              {characters.map((c) => (
                <CharacterCard key={c.id} character={c} grade="N" onClick={() => setSelectedId(c.id)} selected={selectedId === c.id} />
              ))}
            </div>
          )}
        </div>
      </div>
      {selected && (
        <aside style={{ width: 280, borderLeft: '1px solid #e5e7eb', background: '#fafafa', padding: 16, overflow: 'auto' }}>
          <CharacterDetailPanel character={selected} grade="N" />
        </aside>
      )}
    </div>
  );
});

const GachaPanelWrapper = memo(() => {
  const user = useAuthStore((s) => s.user);
  return <div style={{ padding: 16 }}><GachaPanel userId={user?.id ?? ''} /></div>;
});

const AdminDataPanel = memo(() => {
  const [activeTable, setActiveTable] = useState(ADMIN_TABLES[0].key);
  const current = ADMIN_TABLES.find((t) => t.key === activeTable) ?? ADMIN_TABLES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid #e5e7eb', background: '#fafafa', overflowX: 'auto', flexShrink: 0 }}>
        {ADMIN_TABLES.map((t) => (
          <button key={t.key} onClick={() => setActiveTable(t.key)} style={{
            padding: '8px 12px', fontSize: 12, fontWeight: activeTable === t.key ? 600 : 400,
            color: activeTable === t.key ? '#2563eb' : '#6b7280', background: 'transparent',
            border: 'none', borderBottom: activeTable === t.key ? '2px solid #2563eb' : '2px solid transparent',
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <AdminTableEditor key={activeTable} title={current.label} tableName={activeTable} columns={TABLE_COLUMNS[activeTable] ?? []} pkColumn={TABLE_PK[activeTable] ?? 'id'} />
      </div>
    </div>
  );
});

const FacilityPanel = memo(() => {
  const user = useAuthStore((s) => s.user);
  return <FacilityGridWindow userId={user?.id ?? ''} />;
});

const MinigamePanel = memo(() => {
  const [jobType, setJobType] = useState<'cooking' | 'parking' | 'typing' | 'sorting'>('cooking');
  const [playing, setPlaying] = useState(false);
  const JOB_LIST = [
    { type: 'cooking' as const, label: '요리', color: '#ef4444', icon: '🍳' },
    { type: 'parking' as const, label: '발렛파킹', color: '#14b8a6', icon: '🚗' },
    { type: 'typing' as const, label: '타자', color: '#6ee7b7', icon: '⌨️' },
    { type: 'sorting' as const, label: '분류', color: '#f59e0b', icon: '📦' },
  ];

  if (playing) {
    return <MinigameWindow jobType={jobType} characterId="" characterName="플레이어" onClose={() => setPlaying(false)} />;
  }

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>알바를 선택하세요 (캐릭터 배치 후 수동 플레이 가능)</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {JOB_LIST.map((j) => (
          <button key={j.type} onClick={() => { setJobType(j.type); setPlaying(true); }} style={{
            padding: '16px 12px', background: '#fff', border: `2px solid ${j.color}33`,
            borderRadius: 8, cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: 24 }}>{j.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: j.color, marginTop: 4 }}>{j.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
});

/* ── Content factory ── */
const ShopPanel = memo(() => <ShopWindow />);
const EditorPanel = memo(() => <PixelEditor />);

/* ── Content factory ── */
const CONTENT_MAP: Record<WinId, React.ComponentType> = {
  game: GamePanel,
  characters: CharacterPanel,
  gacha: GachaPanelWrapper,
  trading: TradingWindow,
  banking: BankingWindow,
  ranking: RankingWindow,
  facility: FacilityPanel,
  minigame: MinigamePanel,
  shop: ShopPanel,
  editor: EditorPanel,
  'admin-data': AdminDataPanel,
  'admin-members': UserManagement,
};

/* ═══════════════════════════════════════════════
   Window state (minimal — just what React needs)
   ═══════════════════════════════════════════════ */
interface WinState {
  id: WinId;
  screenMode: ScreenMode;
}

/* ═══════════════════════════════════════════════
   Dashboard Page
   ═══════════════════════════════════════════════ */
export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAdmin = user?.role === 'admin';

  /* ── Window state: only screen mode + open list ── */
  const [windows, setWindows] = useState<WinState[]>([]);
  const [focusedId, setFocusedId] = useState<WinId | null>(null);

  /* ── Default bounds per window (created once, stored in ref map) ── */
  const boundsMap = useRef<Record<string, ReturnType<typeof makeBounds>>>({});

  function makeBounds(id: WinId) {
    const def = WIN_DEFS[id];
    const offset = getSpawnOffset();
    return {
      x: 10 + offset,
      y: 10 + offset,
      width: def.defaultWidth,
      height: def.defaultHeight,
      minWidth: def.minWidth,
      minHeight: def.minHeight,
    };
  }

  const openWindow = useCallback((id: WinId) => {
    setWindows((prev) => {
      const existing = prev.find((w) => w.id === id);
      if (existing) {
        // If hidden, restore
        if (existing.screenMode === 'hidden') {
          return prev.map((w) => w.id === id ? { ...w, screenMode: 'normal' as ScreenMode } : w);
        }
        // just focus
        return prev;
      }
      // Create bounds on first open
      if (!boundsMap.current[id]) {
        boundsMap.current[id] = makeBounds(id);
      }
      return [...prev, { id, screenMode: 'normal' }];
    });
    setFocusedId(id);
  }, []);

  const onFocus = useCallback((id: string) => {
    setFocusedId(id as WinId);
  }, []);

  const onClose = useCallback((id: string) => {
    setWindows((prev) => prev.filter((w) => w.id !== id));
    setFocusedId((prev) => prev === id ? null : prev);
    // clear bounds so next open gets fresh cascade
    delete boundsMap.current[id];
  }, []);

  const onScreenModeChange = useCallback((id: string, mode: ScreenMode) => {
    setWindows((prev) => prev.map((w) => w.id === id ? { ...w, screenMode: mode } : w));
  }, []);

  const visibleNav = useMemo(
    () => NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin),
    [isAdmin],
  );

  const openIds = useMemo(() => new Set(windows.map((w) => w.id)), [windows]);

  return (
    <div style={{
      display: 'flex', height: '100vh',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: '#111827', background: '#f3f4f6',
    }}>
      {/* ─── Sidebar ─── */}
      <aside style={{
        width: 200, minWidth: 200, background: '#fff',
        borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid #f3f4f6' }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Tiny Traders</h1>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>모의투자 시뮬레이션</p>
        </div>

        <nav style={{ flex: 1, padding: 8, overflow: 'auto' }}>
          <p style={S.sectionLabel}>PLAY</p>
          {visibleNav.filter((n) => !n.adminOnly).map((item) => (
            <button key={item.id} onClick={() => openWindow(item.id)} style={{
              ...S.navBtn,
              background: openIds.has(item.id) ? '#f3f4f6' : 'transparent',
              color: openIds.has(item.id) ? '#111827' : '#6b7280',
              fontWeight: openIds.has(item.id) ? 600 : 400,
            }}>
              {item.label}
            </button>
          ))}
          {isAdmin && (
            <>
              <p style={{ ...S.sectionLabel, marginTop: 12 }}>MANAGE</p>
              {visibleNav.filter((n) => n.adminOnly).map((item) => (
                <button key={item.id} onClick={() => openWindow(item.id)} style={{
                  ...S.navBtn,
                  background: openIds.has(item.id) ? '#f3f4f6' : 'transparent',
                  color: openIds.has(item.id) ? '#111827' : '#6b7280',
                  fontWeight: openIds.has(item.id) ? 600 : 400,
                }}>
                  {item.label}
                </button>
              ))}
            </>
          )}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
          {user && (
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: 0 }}>{user.displayName}</p>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
                @{user.username}
                {isAdmin && <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280', background: '#f3f4f6', padding: '1px 5px', borderRadius: 3 }}>관리자</span>}
              </p>
            </div>
          )}
          <button onClick={logout} style={{ width: '100%', padding: '7px 0', fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}>
            로그아웃
          </button>
        </div>
      </aside>

      {/* ─── Desktop + Taskbar ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Event Banner */}
        <EventBanner />

        {/* Desktop area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {windows.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#d1d5db', gap: 4 }}>
              <p style={{ fontSize: 14 }}>사이드바에서 메뉴를 선택하세요</p>
              <p style={{ fontSize: 12 }}>여러 창을 동시에 열 수 있습니다</p>
            </div>
          )}

          {windows.map((w) => {
            const bounds = boundsMap.current[w.id] ?? makeBounds(w.id);
            const Content = CONTENT_MAP[w.id];
            return (
              <WindowFrame
                key={w.id}
                id={w.id}
                title={WIN_DEFS[w.id].title}
                defaultBounds={bounds}
                screenMode={w.screenMode}
                isFocused={focusedId === w.id}
                onFocus={onFocus}
                onClose={onClose}
                onScreenModeChange={onScreenModeChange}
              >
                <Content />
              </WindowFrame>
            );
          })}
        </div>

        {/* Taskbar */}
        {windows.length > 0 && (
          <div style={{
            height: 36, background: '#fff', borderTop: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', padding: '0 8px', gap: 4, flexShrink: 0,
          }}>
            {windows.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  if (w.screenMode === 'hidden') {
                    onScreenModeChange(w.id, 'normal');
                    setFocusedId(w.id);
                  } else if (focusedId === w.id) {
                    onScreenModeChange(w.id, 'hidden');
                  } else {
                    setFocusedId(w.id);
                  }
                }}
                style={{
                  padding: '4px 12px', fontSize: 11,
                  fontWeight: w.screenMode === 'hidden' ? 400 : 500,
                  color: w.screenMode === 'hidden' ? '#9ca3af' : (focusedId === w.id ? '#111827' : '#6b7280'),
                  background: focusedId === w.id && w.screenMode !== 'hidden' ? '#e5e7eb' : (w.screenMode === 'hidden' ? 'transparent' : '#f3f4f6'),
                  border: '1px solid', borderColor: w.screenMode === 'hidden' ? '#e5e7eb' : '#d1d5db',
                  borderRadius: 4, cursor: 'pointer',
                }}
              >
                {WIN_DEFS[w.id].title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Styles ─── */
const S = {
  sectionLabel: {
    fontSize: 10, fontWeight: 600, color: '#9ca3af',
    letterSpacing: '0.05em', padding: '8px 10px 4px', margin: 0,
  } as React.CSSProperties,
  navBtn: {
    display: 'block', width: '100%', textAlign: 'left' as const,
    padding: '8px 10px', fontSize: 13, border: 'none', borderRadius: 6,
    cursor: 'pointer', transition: 'background 0.1s, color 0.1s',
  } as React.CSSProperties,
};
