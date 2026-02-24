import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { PushMonitorWorker } from '../workers/PushMonitorWorker';

const router = Router();

/**
 * POST /api/heartbeat/:token
 * GET  /api/heartbeat/:token
 *
 * Public endpoint for push monitors. External systems call this URL
 * to signal they are alive. No authentication required — the token
 * itself is the secret.
 */
router.all('/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Find the monitor with this push token
    const monitor = await db('monitors')
      .where({ push_token: token, type: 'push' })
      .first('id', 'is_active', 'status');

    if (!monitor) {
      res.status(404).json({ success: false, error: 'Invalid push token' });
      return;
    }

    if (!monitor.is_active || monitor.status === 'paused') {
      res.status(200).json({ success: true, message: 'Monitor is paused' });
      return;
    }

    // Record the push timestamp
    PushMonitorWorker.recordPush(monitor.id);

    res.json({ success: true, message: 'OK' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
