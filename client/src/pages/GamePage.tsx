import { useRef, useEffect } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../scenes/MainScene';
import { useAuthStore } from '../stores/authStore';

const GAME_CONFIG: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  pixelArt: true,
  backgroundColor: '#f0f4f8',
  scene: [MainScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

export default function GamePage() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    if (gameContainerRef.current && !gameRef.current) {
      gameRef.current = new Phaser.Game({
        ...GAME_CONFIG,
        parent: gameContainerRef.current,
      });
    }

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const linkStyle: React.CSSProperties = {
    display: 'block',
    padding: '10px 14px',
    fontSize: 13,
    borderRadius: 8,
    textDecoration: 'none',
    transition: 'background 0.15s',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Game Canvas */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={gameContainerRef} style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
      </div>

      {/* Right Panel */}
      <aside style={{
        width: 280,
        background: '#fff',
        borderLeft: '1px solid #e2e8f0',
        padding: 20,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* User Info */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>
            🎮 Tiny Traders
          </h2>
          {user && (
            <div style={{ fontSize: 13, color: '#64748b' }}>
              {user.displayName}
              {user.role === 'admin' && (
                <span style={{
                  fontSize: 11,
                  color: '#7c3aed',
                  background: '#f5f3ff',
                  padding: '1px 6px',
                  borderRadius: 4,
                  marginLeft: 6,
                }}>
                  관리자
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nav Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <a href="/characters" style={{ ...linkStyle, background: '#eff6ff', color: '#2563eb' }}>
            👤 캐릭터 관리
          </a>
          {user?.role === 'admin' && (
            <a href="/admin" style={{ ...linkStyle, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              ⚙️ 관리자 에디터
            </a>
          )}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            marginTop: 16,
            padding: '10px 14px',
            fontSize: 13,
            color: '#ef4444',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          로그아웃
        </button>
      </aside>
    </div>
  );
}
