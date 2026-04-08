import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './query-keys';

// Types
export interface FacilityDefinition {
  id: string;
  name: string;
  type: string;
  shapeJson: Array<[number, number]>;
  maxLevel: number;
  baseCost: number;
  buildTime: number;
  description?: string;
  effectsJson?: Record<string, unknown>;
}

export interface PlacedFacility {
  id: string;
  definitionId: string;
  grade: number;
  gridX: number;
  gridY: number;
  rotation: number;
  status: 'active' | 'building' | 'damaged';
  isCollateral: boolean;
}

export interface GridCell {
  type: 'empty' | 'facility' | 'house' | 'placement' | 'path';
  entityId?: string;
}

export interface GridState {
  width: number;
  height: number;
  cells: GridCell[][];
  pathTiles: Array<[number, number]>;
  facilities?: PlacedFacility[];
}

export interface PathResult {
  found: boolean;
  path: Array<[number, number]>;
  distance: number;
}

// Query Keys
const facilityKeys = {
  all: ['facilities'] as const,
  definitions: () => ['facilities', 'definitions'] as const,
  grid: (userId: string) => ['facilities', 'grid', userId] as const,
} as const;

// Hooks
export function useFacilityDefinitions() {
  return useQuery({
    queryKey: facilityKeys.definitions(),
    queryFn: async () => {
      const res = await fetch('/api/facilities/definitions');
      if (!res.ok) throw new Error('Failed to fetch facility definitions');
      return res.json() as Promise<{ definitions: FacilityDefinition[] }>;
    },
  });
}

export function useGrid(userId: string) {
  return useQuery({
    queryKey: facilityKeys.grid(userId),
    queryFn: async () => {
      const res = await fetch(`/api/grid/${userId}`);
      if (!res.ok) throw new Error('Failed to fetch grid');
      return res.json() as Promise<GridState>;
    },
    enabled: !!userId,
  });
}

export function usePlaceFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      definitionId,
      gridX,
      gridY,
      rotation = 0,
    }: {
      userId: string;
      definitionId: string;
      gridX: number;
      gridY: number;
      rotation?: number;
    }) => {
      const res = await fetch(`/api/facilities/${userId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ definitionId, gridX, gridY, rotation }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to place facility');
      }
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: facilityKeys.grid(userId) });
    },
  });
}

export function useRemoveFacility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, facilityId }: { userId: string; facilityId: string }) => {
      const res = await fetch(`/api/facility/${facilityId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to remove facility');
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: facilityKeys.grid(userId) });
    },
  });
}

export function usePlaceWalkway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, x, y }: { userId: string; x: number; y: number }) => {
      const res = await fetch(`/api/grid/${userId}/path`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to place walkway');
      }
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: facilityKeys.grid(userId) });
    },
  });
}

export function useRemoveWalkway() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, x, y }: { userId: string; x: number; y: number }) => {
      const res = await fetch(`/api/grid/${userId}/path`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y }),
      });
      if (!res.ok) throw new Error('Failed to remove walkway');
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: facilityKeys.grid(userId) });
    },
  });
}

export function useExpandGrid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      width,
      height,
    }: {
      userId: string;
      width: number;
      height: number;
    }) => {
      const res = await fetch(`/api/grid/${userId}/expand`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width, height }),
      });
      if (!res.ok) throw new Error('Failed to expand grid');
      return res.json();
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: facilityKeys.grid(userId) });
    },
  });
}

export function useFindPath() {
  return useMutation({
    mutationFn: async ({
      userId,
      startX,
      startY,
      targetX,
      targetY,
    }: {
      userId: string;
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
    }) => {
      const res = await fetch(`/api/grid/${userId}/pathfind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startX, startY, targetX, targetY }),
      });
      if (!res.ok) throw new Error('Failed to find path');
      return res.json() as Promise<PathResult>;
    },
  });
}
