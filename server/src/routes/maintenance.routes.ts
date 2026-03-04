import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { maintenanceController } from '../controllers/maintenance.controller';

const router = Router();

router.use(requireAuth);
router.use(requireRole('admin'));

router.get('/', maintenanceController.list);
router.get('/:id', maintenanceController.getById);
router.post('/', maintenanceController.create);
router.put('/:id', maintenanceController.update);
router.delete('/:id', maintenanceController.delete);

export default router;
