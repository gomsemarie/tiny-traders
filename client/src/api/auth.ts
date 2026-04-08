const API = '/api/auth';

function getToken(): string | null {
  return localStorage.getItem('tt_token');
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRegister(username: string, password: string, displayName: string) {
  const res = await fetch(`${API}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, displayName }),
  });
  return res.json();
}

export async function apiLogin(username: string, password: string) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  return res.json();
}

export async function apiGetMe() {
  const res = await fetch(`${API}/me`, { headers: authHeaders() });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user;
}

export async function apiGetPendingUsers() {
  const res = await fetch(`${API}/pending`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function apiGetAllUsers() {
  const res = await fetch(`${API}/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed');
  return res.json();
}

export async function apiApproveUser(userId: string) {
  const res = await fetch(`${API}/approve/${userId}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
  });
  return res.json();
}

export async function apiRejectUser(userId: string, reason?: string) {
  const res = await fetch(`${API}/reject/${userId}`, {
    method: 'POST',
    headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  return res.json();
}
