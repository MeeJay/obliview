import type { Request } from 'express';
import { isMasterTenant } from '@obliview/shared';

/**
 * Resolve the tenant scope for a listing request:
 *   - Platform admin (users.role='admin') connected to the master tenant
 *     → null = cross-tenant fan-out (God View).
 *   - Anyone else → req.tenantId, scoped to the active tenant.
 *
 * Service-layer list methods should accept `number | null` for their
 * `tenantId` parameter and skip the `WHERE tenant_id = ?` clause when null.
 *
 * Must be called after `requireAuth` + `requireTenant` have populated the
 * session and req.tenantId.
 */
export function getEffectiveTenantScope(req: Request): number | null {
  if (req.session?.role === 'admin' && isMasterTenant(req.tenantId)) {
    return null;
  }
  return req.tenantId;
}

/**
 * Same as above but typed as `boolean` — handy when a controller only needs
 * to branch on whether it's a God View call.
 */
export function isGodView(req: Request): boolean {
  return req.session?.role === 'admin' && isMasterTenant(req.tenantId);
}
