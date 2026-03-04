import { db } from '../db';
import type { MaintenanceWindow, MaintenanceScopeType } from '@obliview/shared';
import { getPlugin } from '../notifications/registry';
import { config } from '../config';
import { logger } from '../utils/logger';

// ─── DB Row → domain type ───────────────────────────────────────────────────

interface MaintenanceWindowRow {
  id: number;
  name: string;
  scope_type: string;
  scope_id: number;
  is_override: boolean;
  schedule_type: string;
  start_at: Date | null;
  end_at: Date | null;
  start_time: string | null;
  end_time: string | null;
  recurrence_type: string | null;
  days_of_week: number[] | null;
  timezone: string;
  notify_channel_ids: number[];
  last_notified_start_at: Date | null;
  last_notified_end_at: Date | null;
  active: boolean;
  created_at: Date;
}

function rowToWindow(row: MaintenanceWindowRow): MaintenanceWindow {
  return {
    id: row.id,
    name: row.name,
    scopeType: row.scope_type as MaintenanceWindow['scopeType'],
    scopeId: row.scope_id,
    isOverride: row.is_override,
    scheduleType: row.schedule_type as MaintenanceWindow['scheduleType'],
    startAt: row.start_at?.toISOString() ?? null,
    endAt: row.end_at?.toISOString() ?? null,
    startTime: row.start_time,
    endTime: row.end_time,
    recurrenceType: (row.recurrence_type as MaintenanceWindow['recurrenceType']) ?? null,
    daysOfWeek: row.days_of_week,
    timezone: row.timezone,
    notifyChannelIds: row.notify_channel_ids ?? [],
    lastNotifiedStartAt: row.last_notified_start_at?.toISOString() ?? null,
    lastNotifiedEndAt: row.last_notified_end_at?.toISOString() ?? null,
    active: row.active,
    createdAt: row.created_at.toISOString(),
  };
}

// ─── Time helpers ────────────────────────────────────────────────────────────

/**
 * Get the current HH:MM time string in a given IANA timezone.
 */
function getNowTimeInTz(timezone: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const h = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const m = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  } catch {
    return '00:00';
  }
}

/**
 * Get the current day of week (0=Mon … 6=Sun) in a given IANA timezone.
 */
function getNowDayOfWeekInTz(timezone: string, now: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).formatToParts(now);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
    return map[weekday ?? ''] ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Check if a given HH:MM time is within [startTime, endTime] range in a timezone.
 * Handles overnight ranges (e.g. 23:00 – 01:00).
 */
function isTimeInRange(currentTime: string, startTime: string, endTime: string): boolean {
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  }
  // Overnight range
  return currentTime >= startTime || currentTime <= endTime;
}

/**
 * Pure function: check if a single maintenance window is currently active.
 */
