import { create } from 'zustand';
import type { User, UserPermissions, PermissionLevel } from '@obliview/shared';
import { authApi } from '../api/auth.api';
import { connectSocket, disconnectSocket } from '../socket/socketClient';

interface AuthState {
  user: User | null;
  permissions: UserPermissions | null;
  isLoading: boolean;
  isInitialized: boolean;

  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  refreshPermissions: () => Promise<void>;

  // Convenience permission checkers
  isAdmin: () => boolean;
  canCreate: () => boolean;
  canWriteMonitor: (monitorId: number, groupId: number | null) => boolean;
  canWriteGroup: (groupId: number) => boolean;
  getMonitorPermission: (monitorId: number, groupId: number | null) => PermissionLevel | null;
  getGroupPermission: (groupId: number) => PermissionLevel | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  permissions: null,
  isLoading: false,
  isInitialized: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const user = await authApi.login({ username, password });
      // Fetch permissions after login
      const { permissions } = await authApi.me();
      set({ user, permissions, isLoading: false });
      connectSocket(user.id);
    } catch {
      set({ isLoading: false });
      throw new Error('Invalid username or password');
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      disconnectSocket();
      set({ user: null, permissions: null });
    }
  },

  checkSession: async () => {
    try {
      const { user, permissions } = await authApi.me();
      set({ user, permissions, isInitialized: true });
      connectSocket(user.id);
    } catch {
      set({ user: null, permissions: null, isInitialized: true });
    }
  },

  refreshPermissions: async () => {
    try {
      const permissions = await authApi.getPermissions();
      set({ permissions });
    } catch {
      // Ignore errors
    }
  },

  isAdmin: () => get().user?.role === 'admin',

  canCreate: () => {
    const { user, permissions } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    return permissions?.canCreate ?? false;
  },

  canWriteMonitor: (monitorId: number, groupId: number | null) => {
    const { user, permissions } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!permissions) return false;

    // Check direct monitor permission
    const monitorPerm = permissions.permissions[`monitor:${monitorId}`];
    if (monitorPerm === 'rw') return true;

    // Check group permission
    if (groupId !== null) {
      const groupPerm = permissions.permissions[`group:${groupId}`];
      if (groupPerm === 'rw') return true;
    }

    return false;
  },

  canWriteGroup: (groupId: number) => {
    const { user, permissions } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (!permissions) return false;
    return permissions.permissions[`group:${groupId}`] === 'rw';
  },

  getMonitorPermission: (monitorId: number, groupId: number | null) => {
    const { user, permissions } = get();
    if (!user) return null;
    if (user.role === 'admin') return 'rw';
    if (!permissions) return null;

    const monitorPerm = permissions.permissions[`monitor:${monitorId}`];
    const groupPerm = groupId !== null ? permissions.permissions[`group:${groupId}`] : null;

    if (monitorPerm === 'rw' || groupPerm === 'rw') return 'rw';
    if (monitorPerm === 'ro' || groupPerm === 'ro') return 'ro';
    return null;
  },

  getGroupPermission: (groupId: number) => {
    const { user, permissions } = get();
    if (!user) return null;
    if (user.role === 'admin') return 'rw';
    if (!permissions) return null;
    return permissions.permissions[`group:${groupId}`] ?? null;
  },
}));
