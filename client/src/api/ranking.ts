import { useQuery } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

const API_BASE = '/api';

function getAuthHeader() {
  const token = localStorage.getItem('tt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface WealthRanking {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  netWorth: number;
}

export interface ReturnsRanking {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  totalPnl: number;
  returnPercent: number;
}

export interface WorkRanking {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  workIncome: number;
}

export interface CollectionRanking {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  collectionCount: number;
}

// ═══════════════════════════════════════════════
// Wealth Ranking
// ═══════════════════════════════════════════════
export function useWealthRanking() {
  return useQuery({
    queryKey: queryKeys.ranking.byType('wealth'),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rankings/wealth`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch wealth rankings');
      return (await res.json()) as { rankings: WealthRanking[] };
    },
    refetchInterval: 30000, // 30 seconds
  });
}

// ═══════════════════════════════════════════════
// Returns Ranking
// ═══════════════════════════════════════════════
export function useReturnsRanking() {
  return useQuery({
    queryKey: queryKeys.ranking.byType('returns'),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rankings/returns`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch returns rankings');
      return (await res.json()) as { rankings: ReturnsRanking[] };
    },
    refetchInterval: 30000, // 30 seconds
  });
}

// ═══════════════════════════════════════════════
// Work Ranking (placeholder)
// ═══════════════════════════════════════════════
export function useWorkRanking() {
  return useQuery({
    queryKey: queryKeys.ranking.byType('work'),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rankings/work`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch work rankings');
      return (await res.json()) as { rankings: WorkRanking[] };
    },
    refetchInterval: 30000,
  });
}

// ═══════════════════════════════════════════════
// Collection Ranking (placeholder)
// ═══════════════════════════════════════════════
export function useCollectionRanking() {
  return useQuery({
    queryKey: queryKeys.ranking.byType('collection'),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/rankings/collection`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch collection rankings');
      return (await res.json()) as { rankings: CollectionRanking[] };
    },
    refetchInterval: 30000,
  });
}
