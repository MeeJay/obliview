import apiClient from './client';
import type {
  UserTeam,
  TeamPermission,
  ApiResponse,
  CreateTeamRequest,
  UpdateTeamRequest,
  SetTeamMembersRequest,
  SetTeamPermissionsRequest,
} from '@obliview/shared';

interface TeamDetail extends UserTeam {
  memberIds: number[];
  permissions: TeamPermission[];
}

export const teamsApi = {
  async list(): Promise<UserTeam[]> {
    const res = await apiClient.get<ApiResponse<UserTeam[]>>('/teams');
    return res.data.data!;
  },

  /** Platform admin: fetch all teams across all tenants (includes tenantName on each team) */
  async listAll(): Promise<UserTeam[]> {
    const res = await apiClient.get<ApiResponse<UserTeam[]>>('/teams?scope=all');
    return res.data.data!;
  },

  async getById(id: number): Promise<TeamDetail> {
    const res = await apiClient.get<ApiResponse<TeamDetail>>(`/teams/${id}`);
    return res.data.data!;
  },

  async create(data: CreateTeamRequest): Promise<UserTeam> {
    const res = await apiClient.post<ApiResponse<UserTeam>>('/teams', data);
    return res.data.data!;
  },

  async update(id: number, data: UpdateTeamRequest): Promise<UserTeam> {
    const res = await apiClient.put<ApiResponse<UserTeam>>(`/teams/${id}`, data);
    return res.data.data!;
  },

  async delete(id: number): Promise<void> {
    await apiClient.delete(`/teams/${id}`);
  },

  async getMembers(id: number): Promise<number[]> {
    const res = await apiClient.get<ApiResponse<number[]>>(`/teams/${id}/members`);
    return res.data.data!;
  },

  async setMembers(id: number, data: SetTeamMembersRequest): Promise<void> {
    await apiClient.put(`/teams/${id}/members`, data);
  },

  async getPermissions(id: number): Promise<TeamPermission[]> {
    const res = await apiClient.get<ApiResponse<TeamPermission[]>>(`/teams/${id}/permissions`);
    return res.data.data!;
  },

  async setPermissions(id: number, data: SetTeamPermissionsRequest): Promise<TeamPermission[]> {
    const res = await apiClient.put<ApiResponse<TeamPermission[]>>(`/teams/${id}/permissions`, data);
    return res.data.data!;
  },

  async removePermission(teamId: number, permId: number): Promise<void> {
    await apiClient.delete(`/teams/${teamId}/permissions/${permId}`);
  },

  // ── Global team target tenants ──

  async getTargetTenants(teamId: number): Promise<Array<{ id: number; name: string; slug: string }>> {
    const res = await apiClient.get<ApiResponse<Array<{ id: number; name: string; slug: string }>>>(`/teams/${teamId}/target-tenants`);
    return res.data.data!;
  },

  async setTargetTenants(teamId: number, tenantIds: number[]): Promise<Array<{ id: number; name: string; slug: string }>> {
    const res = await apiClient.put<ApiResponse<Array<{ id: number; name: string; slug: string }>>>(`/teams/${teamId}/target-tenants`, { tenantIds });
    return res.data.data!;
  },

  async getCrossTenantPermissions(teamId: number): Promise<Record<number, TeamPermission[]>> {
    const res = await apiClient.get<ApiResponse<Record<number, TeamPermission[]>>>(`/teams/${teamId}/cross-tenant-permissions`);
    return res.data.data!;
  },

  async setCrossTenantPermissions(teamId: number, tenantId: number, permissions: Array<{ scope: 'group' | 'monitor'; scopeId: number; level: 'ro' | 'rw' }>): Promise<Record<number, TeamPermission[]>> {
    const res = await apiClient.put<ApiResponse<Record<number, TeamPermission[]>>>(`/teams/${teamId}/cross-tenant-permissions`, { tenantId, permissions });
    return res.data.data!;
  },
};
