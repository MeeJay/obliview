import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, CalendarClock, Clock, RefreshCw, CheckCircle2 } from 'lucide-react';
import type { MaintenanceWindow, MaintenanceScopeType, NotificationChannel } from '@obliview/shared';
import { maintenanceApi } from '@/api/maintenance.api';
import { MaintenanceWindowModal } from './MaintenanceWindowModal';
import { cn } from '@/utils/cn';

interface ScopeOption {
  id: number;
  name: string;
  type: MaintenanceScopeType;
}

interface Props {
  /** If set, only shows windows for this scope (and allows creating within it) */
  scopeType?: MaintenanceScopeType;
  scopeId?: number;
  /** All scope options available for the modal (groups, monitors, agents) */
  scopeOptions: ScopeOption[];
  channels: NotificationChannel[];
  title?: string;
  /** Pre-fill modal when opening "Add window" (for embedded usage on detail pages) */
  defaultScopeType?: MaintenanceScopeType;
  defaultScopeId?: number;
}

function formatSchedule(w: MaintenanceWindow): string {
  if (w.scheduleType === 'one_time') {
    const start = w.startAt ? new Date(w.startAt).toLocaleString() : '?';
    const end = w.endAt ? new Date(w.endAt).toLocaleString() : '?';
    return `${start} → ${end}`;
  }
  const days = w.daysOfWeek && w.daysOfWeek.length > 0
    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].filter((_, i) => w.daysOfWeek!.includes(i)).join(', ')
    : null;

  const recurrence = w.recurrenceType === 'daily'
    ? 'Every day'
    : days ? `Every ${days}` : 'Weekly';

  return `${recurrence} · ${w.startTime ?? '?'} – ${w.endTime ?? '?'} (${w.timezone})`;
}

function StatusPip({ active, isActiveNow }: { active: boolean; isActiveNow?: boolean }) {
  if (!active) return <span className="text-xs text-text-muted">Inactive</span>;
  if (isActiveNow) return (
    <span className="flex items-center gap-1 text-xs text-status-maintenance font-medium">
      <CheckCircle2 size={11} />
      Active now
    </span>
  );
  return <span className="text-xs text-status-up">Scheduled</span>;
}

export function MaintenanceWindowList({ scopeType, scopeId, scopeOptions, channels, title, defaultScopeType, defaultScopeId }: Props) {
  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenanceWindow | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await maintenanceApi.list(
        scopeType && scopeId !== undefined ? { scopeType, scopeId } : undefined,
      );
      setWindows(data);
    } finally {
      setLoading(false);
    }
  }, [scopeType, scopeId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(data: Parameters<typeof maintenanceApi.create>[0]) {
    if (editing) {
      await maintenanceApi.update(editing.id, data);
    } else {
      await maintenanceApi.create(data);
    }
    await load();
    setEditing(null);
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await maintenanceApi.delete(id);
      setWindows((prev) => prev.filter((w) => w.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(w: MaintenanceWindow) {
    setEditing(w);
    setModalOpen(true);
  }

  const channelOptions = channels.map((ch) => ({ id: ch.id, name: ch.name, type: ch.type }));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <CalendarClock size={15} className="text-text-muted" />
          {title ?? 'Maintenance Windows'}
        </h3>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          <Plus size={12} />
          Add window
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted py-3">
          <RefreshCw size={14} className="animate-spin" />
          Loading…
        </div>
      ) : windows.length === 0 ? (
        <p className="text-sm text-text-muted py-2">No maintenance windows defined.</p>
      ) : (
        <div className="space-y-2">
          {windows.map((w) => (
            <div
              key={w.id}
              className={cn(
                'flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                w.isActiveNow ? 'border-status-maintenance/40 bg-status-maintenance/5' : 'border-border bg-bg-tertiary',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-text-primary truncate">{w.name}</span>
                  {w.isOverride && (
                    <span className="text-[10px] font-semibold px-1 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/25">
                      OVERRIDE
                    </span>
                  )}
                  <StatusPip active={w.active} isActiveNow={w.isActiveNow} />
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                  {w.scheduleType === 'one_time' ? <Clock size={11} /> : <RefreshCw size={11} />}
                  <span className="truncate">{formatSchedule(w)}</span>
                </div>
                {w.scopeName && !scopeId && (
                  <div className="mt-0.5 text-xs text-text-muted">
                    {w.scopeType.charAt(0).toUpperCase() + w.scopeType.slice(1)}: <span className="text-text-secondary">{w.scopeName}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => openEdit(w)}
                  className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                  title="Edit"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  disabled={deleting === w.id}
                  className="p-1.5 rounded text-text-muted hover:text-red-400 hover:bg-bg-hover transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <MaintenanceWindowModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={handleSave}
        initial={editing}
        scopeOptions={scopeOptions}
        channelOptions={channelOptions}
        defaultScopeType={defaultScopeType ?? scopeType}
        defaultScopeId={defaultScopeId ?? scopeId}
      />
    </div>
  );
}
