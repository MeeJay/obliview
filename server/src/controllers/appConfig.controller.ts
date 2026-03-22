import type { Request, Response, NextFunction } from 'express';
import { appConfigService } from '../services/appConfig.service';
import { AppError } from '../middleware/errorHandler';

const ALLOWED_KEYS = [
  'allow_2fa', 'force_2fa', 'otp_smtp_server_id',
  'enable_foreign_sso', 'enable_oblimap_sso', 'enable_obliance_sso',
  'obligate_enabled',
] as const;

export const appConfigController = {
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cfg = await appConfigService.getAll();
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  async set(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const key = req.params.key as typeof ALLOWED_KEYS[number];
      if (!ALLOWED_KEYS.includes(key)) throw new AppError(400, `Unknown config key: ${key}`);
      const { value } = req.body;
      if (value === undefined) throw new AppError(400, 'Missing value');
      await appConfigService.set(key, String(value));
      res.json({ success: true });
    } catch (err) { next(err); }
  },

  /** GET /admin/config/agent-global */
  async getAgentGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cfg = await appConfigService.getAgentGlobal();
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  /** PATCH /admin/config/agent-global */
  async patchAgentGlobal(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { checkIntervalSeconds, heartbeatMonitoring, maxMissedPushes, notificationTypes } = req.body;
      const patch: Record<string, unknown> = {};
      if ('checkIntervalSeconds' in req.body) patch.checkIntervalSeconds = checkIntervalSeconds;
      if ('heartbeatMonitoring' in req.body) patch.heartbeatMonitoring = heartbeatMonitoring;
      if ('maxMissedPushes' in req.body) patch.maxMissedPushes = maxMissedPushes;
      if ('notificationTypes' in req.body) patch.notificationTypes = notificationTypes;
      const updated = await appConfigService.setAgentGlobal(patch);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  /** GET /admin/config/obliguard — returns { url, apiKeySet } (admin only) */
  async getObliguardConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cfg = await appConfigService.getObliguardConfig();
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  /** PUT /admin/config/obliguard — partial update: url and/or apiKey (admin only) */
  async setObliguardConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patch: { url?: string | null; apiKey?: string | null } = {};
      if ('url' in req.body) patch.url = (req.body as { url?: string | null }).url?.trim() || null;
      if ('apiKey' in req.body) patch.apiKey = (req.body as { apiKey?: string | null }).apiKey?.trim() || null;
      const updated = await appConfigService.patchObliguardConfig(patch);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  // ── Oblimap ────────────────────────────────────────────────────────────────

  /** GET /admin/config/oblimap — returns { url, apiKeySet } (admin only) */
  async getOblimapConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cfg = await appConfigService.getOblimapConfig();
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  /** PUT /admin/config/oblimap — partial update (admin only) */
  async setOblimapConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patch: { url?: string | null; apiKey?: string | null } = {};
      if ('url' in req.body) patch.url = (req.body as { url?: string | null }).url?.trim() || null;
      if ('apiKey' in req.body) patch.apiKey = (req.body as { apiKey?: string | null }).apiKey?.trim() || null;
      const updated = await appConfigService.patchOblimapConfig(patch);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  // ── Obligate SSO gateway ───────────────────────────────────────────────────

  async getObligateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cfg = await appConfigService.getObligateConfig();
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  async setObligateConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patch: { url?: string | null; apiKey?: string | null; enabled?: boolean } = {};
      if ('url' in req.body) patch.url = (req.body as { url?: string | null }).url?.trim() || null;
      if ('apiKey' in req.body) patch.apiKey = (req.body as { apiKey?: string | null }).apiKey?.trim() || null;
      if ('enabled' in req.body) patch.enabled = !!req.body.enabled;
      const updated = await appConfigService.patchObligateConfig(patch);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },

  // ── Obliance ───────────────────────────────────────────────────────────────

  /** GET /admin/config/obliance — returns { url, apiKeySet } (admin only) */
  async getOblianceConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const cfg = await appConfigService.getOblianceConfig();
      res.json({ success: true, data: cfg });
    } catch (err) { next(err); }
  },

  /** PUT /admin/config/obliance — partial update (admin only) */
  async setOblianceConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const patch: { url?: string | null; apiKey?: string | null } = {};
      if ('url' in req.body) patch.url = (req.body as { url?: string | null }).url?.trim() || null;
      if ('apiKey' in req.body) patch.apiKey = (req.body as { apiKey?: string | null }).apiKey?.trim() || null;
      const updated = await appConfigService.patchOblianceConfig(patch);
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  },
};
