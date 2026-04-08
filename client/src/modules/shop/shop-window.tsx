import { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/auth-store';

// ===============================================
// Types
// ===============================================
interface ShopItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'consumable' | 'tool' | 'identity' | 'special';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  stock: number; // -1 = unlimited
  effect: string;
}

type Category = ShopItem['category'];

// ===============================================
// Color & Style Constants
// ===============================================
const COLORS = {
  bg: '#fff',
  bgAlt: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
  accent: '#2563eb',
  buy: '#22c55e',
  buyHover: '#16a34a',
  danger: '#dc2626',
  gold: '#f59e0b',
  goldBg: '#fffbeb',
  rarityCommon: '#6b7280',
  rarityRare: '#3b82f6',
  rarityEpic: '#8b5cf6',
  rarityLegendary: '#f59e0b',
} as const;

const COMPACT = {
  rowH: 28,
  tableRowH: 24,
  headerPad: '6px 8px',
  cellPad: '4px 8px',
  labelFontSize: 10,
  valueFontSize: 11,
  priceFontSize: 12,
  font: "'Inter', system-ui, -apple-system, sans-serif",
} as const;

// ===============================================
// Rarity helpers
// ===============================================
const RARITY_COLORS: Record<ShopItem['rarity'], string> = {
  common: COLORS.rarityCommon,
  rare: COLORS.rarityRare,
  epic: COLORS.rarityEpic,
  legendary: COLORS.rarityLegendary,
};

const RARITY_LABELS: Record<ShopItem['rarity'], string> = {
  common: '일반',
  rare: '레어',
  epic: '에픽',
  legendary: '전설',
};

const RARITY_BG: Record<ShopItem['rarity'], string> = {
  common: '#f3f4f6',
  rare: '#eff6ff',
  epic: '#f5f3ff',
  legendary: '#fffbeb',
};

// ===============================================
// Category definitions
// ===============================================
const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'consumable', label: '소모품', icon: 'tabler:flask' },
  { key: 'tool', label: '도구', icon: 'tabler:tool' },
  { key: 'identity', label: '정체성', icon: 'tabler:masks-theater' },
  { key: 'special', label: '특별', icon: 'tabler:sparkles' },
];

