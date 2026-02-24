import apiClient from './client';
import type {
  User,
  UserTeam,
  ApiResponse,
  CreateUserRequest,
  UpdateUserRequest,
} from '@obliview/shared';

export const usersApi = {
  async list(): Promise<User[]> {
    const res = await apiClient.get<ApiResponse<User[]>>('/users');
    return res.data.data!;
  },

  async getById(id: number): Promise<User> {
    const res = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return res.data.data!;
  },

  async create(data: CreateUserRequest): Promise<User> {
    const res = await apiClient.post<ApiResponse<User>>('/users', data);
    return res.data.data!;
  },

  async update(id: number, data: UpdateUserRequest): Promise<User> {
    const res = await apiClient.put<ApiResponse<User>>(`/users/${id}`, data);
    return res.data.data!;
  },

  async changePassword(id: number, password: string): Promise<void> {
    await apiClient.put(`/users/${id}/password`, { password });
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/users/${id}`);
  },

  async getTeams(id: number): Promise<UserTeam[]> {
    const res = await apiClient.get<ApiResponse<UserTeam[]>>(`/users/${id}/teams`);
    return res.data.data!;
  },
};
