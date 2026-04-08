import { useState, useCallback, useEffect, memo } from 'react';
import { useStartMinigame, useSubmitMinigame, type JobType } from '../../api/minigames';
import CookingGame from './cooking-game';
import ParkingGame from './parking-game';
import TypingGame from './typing-game';
import SortingGame from './sorting-game';

// ═══════════════════════════════════════════════
// Color & Style Constants
// ═══════════════════════════════════════════════
const COLORS = {
  bg: '#1a1a2e',
  bgAlt: '#16213e',
  border: '#0f3460',
  text: '#eaeaea',
  textSecondary: '#a8a8a8',
  accent: '#e94560',
  success: '#4caf50',
  warning: '#ff9800',
} as const;

const JOB_COLORS: Record<JobType, { light: string; dark: string }> = {
  cooking: { light: '#ff6b6b', dark: '#c92a2a' },
  parking: { light: '#4ecdc4', dark: '#1a9b8e' },
  typing: { light: '#95e1d3', dark: '#38ada9' },
  sorting: { light: '#f7b731', dark: '#e58e26' },
};

export interface MinigameWindowProps {
  jobType: JobType;
  characterId: string;
  characterName: string;
  boostLevel?: number;
  onClose: () => void;
}

type GameState = 'intro' | 'playing' | 'results';