// ===============================================
// Shop Item Data (hardcoded, will be API later)
// ===============================================
const SHOP_ITEMS: ShopItem[] = [
  // Consumables
  {
    id: 'loss-care-10',
    name: '손실 케어 쿠폰 (10%)',
    description: '매도 시 손실금액을 10% 감면해주는 쿠폰입니다. 자동으로 다음 매도에 적용됩니다.',
    price: 500,
    category: 'consumable',
    rarity: 'common',
    icon: 'tabler:shield',
    stock: -1,
    effect: '매도 시 손실 10% 감면',
  },
  {
    id: 'loss-care-30',
    name: '손실 케어 쿠폰 (30%)',
    description: '매도 시 손실금액을 30% 감면해주는 프리미엄 쿠폰입니다. 큰 손실을 방어하세요!',
    price: 1500,
    category: 'consumable',
    rarity: 'rare',
    icon: 'tabler:shield',
    stock: -1,
    effect: '매도 시 손실 30% 감면',
  },
  {
    id: 'seal-charm',
    name: '돌발 봉인 부적',
    description: '30분간 캐릭터의 돌발 행동을 억제합니다. 중요한 투자 전에 사용하세요.',
    price: 800,
    category: 'consumable',
    rarity: 'common',
    icon: 'tabler:rosette',
    stock: -1,
    effect: '30분간 돌발 행동 억제',
  },
  {
    id: 'stat-booster',
    name: '스텟 부스터',
    description: '30분간 랜덤 스텟이 +2 증가합니다. 어떤 스텟이 올라갈지는 운에 달렸어요!',
    price: 1000,
    category: 'consumable',
    rarity: 'rare',
    icon: 'tabler:bolt',
    stock: -1,
    effect: '30분간 랜덤 스텟 +2',
  },
  {
    id: 'double-pay',
    name: '알바 더블페이',
    description: '다음 알바에서 수익이 2배가 됩니다. 고수익 알바 전에 사용하면 효과적!',
    price: 600,
    category: 'consumable',
    rarity: 'common',
    icon: 'tabler:moneybag',
    stock: -1,
    effect: '다음 알바 수익 2배',
  },
  {
    id: 'market-info',
    name: '시장 정보지',
    description: '1시간 동안 주가 변동 힌트를 제공합니다. 투자의 핵심 정보를 미리 확인하세요.',
    price: 2000,
    category: 'consumable',
    rarity: 'epic',
    icon: 'tabler:news',
    stock: -1,
    effect: '1시간 주가 변동 힌트',
  },
  {
    id: 'sedative',
    name: '진정제',
    description: '캐릭터의 컨디션을 즉시 50% 회복합니다. 컨디션이 낮을 때 긴급 사용!',
    price: 400,
    category: 'consumable',
    rarity: 'common',
    icon: 'tabler:pill',
    stock: -1,
    effect: '컨디션 즉시 50% 회복',
  },
  {
    id: 'lucky-dice',
    name: '행운의 주사위',
    description: '다음 투자에 랜덤 보정치가 적용됩니다. 행운이 따를지, 불운이 따를지...',
    price: 300,
    category: 'consumable',
    rarity: 'common',
    icon: 'tabler:dice',
    stock: -1,
    effect: '다음 투자에 랜덤 보정',
  },

  // Tools
  {
    id: 'premium-knife',
    name: '고급 칼',
    description: '요리 알바에서 효율이 20% 증가합니다. 도구 슬롯에 장착하여 사용하세요.',
    price: 3000,
    category: 'tool',
    rarity: 'rare',
    icon: 'tabler:knife',
    stock: 5,
    effect: '요리 알바 효율 +20%',
  },
  {
    id: 'premium-keyboard',
    name: '고급 키보드',
    description: '타자 알바에서 효율이 20% 증가합니다. 기계식의 타건감을 느껴보세요!',
    price: 3000,
    category: 'tool',
    rarity: 'rare',
    icon: 'tabler:keyboard',
    stock: 5,
    effect: '타자 알바 효율 +20%',
  },
  {
    id: 'precision-tools',
    name: '정밀 도구',
    description: '제작 품질이 30% 향상됩니다. 정교한 작업이 필요할 때 필수 아이템!',
    price: 5000,
    category: 'tool',
    rarity: 'epic',
    icon: 'tabler:tool',
    stock: 3,
    effect: '제작 품질 +30%',
  },

  // Identity
  {
    id: 'meditator',
    name: '명상가',
    description: '멘탈 스텟이 +3 증가합니다. 정체성 슬롯에 장착하여 효과를 받으세요.',
    price: 2000,
    category: 'identity',
    rarity: 'rare',
    icon: 'tabler:yoga',
    stock: 3,
    effect: '멘탈 +3',
  },
  {
    id: 'scholar',
    name: '학자',
    description: '꼼꼼함 스텟이 +5 증가합니다. 투자 분석에 큰 도움이 됩니다.',
    price: 2500,
    category: 'identity',
    rarity: 'epic',
    icon: 'tabler:books',
    stock: 3,
    effect: '꼼꼼함 +5',
  },
  {
    id: 'gambler',
    name: '겜블러',
    description: '행동력 +4, 운 +2가 증가합니다. 대담한 투자 성향의 정체성입니다.',
    price: 1800,
    category: 'identity',
    rarity: 'rare',
    icon: 'tabler:dice',
    stock: 3,
    effect: '행동력 +4, 운 +2',
  },

  // Special (limited items)
  {
    id: 'golden-ticket',
    name: '골든 티켓',
    description: '특별한 이벤트에 참여할 수 있는 황금 티켓입니다. 매우 희귀한 아이템!',
    price: 10000,
    category: 'special',
    rarity: 'legendary',
    icon: 'tabler:ticket',
    stock: 1,
    effect: '특별 이벤트 참여권',
  },
  {
    id: 'time-warp',
    name: '시간 가속기',
    description: '모든 쿨타임을 50% 단축시킵니다. 효율적인 플레이의 비밀 무기!',
    price: 8000,
    category: 'special',
    rarity: 'legendary',
    icon: 'tabler:clock-bolt',
    stock: 2,
    effect: '모든 쿨타임 50% 단축',
  },
];

