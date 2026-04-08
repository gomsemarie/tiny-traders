import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

const API_BASE = '/api/admin';

/** Fetch all rows from an admin table */
export function useAdminTable(tableName: string) {
  return useQuery({
    queryKey: queryKeys.admin.table(tableName),
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${tableName}`);
      if (!res.ok) throw new Error(`Failed to fetch ${tableName}`);
      return res.json() as Promise<{ table: string; rows: Record<string, unknown>[]; count: number }>;
    },
    enabled: !!tableName,
  });
}

/** Fetch available admin tables */
export function useAdminTables() {
  return useQuery({
    queryKey: [...queryKeys.admin.all, 'tables'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/tables`);
      if (!res.ok) throw new Error('Failed to fetch tables');
      return res.json() as Promise<{ tables: string[] }>;
    },
  });
}

/** Create a row */
export function useAdminCreate(tableName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch(`${API_BASE}/${tableName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Create failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.table(tableName) });
    },
  });
}

/** Update a row */
export function useAdminUpdate(tableName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`${API_BASE}/${tableName}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Update failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.table(tableName) });
    },
  });
}

/** Delete a row */
export function useAdminDelete(tableName: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/${tableName}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Delete failed');
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.table(tableName) });
    },
  });
}
