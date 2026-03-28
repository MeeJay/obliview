import type { Request, Response, NextFunction } from 'express';
import { teamService } from '../services/team.service';
import { AppError } from '../middleware/errorHandler';
import type {
  CreateTeamInput,
  UpdateTeamInput,
  SetTeamMembersInput,
  SetTeamPermissionsInput,
} from '../validators/team.schema';

export const teamsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Platform admins can request all teams across tenants via ?scope=all
      // Otherwise scope to the current tenant from session
      const isPlatformAdmin = req.session.role === 'admin';
      const scopeAll = isPlatformAdmin && req.query.scope === 'all';
      const teams = await teamService.getAll(scopeAll ? null : req.tenantId);
      res.json({ success: true, data: teams });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const team = await teamService.getById(id);
      if (!team) throw new AppError(404, 'Team not found');

      const [members, permissions] = await Promise.all([
        teamService.getMembers(id),
        teamService.getPermissions(id),
      ]);

      res.json({ success: true, data: { ...team, memberIds: members, permissions } });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = req.body as CreateTeamInput & { tenantId?: number; isGlobal?: boolean };
      // Platform admins can specify the target tenant in the body; others use the session tenant
      const isPlatformAdmin = req.session.role === 'admin';
      const targetTenantId = (isPlatformAdmin && data.tenantId) ? data.tenantId : req.tenantId;
      // Only the default tenant (id=1) can create global teams
      if (data.isGlobal && targetTenantId !== 1) {
        throw new AppError(400, 'Global teams can only be created in the default tenant');
      }
      const team = await teamService.create(data, targetTenantId);
      res.status(201).json({ success: true, data: team });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        next(new AppError(409, 'Team name already exists'));
      } else {
        next(err);
      }
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      // Block editing global teams unless user is in the default tenant
      const existing = await teamService.getById(id);
      if (existing?.isGlobal && req.tenantId !== 1) {
        throw new AppError(403, 'Only the default tenant admin can edit global teams');
      }
      const data = req.body as UpdateTeamInput;
      const team = await teamService.update(id, data);
      if (!team) throw new AppError(404, 'Team not found');
      res.json({ success: true, data: team });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('unique')) {
        next(new AppError(409, 'Team name already exists'));
      } else {
        next(err);
      }
    }
  },

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      // Block deleting global teams unless user is in the default tenant
      const existing = await teamService.getById(id);
      if (existing?.isGlobal && req.tenantId !== 1) {
        throw new AppError(403, 'Only the default tenant admin can delete global teams');
      }
      const deleted = await teamService.delete(id);
      if (!deleted) throw new AppError(404, 'Team not found');
      res.json({ success: true, message: 'Team deleted' });
    } catch (err) {
      next(err);
    }
  },

  // ── Members ──

  async getMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const members = await teamService.getMembers(id);
      res.json({ success: true, data: members });
    } catch (err) {
      next(err);
    }
  },

  async setMembers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { userIds } = req.body as SetTeamMembersInput;
      await teamService.setMembers(id, userIds);
      res.json({ success: true, data: userIds });
    } catch (err) {
      next(err);
    }
  },

  // ── Permissions ──

  async getPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const permissions = await teamService.getPermissions(id);
      res.json({ success: true, data: permissions });
    } catch (err) {
      next(err);
    }
  },

  async setPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const { permissions } = req.body as SetTeamPermissionsInput;
      const result = await teamService.setPermissions(id, permissions);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async removePermission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permId = parseInt(req.params.permId, 10);
      const deleted = await teamService.removePermission(permId);
      if (!deleted) throw new AppError(404, 'Permission not found');
      res.json({ success: true, message: 'Permission removed' });
    } catch (err) {
      next(err);
    }
  },

  // ── Global team target tenants ──

  async getTargetTenants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const team = await teamService.getById(id);
      if (!team) throw new AppError(404, 'Team not found');
      if (!team.isGlobal) { res.json({ success: true, data: [] }); return; }
      const tenants = await teamService.getTargetTenants(id);
      res.json({ success: true, data: tenants });
    } catch (err) {
      next(err);
    }
  },

  async setTargetTenants(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const team = await teamService.getById(id);
      if (!team) throw new AppError(404, 'Team not found');
      if (!team.isGlobal) throw new AppError(400, 'Only global teams can have target tenants');
      if (req.tenantId !== 1) throw new AppError(403, 'Only the default tenant admin can manage global team targets');
      const { tenantIds } = req.body as { tenantIds: number[] };
      if (!Array.isArray(tenantIds)) throw new AppError(400, 'tenantIds must be an array');
      await teamService.setTargetTenants(id, tenantIds);
      const tenants = await teamService.getTargetTenants(id);
      res.json({ success: true, data: tenants });
    } catch (err) {
      next(err);
    }
  },

  async getCrossTenantPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const team = await teamService.getById(id);
      if (!team) throw new AppError(404, 'Team not found');
      const perms = await teamService.getCrossTenantPermissions(id);
      res.json({ success: true, data: perms });
    } catch (err) {
      next(err);
    }
  },

  async setCrossTenantPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseInt(req.params.id, 10);
      const team = await teamService.getById(id);
      if (!team) throw new AppError(404, 'Team not found');
      if (!team.isGlobal) throw new AppError(400, 'Only global teams can have cross-tenant permissions');
      if (req.tenantId !== 1) throw new AppError(403, 'Only the default tenant admin can manage cross-tenant permissions');
      const { tenantId, permissions } = req.body as {
        tenantId: number;
        permissions: Array<{ scope: 'group' | 'monitor'; scopeId: number; level: 'ro' | 'rw' }>;
      };
      if (!tenantId || !Array.isArray(permissions)) throw new AppError(400, 'Invalid body');

      // Get existing permissions, remove ones for this tenant, add new ones
      const existing = await teamService.getPermissions(id);
      const crossTenantPerms = await teamService.getCrossTenantPermissions(id);
      const idsToRemove = (crossTenantPerms[tenantId] ?? []).map(p => p.id);

      // Remove old permissions for this tenant
      for (const pid of idsToRemove) {
        await teamService.removePermission(pid);
      }
      // Add new permissions
      for (const p of permissions) {
        await teamService.addPermission(id, p.scope, p.scopeId, p.level);
      }

      const updated = await teamService.getCrossTenantPermissions(id);
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
};