// ===============================================
// Purchase animation (coin burst effect)
// ===============================================
interface CoinParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  scale: number;
}

function PurchaseEffect({ active, onDone }: { active: boolean; onDone: () => void }) {
  const [particles, setParticles] = useState<CoinParticle[]>([]);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!active) return;

    const newParticles: CoinParticle[] = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 6,
      vy: -Math.random() * 4 - 2,
      opacity: 1,
      scale: 0.6 + Math.random() * 0.6,
    }));
    setParticles(newParticles);

    let frame = 0;
    const animate = () => {
      frame++;
      setParticles((prev) =>
        prev.map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.15,
          opacity: Math.max(0, p.opacity - 0.04),
          scale: p.scale * 0.97,
        })),
      );
      if (frame < 30) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setParticles([]);
        onDone();
      }
    };
    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active, onDone]);

  if (!active || particles.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {particles.map((p) => (
        <span
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            opacity: p.opacity,
            transform: `scale(${p.scale})`,
            fontSize: 14,
            userSelect: 'none',
          }}
        >
          <Icon icon="tabler:coin" width={14} />
        </span>
      ))}
    </div>
  );
}

// ===============================================
// Category Tab Button
// ===============================================
const CategoryTab = memo(({
  category,
  active,
  onClick,
}: {
  category: { key: Category; label: string; icon: string };
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      flex: 1,
      padding: '6px 4px',
      fontSize: COMPACT.labelFontSize,
      fontWeight: active ? 600 : 400,
      color: active ? COLORS.accent : COLORS.textSecondary,
      background: active ? '#eff6ff' : 'transparent',
      border: 'none',
      borderBottom: active ? `2px solid ${COLORS.accent}` : '2px solid transparent',
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      whiteSpace: 'nowrap',
    }}
  >
    <Icon icon={category.icon} width={12} />
    {category.label}
  </button>
));

// ===============================================
// Item Row (left panel list item)
// ===============================================
const ItemRow = memo(({
  item,
  isSelected,
  canAfford,
  onClick,
}: {
  item: ShopItem;
  isSelected: boolean;
  canAfford: boolean;
  onClick: () => void;
}) => {
  const [hovered, setHovered] = useState(false);
  const rarityColor = RARITY_COLORS[item.rarity];
  const isOutOfStock = item.stock === 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
        background: isSelected
          ? '#eff6ff'
          : hovered
            ? '#f9fafb'
            : COLORS.bg,
        borderBottom: `1px solid ${COLORS.border}`,
        borderLeft: isSelected ? `3px solid ${COLORS.accent}` : '3px solid transparent',
        opacity: isOutOfStock ? 0.5 : 1,
        transition: 'background 0.1s ease',
      }}
    >
      {/* Icon with rarity border */}
      <div style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        border: `2px solid ${rarityColor}`,
        background: RARITY_BG[item.rarity],
        flexShrink: 0,
      }}>
        <Icon icon={item.icon} width={16} />
      </div>

      {/* Name + effect */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          fontSize: COMPACT.valueFontSize,
          fontWeight: 600,
          color: COLORS.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.name}
        </div>
        <div style={{
          fontSize: 9,
          color: COLORS.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {item.effect}
        </div>
      </div>

      {/* Price + stock */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{
          fontSize: COMPACT.valueFontSize,
          fontWeight: 600,
          color: canAfford ? COLORS.gold : COLORS.danger,
        }}>
          {item.price.toLocaleString()}G
        </div>
        <div style={{
          fontSize: 9,
          color: isOutOfStock ? COLORS.danger : COLORS.textSecondary,
        }}>
          {isOutOfStock ? '품절' : item.stock === -1 ? '재고:~' : `재고:${item.stock}`}
        </div>
      </div>
    </div>
  );
});

