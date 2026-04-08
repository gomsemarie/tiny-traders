import { useState, useEffect, useRef, memo } from 'react';
import type { StatAssist } from '../../api/minigames';

// ═══════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════

const COLORS = {
  bgAlt: '#16213e',
  text: '#eaeaea',
  textSecondary: '#a8a8a8',
  accentLight: '#f7b731',
  accentDark: '#e58e26',
};

const BOX_COLORS = [
  { id: 'red', color: '#e74c3c', emoji: '🔴' },
  { id: 'blue', color: '#3498db', emoji: '🔵' },
  { id: 'green', color: '#2ecc71', emoji: '🟢' },
];

interface Box {
  id: string;
  correctColor: string;
  createdAt: number;
}

interface GameState {
  score: number;
  combo: number;
  boxes: Box[];
  gameTime: number;
  maxCombo: number;
  sortMode: '2way' | '3way';
}

interface SortingGameProps {
  duration: number;
  statAssist: StatAssist;
  onGameEnd: (score: number, durationSec: number, actionCount: number) => void;
  accentColor: { light: string; dark: string };
}

// ═══════════════════════════════════════════════
// SortingGame Component
// ═══════════════════════════════════════════════

const SortingGame = memo(({ duration, statAssist, onGameEnd, accentColor }: SortingGameProps) => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    combo: 0,
    boxes: [],
    gameTime: 0,
    maxCombo: 0,
    sortMode: '2way',
  });

  const gameRef = useRef<{
    lastBoxTime: number;
    nextBoxDelay: number;
    actionCount: number;
    keys: Record<string, boolean>;
  }>({
    lastBoxTime: 0,
    nextBoxDelay: 2000,
    actionCount: 0,
    keys: {},
  });

  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['a', 's', 'd'].includes(key)) {
        e.preventDefault();
        gameRef.current.keys[key] = true;
        gameRef.current.actionCount++;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['a', 's', 'd'].includes(key)) {
        gameRef.current.keys[key] = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Box generation with difficulty scaling
  useEffect(() => {
    const genBox = () => {
      setGameState((prev) => {
        if (prev.gameTime >= duration) return prev;

        const now = Date.now();
        const elapsed = now - gameRef.current.lastBoxTime;

        if (elapsed < gameRef.current.nextBoxDelay) return prev;

        gameRef.current.lastBoxTime = now;

        // Determine sort mode: 2-way at first, 3-way after 300 score
        const newSortMode: '2way' | '3way' = prev.score >= 300 ? '3way' : '2way';

        // Select random box color
        const maxColors = newSortMode === '3way' ? 3 : 2;
        const colors = BOX_COLORS.slice(0, maxColors);
        const correctColor = colors[Math.floor(Math.random() * colors.length)].id;

        // Speed up box generation (2s → 1s per 300 score)
        const speedFactor = Math.max(0.5, 1 - prev.score / 3000);
        gameRef.current.nextBoxDelay = 2000 * speedFactor;

        return {
          ...prev,
          boxes: [...prev.boxes, {
            id: `box-${prev.boxes.length}-${now}`,
            correctColor,
            createdAt: now,
          }],
          sortMode: newSortMode,
        };
      });
    };

    const interval = setInterval(genBox, 100);
    return () => clearInterval(interval);
  }, [duration]);

  // Game loop
  useEffect(() => {
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);

      setGameState((prev) => {
        const newState = { ...prev, gameTime: remaining };

        // Check for timed-out boxes (8s to sort)
        const now = Date.now();
        newState.boxes = newState.boxes.filter((box) => {
          const boxAge = (now - box.createdAt) / 1000;
          return boxAge < 8;
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

  // Handle sorting
  const handleSort = (boxId: string, direction: 'left' | 'middle' | 'right') => {
    const box = gameState.boxes.find((b) => b.id === boxId);
    if (!box) return;

    setGameState((prev) => {
      const colors = prev.sortMode === '3way' ? BOX_COLORS : BOX_COLORS.slice(0, 2);
      let correct = false;

      if (direction === 'left' && box.correctColor === colors[0].id) correct = true;
      if (direction === 'middle' && box.correctColor === colors[1].id) correct = true;
      if (direction === 'right' && (colors[2]?.id === box.correctColor || (prev.sortMode === '2way' && direction === 'right'))) correct = true;

      if (!correct) {
        return { ...prev, combo: 0 };
      }

      const basePoints = 50;
      const comboBonus = prev.combo * 5;
      const totalPoints = basePoints + comboBonus;

      return {
        ...prev,
        score: prev.score + totalPoints,
        combo: prev.combo + 1,
        maxCombo: Math.max(prev.maxCombo, prev.combo + 1),
        boxes: prev.boxes.filter((b) => b.id !== boxId),
      };
    });
  };

  // Check for key presses to handle sorting
  useEffect(() => {
    if (!gameState.boxes.length) return;

    const currentBox = gameState.boxes[0];
    if (!currentBox) return;

    if (gameRef.current.keys['a']) {
      handleSort(currentBox.id, 'left');
      gameRef.current.keys['a'] = false;
    } else if (gameRef.current.keys['s'] && gameState.sortMode === '3way') {
      handleSort(currentBox.id, 'middle');
      gameRef.current.keys['s'] = false;
    } else if (gameRef.current.keys['d']) {
      handleSort(currentBox.id, gameState.sortMode === '3way' ? 'right' : 'right');
      gameRef.current.keys['d'] = false;
    }
  }, [gameState.boxes, gameState.sortMode]);

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
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>모드</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: accentColor.light }}>
              {gameState.sortMode === '2way' ? 'A/D' : 'A/S/D'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>남은 시간</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: gameState.gameTime > 10 ? accentColor.light : '#ff6b6b' }}>
              {gameState.gameTime.toFixed(1)}초
            </div>
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
        padding: '20px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Conveyor belt simulation */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
        }}>
          {gameState.boxes.length === 0 ? (
            <div style={{
              color: COLORS.textSecondary,
              fontSize: 12,
            }}>
              상자 준비 중...
            </div>
          ) : (
            <BoxCard
              box={gameState.boxes[0]}
              sortMode={gameState.sortMode}
              onSort={(direction) => handleSort(gameState.boxes[0].id, direction)}
              accentColor={accentColor}
            />
          )}

          {/* Queue preview */}
          {gameState.boxes.length > 1 && (
            <div style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              opacity: 0.5,
            }}>
              {gameState.boxes.slice(1, 4).map((box) => {
                const color = BOX_COLORS.find((c) => c.id === box.correctColor);
                return (
                  <div
                    key={box.id}
                    style={{
                      width: 40,
                      height: 40,
                      background: color?.color,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                    }}
                  >
                    📦
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sorting bins */}
        <SortingBins sortMode={gameState.sortMode} accentColor={accentColor} />
      </div>
    </div>
  );
});

SortingGame.displayName = 'SortingGame';

// ═══════════════════════════════════════════════
// BoxCard (current box to sort)
// ═══════════════════════════════════════════════

interface BoxCardProps {
  box: Box;
  sortMode: '2way' | '3way';
  onSort: (direction: 'left' | 'middle' | 'right') => void;
  accentColor: { light: string; dark: string };
}

const BoxCard = memo(({ box, sortMode, onSort, accentColor }: BoxCardProps) => {
  const color = BOX_COLORS.find((c) => c.id === box.correctColor);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        width: 80,
        height: 80,
        background: color?.color,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 48,
        border: `3px solid ${accentColor.light}`,
        boxShadow: `0 0 16px ${color?.color}80`,
      }}>
        📦
      </div>

      <div style={{
        display: 'flex',
        gap: 8,
      }}>
        <button
          onClick={() => onSort('left')}
          style={{
            padding: '8px 16px',
            background: BOX_COLORS[0].color,
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          A: {BOX_COLORS[0].emoji}
        </button>

        {sortMode === '3way' && (
          <button
            onClick={() => onSort('middle')}
            style={{
              padding: '8px 16px',
              background: BOX_COLORS[1].color,
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            S: {BOX_COLORS[1].emoji}
          </button>
        )}

        <button
          onClick={() => onSort('right')}
          style={{
            padding: '8px 16px',
            background: BOX_COLORS[2].color,
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          D: {BOX_COLORS[2].emoji}
        </button>
      </div>
    </div>
  );
});

BoxCard.displayName = 'BoxCard';

// ═══════════════════════════════════════════════
// SortingBins (visual representation)
// ═══════════════════════════════════════════════

interface SortingBinsProps {
  sortMode: '2way' | '3way';
  accentColor: { light: string; dark: string };
}

const SortingBins = memo(({ sortMode, accentColor }: SortingBinsProps) => (
  <div style={{
    display: 'flex',
    gap: 8,
    justifyContent: 'center',
    padding: '12px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 6,
  }}>
    {BOX_COLORS.slice(0, sortMode === '3way' ? 3 : 2).map((color) => (
      <div
        key={color.id}
        style={{
          flex: 1,
          minWidth: 60,
          height: 60,
          background: `${color.color}20`,
          border: `2px solid ${color.color}`,
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 24,
        }}
      >
        {color.emoji}
      </div>
    ))}
  </div>
));

SortingBins.displayName = 'SortingBins';

export default SortingGame;
