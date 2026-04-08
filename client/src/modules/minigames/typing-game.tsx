import { useState, useEffect, useRef, memo } from 'react';
import type { StatAssist } from '../../api/minigames';

// ═══════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════

const COLORS = {
  bgAlt: '#16213e',
  text: '#eaeaea',
  textSecondary: '#a8a8a8',
  accentLight: '#95e1d3',
  accentDark: '#38ada9',
};

const WORDS = [
  { text: '연', difficulty: 1 },
  { text: '투자', difficulty: 1 },
  { text: '주식', difficulty: 1 },
  { text: '수익', difficulty: 2 },
  { text: '배당금', difficulty: 2 },
  { text: '손절매', difficulty: 2 },
  { text: '포트폴리오', difficulty: 3 },
  { text: '듀레이션', difficulty: 3 },
  { text: '변동성', difficulty: 3 },
  { text: '리밸런싱', difficulty: 3 },
  { text: 'Hello123', difficulty: 2 },
  { text: 'Game@2024', difficulty: 3 },
];

interface Word {
  id: string;
  text: string;
  typed: string;
  completed: boolean;
  createdAt: number;
}

interface GameState {
  score: number;
  combo: number;
  words: Word[];
  gameTime: number;
  maxCombo: number;
  errors: number;
}

interface TypingGameProps {
  duration: number;
  statAssist: StatAssist;
  onGameEnd: (score: number, durationSec: number, actionCount: number) => void;
  accentColor: { light: string; dark: string };
}

// ═══════════════════════════════════════════════
// TypingGame Component
// ═══════════════════════════════════════════════

