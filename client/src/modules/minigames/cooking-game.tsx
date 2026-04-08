import { useState, useEffect, useRef, memo } from 'react';
import type { StatAssist } from '../../api/minigames';

// ═══════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════

const COLORS = {
  bgAlt: '#16213e',
  text: '#eaeaea',
  textSecondary: '#a8a8a8',
  accentLight: '#ff6b6b',
  accentDark: '#c92a2a',
};

const INGREDIENTS = ['🥬', '🥔', '🥕', '🍗', '🥚', '🧂', '🧈'];

interface Order {
  id: string;
  ingredients: string[];
  currentIndex: number;
  createdAt: number;
}

interface GameState {
  score: number;
  combo: number;
  orders: Order[];
  gameTime: number;
  maxCombo: number;
}

interface CookingGameProps {
  duration: number;
  statAssist: StatAssist;
  onGameEnd: (score: number, durationSec: number, actionCount: number) => void;
  accentColor: { light: string; dark: string };
}

// ═══════════════════════════════════════════════
// CookingGame Component
// ═══════════════════════════════════════════════

const CookingGame = memo(({ duration, statAssist, onGameEnd, accentColor }: CookingGameProps) => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    combo: 0,
    orders: [],
    gameTime: 0,
    maxCombo: 0,
  });

  const gameRef = useRef<{
    lastOrderTime: number;
    nextOrderDelay: number;
    actionCount: number;
  }>({
    lastOrderTime: 0,
    nextOrderDelay: 2000,
    actionCount: 0,
  });

  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  // Order generation with difficulty scaling
  useEffect(() => {
    const genOrder = () => {
      setGameState((prev) => {
        if (prev.gameTime >= duration) return prev;

        const now = Date.now();
        const elapsed = now - gameRef.current.lastOrderTime;

        if (elapsed < gameRef.current.nextOrderDelay) return prev;

        gameRef.current.lastOrderTime = now;

        // Difficulty: base 2 ingredients, +1 per 20 points
        const baseLen = 2 + Math.floor(prev.score / 200);
        const len = Math.min(4, baseLen);
        const ingredients = Array.from({ length: len }, () =>
          INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]
        );

        // Speed up order generation (2s → 1.2s per 30 combo)
        const speedFactor = Math.max(0.5, 1 - prev.combo * 0.02);
        gameRef.current.nextOrderDelay = 2000 * speedFactor;

        return {
          ...prev,
          orders: [...prev.orders, {
            id: `order-${prev.orders.length}-${now}`,
            ingredients,
            currentIndex: 0,
            createdAt: now,
          }],
        };
      });
    };

    const interval = setInterval(genOrder, 100);
    return () => clearInterval(interval);
  }, [duration]);

  // Game loop: check timeout, update time
  useEffect(() => {
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);

      setGameState((prev) => {
        const newState = { ...prev, gameTime: remaining };

        // Check for timed-out orders (overcook)
        const now = Date.now();
        newState.orders = newState.orders.filter((order) => {
          const orderAge = (now - order.createdAt) / 1000;
          return orderAge < 8; // 8s to complete
        });

        return newState;
      });

      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        onGameEnd(gameState.score, duration, gameRef.current.actionCount);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [duration, gameState.score, onGameEnd]);

  // Handle ingredient click
  const handleIngredientClick = (orderId: string, ingredientIndex: number) => {
    gameRef.current.actionCount++;

    setGameState((prev) => {
      const order = prev.orders.find((o) => o.id === orderId);
      if (!order || ingredientIndex !== order.currentIndex) {
        // Wrong ingredient: reset combo, no points
        return { ...prev, combo: 0 };
      }

      const nextIndex = order.currentIndex + 1;
      if (nextIndex >= order.ingredients.length) {
        // Order complete!
        const basePoints = 50;
        const speedBonus = Math.max(0, 100 - Math.floor((Date.now() - order.createdAt) / 100));
        const comboBonus = prev.combo * 5;
        const totalPoints = basePoints + speedBonus + comboBonus;

        return {
          ...prev,
          score: prev.score + totalPoints,
          combo: prev.combo + 1,
          maxCombo: Math.max(prev.maxCombo, prev.combo + 1),
          orders: prev.orders.filter((o) => o.id !== orderId),
        };
      }

      return {
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, currentIndex: nextIndex } : o
        ),
      };
    });
  };

  const gameTimePercent = (gameState.gameTime / duration) * 100;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: COLORS.bgAlt,
      color: COLORS.text,
      overflow: 'hidden',
    }}>
      {/* HUD */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(0, 0, 0, 0.2)',
        borderBottom: `1px solid ${accentColor.dark}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>점수</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: accentColor.light }}>
              {gameState.score}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>콤보</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: gameState.combo > 0 ? accentColor.light : COLORS.textSecondary }}>
              ×{gameState.combo}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>남은 시간</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: gameState.gameTime > 10 ? accentColor.light : '#ff6b6b' }}>
            {gameState.gameTime.toFixed(1)}초
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        background: 'rgba(0, 0, 0, 0.4)',
        borderBottom: `2px solid ${accentColor.dark}`,
        position: 'relative',
        flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${gameTimePercent}%`,
          background: accentColor.light,
          transition: 'width 0.1s linear',
        }} />
      </div>

      {/* Game area */}
      <div style={{
        flex: 1,
        padding: '16px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {gameState.orders.length === 0 ? (
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.textSecondary,
            fontSize: 12,
          }}>
            주문 대기 중...
          </div>
        ) : (
          gameState.orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onIngredientClick={(idx) => handleIngredientClick(order.id, idx)}
              accentColor={accentColor}
            />
          ))
        )}
      </div>
    </div>
  );
});

CookingGame.displayName = 'CookingGame';

// ═══════════════════════════════════════════════
// Order Card (single order display)
// ═══════════════════════════════════════════════

interface OrderCardProps {
  order: Order;
  onIngredientClick: (index: number) => void;
  accentColor: { light: string; dark: string };
}

const OrderCard = memo(({ order, onIngredientClick, accentColor }: OrderCardProps) => (
  <div style={{
    background: `rgba(${accentColor.dark === '#c92a2a' ? '201,42,42' : '201,42,42'}, 0.2)`,
    border: `1px solid ${accentColor.dark}`,
    borderRadius: 6,
    padding: '12px',
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  }}>
    <div style={{
      fontSize: 20,
      display: 'flex',
      gap: 4,
      flex: 1,
    }}>
      {order.ingredients.map((ing, idx) => (
        <button
          key={idx}
          onClick={() => onIngredientClick(idx)}
          style={{
            padding: '4px 8px',
            background: idx === order.currentIndex ? accentColor.light : 'rgba(0, 0, 0, 0.3)',
            border: idx === order.currentIndex ? `2px solid ${accentColor.light}` : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 32,
            opacity: idx < order.currentIndex ? 0.4 : 1,
            transition: 'all 0.1s',
          }}
          title={`Ingredient ${idx + 1}`}
        >
          {ing}
        </button>
      ))}
    </div>
    <div style={{ fontSize: 10, color: COLORS.textSecondary, minWidth: 40, textAlign: 'right' }}>
      {order.currentIndex}/{order.ingredients.length}
    </div>
  </div>
));

OrderCard.displayName = 'OrderCard';

export default CookingGame;
