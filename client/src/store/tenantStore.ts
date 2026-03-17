import { create } from 'zustand';
import type { TenantWithRole, ApiResponse } from '@obliview/shared';
import { useGroupStore } from './groupStore';
import { useAuthStore } from './authStore';
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
      set({ currentTenantId: tenantId });
      // Reload group collapsed state for the new tenant context
      const userId = useAuthStore.getState().user?.id ?? null;
      useGroupStore.getState().reinitForTenant(userId, tenantId);
    } catch {
      // ignore
    }
  },
}));