export function isWindowActive(window: MaintenanceWindow, now: Date = new Date()): boolean {
  if (!window.active) return false;

  if (window.scheduleType === 'one_time') {
    if (!window.startAt || !window.endAt) return false;
    const start = new Date(window.startAt);
    const end = new Date(window.endAt);
    return now >= start && now <= end;
  }

  // recurring
  if (!window.startTime || !window.endTime) return false;
  const currentTime = getNowTimeInTz(window.timezone, now);

  if (window.recurrenceType === 'daily') {
    return isTimeInRange(currentTime, window.startTime, window.endTime);
  }

  if (window.recurrenceType === 'weekly') {
    if (!window.daysOfWeek || window.daysOfWeek.length === 0) return false;
    const currentDay = getNowDayOfWeekInTz(window.timezone, now);
    return window.daysOfWeek.includes(currentDay) &&
      isTimeInRange(currentTime, window.startTime, window.endTime);
  }

  return false;
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 60_000; // 60 seconds

interface CacheEntry {
  value: boolean;
  cachedAt: number;
}

const maintenanceCache = new Map<string, CacheEntry>();

function getCached(key: string): boolean | null {
  const entry = maintenanceCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    maintenanceCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key: string, value: boolean): void {
  maintenanceCache.set(key, { value, cachedAt: Date.now() });
}

// ─── Background job handles ───────────────────────────────────────────────────

let cleanupTimer: ReturnType<typeof setInterval> | null = null;
let transitionTimer: ReturnType<typeof setInterval> | null = null;

// ─── Core service ─────────────────────────────────────────────────────────────

export const maintenanceService = {
  // ── CRUD ──────────────────────────────────────────────────────────────────

  async list(filters?: { scopeType?: string; scopeId?: number }): Promise<MaintenanceWindow[]> {
    const query = db<MaintenanceWindowRow>('maintenance_windows').orderBy('created_at', 'desc');
    if (filters?.scopeType) query.where({ scope_type: filters.scopeType });
    if (filters?.scopeId !== undefined) query.where({ scope_id: filters.scopeId });
    const rows = await query;
    return rows.map(rowToWindow);
  },

  async getById(id: number): Promise<MaintenanceWindow | null> {
    const row = await db<MaintenanceWindowRow>('maintenance_windows').where({ id }).first();
    return row ? rowToWindow(row) : null;
  },

  async create(data: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'isActiveNow' | 'scopeName'>): Promise<MaintenanceWindow> {
    const [row] = await db<MaintenanceWindowRow>('maintenance_windows')
      .insert({
        name: data.name,
        scope_type: data.scopeType,
        scope_id: data.scopeId,
        is_override: data.isOverride ?? false,
        schedule_type: data.scheduleType,
        start_at: data.startAt ? new Date(data.startAt) : null,
        end_at: data.endAt ? new Date(data.endAt) : null,
        start_time: data.startTime ?? null,
        end_time: data.endTime ?? null,
        recurrence_type: data.recurrenceType ?? null,
        days_of_week: data.daysOfWeek ?? null,
        timezone: data.timezone ?? 'UTC',
        notify_channel_ids: data.notifyChannelIds ?? [],
        active: data.active ?? true,
      })
      .returning('*');
    maintenanceCache.clear(); // invalidate cache on any write
    return rowToWindow(row);
  },

  async update(id: number, data: Partial<Omit<MaintenanceWindow, 'id' | 'createdAt' | 'isActiveNow' | 'scopeName'>>): Promise<MaintenanceWindow | null> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.scopeType !== undefined) patch.scope_type = data.scopeType;
    if (data.scopeId !== undefined) patch.scope_id = data.scopeId;
    if (data.isOverride !== undefined) patch.is_override = data.isOverride;
    if (data.scheduleType !== undefined) patch.schedule_type = data.scheduleType;
    if ('startAt' in data) patch.start_at = data.startAt ?? null;
    if ('endAt' in data) patch.end_at = data.endAt ?? null;
    if ('startTime' in data) patch.start_time = data.startTime ?? null;
    if ('endTime' in data) patch.end_time = data.endTime ?? null;
    if ('recurrenceType' in data) patch.recurrence_type = data.recurrenceType ?? null;
    if ('daysOfWeek' in data) patch.days_of_week = data.daysOfWeek ?? null;
    if (data.timezone !== undefined) patch.timezone = data.timezone;
    if (data.notifyChannelIds !== undefined) patch.notify_channel_ids = data.notifyChannelIds;
    if (data.active !== undefined) patch.active = data.active;

    if (Object.keys(patch).length === 0) return this.getById(id);

    const [row] = await db<MaintenanceWindowRow>('maintenance_windows')
      .where({ id })
      .update(patch)
      .returning('*');

    maintenanceCache.clear();
    return row ? rowToWindow(row) : null;
  },

  async delete(id: number): Promise<void> {
    await db('maintenance_windows').where({ id }).del();
    maintenanceCache.clear();
  },

  // ── Scope queries ──────────────────────────────────────────────────────────

  async getWindowsForScope(scopeType: MaintenanceScopeType, scopeId: number): Promise<MaintenanceWindow[]> {
    const rows = await db<MaintenanceWindowRow>('maintenance_windows')
      .where({ scope_type: scopeType, scope_id: scopeId, active: true });
    return rows.map(rowToWindow);
  },

  /**
   * Get the ancestor group IDs for a given group (including itself).
   */
  async getAncestorGroupIds(groupId: number): Promise<number[]> {
    const rows = await db('group_closure')
      .where('descendant_id', groupId)
      .select('ancestor_id');
    return rows.map((r: { ancestor_id: number }) => r.ancestor_id);
  },

  /**
   * Resolve which maintenance windows apply to a monitor.
   * - If monitor has any is_override=true windows → use only those.
   * - Otherwise: own windows + ancestor group windows.
   */
  async getWindowsAffectingMonitor(monitorId: number, groupId?: number | null): Promise<MaintenanceWindow[]> {
    const ownRows = await db<MaintenanceWindowRow>('maintenance_windows')
      .where({ scope_type: 'monitor', scope_id: monitorId, active: true });
    const ownWindows = ownRows.map(rowToWindow);

    const hasOverride = ownWindows.some((w) => w.isOverride);
    if (hasOverride) return ownWindows.filter((w) => w.isOverride);

    const groupWindows: MaintenanceWindow[] = [];
    if (groupId) {
      const ancestorIds = await this.getAncestorGroupIds(groupId);
      if (ancestorIds.length > 0) {
        const groupRows = await db<MaintenanceWindowRow>('maintenance_windows')
          .where({ scope_type: 'group', active: true })
          .whereIn('scope_id', ancestorIds);
        groupWindows.push(...groupRows.map(rowToWindow));
      }
    }

    return [...ownWindows, ...groupWindows];
  },

  /**
   * Resolve which maintenance windows apply to an agent device.
   */
  async getWindowsAffectingAgent(deviceId: number, groupId?: number | null): Promise<MaintenanceWindow[]> {
    const ownRows = await db<MaintenanceWindowRow>('maintenance_windows')
      .where({ scope_type: 'agent', scope_id: deviceId, active: true });
    const ownWindows = ownRows.map(rowToWindow);

    const hasOverride = ownWindows.some((w) => w.isOverride);
    if (hasOverride) return ownWindows.filter((w) => w.isOverride);

    const groupWindows: MaintenanceWindow[] = [];
    if (groupId) {
      const ancestorIds = await this.getAncestorGroupIds(groupId);
      if (ancestorIds.length > 0) {
        const groupRows = await db<MaintenanceWindowRow>('maintenance_windows')
          .where({ scope_type: 'group', active: true })
          .whereIn('scope_id', ancestorIds);
        groupWindows.push(...groupRows.map(rowToWindow));
      }
    }

    return [...ownWindows, ...groupWindows];
  },

  // ── isInMaintenance (cached) ──────────────────────────────────────────────

  async isInMaintenance(
    scopeType: 'monitor' | 'agent',
    scopeId: number,
    groupId?: number | null,
  ): Promise<boolean> {
    const cacheKey = `${scopeType}:${scopeId}:${groupId ?? 'null'}`;
    const cached = getCached(cacheKey);
    if (cached !== null) return cached;

    const windows = scopeType === 'monitor'
      ? await this.getWindowsAffectingMonitor(scopeId, groupId)
      : await this.getWindowsAffectingAgent(scopeId, groupId);

    const now = new Date();
    const result = windows.some((w) => isWindowActive(w, now));
    setCache(cacheKey, result);
    return result;
  },

  /**
   * Batch check: returns the set of monitor IDs that are currently in maintenance.
   * Used by the monitor list API to avoid N+1 queries.
   */
  async getInMaintenanceMonitorIds(monitors: Array<{ id: number; groupId: number | null }>): Promise<Set<number>> {
    const result = new Set<number>();
    const now = new Date();

    // Fetch all active windows in one query
    const allWindows = await db<MaintenanceWindowRow>('maintenance_windows')
      .where({ active: true })
      .select('*');
    const windows = allWindows.map(rowToWindow);

    // Build ancestor map for all unique group IDs
    const groupIds = [...new Set(monitors.map((m) => m.groupId).filter((g): g is number => g !== null))];
    const ancestorMap = new Map<number, number[]>();
    if (groupIds.length > 0) {
      const closureRows = await db('group_closure')
        .whereIn('descendant_id', groupIds)
        .select('descendant_id', 'ancestor_id');
      for (const row of closureRows) {
        if (!ancestorMap.has(row.descendant_id)) ancestorMap.set(row.descendant_id, []);
        ancestorMap.get(row.descendant_id)!.push(row.ancestor_id);
      }
    }

    for (const monitor of monitors) {
      // Own monitor windows
      const ownWindows = windows.filter((w) => w.scopeType === 'monitor' && w.scopeId === monitor.id);
      const hasOverride = ownWindows.some((w) => w.isOverride);

      let applicable: MaintenanceWindow[];
      if (hasOverride) {
        applicable = ownWindows.filter((w) => w.isOverride);
      } else {
        const groupWindows = monitor.groupId
          ? windows.filter((w) => w.scopeType === 'group' && (ancestorMap.get(monitor.groupId!) ?? []).includes(w.scopeId))
          : [];
        applicable = [...ownWindows, ...groupWindows];
      }

      if (applicable.some((w) => isWindowActive(w, now))) {
        result.add(monitor.id);
      }
    }

    return result;
  },

  // ── Background jobs ────────────────────────────────────────────────────────

  /**
   * Delete one-time windows that have expired.
   */
  async cleanupExpiredOneTime(): Promise<void> {
    await db('maintenance_windows')
      .where({ schedule_type: 'one_time' })
      .where('end_at', '<', new Date())
      .del();
  },

  /**
   * Send start/end notifications for windows that just became active or inactive.
   * Uses last_notified_start_at / last_notified_end_at to deduplicate.
   */
  async checkMaintenanceTransitions(): Promise<void> {
    const rows = await db<MaintenanceWindowRow>('maintenance_windows')
      .where({ active: true })
      .whereRaw('array_length(notify_channel_ids, 1) > 0')
      .select('*');

    const now = new Date();

    for (const row of rows) {
      const window = rowToWindow(row);
      const active = isWindowActive(window, now);

      if (active && !window.lastNotifiedStartAt) {
        // Window just became active — send start notification
        await this._sendMaintenanceNotification(window, 'start');
        await db('maintenance_windows').where({ id: window.id }).update({
          last_notified_start_at: now,
          last_notified_end_at: null, // reset end so we notify again if it cycles
        });
      } else if (!active && window.lastNotifiedStartAt && !window.lastNotifiedEndAt) {
        // Window just became inactive — send end notification
        await this._sendMaintenanceNotification(window, 'end');
        await db('maintenance_windows').where({ id: window.id }).update({
          last_notified_end_at: now,
        });
      }
    }
  },

  async _sendMaintenanceNotification(window: MaintenanceWindow, event: 'start' | 'end'): Promise<void> {
    if (window.notifyChannelIds.length === 0) return;
    try {
      const message = event === 'start'
        ? `Maintenance window "${window.name}" has started. Alerts are suppressed during this period.`
        : `Maintenance window "${window.name}" has ended. Monitoring resumed.`;

      const payload = {
        monitorName: window.name,
        oldStatus: event === 'start' ? 'up' : 'maintenance',
        newStatus: event === 'start' ? 'maintenance' : 'up',
        message,
        timestamp: new Date().toISOString(),
        appName: config.appName,
      };

      const channels = await db('notification_channels')
        .whereIn('id', window.notifyChannelIds)
        .where({ is_enabled: true });

      for (const ch of channels) {
        const plugin = getPlugin(ch.type);
        if (!plugin) continue;
        try {
          // Resolve SMTP server config if needed (same pattern as notificationService)
          let resolvedConfig: Record<string, unknown> = ch.config;
          if (ch.type === 'smtp' && ch.config?.smtpServerId) {
            const { smtpServerService } = await import('./smtpServer.service');
            const srv = await smtpServerService.getTransportConfig(Number(ch.config.smtpServerId));
            if (srv) resolvedConfig = { ...ch.config, host: srv.host, port: srv.port, secure: srv.secure, username: srv.username, password: srv.password, fromAddress: srv.fromAddress };
          }
          await plugin.send(resolvedConfig, payload);
          logger.info(`[Maintenance] Notification sent (${event}) via ${ch.name} for window "${window.name}"`);
        } catch (err) {
          logger.error(err, `[Maintenance] Failed to notify channel ${ch.id}`);
        }
      }
    } catch (err) {
      logger.error(err, '[MaintenanceService] Failed to send transition notification');
    }
  },

  startJobs(): void {
    // Cleanup expired one-time windows every 5 minutes
    cleanupTimer = setInterval(() => {
      this.cleanupExpiredOneTime().catch((err) =>
        console.error('[MaintenanceService] Cleanup job error:', err),
      );
    }, 5 * 60 * 1000);

    // Check for maintenance transitions every 60 seconds
    transitionTimer = setInterval(() => {
      maintenanceCache.clear(); // also refresh the cache every minute
      this.checkMaintenanceTransitions().catch((err) =>
        console.error('[MaintenanceService] Transition job error:', err),
      );
    }, 60 * 1000);

    console.log('[MaintenanceService] Background jobs started.');
  },

  stopJobs(): void {
    if (cleanupTimer) { clearInterval(cleanupTimer); cleanupTimer = null; }
    if (transitionTimer) { clearInterval(transitionTimer); transitionTimer = null; }
  },
};