const MinigameWindow = memo(({
  jobType, characterId, characterName, boostLevel = 0, onClose,
}: MinigameWindowProps) => {
  const [gameState, setGameState] = useState<GameState>('intro');
  const [score, setScore] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [actionCount, setActionCount] = useState(0);

  const startMutation = useStartMinigame(jobType);
  const submitMutation = useSubmitMinigame(jobType);

  // Start game
  const handleStartGame = useCallback(async () => {
    try {
      const result = await startMutation.mutateAsync(characterId);
      setGameState('playing');
    } catch (err) {
      console.error('Failed to start minigame:', err);
    }
  }, [characterId, startMutation]);

  // Submit result
  const handleGameEnd = useCallback(async (finalScore: number, finalDuration: number, finalActionCount: number) => {
    setScore(finalScore);
    setDurationSec(finalDuration);
    setActionCount(finalActionCount);

    try {
      await submitMutation.mutateAsync({
        characterId,
        score: finalScore,
        durationSec: finalDuration,
        actionCount: finalActionCount,
        boostLevel,
      });
      setGameState('results');
    } catch (err) {
      console.error('Failed to submit minigame result:', err);
      setGameState('results');
    }
  }, [characterId, boostLevel, submitMutation]);

  const accentColor = JOB_COLORS[jobType];
  const jobLabel = { cooking: '요리', parking: '발렛파킹', typing: '타자', sorting: '분류' }[jobType];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: COLORS.bgAlt,
      color: COLORS.text,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: accentColor.dark,
        borderBottom: `2px solid ${accentColor.light}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>
            {characterName} · {jobLabel}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: accentColor.light, marginTop: 2 }}>
            {jobLabel} 알바
          </div>
        </div>
        {gameState === 'intro' && (
          <button
            onClick={onClose}
            style={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: 4,
              color: COLORS.text,
              cursor: 'pointer',
              fontSize: 16,
            }}
            title="닫기"
          >
            ✕
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {gameState === 'intro' && (
          <IntroScreen
            jobType={jobType}
            characterName={characterName}
            accentColor={accentColor}
            isLoading={startMutation.isPending}
            onStart={handleStartGame}
          />
        )}

        {gameState === 'playing' && startMutation.data && (
          <GameRenderer
            jobType={jobType}
            duration={startMutation.data.duration}
            statAssist={startMutation.data.statAssist}
            onGameEnd={handleGameEnd}
            accentColor={accentColor}
          />
        )}

        {gameState === 'results' && (
          <ResultsScreen
            jobType={jobType}
            characterName={characterName}
            score={score}
            durationSec={durationSec}
            result={submitMutation.data}
            isLoading={submitMutation.isPending}
            accentColor={accentColor}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
});

MinigameWindow.displayName = 'MinigameWindow';

// ═══════════════════════════════════════════════
// Intro Screen
// ═══════════════════════════════════════════════

interface IntroScreenProps {
  jobType: JobType;
  characterName: string;
  accentColor: { light: string; dark: string };
  isLoading: boolean;
  onStart: () => void;
}

const IntroScreen = memo(({ jobType, characterName, accentColor, isLoading, onStart }: IntroScreenProps) => {
  const descriptions: Record<JobType, string> = {
    cooking: '재료를 올바른 순서로 클릭하여 요리하세요!\n속도와 정확도가 점수를 결정합니다.',
    parking: 'WASD를 사용하여 차량을 주차 공간에 옮기세요!\n비싼 차일수록 보상이 큽니다.',
    typing: '표시된 단어를 빠르고 정확하게 타이핑하세요!\n오타 시 다시 입력해야 합니다.',
    sorting: 'A/D (또는 A/S/D)를 눌러 상자를 분류하세요!\n색상과 라벨을 맞춰야 합니다.',
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      textAlign: 'center',
      gap: 24,
      overflow: 'auto',
    }}>
      <div style={{
        fontSize: 48,
        lineHeight: 1,
        marginBottom: 8,
      }}>
        {jobType === 'cooking' && '🍳'}
        {jobType === 'parking' && '🚗'}
        {jobType === 'typing' && '⌨️'}
        {jobType === 'sorting' && '📦'}
      </div>

      <div>
        <p style={{ fontSize: 12, color: COLORS.textSecondary, margin: '0 0 8px' }}>
          {characterName}님, 준비되셨습니까?
        </p>
        <p style={{
          fontSize: 13,
          color: COLORS.text,
          lineHeight: 1.6,
          whiteSpace: 'pre-line',
          margin: 0,
        }}>
          {descriptions[jobType]}
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: 12,
        justifyContent: 'center',
        marginTop: 16,
      }}>
        <button
          onClick={onStart}
          disabled={isLoading}
          style={{
            padding: '8px 24px',
            background: accentColor.light,
            color: '#000',
            border: 'none',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? '시작 중...' : '시작'}
        </button>
      </div>
    </div>
  );
});

IntroScreen.displayName = 'IntroScreen';

// ═══════════════════════════════════════════════
// Game Renderer
// ═══════════════════════════════════════════════

interface GameRendererProps {
  jobType: JobType;
  duration: number;
  statAssist: any;
  onGameEnd: (score: number, durationSec: number, actionCount: number) => void;
  accentColor: { light: string; dark: string };
}

const GameRenderer = memo(({ jobType, duration, statAssist, onGameEnd, accentColor }: GameRendererProps) => {
  const GameComponent = {
    cooking: CookingGame,
    parking: ParkingGame,
    typing: TypingGame,
    sorting: SortingGame,
  }[jobType];

  return (
    <GameComponent
      duration={duration}
      statAssist={statAssist}
      onGameEnd={onGameEnd}
      accentColor={accentColor}
    />
  );
});

GameRenderer.displayName = 'GameRenderer';

// ═══════════════════════════════════════════════
// Results Screen
// ═══════════════════════════════════════════════

interface ResultsScreenProps {
  jobType: JobType;
  characterName: string;
  score: number;
  durationSec: number;
  result?: any;
  isLoading: boolean;
  accentColor: { light: string; dark: string };
  onClose: () => void;
}

const ResultsScreen = memo(({
  jobType, characterName, score, durationSec, result, isLoading, accentColor, onClose,
}: ResultsScreenProps) => {
  const totalReward = result?.totalReward ?? 0;
  const tier = result?.tier ?? 'D';
  const bonusItem = result?.bonusItem;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 20px',
      textAlign: 'center',
      gap: 20,
      overflow: 'auto',
    }}>
      <div style={{
        fontSize: 36,
        fontWeight: 700,
        color: accentColor.light,
        marginBottom: 8,
      }}>
        {tier} 등급
      </div>

      <div style={{
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 6,
        padding: '16px',
        width: '100%',
        maxWidth: 300,
        border: `1px solid ${accentColor.dark}`,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 }}>점수</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {score.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 }}>시간</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
              {durationSec}초
            </div>
          </div>
        </div>
      </div>

      <div style={{
        background: accentColor.dark,
        borderRadius: 6,
        padding: '16px',
        width: '100%',
        maxWidth: 300,
        border: `2px solid ${accentColor.light}`,
      }}>
        <div style={{ fontSize: 10, color: COLORS.textSecondary, marginBottom: 6 }}>획득 보상</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: accentColor.light }}>
          {totalReward.toLocaleString()} G
        </div>
        {bonusItem && (
          <div style={{ fontSize: 10, color: COLORS.textSecondary, marginTop: 8 }}>
            + {bonusItem}
          </div>
        )}
      </div>

      {isLoading && (
        <p style={{ fontSize: 12, color: COLORS.textSecondary, margin: '16px 0 0' }}>
          결과를 처리 중...
        </p>
      )}

      <button
        onClick={onClose}
        disabled={isLoading}
        style={{
          marginTop: 16,
          padding: '8px 32px',
          background: accentColor.light,
          color: '#000',
          border: 'none',
          borderRadius: 4,
          fontSize: 12,
          fontWeight: 600,
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1,
        }}
      >
        완료
      </button>
    </div>
  );
});

ResultsScreen.displayName = 'ResultsScreen';

export default MinigameWindow;
