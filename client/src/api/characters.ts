import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

/** Fetch user's characters */
export function useCharacters(userId: string) {
  return useQuery({
    queryKey: queryKeys.characters.mine(),
    queryFn: async () => {
      const res = await fetch(`/api/characters/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch characters');
      return res.json() as Promise<{ characters: CharacterData[] }>;
    },
    enabled: !!userId,
  });
}

/** Fetch character detail */
export function useCharacterDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.characters.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/character/${id}`);
      if (!res.ok) throw new Error('Failed to fetch character');
      return res.json() as Promise<CharacterData & { template: any }>;
    },
    enabled: !!id,
  });
}

/** Level up mutation */
export function useLevelUp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (characterId: string) => {
      const res = await fetch(`/api/character/${characterId}/levelup`, { method: 'POST' });
      if (!res.ok) throw new Error('Level up failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.characters.all });
    },
  });
}

/** Dispose mutation */
export function useDisposeCharacter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (characterId: string) => {
      const res = await fetch(`/api/character/${characterId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Dispose failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.characters.all });
    },
  });
}

/** Get active gacha banners */
export function useGachaBanners() {
  return useQuery({
    queryKey: ['gacha', 'banners'],
    queryFn: async () => {
      const res = await fetch('/api/gacha/banners');
      if (!res.ok) throw new Error('Failed to fetch banners');
      return res.json() as Promise<{ banners: GachaBanner[] }>;
    },
  });
}

/** Roll gacha */
export function useGachaRoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, bannerId }: { userId: string; bannerId: string }) => {
      const res = await fetch('/api/gacha/roll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, bannerId }),
      });
      if (!res.ok) throw new Error('Gacha roll failed');
      return res.json() as Promise<GachaResult>;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.characters.all });
    },
  });
}

// Types
export interface CharacterData {
  id: string;
  ownerId: string;
  templateId: string;
  nickname: string | null;
  level: number;
  experience: number;
  condition: number;
  stamina: number;
  efficiency: number;
  precision: number;
  mental: number;
  initiative: number;
  discipline: number;
  luck: number;
  slotIndex: number | null;
  activity: string;
  createdAt: string;
}

export interface GachaBanner {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  ratesJson: Record<string, number>;
  featuredIds: string[];
  startsAt: string | null;
  endsAt: string | null;
}

export interface GachaResult {
  characterId: string;
  grade: string;
  templateName: string;
}
