import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@obliview/shared';
import { isMasterTenant } from '@obliview/shared';
import { AppError } from './errorHandler';
import { permissionService } from '../services/permission.service';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session?.userId) {
      next(new AppError(401, 'Authentication required'));
      return;
    }

    if (!roles.includes(req.session.role as UserRole)) {
      next(new AppError(403, 'Insufficient permissions'));
      return;
    }

    next();
  };
}

/**
 * Require write permission on a monitor (id from req.params.id).
 * Admins always pass. Non-admins need RW via their teams.
 */
export function requireMonitorWrite() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.session.role === 'admin') return next();
      const monitorId = parseInt(req.params.id, 10);
      if (isNaN(monitorId)) return next(new AppError(400, 'Invalid monitor ID'));
      const canWrite = await permissionService.canWriteMonitor(req.session.userId!, monitorId, false);
      if (!canWrite) return next(new AppError(403, 'Insufficient permissions'));
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require write permission on a group (id from req.params.id).
 */
export function requireGroupWrite() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.session.role === 'admin') return next();
      const groupId = parseInt(req.params.id, 10);
      if (isNaN(groupId)) return next(new AppError(400, 'Invalid group ID'));
      const canWrite = await permissionService.canWriteGroup(req.session.userId!, groupId, false);
      if (!canWrite) return next(new AppError(403, 'Insufficient permissions'));
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require canCreate permission (for creating new monitors/groups).
 */
export function requireCanCreate() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.session.role === 'admin') return next();
      const canCreate = await permissionService.canCreate(req.session.userId!, false);
      if (!canCreate) return next(new AppError(403, 'Insufficient permissions'));
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require a tenant-wide capability resolved from the active permission_set
 * attached to the user via user_tenants.role.
 *
 * Order of checks:
 *   1. Platform admins (users.role='admin') always pass — they sit above the
 *      tenant capability matrix.
 *   2. Tenant role='admin' short-circuits (see permission.service).
 *   3. Otherwise the capability must be present in the permission_set.
 *
 * Must be applied AFTER `requireAuth` and `requireTenant`.
 */
export function requireTenantCapability(capability: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.session.role === 'admin') return next();
      const ok = await permissionService.userHasTenantCapability(
        req.session.userId!,
        req.tenantId,
        capability,
      );
      if (!ok) return next(new AppError(403, `Missing capability: ${capability}`));
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Require the caller to be a platform admin (users.role='admin').
 * This is the global, tenant-agnostic admin gate — distinct from a
 * tenant-scoped 'admin' role carried by user_tenants.
 */
export function requirePlatformAdmin() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.session.role !== 'admin') {
      next(new AppError(403, 'Platform admin required'));
      return;
    }
    next();
  };
}

/**
 * Require the active tenant to be the master tenant (God View). Combine with
 * requirePlatformAdmin() for endpoints that fan out across all tenants.
 */
export function requireMasterTenant() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!isMasterTenant(req.tenantId)) {
      next(new AppError(403, 'Master tenant required'));
      return;
    }
    next();
  };
}
