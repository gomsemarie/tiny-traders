import { useQuery } from '@tanstack/react-query';
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
export type EventType = 'investment' | 'labor' | 'facility' | 'character' | 'economy' | 'special';

export interface GameEvent {
  id: string;
  type: EventType;
  name: string;
  description: string;
  effectJson: string;
  startedAt: number;
  endsAt: number;
}

// ═══════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════

/**
 * Fetch the currently active event
 * Refetches every 10 seconds
 */
export function useActiveEvent() {
  return useQuery({
    queryKey: queryKeys.events.active,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/events/active`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch active event');
      return res.json() as Promise<{ event: GameEvent | null }>;
    },
    refetchInterval: 10000,
  });
}

/**
 * Fetch event history
 */
export function useEventHistory(limit: number = 20) {
  return useQuery({
    queryKey: queryKeys.events.history(limit),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/events/history?limit=${limit}`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error('Failed to fetch event history');
      return res.json() as Promise<{ history: GameEvent[] }>;
    },
  });
}
