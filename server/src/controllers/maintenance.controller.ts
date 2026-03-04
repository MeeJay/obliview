import type { Request, Response } from 'express';
import { maintenanceService, isWindowActive } from '../services/maintenance.service';
import type { CreateMaintenanceWindowRequest, UpdateMaintenanceWindowRequest } from '@obliview/shared';
import { db } from '../db';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function enrichWindow(w: Awaited<ReturnType<typeof maintenanceService.getById>>) {
  if (!w) return null;
  const now = new Date();
  const isActiveNow = isWindowActive(w, now);

  // Resolve scope name
  let scopeName = `#${w.scopeId}`;
  try {
    if (w.scopeType === 'group') {
      const row = await db('monitor_groups').where({ id: w.scopeId }).select('name').first();
      if (row) scopeName = row.name;
    } else if (w.scopeType === 'monitor') {
      const row = await db('monitors').where({ id: w.scopeId }).select('name').first();
      if (row) scopeName = row.name;
    } else if (w.scopeType === 'agent') {
      const row = await db('agent_devices').where({ id: w.scopeId }).select('name', 'hostname').first();
      if (row) scopeName = row.name ?? row.hostname;
    }
  } catch { /* ignore */ }

  return { ...w, isActiveNow, scopeName };
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const maintenanceController = {
  async list(req: Request, res: Response) {
    try {
      const { scopeType, scopeId } = req.query;
      const filters: { scopeType?: string; scopeId?: number } = {};
      if (typeof scopeType === 'string') filters.scopeType = scopeType;
      if (typeof scopeId === 'string') filters.scopeId = Number(scopeId);

      const windows = await maintenanceService.list(filters);
      const enriched = await Promise.all(windows.map(enrichWindow));
      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const window = await maintenanceService.getById(id);
      if (!window) return res.status(404).json({ success: false, error: 'Not found' });
      const enriched = await enrichWindow(window);
      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async create(req: Request, res: Response) {
    try {
      const body: CreateMaintenanceWindowRequest = req.body;

      if (!body.name || !body.scopeType || !body.scopeId || !body.scheduleType) {
        return res.status(400).json({ success: false, error: 'name, scopeType, scopeId and scheduleType are required' });
      }
      if (body.scheduleType === 'one_time' && (!body.startAt || !body.endAt)) {
        return res.status(400).json({ success: false, error: 'startAt and endAt are required for one-time windows' });
      }
      if (body.scheduleType === 'recurring' && (!body.startTime || !body.endTime || !body.recurrenceType)) {
        return res.status(400).json({ success: false, error: 'startTime, endTime and recurrenceType are required for recurring windows' });
      }

      const created = await maintenanceService.create({
        name: body.name,
        scopeType: body.scopeType,
        scopeId: body.scopeId,
        isOverride: body.isOverride ?? false,
        scheduleType: body.scheduleType,
        startAt: body.startAt ?? null,
        endAt: body.endAt ?? null,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        recurrenceType: body.recurrenceType ?? null,
        daysOfWeek: body.daysOfWeek ?? null,
        timezone: body.timezone ?? 'UTC',
        notifyChannelIds: body.notifyChannelIds ?? [],
        lastNotifiedStartAt: null,
        lastNotifiedEndAt: null,
        active: body.active ?? true,
      });

      const enriched = await enrichWindow(created);
      return res.status(201).json({ success: true, data: enriched });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const body: UpdateMaintenanceWindowRequest = req.body;

      const updated = await maintenanceService.update(id, body);
      if (!updated) return res.status(404).json({ success: false, error: 'Not found' });

      const enriched = await enrichWindow(updated);
      return res.json({ success: true, data: enriched });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },

  async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const existing = await maintenanceService.getById(id);
      if (!existing) return res.status(404).json({ success: false, error: 'Not found' });
      await maintenanceService.delete(id);
      return res.json({ success: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
  },
};
