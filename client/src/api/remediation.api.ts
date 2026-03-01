import apiClient from './client';
import type {
  RemediationAction,
  RemediationBinding,
  ResolvedRemediationBinding,
  RemediationRun,
  CreateRemediationActionRequest,
  UpdateRemediationActionRequest,
  AddRemediationBindingRequest,
  OverrideModeR,
  RemediationTrigger,
  ApiResponse,
} from '@obliview/shared';

export const remediationApi = {
  // ── Actions ────────────────────────────────────────────────────────────────

  async listActions(): Promise<RemediationAction[]> {
    const res = await apiClient.get<ApiResponse<RemediationAction[]>>('/remediation/actions');
    return res.data.data!;
  },

  async createAction(data: CreateRemediationActionRequest): Promise<RemediationAction> {
    const res = await apiClient.post<ApiResponse<RemediationAction>>('/remediation/actions', data);
    return res.data.data!;
  },

  async updateAction(id: number, data: UpdateRemediationActionRequest): Promise<RemediationAction> {
    const res = await apiClient.put<ApiResponse<RemediationAction>>(`/remediation/actions/${id}`, data);
    return res.data.data!;
  },

  async deleteAction(id: number): Promise<void> {
    await apiClient.delete(`/remediation/actions/${id}`);
  },

  // ── Bindings ───────────────────────────────────────────────────────────────

  async getBindings(scope: string, scopeId: number | null): Promise<RemediationBinding[]> {
    const params: Record<string, string | number | null> = { scope };
    if (scopeId !== null) params.scopeId = scopeId;
    const res = await apiClient.get<ApiResponse<RemediationBinding[]>>('/remediation/bindings', { params });
    return res.data.data!;
  },

  async getResolved(
    scope: 'group' | 'monitor',
    scopeId: number,
    groupId?: number | null,
  ): Promise<Array<ResolvedRemediationBinding & { source: string; isDirect: boolean }>> {
    const params: Record<string, string | number | null | undefined> = { scope, scopeId };
    if (groupId != null) params.groupId = groupId;
    const res = await apiClient.get<ApiResponse<Array<ResolvedRemediationBinding & { source: string; isDirect: boolean }>>>(
      '/remediation/resolved',
      { params },
    );
    return res.data.data!;
  },

  async addBinding(data: AddRemediationBindingRequest): Promise<RemediationBinding> {
    const res = await apiClient.post<ApiResponse<RemediationBinding>>('/remediation/bindings', data);
    return res.data.data!;
  },

  async updateBinding(
    id: number,
    data: { overrideMode?: OverrideModeR; triggerOn?: RemediationTrigger; cooldownSeconds?: number },
  ): Promise<RemediationBinding> {
    const res = await apiClient.patch<ApiResponse<RemediationBinding>>(`/remediation/bindings/${id}`, data);
    return res.data.data!;
  },

  async deleteBinding(id: number): Promise<void> {
    await apiClient.delete(`/remediation/bindings/${id}`);
  },

  // ── Run history ────────────────────────────────────────────────────────────

  async getRunsForMonitor(monitorId: number): Promise<RemediationRun[]> {
    const res = await apiClient.get<ApiResponse<RemediationRun[]>>('/remediation/runs', {
      params: { monitorId },
    });
    return res.data.data!;
  },

  async getRunsForAction(actionId: number): Promise<RemediationRun[]> {
    const res = await apiClient.get<ApiResponse<RemediationRun[]>>('/remediation/runs', {
      params: { actionId },
    });
    return res.data.data!;
  },
};
