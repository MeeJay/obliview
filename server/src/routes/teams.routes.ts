import { Router } from 'express';
import { teamsController } from '../controllers/teams.controller';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import {
  createTeamSchema,
  updateTeamSchema,
  setTeamMembersSchema,
  setTeamPermissionsSchema,
} from '../validators/team.schema';

const router = Router();

// All team routes require admin
router.use(requireAuth);
router.use(requireRole('admin'));

// Team CRUD
router.get('/', teamsController.list);
router.get('/:id', teamsController.getById);
router.post('/', validate(createTeamSchema), teamsController.create);
router.put('/:id', validate(updateTeamSchema), teamsController.update);
router.delete('/:id', teamsController.delete);

// Members
router.get('/:id/members', teamsController.getMembers);
router.put('/:id/members', validate(setTeamMembersSchema), teamsController.setMembers);

// Permissions
router.get('/:id/permissions', teamsController.getPermissions);
router.put('/:id/permissions', validate(setTeamPermissionsSchema), teamsController.setPermissions);
router.delete('/:id/permissions/:permId', teamsController.removePermission);

// Global team target tenants
router.get('/:id/target-tenants', teamsController.getTargetTenants);
router.put('/:id/target-tenants', teamsController.setTargetTenants);

// Cross-tenant permissions (global teams)
router.get('/:id/cross-tenant-permissions', teamsController.getCrossTenantPermissions);
router.put('/:id/cross-tenant-permissions', teamsController.setCrossTenantPermissions);

export default router;