// ===============================================
// Detail Panel (right panel)
// ===============================================
const DetailPanel = memo(({
  item,
  quantity,
  onQuantityChange,
  onBuy,
  canAfford,
  isPurchasing,
  userGold,
}: {
  item: ShopItem | null;
  quantity: number;
  onQuantityChange: (q: number) => void;
  onBuy: () => void;
  canAfford: boolean;
  isPurchasing: boolean;
  userGold: number;
}) => {
  if (!item) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: COLORS.textSecondary,
        fontSize: COMPACT.valueFontSize,
        padding: 16,
        gap: 8,
      }}>
        <Icon icon="tabler:building-store" width={32} style={{ opacity: 0.4 }} />
        <span>아이템을 선택하세요</span>
      </div>
    );
  }

  const rarityColor = RARITY_COLORS[item.rarity];
  const totalPrice = item.price * quantity;
  const isOutOfStock = item.stock === 0;
  const maxQuantity = item.stock === -1 ? 99 : item.stock;
  const canBuy = canAfford && !isOutOfStock && quantity > 0 && !isPurchasing;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: 10,
      gap: 10,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Item icon + name + rarity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: `2px solid ${rarityColor}`,
          background: RARITY_BG[item.rarity],
          flexShrink: 0,
        }}>
          <Icon icon={item.icon} width={24} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            color: COLORS.text,
          }}>
            {item.name}
          </div>
          <span style={{
            display: 'inline-block',
            fontSize: 9,
            fontWeight: 600,
            color: rarityColor,
            background: RARITY_BG[item.rarity],
            border: `1px solid ${rarityColor}`,
            borderRadius: 3,
            padding: '1px 5px',
            marginTop: 2,
          }}>
            {RARITY_LABELS[item.rarity]}
          </span>
        </div>
      </div>

      {/* Description */}
      <div style={{
        fontSize: COMPACT.valueFontSize,
        color: COLORS.textSecondary,
        lineHeight: 1.5,
        padding: '6px 8px',
        background: COLORS.bgAlt,
        borderRadius: 4,
        border: `1px solid ${COLORS.border}`,
      }}>
        {item.description}
      </div>

      {/* Effect */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: '#f0fdf4',
        borderRadius: 4,
        border: '1px solid #bbf7d0',
      }}>
        <span style={{ fontSize: 11 }}>✦</span>
        <span style={{
          fontSize: COMPACT.valueFontSize,
          fontWeight: 600,
          color: '#15803d',
        }}>
          {item.effect}
        </span>
      </div>

      {/* Price info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 8px',
        background: COLORS.goldBg,
        borderRadius: 4,
        border: '1px solid #fde68a',
      }}>
        <span style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary }}>
          단가
        </span>
        <span style={{
          fontSize: COMPACT.priceFontSize,
          fontWeight: 700,
          color: COLORS.gold,
        }}>
          {item.price.toLocaleString()}G
        </span>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Quantity selector */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: COMPACT.labelFontSize, color: COLORS.textSecondary }}>
          수량
        </span>
        <button
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            background: COLORS.bg,
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 700,
            cursor: quantity <= 1 ? 'default' : 'pointer',
            opacity: quantity <= 1 ? 0.4 : 1,
          }}
        >
          -
        </button>
        <span style={{
          width: 28,
          textAlign: 'center',
          fontSize: COMPACT.priceFontSize,
          fontWeight: 700,
          color: COLORS.text,
        }}>
          {quantity}
        </span>
        <button
          onClick={() => onQuantityChange(Math.min(maxQuantity, quantity + 1))}
          disabled={quantity >= maxQuantity}
          style={{
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${COLORS.border}`,
            borderRadius: 4,
            background: COLORS.bg,
            color: COLORS.text,
            fontSize: 13,
            fontWeight: 700,
            cursor: quantity >= maxQuantity ? 'default' : 'pointer',
            opacity: quantity >= maxQuantity ? 0.4 : 1,
          }}
        >
          +
        </button>
      </div>

      {/* Total + Buy button */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {quantity > 1 && (
          <div style={{
            textAlign: 'center',
            fontSize: COMPACT.labelFontSize,
            color: COLORS.textSecondary,
          }}>
            합계: <span style={{ fontWeight: 600, color: COLORS.gold }}>
              {totalPrice.toLocaleString()}G
            </span>
          </div>
        )}
        <BuyButton
          onClick={onBuy}
          disabled={!canBuy}
          totalPrice={totalPrice}
          canAfford={canAfford}
          isOutOfStock={isOutOfStock}
          isPurchasing={isPurchasing}
        />
        {!canAfford && !isOutOfStock && (
          <div style={{
            textAlign: 'center',
            fontSize: 9,
            color: COLORS.danger,
          }}>
            골드가 부족합니다 (보유: {userGold.toLocaleString()}G)
          </div>
        )}
      </div>
    </div>
  );
});

// ===============================================
// Buy Button with hover effect
// ===============================================
function BuyButton({
  onClick,
  disabled,
  totalPrice,
  canAfford,
  isOutOfStock,
  isPurchasing,
}: {
  onClick: () => void;
  disabled: boolean;
  totalPrice: number;
  canAfford: boolean;
  isOutOfStock: boolean;
  isPurchasing: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  let label: string;
  let bg: string;

  if (isPurchasing) {
    label = '구매 중...';
    bg = COLORS.textSecondary;
  } else if (isOutOfStock) {
    label = '품절';
    bg = COLORS.textSecondary;
  } else if (!canAfford) {
    label = `골드 부족 ${totalPrice.toLocaleString()}G`;
    bg = COLORS.textSecondary;
  } else {
    label = `구매하기 ${totalPrice.toLocaleString()}G`;
    bg = hovered ? COLORS.buyHover : COLORS.buy;
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '8px 12px',
        background: bg,
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: COMPACT.valueFontSize,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.7 : 1,
        transition: 'background 0.15s ease, transform 0.1s ease',
        transform: hovered && !disabled ? 'scale(1.02)' : 'scale(1)',
        letterSpacing: 0.3,
      }}
    >
      {label}
    </button>
  );
}

// ===============================================
// Purchase success toast
// ===============================================
function PurchaseToast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;

  return (
    <div style={{
      position: 'absolute',
      top: 8,
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#15803d',
      color: '#fff',
      padding: '6px 14px',
      borderRadius: 6,
      fontSize: COMPACT.valueFontSize,
      fontWeight: 600,
      zIndex: 20,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      whiteSpace: 'nowrap',
      animation: 'shopToastSlide 0.3s ease',
    }}>
      {message}
    </div>
  );
}

// ===============================================
// Main ShopWindow Component
// ===============================================
export default function ShopWindow() {
  const user = useAuthStore((s) => s.user);
  const [activeCategory, setActiveCategory] = useState<Category>('consumable');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchaseEffect, setPurchaseEffect] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [localStockOverrides, setLocalStockOverrides] = useState<Record<string, number>>({});
  const [localGoldOffset, setLocalGoldOffset] = useState(0);

  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Derived gold
  const userGold = (user?.gold ?? 0) + localGoldOffset;

  // Filtered items by category
  const filteredItems = useMemo(() =>
    SHOP_ITEMS.filter((item) => item.category === activeCategory).map((item) => ({
      ...item,
      stock: localStockOverrides[item.id] ?? item.stock,
    })),
    [activeCategory, localStockOverrides],
  );

  // Selected item
  const selectedItem = useMemo(() =>
    filteredItems.find((item) => item.id === selectedItemId) ?? null,
    [filteredItems, selectedItemId],
  );

  // Can afford check
  const canAfford = selectedItem
    ? userGold >= selectedItem.price * quantity
    : false;

  // Handle category change
  const handleCategoryChange = useCallback((category: Category) => {
    setActiveCategory(category);
    setSelectedItemId(null);
    setQuantity(1);
  }, []);

  // Handle item select
  const handleItemSelect = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    setQuantity(1);
  }, []);

  // Show toast
  const showToast = useCallback((message: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimeoutRef.current = setTimeout(() => {
      setToastVisible(false);
    }, 2000);
  }, []);

  // Handle purchase
  const handleBuy = useCallback(() => {
    if (!selectedItem || !canAfford) return;

    const totalPrice = selectedItem.price * quantity;

    // Deduct gold locally
    setLocalGoldOffset((prev) => prev - totalPrice);

    // Update stock locally
    if (selectedItem.stock !== -1) {
      setLocalStockOverrides((prev) => ({
        ...prev,
        [selectedItem.id]: Math.max(0, (prev[selectedItem.id] ?? selectedItem.stock) - quantity),
      }));
    }

    // Show effects
    setPurchaseEffect(true);
    showToast(`${selectedItem.name} x${quantity} 구매 완료!`);

    // Reset quantity
    setQuantity(1);
  }, [selectedItem, canAfford, quantity, showToast]);

  // Clear purchase effect
  const handlePurchaseEffectDone = useCallback(() => {
    setPurchaseEffect(false);
  }, []);

  // Inject keyframe animation
  useEffect(() => {
    const styleId = 'shop-window-animations';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes shopToastSlide {
        from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

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
      position: 'relative',
    }}>
      {/* Toast notification */}
      <PurchaseToast message={toastMessage} visible={toastVisible} />

      {/* Header: category tabs + gold display */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.bg,
        flexShrink: 0,
      }}>
        {/* Category tabs */}
        <div style={{
          display: 'flex',
          flex: 1,
          gap: 1,
        }}>
          {CATEGORIES.map((cat) => (
            <CategoryTab
              key={cat.key}
              category={cat}
              active={activeCategory === cat.key}
              onClick={() => handleCategoryChange(cat.key)}
            />
          ))}
        </div>

        {/* Gold display */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 10px',
          background: COLORS.goldBg,
          borderLeft: `1px solid ${COLORS.border}`,
          flexShrink: 0,
        }}>
          <Icon icon="tabler:moneybag" width={13} />
          <span style={{
            fontSize: COMPACT.priceFontSize,
            fontWeight: 700,
            color: COLORS.gold,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {userGold.toLocaleString()}G
          </span>
        </div>
      </div>

      {/* Main content: item list + detail panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        {/* Left panel: item list */}
        <div style={{
          width: '50%',
          borderRight: `1px solid ${COLORS.border}`,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          {/* Column header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: COMPACT.headerPad,
            background: COLORS.bgAlt,
            borderBottom: `1px solid ${COLORS.border}`,
            fontSize: COMPACT.labelFontSize,
            fontWeight: 600,
            color: COLORS.textSecondary,
            flexShrink: 0,
          }}>
            <span>아이템 ({filteredItems.length})</span>
            <span>가격</span>
          </div>

          {/* Scrollable item list */}
          <div style={{
            flex: 1,
            overflow: 'auto',
          }}>
            {filteredItems.length === 0 ? (
              <div style={{
                padding: 20,
                textAlign: 'center',
                color: COLORS.textSecondary,
                fontSize: COMPACT.valueFontSize,
              }}>
                <div style={{ marginBottom: 8, opacity: 0.4 }}><Icon icon="tabler:package" width={24} /></div>
                이 카테고리에 상품이 없습니다.
              </div>
            ) : (
              filteredItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  isSelected={selectedItemId === item.id}
                  canAfford={userGold >= item.price}
                  onClick={() => item.stock !== 0 && handleItemSelect(item.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right panel: item detail */}
        <div style={{
          width: '50%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          position: 'relative',
        }}>
          <PurchaseEffect active={purchaseEffect} onDone={handlePurchaseEffectDone} />
          <DetailPanel
            item={selectedItem}
            quantity={quantity}
            onQuantityChange={setQuantity}
            onBuy={handleBuy}
            canAfford={canAfford}
            isPurchasing={false}
            userGold={userGold}
          />
        </div>
      </div>

      {/* NPC shopkeeper footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 10px',
        background: COLORS.bgAlt,
        borderTop: `1px solid ${COLORS.border}`,
        flexShrink: 0,
      }}>
        <Icon icon="tabler:cat" width={14} />
        <span style={{
          fontSize: 10,
          color: COLORS.textSecondary,
          fontStyle: 'italic',
        }}>
          "어서 오세요~ 필요한 게 있으면 말씀해 주세요냥!"
        </span>
      </div>
    </div>
  );
}
