import { useState, useEffect, useRef, memo } from 'react';
import type { StatAssist } from '../../api/minigames';

// ═══════════════════════════════════════════════
// Types & Constants
// ═══════════════════════════════════════════════

const COLORS = {
  bgAlt: '#16213e',
  text: '#eaeaea',
  textSecondary: '#a8a8a8',
  accentLight: '#4ecdc4',
  accentDark: '#1a9b8e',
};

const CAR_GRADES = [
  { icon: '🚗', name: 'cheap', reward: 30, weight: 0.7 },
  { icon: '🚙', name: 'medium', reward: 80, weight: 0.2 },
  { icon: '🏎️', name: 'expensive', reward: 150, weight: 0.1 },
];

const PARKING_SPACES = 6;

interface Car {
  id: string;
  grade: string;
  icon: string;
  reward: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  parkedTime?: number;
}

interface ParkingSpace {
  id: number;
  x: number;
  y: number;
  occupied: boolean;
  parkedCarId?: string;
}

interface GameState {
  score: number;
  cars: Car[];
  spaces: ParkingSpace[];
  selectedCarId?: string;
  gameTime: number;
}

interface ParkingGameProps {
  duration: number;
  statAssist: StatAssist;
  onGameEnd: (score: number, durationSec: number, actionCount: number) => void;
  accentColor: { light: string; dark: string };
}

// ═══════════════════════════════════════════════
// ParkingGame Component
// ═══════════════════════════════════════════════

