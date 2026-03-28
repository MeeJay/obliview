import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { permissionSetService } from '../services/permissionSet.service';

const router = Router();

// All routes require auth
router.use(requireAuth);

/** GET /api/permission-sets — list all permission sets */
router.get('/', async (_req, res, next) => {
  try {
    const sets = await permissionSetService.getAll();
    res.json({ success: true, data: sets });
  } catch (err) {
    next(err);
  }
});

/** GET /api/permission-sets/capabilities — list available capabilities */
router.get('/capabilities', async (_req, res, next) => {
  try {
    const capabilities = permissionSetService.getAvailableCapabilities();
    res.json({ success: true, data: capabilities });
  } catch (err) {
    next(err);
  }
});

/** POST /api/permission-sets — create a custom permission set (admin only) */
router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, slug, capabilities } = req.body as { name: string; slug: string; capabilities: string[] };
    if (!name || !slug || !Array.isArray(capabilities)) {
      res.status(400).json({ success: false, error: 'Missing required fields: name, slug, capabilities' });
      return;
    }
    const set = await permissionSetService.create({ name, slug, capabilities });
    res.status(201).json({ success: true, data: set });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ success: false, error: 'A permission set with this slug already exists' });
      return;
    }
    next(err);
  }
});

/** PUT /api/permission-sets/:id — update a permission set (admin only) */
router.put('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
    const { name, capabilities } = req.body as { name?: string; capabilities?: string[] };
    const set = await permissionSetService.update(id, { name, capabilities });
    if (!set) { res.status(404).json({ success: false, error: 'Permission set not found' }); return; }
    res.json({ success: true, data: set });
  } catch (err) {
    next(err);
  }
});

/** DELETE /api/permission-sets/:id — delete a non-default permission set (admin only) */
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid ID' }); return; }
    const deleted = await permissionSetService.delete(id);
    if (!deleted) {
      res.status(400).json({ success: false, error: 'Cannot delete: set not found or is a default set' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
