import { useState, memo, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../stores/auth-store';
import { useSavings, useOpenSavings, useCancelSavings, type SavingsAccount } from '../../api/banking';

// ═══════════════════════════════════════════════
// Color & Style Constants
// ═══════════════════════════════════════════════
const COLORS = {
  bg: '#fff',
  bgAlt: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
  up: '#16a34a',
  down: '#dc2626',
  accent: '#2563eb',
} as const;

// ═══════════════════════════════════════════════
// Compact Row Heights & Paddings
// ═══════════════════════════════════════════════
const COMPACT = {
  rowH: 28,
  tableRowH: 24,
  headerPad: '6px 8px',
  cellPad: '4px 8px',
  labelFontSize: 10,
  valueFontSize: 11,
  font: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

// ═══════════════════════════════════════════════
// Product Definitions (game-level high interest rates)
// ═══════════════════════════════════════════════
const PRODUCTS = [
  { name: '초단기', termMinutes: 10, rate: 2 },    // 10 minutes, 2%
  { name: '단기', termMinutes: 30, rate: 5 },      // 30 minutes, 5%
  { name: '1시간', termMinutes: 60, rate: 10 },    // 1 hour, 10%
  { name: '6시간', termMinutes: 360, rate: 25 },   // 6 hours, 25%
  { name: '12시간', termMinutes: 720, rate: 40 },  // 12 hours, 40%
  { name: '24시간', termMinutes: 1440, rate: 60 }, // 24 hours, 60%
];

// ═══════════════════════════════════════════════
// Helper: Format countdown
// ═══════════════════════════════════════════════
function formatCountdown(maturesAt: Date | string): string {
  const maturesTime = typeof maturesAt === 'string' ? new Date(maturesAt).getTime() : maturesAt.getTime();
  const now = Date.now();
  const diffMs = maturesTime - now;

  if (diffMs <= 0) return '완료';

  const diffS = Math.floor(diffMs / 1000);
  const days = Math.floor(diffS / 86400);
  const hours = Math.floor((diffS % 86400) / 3600);
  const minutes = Math.floor((diffS % 3600) / 60);
  const seconds = diffS % 60;

  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}

// ═══════════════════════════════════════════════
// Product Card
// ═══════════════════════════════════════════════
const ProductCard = memo(({ product }: { product: typeof PRODUCTS[0] }) => {
  const [amount, setAmount] = useState('');
  const mutation = useOpenSavings();
  const user = useAuthStore((s) => s.user);

  const handleOpenSavings = useCallback(() => {
    const principal = parseInt(amount, 10);
    if (!user || !amount || principal <= 0) return;

    mutation.mutate({
      userId: user.id,
      principal,
      productName: product.name,
      interestRate: product.rate,
      termMinutes: product.termMinutes,
    });

    if (!mutation.isPending) {
      setAmount('');
    }
  }, [amount, product, user, mutation]);

  return (
    <div style={{
      border: `1px solid ${COLORS.border}`,
      borderRadius: 4,
      padding: '8px',
      background: COLORS.bg,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ fontSize: COMPACT.valueFontSize, fontWeight: 600, color: COLORS.text }}>
        {product.name}
      </div>
      <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary }}>
        기간: {product.termMinutes < 60 ? `${product.termMinutes}분` : product.termMinutes < 1440 ? `${Math.round(product.termMinutes / 60)}시간` : '1일'}
      </div>
      <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.accent, fontWeight: 600 }}>
        금리: {product.rate.toFixed(1)}%
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <input
          type="number"
          placeholder="금액"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1,
            padding: '4px 6px',
            fontSize: COMPACT.valueFontSize,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 3,
            background: COLORS.bg,
            color: COLORS.text,
            fontFamily: COMPACT.font,
          }}
        />
      </div>
      <button
        onClick={handleOpenSavings}
        disabled={!amount || parseInt(amount, 10) <= 0 || mutation.isPending}
        style={{
          padding: '4px 8px',
          background: mutation.isPending ? COLORS.border : COLORS.accent,
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          fontSize: COMPACT.valueFontSize,
          fontWeight: 600,
          cursor: mutation.isPending || !amount ? 'default' : 'pointer',
          opacity: mutation.isPending || !amount ? 0.6 : 1,
        }}>
        {mutation.isPending ? '가입 중...' : '가입'}
      </button>
      {mutation.isError && (
        <div style={{ fontSize: COMPACT.labelFontSize, color: COLORS.down }}>
          {mutation.error?.message}
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════
// Savings Row
// ═══════════════════════════════════════════════
const SavingsRow = memo(({ account }: { account: SavingsAccount }) => {
  const mutation = useCancelSavings();
  const user = useAuthStore((s) => s.user);

  const handleCancel = useCallback(() => {
    if (!user) return;
    mutation.mutate({ accountId: account.id, userId: user.id });
  }, [account.id, user, mutation]);

  const isMatured = account.status === 'matured';
  const countdownText = formatCountdown(account.maturesAt);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 80px 60px 100px 60px 70px',
      gap: 8,
      alignItems: 'center',
      padding: COMPACT.cellPad,
      borderBottom: `1px solid ${COLORS.border}`,
      fontSize: COMPACT.valueFontSize,
      height: COMPACT.tableRowH,
    }}>
      <div style={{ fontWeight: 500, color: COLORS.text }}>{account.productName}</div>
      <div style={{ color: COLORS.textSecondary }}>{account.principal.toLocaleString()}</div>
      <div style={{ color: COLORS.accent, fontWeight: 600 }}>{account.interestRate.toFixed(1)}%</div>
      <div style={{ color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
        {countdownText}
      </div>
      <div style={{
        color: isMatured ? COLORS.up : COLORS.textSecondary,
        fontSize: COMPACT.labelFontSize,
        fontWeight: 500,
      }}>
        {isMatured ? '완료' : '진행'}
      </div>
      <button
        onClick={handleCancel}
        disabled={isMatured && account.status !== 'matured' || mutation.isPending}
        style={{
          padding: '2px 6px',
          background: isMatured ? COLORS.up : COLORS.down,
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          fontSize: COMPACT.labelFontSize,
          fontWeight: 600,
          cursor: mutation.isPending ? 'default' : 'pointer',
          opacity: mutation.isPending ? 0.6 : 1,
        }}>
        {mutation.isPending ? '처리 중...' : isMatured ? '수령' : '해지'}
      </button>
    </div>
  );
});

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════
export default function BankingWindow() {
  const user = useAuthStore((s) => s.user);
  const { data: savingsData, isLoading } = useSavings(user?.id ?? '');

  const accounts = savingsData?.accounts ?? [];
  const activeAccounts = useMemo(() => accounts.filter((a) => a.status === 'active' || a.status === 'matured'), [accounts]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: COLORS.bg,
      color: COLORS.text,
      fontFamily: COMPACT.font,
      fontSize: COMPACT.valueFontSize,
      overflow: 'hidden',
    }}>
      {/* Products Section */}
      <div style={{ padding: 8, borderBottom: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        <div style={{ fontSize: COMPACT.labelFontSize, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6 }}>
          적금 상품
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 6,
          maxHeight: 280,
          overflow: 'auto',
        }}>
          {PRODUCTS.map((product) => (
            <ProductCard key={product.name} product={product} />
          ))}
        </div>
      </div>

      {/* Savings Section */}
      <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: COMPACT.labelFontSize, fontWeight: 600, color: COLORS.textSecondary, marginBottom: 6 }}>
          내 적금 ({activeAccounts.length})
        </div>

        {isLoading ? (
          <div style={{ color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize }}>
            로딩 중...
          </div>
        ) : activeAccounts.length === 0 ? (
          <div style={{ color: COLORS.textSecondary, fontSize: COMPACT.labelFontSize, textAlign: 'center', padding: '20px 0' }}>
            가입된 적금이 없습니다.
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header Row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '80px 80px 60px 100px 60px 70px',
              gap: 8,
              padding: COMPACT.cellPad,
              background: COLORS.bgAlt,
              borderBottom: `1px solid ${COLORS.border}`,
              fontSize: COMPACT.labelFontSize,
              fontWeight: 600,
              color: COLORS.textSecondary,
              height: COMPACT.tableRowH,
            }}>
              <div>상품</div>
              <div>원금</div>
              <div>금리</div>
              <div>남은 시간</div>
              <div>상태</div>
              <div>액션</div>
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {activeAccounts.map((account) => (
                <SavingsRow key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
