import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Pencil, Pause, Play, Trash2, ArrowLeft, FolderOpen, RotateCcw, Bell, Globe } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useGroupStore } from '@/store/groupStore';
import { useAuthStore } from '@/store/authStore';
import { groupsApi } from '@/api/groups.api';
import { monitorsApi } from '@/api/monitors.api';
import { MONITOR_TYPE_LABELS } from '@obliview/shared';
import { MonitorStatusBadge } from '@/components/monitors/MonitorStatusBadge';
import { HeartbeatChart } from '@/components/monitors/HeartbeatChart';
import { HeartbeatBar } from '@/components/monitors/HeartbeatBar';
import { Button } from '@/components/common/Button';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { PeriodSelector } from '@/components/common/PeriodSelector';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { NotificationBindingsPanel } from '@/components/notifications/NotificationBindingsPanel';
import type { MonitorGroup, Monitor, Heartbeat } from '@obliview/shared';
import toast from 'react-hot-toast';

interface GroupStats {
  total: number;
  up: number;
  down: number;
  uptimePct: number;
  avgResponseTime: number | null;
  monitorCount: number;
  downMonitorNames: string[];
}

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, canWriteGroup } = useAuthStore();
  const { getGroup, removeGroup, fetchGroups, fetchTree } = useGroupStore();

  const groupId = parseInt(id!, 10);
  const storeGroup = getGroup(groupId);
  const canWrite = canWriteGroup(groupId);

  const [group, setGroup] = useState<MonitorGroup | null>(storeGroup ?? null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('24h');
  const [periodHeartbeats, setPeriodHeartbeats] = useState<Heartbeat[]>([]);
  const [stats, setStats] = useState<GroupStats | null>(null);

  // Fetch group + monitors on mount
  useEffect(() => {
    async function loadData() {
      try {
        const [g, m] = await Promise.all([
          groupsApi.getById(groupId),
          groupsApi.getMonitors(groupId, true),
        ]);
        setGroup(g);
        setMonitors(m);
      } catch {
        // group may come from store
      }
      setLoading(false);
    }
    loadData();
  }, [groupId]);

  // Fetch heartbeats + stats by period
  useEffect(() => {
    Promise.all([
      groupsApi.getHeartbeats(groupId, period),
      groupsApi.getDetailStats(groupId, period),
    ]).then(([hbs, s]) => {
      setPeriodHeartbeats(hbs);
      setStats(s);
    }).catch(() => {
      setPeriodHeartbeats([]);
      setStats(null);
    });
  }, [groupId, period]);

  if (loading && !group) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <p className="text-text-muted">Group not found</p>
        <Link to="/" className="mt-4">
          <Button variant="secondary">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!confirm(`Delete group "${group.name}" and all its sub-groups? Monitors will become ungrouped.`)) return;
    try {
      await groupsApi.delete(groupId);
      removeGroup(groupId);
      fetchGroups();
      fetchTree();
      toast.success('Group deleted');
      navigate('/');
    } catch {
      toast.error('Failed to delete group');
    }
  };

  const handlePauseAll = async () => {
    const active = monitors.filter((m) => m.status !== 'paused');
    if (active.length === 0) {
      toast('No active monitors to pause');
      return;
    }
    try {
      await Promise.all(active.map((m) => monitorsApi.pause(m.id)));
      toast.success(`Paused ${active.length} monitors`);
      // Refresh
      const m = await groupsApi.getMonitors(groupId, true);
      setMonitors(m);
    } catch {
      toast.error('Failed to pause monitors');
    }
  };

  const handleResumeAll = async () => {
    const paused = monitors.filter((m) => m.status === 'paused');
    if (paused.length === 0) {
      toast('No paused monitors to resume');
      return;
    }
    try {
      await Promise.all(paused.map((m) => monitorsApi.pause(m.id)));
      toast.success(`Resumed ${paused.length} monitors`);
      const m = await groupsApi.getMonitors(groupId, true);
      setMonitors(m);
    } catch {
      toast.error('Failed to resume monitors');
    }
  };

  const handleClearHeartbeats = async () => {
    if (!confirm(`Clear all heartbeat/uptime data for group "${group.name}" and all its sub-groups? This cannot be undone.`)) return;
    try {
      const result = await groupsApi.clearHeartbeats(groupId);
      toast.success(`Cleared ${result.deleted} heartbeats from ${result.monitorCount} monitors`);
      setPeriodHeartbeats([]);
    } catch {
      toast.error('Failed to clear heartbeats');
    }
  };

  const pausedCount = monitors.filter((m) => m.status === 'paused').length;
  const hasPaused = pausedCount > 0;

  return (
    <div className="p-6">
      {/* Back button */}
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4">
        <ArrowLeft size={14} />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
            <FolderOpen size={24} className="text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-text-primary">{group.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {group.isGeneral && (
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                  <Globe size={10} />
                  General
                </span>
              )}
              {group.groupNotifications && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-[10px] font-medium text-yellow-500">
                  <Bell size={10} />
                  Grouped Notifications
                </span>
              )}
              {group.description && (
                <span className="text-sm text-text-muted">{group.description}</span>
              )}
            </div>
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <Link to={`/group/${groupId}/edit`}>
              <Button variant="secondary" size="sm">
                <Pencil size={14} className="mr-1.5" />
                Edit
              </Button>
            </Link>
            {hasPaused ? (
              <Button variant="secondary" size="sm" onClick={handleResumeAll}>
                <Play size={14} className="mr-1.5" />
                Resume All
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handlePauseAll}>
                <Pause size={14} className="mr-1.5" />
                Pause All
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleClearHeartbeats}>
              <RotateCcw size={14} className="mr-1.5" />
              Clear Data
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              <Trash2 size={14} className="mr-1.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Stats grid */}
      {stats && (
        <div
          className="grid gap-4 mb-6"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}
        >
          <div className="rounded-lg border border-border bg-bg-secondary p-4">
            <div className="text-sm text-text-secondary mb-1">Uptime</div>
            <div
              className={cn(
                'text-xl font-mono font-semibold',
                stats.uptimePct >= 99
                  ? 'text-status-up'
                  : stats.uptimePct >= 95
                    ? 'text-yellow-500'
                    : 'text-status-down',
              )}
            >
              {stats.uptimePct}%
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-secondary p-4">
            <div className="text-sm text-text-secondary mb-1">Monitors</div>
            <div className="text-xl font-mono font-semibold text-text-primary">
              {stats.monitorCount}
            </div>
            <div className="text-xs text-text-muted mt-0.5">
              {stats.monitorCount - stats.downMonitorNames.length} up / {stats.downMonitorNames.length} down
            </div>
          </div>
          {stats.downMonitorNames.length > 0 && (
            <div className="rounded-lg border border-status-down/30 bg-status-down-bg p-4">
              <div className="text-sm text-text-secondary mb-1">Down Monitors</div>
              <div className="text-xl font-mono font-semibold text-status-down">
                {stats.downMonitorNames.length}
              </div>
              <div className="text-xs text-text-muted mt-0.5 truncate">
                {stats.downMonitorNames.join(', ')}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-border bg-bg-secondary p-4">
            <div className="text-sm text-text-secondary mb-1">Avg Response Time</div>
            <div className="text-xl font-mono font-semibold text-text-primary">
              {stats.avgResponseTime ? `${stats.avgResponseTime}ms` : 'N/A'}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-bg-secondary p-4">
            <div className="text-sm text-text-secondary mb-1">Total Checks</div>
            <div className="text-xl font-mono font-semibold text-text-primary">
              {stats.total.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-secondary">History</h3>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>

      {/* Heartbeat Bar */}
      <div className="mb-6 rounded-lg border border-border bg-bg-secondary p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Heartbeat History</h3>
        <HeartbeatBar heartbeats={periodHeartbeats} />
      </div>

      {/* Response Time Chart */}
      <div className="mb-6 rounded-lg border border-border bg-bg-secondary p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-3">Response Time</h3>
        <HeartbeatChart heartbeats={periodHeartbeats} height={250} period={period} />
      </div>

      {/* Monitors list */}
      {monitors.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-bg-secondary">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text-secondary">
              Monitors ({monitors.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {monitors.map((m) => (
              <Link
                key={m.id}
                to={`/monitor/${m.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition-colors"
              >
                <MonitorStatusBadge status={m.status} size="sm" />
                <span className="flex-1 text-sm text-text-primary truncate">{m.name}</span>
                <span className="text-xs text-text-muted">{MONITOR_TYPE_LABELS[m.type]}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Notification Bindings (admin only) */}
      {isAdmin() && (
        <div className="mt-6">
          <NotificationBindingsPanel
            scope="group"
            scopeId={groupId}
            title="Notification Channels"
          />
        </div>
      )}

      {/* Settings (admin only) */}
      {isAdmin() && (
        <div className="mt-6">
          <SettingsPanel
            scope="group"
            scopeId={groupId}
            title="Group Settings"
          />
        </div>
      )}
    </div>
  );
}
