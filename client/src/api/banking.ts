import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

const API_BASE = '/api';

// ═══════════════════════════════════════════════
// Helper: Get auth token
// ═══════════════════════════════════════════════
function getAuthHeader() {
  const token = localStorage.getItem('tt_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ═══════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════
export interface SavingsAccount {
  id: string;
  userId: string;
  productName: string;
  principal: number;
  interestRate: number;
  termDays: number; // Stored as minutes in DB
  status: 'active' | 'matured' | 'cancelled';
  createdAt: Date;
  maturesAt: Date;
}

// ═══════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════

/** Fetch user's savings accounts (refetch every 10s) */
export function useSavings(userId: string) {
  return useQuery({
    queryKey: queryKeys.banking.accounts(userId),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/savings/${userId}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch savings');
      return res.json() as Promise<{ accounts: SavingsAccount[] }>;
    },
    enabled: !!userId,
    refetchInterval: 10000,
  });
}

// ═══════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════

export interface OpenSavingsInput {
  userId: string;
  principal: number;
  productName: string;
  interestRate: number;
  termMinutes: number; // Game uses minutes (10min ~ 24hours)
}

export interface OpenSavingsResult {
  accountId: string;
  error?: string;
}

/** Open a new savings account */
export function useOpenSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OpenSavingsInput) => {
      const res = await fetch(`${API_BASE}/savings/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to open savings');
      }
      return res.json() as Promise<OpenSavingsResult>;
    },
    onSuccess: (_, input) => {
      // Invalidate savings query
      qc.invalidateQueries({ queryKey: queryKeys.banking.accounts(input.userId) });
    },
  });
}

export interface CancelSavingsInput {
  accountId: string;
  userId: string;
}

export interface CancelSavingsResult {
  success: boolean;
  error?: string;
}

/** Cancel a savings account early */
export function useCancelSavings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelSavingsInput) => {
      const res = await fetch(`${API_BASE}/savings/${input.accountId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || 'Failed to cancel savings');
      }
      return res.json() as Promise<CancelSavingsResult>;
    },
    onSuccess: (_, input) => {
      // Invalidate savings query
      qc.invalidateQueries({ queryKey: queryKeys.banking.accounts(input.userId) });
    },
  });
}
