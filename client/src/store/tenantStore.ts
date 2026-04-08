import { create } from 'zustand';
import type { TenantWithRole, ApiResponse } from '@obliview/shared';
import apiClient from '../api/client';

interface TenantState {
  currentTenantId: number | null;
  tenants: TenantWithRole[];
  isLoading: boolean;
  fetchTenants: () => Promise<void>;
  setCurrentTenant: (tenantId: number) => Promise<void>;
}

export const useTenantStore = create<TenantState>((set) => ({
  currentTenantId: null,
  tenants: [],
  isLoading: false,

  fetchTenants: async () => {
    try {
      set({ isLoading: true });
      const res = await apiClient.get<ApiResponse<TenantWithRole[]>>('/tenants');
      set({ tenants: res.data.data ?? [], isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setCurrentTenant: async (tenantId: number) => {
    try {
      await apiClient.post('/tenant/switch', { tenantId });
      // Full page reload to re-fetch ALL tenant-scoped data (sidebar, monitors,
      // agents, notifications, settings, dashboard stats, etc.).
      // This is more reliable than selectively re-fetching each store.
      window.location.reload();
    } catch {
      // ignore
    }
  },
}));
