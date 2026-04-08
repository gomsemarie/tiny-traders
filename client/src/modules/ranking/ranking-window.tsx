import { memo, useState } from 'react';
import { useWealthRanking, useReturnsRanking } from '../../api/ranking';
import { useAuthStore } from '../../stores/auth-store';
import type { WealthRanking, ReturnsRanking } from '../../api/ranking';

const ACCENT_COLOR = '#2563eb';
const UP_COLOR = '#16a34a';
const DOWN_COLOR = '#dc2626';
const ROW_HEIGHT = 28;
const LABEL_SIZE = 10;
const VALUE_SIZE = 11;
const RANK_SIZE = 12;

// ═══════════════════════════════════════════════
// Tab Component
// ═══════════════════════════════════════════════
const TabButton = memo(
  ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 12px',
        fontSize: LABEL_SIZE,
        fontWeight: active ? 600 : 400,
        color: active ? ACCENT_COLOR : '#6b7280',
        background: 'transparent',
        border: 'none',
        borderBottom: active ? `2px solid ${ACCENT_COLOR}` : '2px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
    >
      {label}
    </button>
  ),
);

// ═══════════════════════════════════════════════
// Wealth Table
// ═══════════════════════════════════════════════
const WealthTable = memo(({ rankings, currentUserId }: { rankings: WealthRanking[]; currentUserId: string }) => {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return '#fbbf24'; // gold
    if (rank === 2) return '#d1d5db'; // silver
    if (rank === 3) return '#f97316'; // bronze
    return '#6b7280';
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 100px',
          gap: 8,
          padding: '8px 12px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          fontSize: LABEL_SIZE,
          fontWeight: 600,
          color: '#6b7280',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <div>순위</div>
        <div>닉네임</div>
        <div style={{ textAlign: 'right' }}>자산</div>
      </div>

      {/* Rows */}
      {rankings.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: VALUE_SIZE }}>
          순위가 없습니다.
        </div>
      ) : (
        rankings.map((row, idx) => {
          const isCurrentUser = row.userId === currentUserId;
          const bgColor = isCurrentUser ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#f9fafb';
          const borderColor = isCurrentUser ? ACCENT_COLOR : 'transparent';

          return (
            <div
              key={row.userId}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 100px',
                gap: 8,
                padding: '8px 12px',
                height: ROW_HEIGHT,
                alignItems: 'center',
                background: bgColor,
                borderBottom: '1px solid #e5e7eb',
                borderLeft: `3px solid ${borderColor}`,
                fontSize: VALUE_SIZE,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: RANK_SIZE, color: getMedalColor(row.rank) }}>
                {row.rank}
              </div>
              <div style={{ color: '#1f2937', fontWeight: isCurrentUser ? 600 : 400 }}>
                {row.displayName}
                {isCurrentUser && (
                  <span style={{ marginLeft: 6, fontSize: 9, color: ACCENT_COLOR, fontWeight: 600 }}>
                    (나)
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right', color: '#1f2937', fontWeight: 500 }}>
                {row.netWorth.toLocaleString()}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════
// Returns Table
// ═══════════════════════════════════════════════
const ReturnsTable = memo(({ rankings, currentUserId }: { rankings: ReturnsRanking[]; currentUserId: string }) => {
  const getMedalColor = (rank: number) => {
    if (rank === 1) return '#fbbf24';
    if (rank === 2) return '#d1d5db';
    if (rank === 3) return '#f97316';
    return '#6b7280';
  };

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 80px 80px',
          gap: 8,
          padding: '8px 12px',
          background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          fontSize: LABEL_SIZE,
          fontWeight: 600,
          color: '#6b7280',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        <div>순위</div>
        <div>닉네임</div>
        <div style={{ textAlign: 'right' }}>수익</div>
        <div style={{ textAlign: 'right' }}>수익률</div>
      </div>

      {/* Rows */}
      {rankings.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: VALUE_SIZE }}>
          순위가 없습니다.
        </div>
      ) : (
        rankings.map((row, idx) => {
          const isCurrentUser = row.userId === currentUserId;
          const bgColor = isCurrentUser ? '#eff6ff' : idx % 2 === 0 ? '#fff' : '#f9fafb';
          const borderColor = isCurrentUser ? ACCENT_COLOR : 'transparent';
          const pnlColor = row.totalPnl >= 0 ? UP_COLOR : DOWN_COLOR;
          const returnColor = row.returnPercent >= 0 ? UP_COLOR : DOWN_COLOR;

          return (
            <div
              key={row.userId}
              style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 80px 80px',
                gap: 8,
                padding: '8px 12px',
                height: ROW_HEIGHT,
                alignItems: 'center',
                background: bgColor,
                borderBottom: '1px solid #e5e7eb',
                borderLeft: `3px solid ${borderColor}`,
                fontSize: VALUE_SIZE,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: RANK_SIZE, color: getMedalColor(row.rank) }}>
                {row.rank}
              </div>
              <div style={{ color: '#1f2937', fontWeight: isCurrentUser ? 600 : 400 }}>
                {row.displayName}
                {isCurrentUser && (
                  <span style={{ marginLeft: 6, fontSize: 9, color: ACCENT_COLOR, fontWeight: 600 }}>
                    (나)
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right', color: pnlColor, fontWeight: 500 }}>
                {row.totalPnl >= 0 ? '+' : ''}{row.totalPnl.toLocaleString()}
              </div>
              <div style={{ textAlign: 'right', color: returnColor, fontWeight: 500 }}>
                {row.returnPercent >= 0 ? '+' : ''}{row.returnPercent.toFixed(2)}%
              </div>
            </div>
          );
        })
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════
// Main RankingWindow
// ═══════════════════════════════════════════════
export default memo(function RankingWindow() {
  const [tab, setTab] = useState<'wealth' | 'returns'>('wealth');
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?.id ?? '';

  const wealthQuery = useWealthRanking();
  const returnsQuery = useReturnsRanking();

  const isLoading = tab === 'wealth' ? wealthQuery.isLoading : returnsQuery.isLoading;
  const isError = tab === 'wealth' ? wealthQuery.isError : returnsQuery.isError;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#fff',
        overflow: 'hidden',
      }}
    >
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '0 12px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
          flexShrink: 0,
        }}
      >
        <TabButton active={tab === 'wealth'} label="자산" onClick={() => setTab('wealth')} />
        <TabButton active={tab === 'returns'} label="수익률" onClick={() => setTab('returns')} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: '#9ca3af', fontSize: VALUE_SIZE }}>로딩 중...</p>
          </div>
        ) : isError ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: DOWN_COLOR, fontSize: VALUE_SIZE }}>순위 데이터를 불러올 수 없습니다.</p>
          </div>
        ) : tab === 'wealth' ? (
          <WealthTable
            rankings={wealthQuery.data?.rankings ?? []}
            currentUserId={currentUserId}
          />
        ) : (
          <ReturnsTable
            rankings={returnsQuery.data?.rankings ?? []}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
});
