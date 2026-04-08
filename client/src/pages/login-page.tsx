import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../stores/auth-store';
import { apiRegister } from '../api/auth';

type Tab = 'login' | 'register';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(username, password);
    setLoading(false);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || '로그인에 실패했습니다.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const result = await apiRegister(username, password, displayName);
      setLoading(false);
      if (result.success) {
        setSuccess(result.message);
        setTab('login');
        setUsername('');
        setPassword('');
        setDisplayName('');
      } else {
        setError(result.error || '가입 요청에 실패했습니다.');
      }
    } catch {
      setLoading(false);
      setError('서버 연결에 실패했습니다.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f7f8fa',
      backgroundImage: `
        linear-gradient(rgba(0, 0, 0, 0.02) 1px, transparent 1px),
        linear-gradient(90deg, rgba(0, 0, 0, 0.02) 1px, transparent 1px),
        radial-gradient(ellipse at 50% 40%, rgba(59, 130, 246, 0.04) 0%, transparent 60%)
      `,
      backgroundSize: '32px 32px, 32px 32px, 100% 100%',
    }}>
      {/* Card */}
      <div style={{
        width: 400,
        borderRadius: 12,
        border: '1px solid #e2e5ea',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        animation: 'fadeInScale 0.5s ease-out',
        background: '#ffffff',
      }}>
        {/* Header */}
        <div style={{
          padding: '32px 28px 24px',
          textAlign: 'center',
          borderBottom: '1px solid #e2e5ea',
        }}>
          <Icon icon="tabler:chart-line" width={36} style={{ color: '#3b82f6', marginBottom: 8 }} />
          <h1 style={{
            fontFamily: "'Gothic A1', sans-serif",
            fontSize: 28,
            fontWeight: 800,
            color: '#1e2028',
            margin: 0,
            letterSpacing: '-0.02em',
          }}>
            Tiny Traders
          </h1>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, letterSpacing: '0.05em' }}>
            모의투자 시뮬레이션
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: '#fafbfc' }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              style={{
                flex: 1,
                padding: '11px 0',
                fontSize: 13,
                fontWeight: tab === t ? 700 : 400,
                color: tab === t ? '#1e2028' : '#9ca3af',
                background: tab === t ? '#ffffff' : 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid #3b82f6' : '2px solid transparent',
                cursor: 'pointer',
                fontFamily: "'Gothic A1', sans-serif",
                transition: 'all 0.15s',
              }}
              onClick={() => { setTab(t); setError(''); setSuccess(''); }}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px 28px', background: '#ffffff' }}>
          {error && (
            <div style={{
              padding: '9px 12px',
              background: 'rgba(239, 68, 68, 0.06)',
              color: '#ef4444',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
              border: '1px solid rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Icon icon="tabler:alert-circle" width={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '9px 12px',
              background: 'rgba(16, 185, 129, 0.06)',
              color: '#059669',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
              border: '1px solid rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Icon icon="tabler:check" width={16} style={{ flexShrink: 0 }} />
              {success}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <Field label="아이디" icon="tabler:user">
                <input
                  style={inputStyle}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  autoFocus
                />
              </Field>
              <Field label="비밀번호" icon="tabler:lock" last>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                />
              </Field>
              <button type="submit" style={btnStyle} disabled={loading}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon icon="tabler:loader-2" width={16} style={{ animation: 'spin 1s linear infinite' }} />
                    로그인 중...
                  </span>
                ) : '로그인'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <Field label="아이디" icon="tabler:user">
                <input
                  style={inputStyle}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3~20자 영문/숫자"
                  autoFocus
                />
              </Field>
              <Field label="닉네임" icon="tabler:id-badge-2">
                <input
                  style={inputStyle}
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="게임에서 사용할 닉네임"
                />
              </Field>
              <Field label="비밀번호" icon="tabler:lock" last>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="4자 이상"
                />
              </Field>
              <button type="submit" style={btnStyle} disabled={loading}>
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <Icon icon="tabler:loader-2" width={16} style={{ animation: 'spin 1s linear infinite' }} />
                    가입 요청 중...
                  </span>
                ) : '가입 요청'}
              </button>
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 14 }}>
                관리자 승인 후 로그인할 수 있습니다.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Footer attribution */}
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 24, letterSpacing: '0.05em' }}>
        &copy; Tiny Traders — pixel village economy
      </p>
    </div>
  );
}

/* ─── Field helper ─── */
function Field({ label, icon, last, children }: { label: string; icon: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: last ? 20 : 14 }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: 5,
        fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 5,
      }}>
        <Icon icon={icon} width={14} style={{ color: '#9ca3af' }} />
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 13,
  border: '1px solid #e2e5ea',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
  color: '#1e2028',
  background: '#fafbfc',
  fontFamily: "'Gothic A1', sans-serif",
  transition: 'border-color 0.15s',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px',
  fontSize: 14,
  fontWeight: 700,
  background: '#3b82f6',
  color: '#ffffff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: "'Gothic A1', sans-serif",
  transition: 'filter 0.15s',
  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.25)',
};
