import { NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import AdminTableEditor from '../modules/admin/admin-table-editor';
import UserManagement from '../modules/admin/user-management';
import { TABLE_COLUMNS, TABLE_PK } from '../modules/admin/columns';
import { useAuthStore } from '../stores/auth-store';

const NAV_ITEMS = [
  { path: '/admin/characters', label: '캐릭터 관리', icon: 'tabler:user', table: 'character_templates' },
  { path: '/admin/skills', label: '스킬 관리', icon: 'tabler:bolt', table: 'skills' },
  { path: '/admin/items', label: '아이템 관리', icon: 'tabler:backpack', table: 'item_templates' },
  { path: '/admin/gacha', label: '뽑기 관리', icon: 'tabler:dice', table: 'gacha_banners' },
  { path: '/admin/facilities', label: '시설 관리', icon: 'tabler:crane', table: 'facility_templates' },
  { path: '/admin/balance', label: '밸런스/설정', icon: 'tabler:settings', table: 'game_config' },
  { path: '/admin/investment', label: '투자 종목', icon: 'tabler:chart-line', table: 'tradable_assets' },
  { path: '/admin/events', label: '이벤트 관리', icon: 'tabler:confetti', table: 'event_history' },
  { path: '/admin/titles', label: '칭호 관리', icon: 'tabler:medal', table: 'title_definitions' },
  { path: '/admin/achievements', label: '업적 관리', icon: 'tabler:trophy', table: 'achievement_definitions' },
  { path: '/admin/patchnotes', label: '패치노트', icon: 'tabler:clipboard-list', table: 'patch_notes' },
  { path: '/admin/members', label: '회원 관리', icon: 'tabler:lock', table: '__members__' },
];

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 240,
        minWidth: 240,
        background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '2px 0 8px rgba(0,0,0,0.15)',
      }}>
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon icon="tabler:device-gamepad-2" width={20} /> Tiny Traders
          </h1>
          <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>관리자 에디터</p>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 20px',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : '#cbd5e1',
                background: isActive ? 'rgba(59,130,246,0.2)' : 'transparent',
                borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
              })}
            >
              <Icon icon={item.icon} width={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          {user && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
              <Icon icon="tabler:crown" width={14} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4 }} />{user.displayName}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <a
              href="/"
              style={{ fontSize: 12, color: '#64748b', textDecoration: 'none' }}
            >
              ← 게임
            </a>
            <button
              onClick={logout}
              style={{
                fontSize: 12,
                color: '#ef4444',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <Routes>
          <Route index element={<Navigate to="/admin/characters" replace />} />
          {NAV_ITEMS.map((item) => {
            const segment = item.path.split('/').pop()!;
            return (
              <Route
                key={segment}
                path={segment}
                element={
                  item.table === '__members__' ? (
                    <UserManagement />
                  ) : (
                    <AdminTableEditor
                      title={item.label}
                      tableName={item.table}
                      columns={TABLE_COLUMNS[item.table] ?? []}
                      pkColumn={TABLE_PK[item.table] ?? 'id'}
                    />
                  )
                }
              />
            );
          })}
        </Routes>
      </main>
    </div>
  );
}
