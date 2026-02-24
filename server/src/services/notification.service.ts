import { db } from '../db';
import type { NotificationChannel, NotificationBinding, OverrideMode } from '@obliview/shared';
import type { NotificationPayload } from '../notifications/types';
import { getPlugin } from '../notifications/registry';
import { config } from '../config';
import { logger } from '../utils/logger';

interface ChannelRow {
  id: number;
  name: string;
  type: string;
  config: Record<string, unknown>;
  is_enabled: boolean;
  created_by: number | null;
  created_at: Date;
  updated_at: Date;
}

interface BindingRow {
  id: number;
  channel_id: number;
  scope: string;
  scope_id: number | null;
  override_mode: string;
}

function rowToChannel(row: ChannelRow): NotificationChannel {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    config: typeof row.config === 'string' ? JSON.parse(row.config) : row.config,
    isEnabled: row.is_enabled,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function rowToBinding(row: BindingRow): NotificationBinding {
  return {
    id: row.id,
    channelId: row.channel_id,
    scope: row.scope as NotificationBinding['scope'],
    scopeId: row.scope_id,
    overrideMode: row.override_mode as OverrideMode,
  };
}

export const notificationService = {
  // ── Channel CRUD ──

  async getAllChannels(): Promise<NotificationChannel[]> {
    const rows = await db<ChannelRow>('notification_channels').orderBy('name');
    return rows.map(rowToChannel);
  },

  async getChannelById(id: number): Promise<NotificationChannel | null> {
    const row = await db<ChannelRow>('notification_channels').where({ id }).first();
    return row ? rowToChannel(row) : null;
  },

  async createChannel(data: {
    name: string;
    type: string;
    config: Record<string, unknown>;
    isEnabled?: boolean;
    createdBy?: number;
  }): Promise<NotificationChannel> {
    const plugin = getPlugin(data.type);
    if (!plugin) throw new Error(`Unknown notification type: ${data.type}`);

    const [row] = await db<ChannelRow>('notification_channels')
      .insert({
        name: data.name,
        type: data.type,
        config: JSON.stringify(data.config) as unknown as Record<string, unknown>,
        is_enabled: data.isEnabled ?? true,
        created_by: data.createdBy ?? null,
      })
      .returning('*');

    return rowToChannel(row);
  },

  async updateChannel(id: number, data: {
    name?: string;
    config?: Record<string, unknown>;
    isEnabled?: boolean;
  }): Promise<NotificationChannel | null> {
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (data.name !== undefined) updateData.name = data.name;
    if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
    if (data.isEnabled !== undefined) updateData.is_enabled = data.isEnabled;

    const [row] = await db<ChannelRow>('notification_channels')
      .where({ id })
      .update(updateData)
      .returning('*');
    return row ? rowToChannel(row) : null;
  },

  async deleteChannel(id: number): Promise<boolean> {
    const count = await db('notification_channels').where({ id }).del();
    return count > 0;
  },

  async testChannel(id: number): Promise<void> {
    const channel = await this.getChannelById(id);
    if (!channel) throw new Error('Channel not found');

    const plugin = getPlugin(channel.type);
    if (!plugin) throw new Error(`No plugin for type: ${channel.type}`);

    await plugin.sendTest(channel.config);
  },

  // ── Bindings ──

  async getBindings(scope: string, scopeId: number | null): Promise<NotificationBinding[]> {
    const rows = await db<BindingRow>('notification_bindings')
      .where({ scope, scope_id: scopeId });
    return rows.map(rowToBinding);
  },

  async addBinding(channelId: number, scope: string, scopeId: number | null, overrideMode: OverrideMode = 'merge'): Promise<NotificationBinding> {
    const [row] = await db<BindingRow>('notification_bindings')
      .insert({
        channel_id: channelId,
        scope,
        scope_id: scopeId,
        override_mode: overrideMode,
      })
      .onConflict(['channel_id', 'scope', 'scope_id'])
      .merge({ override_mode: overrideMode })
      .returning('*');
    return rowToBinding(row);
  },

  async removeBinding(channelId: number, scope: string, scopeId: number | null): Promise<boolean> {
    const count = await db('notification_bindings')
      .where({ channel_id: channelId, scope, scope_id: scopeId })
      .del();
    return count > 0;
  },

  // ── Resolution (merge/replace/exclude inheritance) ──

  /**
   * Apply a set of bindings to the current channel set.
   * 1. If any binding has 'replace' mode → clear the set first
   * 2. Add all 'merge' (and 'replace') bindings to the set
   * 3. Remove all 'exclude' bindings from the set
   */
  _applyBindings(channelIds: Set<number>, bindings: NotificationBinding[]): Set<number> {
    if (bindings.length === 0) return channelIds;

    const hasReplace = bindings.some((b) => b.overrideMode === 'replace');
    if (hasReplace) {
      channelIds = new Set();
    }

    // Add merge/replace bindings
    for (const b of bindings) {
      if (b.overrideMode !== 'exclude') {
        channelIds.add(b.channelId);
      }
    }

    // Remove exclude bindings
    for (const b of bindings) {
      if (b.overrideMode === 'exclude') {
        channelIds.delete(b.channelId);
      }
    }

    return channelIds;
  },

  /**
   * Resolve which channels should fire for a given monitor.
   * Chain: Global → Group ancestors (root→leaf) → Monitor
   * 'merge' = add to parent channels, 'replace' = discard parent channels at that level,
   * 'exclude' = remove a specific channel from the inherited set.
   */
  async resolveChannelsForMonitor(monitorId: number, groupId: number | null): Promise<number[]> {
    let channelIds: Set<number> = new Set();

    // 1. Global bindings
    const globalBindings = await this.getBindings('global', null);
    channelIds = this._applyBindings(channelIds, globalBindings);

    // 2. Group chain (root → leaf)
    if (groupId !== null) {
      const ancestorRows = await db('group_closure')
        .where('descendant_id', groupId)
        .orderBy('depth', 'desc')
        .select('ancestor_id');

      for (const row of ancestorRows) {
        const groupBindings = await this.getBindings('group', row.ancestor_id);
        channelIds = this._applyBindings(channelIds, groupBindings);
      }
    }

    // 3. Monitor bindings
    const monitorBindings = await this.getBindings('monitor', monitorId);
    channelIds = this._applyBindings(channelIds, monitorBindings);

    return Array.from(channelIds);
  },

  /**
   * Resolve bindings for a scope WITH source info (for the UI).
   * Shows which channels are active and where they come from.
   * Also tracks excluded channels so the UI can show "Unbind" state.
   */
  async resolveBindingsWithSources(
    scope: 'group' | 'monitor',
    scopeId: number,
    groupId?: number | null,
  ): Promise<{
    channelId: number;
    channelName: string;
    channelType: string;
    source: 'global' | 'group' | 'monitor';
    sourceId: number | null;
    sourceName: string;
    isDirect: boolean;
    isExcluded: boolean;
  }[]> {
    interface SourceInfo {
      channelId: number;
      source: 'global' | 'group' | 'monitor';
      sourceId: number | null;
      sourceName: string;
      isDirect: boolean;
      isExcluded: boolean;
    }

    // Build the inheritance chain
    const result: Map<number, SourceInfo> = new Map();
    // Track excluded channel IDs separately for the final output
    const excludedSet: Set<number> = new Set();

    const applyBindingsWithSources = (
      bindings: NotificationBinding[],
      source: SourceInfo['source'],
      sourceId: number | null,
      sourceName: string,
      isDirect: boolean,
    ) => {
      if (bindings.length === 0) return;

      const hasReplace = bindings.some((b) => b.overrideMode === 'replace');
      if (hasReplace) {
        result.clear();
        excludedSet.clear();
      }

      // Add merge/replace bindings
      for (const b of bindings) {
        if (b.overrideMode !== 'exclude') {
          result.set(b.channelId, {
            channelId: b.channelId,
            source,
            sourceId,
            sourceName,
            isDirect,
            isExcluded: false,
          });
          excludedSet.delete(b.channelId);
        }
      }

      // Process excludes
      for (const b of bindings) {
        if (b.overrideMode === 'exclude') {
          // Keep the entry in result (for UI to show it) but mark as excluded
          const existing = result.get(b.channelId);
          if (existing) {
            existing.isExcluded = true;
          }
          excludedSet.add(b.channelId);
        }
      }
    };

    // 1. Global bindings
    const globalBindings = await this.getBindings('global', null);
    applyBindingsWithSources(globalBindings, 'global', null, 'Global', false);

    // 2. Group chain (for monitor scope: walk group ancestors; for group scope: walk parent ancestors)
    const effectiveGroupId = scope === 'monitor' ? groupId : null;

    // For group scope, walk the parent chain (ancestors of this group)
    if (scope === 'group') {
      const ancestorRows = await db('group_closure')
        .where('descendant_id', scopeId)
        .where('depth', '>', 0) // exclude self
        .orderBy('depth', 'desc')
        .select('ancestor_id');

      for (const row of ancestorRows) {
        const groupBindings = await this.getBindings('group', row.ancestor_id);
        const groupRow = await db('monitor_groups').where({ id: row.ancestor_id }).first('name');
        applyBindingsWithSources(
          groupBindings,
          'group',
          row.ancestor_id,
          groupRow?.name || `Group #${row.ancestor_id}`,
          false,
        );
      }
    }

    // For monitor scope, walk all group ancestors (including the direct group)
    if (scope === 'monitor' && effectiveGroupId !== null && effectiveGroupId !== undefined) {
      const ancestorRows = await db('group_closure')
        .where('descendant_id', effectiveGroupId)
        .orderBy('depth', 'desc')
        .select('ancestor_id');

      for (const row of ancestorRows) {
        const groupBindings = await this.getBindings('group', row.ancestor_id);
        const groupRow = await db('monitor_groups').where({ id: row.ancestor_id }).first('name');
        applyBindingsWithSources(
          groupBindings,
          'group',
          row.ancestor_id,
          groupRow?.name || `Group #${row.ancestor_id}`,
          false,
        );
      }
    }

    // 3. Direct bindings at this scope
    const directBindings = await this.getBindings(scope, scopeId);
    applyBindingsWithSources(directBindings, scope, scopeId, 'Direct', true);

    // Enrich with channel name/type
    const channelIds = Array.from(result.keys());
    if (channelIds.length === 0) return [];

    const channels = await db<ChannelRow>('notification_channels').whereIn('id', channelIds);
    const channelMap = new Map(channels.map((c) => [c.id, c]));

    return Array.from(result.values()).map((r) => {
      const ch = channelMap.get(r.channelId);
      return {
        ...r,
        channelName: ch?.name || `Channel #${r.channelId}`,
        channelType: ch?.type || 'unknown',
      };
    });
  },

  // ── Send notifications ──

  async sendForMonitor(
    monitorId: number,
    groupId: number | null,
    payload: NotificationPayload,
  ): Promise<void> {
    const channelIds = await this.resolveChannelsForMonitor(monitorId, groupId);
    if (channelIds.length === 0) {
      logger.warn(`No notification channels resolved for monitor ${monitorId} (event: ${payload.newStatus}) — check global/group/monitor bindings`);
      return;
    }

    // Enrich payload with app name from config
    const enrichedPayload: NotificationPayload = { ...payload, appName: config.appName };

    const channels = await db<ChannelRow>('notification_channels')
      .whereIn('id', channelIds)
      .where({ is_enabled: true });

    for (const row of channels) {
      const channel = rowToChannel(row);
      const plugin = getPlugin(channel.type);
      if (!plugin) {
        logger.warn(`No plugin for notification type "${channel.type}"`);
        continue;
      }

      try {
        await plugin.send(channel.config, enrichedPayload);
        await this.logNotification(channel.id, monitorId, 'status_change', true);
        logger.info(`Notification sent: ${channel.name} (${channel.type}) for monitor ${payload.monitorName}`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        await this.logNotification(channel.id, monitorId, 'status_change', false, errMsg);
        logger.error(`Notification failed: ${channel.name} (${channel.type}): ${errMsg}`);
      }
    }
  },

  /**
   * Resolve channels for a group-level notification.
   * Chain: Global → Group ancestors (root→leaf, including the group itself).
   * No monitor-level bindings are included.
   */
  async resolveChannelsForGroup(groupId: number): Promise<number[]> {
    let channelIds: Set<number> = new Set();

    // 1. Global bindings
    const globalBindings = await this.getBindings('global', null);
    channelIds = this._applyBindings(channelIds, globalBindings);

    // 2. Group chain (root → leaf, including self via depth >= 0)
    const ancestorRows = await db('group_closure')
      .where('descendant_id', groupId)
      .orderBy('depth', 'desc')
      .select('ancestor_id');

    for (const row of ancestorRows) {
      const groupBindings = await this.getBindings('group', row.ancestor_id);
      channelIds = this._applyBindings(channelIds, groupBindings);
    }

    return Array.from(channelIds);
  },

  /**
   * Send a group-level notification (for grouped notifications feature).
   * Resolves channels at the group level (no monitor bindings) and dispatches.
   */
  async sendForGroup(
    groupId: number,
    groupName: string,
    payload: NotificationPayload,
  ): Promise<void> {
    const channelIds = await this.resolveChannelsForGroup(groupId);
    if (channelIds.length === 0) return;

    const enrichedPayload: NotificationPayload = { ...payload, appName: config.appName };

    const channels = await db<ChannelRow>('notification_channels')
      .whereIn('id', channelIds)
      .where({ is_enabled: true });

    for (const row of channels) {
      const channel = rowToChannel(row);
      const plugin = getPlugin(channel.type);
      if (!plugin) {
        logger.warn(`No plugin for notification type "${channel.type}"`);
        continue;
      }

      try {
        await plugin.send(channel.config, enrichedPayload);
        await this.logNotification(channel.id, null, 'group_status_change', true);
        logger.info(`Group notification sent: ${channel.name} (${channel.type}) for group "${groupName}"`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        await this.logNotification(channel.id, null, 'group_status_change', false, errMsg);
        logger.error(`Group notification failed: ${channel.name} (${channel.type}): ${errMsg}`);
      }
    }
  },

  async logNotification(
    channelId: number,
    monitorId: number | null,
    eventType: string,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await db('notification_log').insert({
      channel_id: channelId,
      monitor_id: monitorId,
      event_type: eventType,
      success,
      error: error ?? null,
    });
  },
};
