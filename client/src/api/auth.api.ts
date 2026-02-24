import apiClient from './client';
import type { User, UserPermissions, ApiResponse, LoginRequest, LoginResponse } from '@obliview/shared';

export const authApi = {
  async login(data: LoginRequest): Promise<User> {
    const res = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data);
    return res.data.data!.user;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async me(): Promise<{ user: User; permissions: UserPermissions }> {
    const res = await apiClient.get<ApiResponse<{ user: User; permissions: UserPermissions }>>('/auth/me');
    return res.data.data!;
  },

  async getPermissions(): Promise<UserPermissions> {
    const res = await apiClient.get<ApiResponse<UserPermissions>>('/auth/permissions');
    return res.data.data!;
  },
};
