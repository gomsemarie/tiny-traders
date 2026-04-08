import { create } from 'zustand';
import { apiGetMe, apiLogin } from '../api/auth';

interface User {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  status: 'pending' | 'approved' | 'rejected';
  gold: number;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  login: async (username, password) => {
    set({ loading: true });
    try {
      const result = await apiLogin(username, password);
      if (result.success && result.token) {
        localStorage.setItem('tt_token', result.token);
        set({ user: result.user, loading: false });
        return { success: true };
      }
      set({ loading: false });
      return { success: false, error: result.error };
    } catch {
      set({ loading: false });
      return { success: false, error: '서버 연결에 실패했습니다.' };
    }
  },

  logout: () => {
    localStorage.removeItem('tt_token');
    set({ user: null });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('tt_token');
    if (!token) {
      set({ initialized: true, user: null });
      return;
    }
    try {
      const user = await apiGetMe();
      set({ user, initialized: true });
    } catch {
      localStorage.removeItem('tt_token');
      set({ user: null, initialized: true });
    }
  },
}));