const ParkingGame = memo(({ duration, statAssist, onGameEnd, accentColor }: ParkingGameProps) => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    cars: [],
    spaces: Array.from({ length: PARKING_SPACES }, (_, i) => ({
      id: i,
      x: (i % 3) * 140 + 20,
      y: Math.floor(i / 3) * 140 + 20,
      occupied: false,
    })),
    gameTime: 0,
  });

  const gameRef = useRef<{
    lastCarTime: number;
    nextCarDelay: number;
    playerX: number;
    playerY: number;
    keys: Record<string, boolean>;
    actionCount: number;
  }>({
    lastCarTime: 0,
    nextCarDelay: 2000,
    playerX: 160,
    playerY: 360,
    keys: {},
    actionCount: 0,
  });

  const rafRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const canvasRef = useRef<HTMLDivElement>(null);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
        gameRef.current.keys[key] = true;
        gameRef.current.actionCount++;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(key)) {
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

  // Spawn new cars
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      if (now - gameRef.current.lastCarTime < gameRef.current.nextCarDelay) return;

      gameRef.current.lastCarTime = now;

      setGameState((prev) => {
        if (prev.gameTime >= duration) return prev;

        // Select random car grade
        const rand = Math.random();
        let grade = CAR_GRADES[0];
        let weight = 0;
        for (const g of CAR_GRADES) {
          weight += g.weight;
          if (rand < weight) {
            grade = g;
            break;
          }
        }

        // Speed up car generation (2s → 1.2s per 200 score)
        const speedFactor = Math.max(0.6, 1 - prev.score / 2000);
        gameRef.current.nextCarDelay = 2000 * speedFactor;

        return {
          ...prev,
          cars: [...prev.cars, {
            id: `car-${prev.cars.length}-${now}`,
            grade: grade.name,
            icon: grade.icon,
            reward: grade.reward,
            x: Math.random() * 300,
            y: -40,
            vx: (Math.random() - 0.5) * 40,
            vy: 80 + prev.score / 50, // Speed increases with score
          }],
        };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration]);

  // Game loop
  useEffect(() => {
    const animate = () => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const remaining = Math.max(0, duration - elapsed);

      // Player movement
      const speed = 120; // pixels per second
      const dt = 0.016; // ~60fps
      if (gameRef.current.keys['a']) gameRef.current.playerX = Math.max(0, gameRef.current.playerX - speed * dt);
      if (gameRef.current.keys['d']) gameRef.current.playerX = Math.min(340, gameRef.current.playerX + speed * dt);
      if (gameRef.current.keys['w']) gameRef.current.playerY = Math.max(260, gameRef.current.playerY - speed * dt);
      if (gameRef.current.keys['s']) gameRef.current.playerY = Math.min(360, gameRef.current.playerY + speed * dt);

      setGameState((prev) => {
        let newScore = prev.score;
        const now = Date.now();
        const playerX = gameRef.current.playerX;
        const playerY = gameRef.current.playerY;

        // Update cars
        let newCars = prev.cars
          .map((car) => ({
            ...car,
            y: car.y + car.vy * dt,
            x: car.x + car.vx * dt,
          }))
          .filter((car) => car.y < 400);

        // Check collisions with parking spaces
        newCars = newCars.map((car) => {
          if (car.parkedTime !== undefined) return car; // Already parked

          // Check proximity to any empty parking space
          for (const space of prev.spaces) {
            if (space.occupied) continue;

            const dx = playerX - space.x;
            const dy = playerY - space.y;
            const carDx = car.x - space.x;
            const carDy = car.y - space.y;
            const dist = Math.sqrt(carDx * carDx + carDy * carDy);

            if (dist < 40 && Math.sqrt(dx * dx + dy * dy) < 50) {
              // Player is near and car is near space: park it
              newScore += car.reward;
              return { ...car, parkedTime: now, x: space.x, y: space.y };
            }
          }
          return car;
        });

        // Auto-despawn parked cars after 3-5s
        newCars = newCars.filter((car) => {
          if (car.parkedTime && (now - car.parkedTime) > (3000 + Math.random() * 2000)) {
            return false;
          }
          return true;
        });

        return {
          ...prev,
          score: newScore,
          cars: newCars,
          gameTime: remaining,
        };
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
        <div>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>점수</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: accentColor.light }}>
            {gameState.score}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>차량 수</div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            {gameState.cars.length}대
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

      {/* Game canvas */}
      <div
        ref={canvasRef}
        style={{
          flex: 1,
          position: 'relative',
          background: 'linear-gradient(135deg, rgba(22, 33, 62, 0.8), rgba(15, 52, 96, 0.8))',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Parking spaces grid */}
        {gameState.spaces.map((space) => (
          <div
            key={space.id}
            style={{
              position: 'absolute',
              left: space.x,
              top: space.y,
              width: 100,
              height: 100,
              border: space.occupied ? `2px solid ${accentColor.light}` : '2px dashed rgba(255,255,255,0.2)',
              borderRadius: 4,
              background: space.occupied ? `rgba(78, 205, 196, 0.1)` : 'transparent',
            }}
          />
        ))}

        {/* Cars */}
        {gameState.cars.map((car) => (
          <div
            key={car.id}
            style={{
              position: 'absolute',
              left: car.x,
              top: car.y,
              width: 32,
              height: 32,
              fontSize: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: car.parkedTime ? 'all 0.3s' : 'none',
              opacity: car.parkedTime ? 0.6 : 1,
            }}
          >
            {car.icon}
          </div>
        ))}

        {/* Player (driver) */}
        <div
          style={{
            position: 'absolute',
            left: gameRef.current.playerX,
            top: gameRef.current.playerY,
            width: 28,
            height: 28,
            fontSize: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.05s',
            background: `rgba(${accentColor.light === '#4ecdc4' ? '78, 205, 196' : '78, 205, 196'}, 0.3)`,
            borderRadius: 50,
            border: `2px solid ${accentColor.light}`,
          }}
        >
          👤
        </div>

        {/* Controls hint */}
        <div style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          fontSize: 10,
          color: COLORS.textSecondary,
          background: 'rgba(0, 0, 0, 0.4)',
          padding: '6px 8px',
          borderRadius: 4,
        }}>
          W/A/S/D 이동
        </div>
      </div>
    </div>
  );
});

ParkingGame.displayName = 'ParkingGame';

export default ParkingGame;