const TypingGame = memo(({ duration, statAssist, onGameEnd, accentColor }: TypingGameProps) => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    combo: 0,
    words: [],
    gameTime: 0,
    maxCombo: 0,
    errors: 0,
  });

  const gameRef = useRef<{
    lastWordTime: number;
    nextWordDelay: number;
    actionCount: number;
    inputBuffer: string;
    currentWordIndex: number;
  }>({
    lastWordTime: 0,
    nextWordDelay: 2500,
    actionCount: 0,
    inputBuffer: '',
    currentWordIndex: 0,
  });

  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());

  // Word generation with difficulty scaling
  useEffect(() => {
    const genWord = () => {
      setGameState((prev) => {
        if (prev.gameTime >= duration) return prev;

        const now = Date.now();
        const elapsed = now - gameRef.current.lastWordTime;

        if (elapsed < gameRef.current.nextWordDelay) return prev;

        gameRef.current.lastWordTime = now;

        // Difficulty: start at 1, progress based on score
        const diffLevel = Math.min(3, 1 + Math.floor(prev.score / 200));
        const candidates = WORDS.filter((w) => w.difficulty <= diffLevel);
        const word = candidates[Math.floor(Math.random() * candidates.length)];

        // Speed up word generation (2.5s → 1.5s per 300 score)
        const speedFactor = Math.max(0.6, 1 - prev.score / 3000);
        gameRef.current.nextWordDelay = 2500 * speedFactor;

        return {
          ...prev,
          words: [...prev.words, {
            id: `word-${prev.words.length}-${now}`,
            text: word.text,
            typed: '',
            completed: false,
            createdAt: now,
          }],
        };
      });
    };

    const interval = setInterval(genWord, 100);
    return () => clearInterval(interval);
  }, [duration]);

  // Game loop: check timeout, update time
  useEffect(() => {
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);

      setGameState((prev) => {
        const newState = { ...prev, gameTime: remaining };

        // Check for timed-out words (10s to type)
        const now = Date.now();
        newState.words = newState.words.filter((word) => {
          const wordAge = (now - word.createdAt) / 1000;
          return wordAge < 10;
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

  // Keyboard input handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.words.length) return;

      gameRef.current.actionCount++;
      const key = e.key;

      // Backspace
      if (key === 'Backspace') {
        e.preventDefault();
        gameRef.current.inputBuffer = gameRef.current.inputBuffer.slice(0, -1);
        return;
      }

      // Enter: clear and try next
      if (key === 'Enter') {
        e.preventDefault();
        gameRef.current.inputBuffer = '';
        return;
      }

      // Normal character
      if (key.length === 1) {
        e.preventDefault();
        gameRef.current.inputBuffer += key;

        const word = gameState.words[gameRef.current.currentWordIndex];
        if (!word) {
          gameRef.current.inputBuffer = '';
          return;
        }

        const targetText = word.text;

        // Check if input matches so far (allow typos)
        const isCorrect = targetText.startsWith(gameRef.current.inputBuffer);

        if (!isCorrect) {
          // Typo: reset buffer
          setGameState((prev) => ({
            ...prev,
            errors: prev.errors + 1,
            combo: 0,
          }));
          gameRef.current.inputBuffer = '';
          return;
        }

        // Check if word is complete
        if (gameRef.current.inputBuffer === targetText) {
          const now = Date.now();
          const wordAge = (now - word.createdAt) / 1000;
          const speedBonus = Math.max(0, 100 - Math.floor(wordAge * 50));
          const comboBonus = gameState.combo * 3;
          const basePoints = 50;
          const totalPoints = basePoints + speedBonus + comboBonus;

          setGameState((prev) => ({
            ...prev,
            score: prev.score + totalPoints,
            combo: prev.combo + 1,
            maxCombo: Math.max(prev.maxCombo, prev.combo + 1),
            words: prev.words.map((w) =>
              w.id === word.id ? { ...w, completed: true } : w
            ),
          }));

          gameRef.current.inputBuffer = '';
          gameRef.current.currentWordIndex++;

          // Auto-remove completed words
          setGameState((prev) => ({
            ...prev,
            words: prev.words.filter((w) => !w.completed),
          }));
          gameRef.current.currentWordIndex = Math.min(gameRef.current.currentWordIndex, gameState.words.length - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.words]);

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
          <div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>오류</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: gameState.errors > 0 ? '#ff6b6b' : COLORS.textSecondary }}>
              {gameState.errors}
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
        padding: '24px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
      }}>
        {gameState.words.length === 0 ? (
          <div style={{
            color: COLORS.textSecondary,
            fontSize: 12,
          }}>
            단어 준비 중...
          </div>
        ) : (
          <>
            {/* Word to type */}
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: 2,
              minHeight: 36,
            }}>
              {gameState.words.length > 0 && (
                <WordDisplay
                  word={gameState.words[0]}
                  buffer={gameRef.current.inputBuffer}
                  accentColor={accentColor}
                />
              )}
            </div>

            {/* Input indicator */}
            <div style={{
              fontSize: 12,
              color: COLORS.textSecondary,
              textAlign: 'center',
            }}>
              입력: <span style={{ color: accentColor.light, fontWeight: 600 }}>
                {gameRef.current.inputBuffer || '...'}
              </span>
            </div>

            {/* Queue */}
            {gameState.words.length > 1 && (
              <div style={{
                marginTop: 16,
                textAlign: 'center',
                color: COLORS.textSecondary,
                fontSize: 11,
              }}>
                다음: {gameState.words.slice(1, 4).map((w) => w.text).join(', ')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

TypingGame.displayName = 'TypingGame';

// ═══════════════════════════════════════════════
// Word Display (shows typed vs target)
// ═══════════════════════════════════════════════

interface WordDisplayProps {
  word: Word;
  buffer: string;
  accentColor: { light: string; dark: string };
}

const WordDisplay = memo(({ word, buffer, accentColor }: WordDisplayProps) => (
  <div style={{ display: 'flex', gap: 2 }}>
    {word.text.split('').map((char, i) => (
      <span
        key={i}
        style={{
          color: i < buffer.length ? accentColor.light : COLORS.textSecondary,
          opacity: i < buffer.length ? 1 : 0.5,
          transition: 'all 0.1s',
        }}
      >
        {char}
      </span>
    ))}
  </div>
));

WordDisplay.displayName = 'WordDisplay';

export default TypingGame;
