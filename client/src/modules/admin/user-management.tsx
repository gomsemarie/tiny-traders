import { useState, useEffect, useCallback } from 'react';
import { apiGetAllUsers, apiApproveUser, apiRejectUser } from '../../api/auth';

interface UserRow {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: string;
  gold: number;
  createdAt: string;
  lastLoginAt: string | null;
  rejectedReason: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '대기', color: '#d97706', bg: '#fffbeb' },
  approved: { label: '승인', color: '#16a34a', bg: '#f0fdf4' },
  rejected: { label: '거절', color: '#dc2626', bg: '#fef2f2' },
};

export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGetAllUsers();
      setUsers(data.users);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleApprove = async (userId: string) => {
    setActionLoading(userId);
    await apiApproveUser(userId);
    setActionLoading(null);
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    const reason = prompt('거절 사유를 입력하세요 (선택):');
    setActionLoading(userId);
    await apiRejectUser(userId, reason || undefined);
    setActionLoading(null);
    fetchUsers();
  };

  const filteredUsers = filter === 'all' ? users : users.filter((u) => u.status === filter);
  const pendingCount = users.filter((u) => u.status === 'pending').length;

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#9ca3af', fontSize: 13 }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 24px',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
            회원 관리
          </h2>
          {pendingCount > 0 && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#d97706',
              background: '#fffbeb',
              padding: '2px 7px',
              borderRadius: 4,
            }}>
              {pendingCount}명 대기
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                fontWeight: filter === f ? 600 : 400,
                color: filter === f ? '#111827' : '#6b7280',
                background: filter === f ? '#f3f4f6' : 'transparent',
                border: '1px solid',
                borderColor: filter === f ? '#d1d5db' : '#e5e7eb',
                borderRadius: 5,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? '전체' : STATUS_LABELS[f].label}
            </button>
          ))}
        </div>
      </header>

      {/* User List */}
      <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 13 }}>
            {filter === 'pending' ? '대기 중인 가입 요청이 없습니다.' : '유저가 없습니다.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredUsers.map((user) => {
              const statusInfo = STATUS_LABELS[user.status] || STATUS_LABELS.pending;
              return (
                <div
                  key={user.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    background: '#fff',
                    borderRadius: 8,
                    border: '1px solid',
                    borderColor: user.status === 'pending' ? '#fde68a' : '#e5e7eb',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                        {user.displayName}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>
                        @{user.username}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color: statusInfo.color,
                        background: statusInfo.bg,
                        padding: '1px 6px',
                        borderRadius: 3,
                      }}>
                        {statusInfo.label}
                      </span>
                      {user.role === 'admin' && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: '#6b7280',
                          background: '#f3f4f6',
                          padding: '1px 6px',
                          borderRadius: 3,
                        }}>
                          관리자
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                      가입: {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                      {user.lastLoginAt && (
                        <> · 마지막 접속: {new Date(user.lastLoginAt).toLocaleDateString('ko-KR')}</>
                      )}
                      {user.rejectedReason && (
                        <span style={{ color: '#dc2626' }}> · 사유: {user.rejectedReason}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {user.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => handleApprove(user.id)}
                        disabled={actionLoading === user.id}
                        style={{
                          padding: '5px 14px',
                          fontSize: 12,
                          fontWeight: 500,
                          background: '#111827',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 5,
                          cursor: 'pointer',
                          opacity: actionLoading === user.id ? 0.5 : 1,
                        }}
                      >
                        승인
                      </button>
                      <button
                        onClick={() => handleReject(user.id)}
                        disabled={actionLoading === user.id}
                        style={{
                          padding: '5px 14px',
                          fontSize: 12,
                          fontWeight: 500,
                          background: '#fff',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: 5,
                          cursor: 'pointer',
                          opacity: actionLoading === user.id ? 0.5 : 1,
                        }}
                      >
                        거절
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
