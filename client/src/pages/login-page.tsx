import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f9fafb',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    }}>
      <div style={{
        width: 380,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '32px 28px 20px' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>
            Tiny Traders
          </h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>
            모의투자 시뮬레이션
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
          {(['login', 'register'] as const).map((t) => (
            <button
              key={t}
              style={{
                flex: 1,
                padding: '11px 0',
                fontSize: 13,
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#111827' : '#9ca3af',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t ? '2px solid #111827' : '2px solid transparent',
                cursor: 'pointer',
              }}
              onClick={() => { setTab(t); setError(''); setSuccess(''); }}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* Form */}
        <div style={{ padding: '24px 28px 28px' }}>
          {error && (
            <div style={{
              padding: '9px 12px',
              background: '#fef2f2',
              color: '#dc2626',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{
              padding: '9px 12px',
              background: '#f0fdf4',
              color: '#16a34a',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
            }}>
              {success}
            </div>
          )}

          {tab === 'login' ? (
            <form onSubmit={handleLogin}>
              <Field label="아이디">
                <input
                  style={inputStyle}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="아이디를 입력하세요"
                  autoFocus
                />
              </Field>
              <Field label="비밀번호" last>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                />
              </Field>
              <button type="submit" style={btnStyle} disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <Field label="아이디">
                <input
                  style={inputStyle}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="3~20자 영문/숫자"
                  autoFocus
                />
              </Field>
              <Field label="닉네임">
                <input
                  style={inputStyle}
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="게임에서 사용할 닉네임"
                />
              </Field>
              <Field label="비밀번호" last>
                <input
                  style={inputStyle}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="4자 이상"
                />
              </Field>
              <button type="submit" style={btnStyle} disabled={loading}>
                {loading ? '가입 요청 중...' : '가입 요청'}
              </button>
              <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', marginTop: 12 }}>
                관리자 승인 후 로그인할 수 있습니다.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Small helpers ─── */
function Field({ label, last, children }: { label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: last ? 20 : 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  fontSize: 13,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  outline: 'none',
  boxSizing: 'border-box',
  color: '#111827',
  background: '#fafafa',
};

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px',
  fontSize: 13,
  fontWeight: 600,
  background: '#111827',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
};
