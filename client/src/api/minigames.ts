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

export type JobType = 'cooking' | 'parking' | 'typing' | 'sorting';

export interface StatAssist {
  speedBoost: number;
  accuracyBoost: number;
  bonusEventChance: number;
  extraTimeSec: number;
}

export interface MinigameStartResponse {
  jobType: JobType;
  requiredFacility: string;
  duration: number;
  statAssist: StatAssist;
}

export interface MinigameSubmitInput {
  characterId: string;
  score: number;
  durationSec: number;
  actionCount: number;
  boostLevel?: number;
}

export interface MinigameResult {
  jobType: JobType;
  characterId: string;
  score: number;
  maxScore: number;
  scoreRatio: number;
  baseReward: number;
  scoreMultiplier: number;
  manualMultiplier: number;
  statBonus: number;
  facilityBonus: number;
  totalReward: number;
  bonusDropped: boolean;
  bonusItem?: string;
  conditionDrain: number;
  tier: string;
}

// ═══════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════

/**
 * Get minigame config (difficulty levels, validation rules, etc.)
 */
export function useMinigameConfig(jobType: JobType) {
  return useQuery({
    queryKey: queryKeys.jobs?.config?.(jobType) ?? ['minigame', 'config', jobType],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/jobs/${jobType}/config`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error(`Failed to fetch ${jobType} config`);
      return res.json();
    },
  });
}

/**
 * Start minigame session (get stat assists + duration)
 */
export function useStartMinigame(jobType: JobType) {
  return useMutation({
    mutationFn: async (characterId: string) => {
      const res = await fetch(`${API_BASE}/jobs/${jobType}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ characterId }),
      });
      if (!res.ok) throw new Error(`Failed to start ${jobType} minigame`);
      return res.json() as Promise<MinigameStartResponse>;
    },
  });
}

// ═══════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════

/**
 * Submit minigame result and get reward
 */
export function useSubmitMinigame(jobType: JobType) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MinigameSubmitInput) => {
      const res = await fetch(`${API_BASE}/jobs/${jobType}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || `Failed to submit ${jobType} result`);
      }
      return res.json() as Promise<MinigameResult>;
    },
    onSuccess: () => {
      // Invalidate character data to reflect rewards
      qc.invalidateQueries({ queryKey: ['characters'] });
    },
  });
}
