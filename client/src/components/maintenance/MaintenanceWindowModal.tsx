import { useState, useEffect } from 'react';
import { X, CalendarClock } from 'lucide-react';
import type {
  MaintenanceWindow,
  CreateMaintenanceWindowRequest,
  MaintenanceScopeType,
  MaintenanceScheduleType,
  MaintenanceRecurrenceType,
} from '@obliview/shared';
import { cn } from '@/utils/cn';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
];

interface ScopeOption {
  id: number;
  name: string;
  type: MaintenanceScopeType;
}

interface ChannelOption {
  id: number;
  name: string;
  type: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateMaintenanceWindowRequest) => Promise<void>;
  initial?: MaintenanceWindow | null;
  scopeOptions: ScopeOption[];
  channelOptions: ChannelOption[];
  /** Pre-fill when embedding in a detail page */
  defaultScopeType?: MaintenanceScopeType;
  defaultScopeId?: number;
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">{children}</label>;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary',
        'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
        props.className,
      )}
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className={cn(
        'w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary',
        'focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent',
        props.className,
      )}
    />
  );
}

export function MaintenanceWindowModal({ open, onClose, onSave, initial, scopeOptions, channelOptions, defaultScopeType, defaultScopeId }: Props) {
  const [name, setName] = useState('');
  const [scopeType, setScopeType] = useState<MaintenanceScopeType>('monitor');
  const [scopeId, setScopeId] = useState<number | ''>('');
  const [isOverride, setIsOverride] = useState(false);
  const [scheduleType, setScheduleType] = useState<MaintenanceScheduleType>('one_time');
  // one_time
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  // recurring
  const [startTime, setStartTime] = useState('02:00');
  const [endTime, setEndTime] = useState('04:00');
  const [recurrenceType, setRecurrenceType] = useState<MaintenanceRecurrenceType>('weekly');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [timezone, setTimezone] = useState('UTC');
  const [notifyChannelIds, setNotifyChannelIds] = useState<number[]>([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset form when opening
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setScopeType(initial.scopeType);
      setScopeId(initial.scopeId);
      setIsOverride(initial.isOverride);
      setScheduleType(initial.scheduleType);
      setStartAt(initial.startAt ? initial.startAt.slice(0, 16) : '');
      setEndAt(initial.endAt ? initial.endAt.slice(0, 16) : '');
      setStartTime(initial.startTime ?? '02:00');
      setEndTime(initial.endTime ?? '04:00');
      setRecurrenceType(initial.recurrenceType ?? 'weekly');
      setDaysOfWeek(initial.daysOfWeek ?? []);
      setTimezone(initial.timezone ?? 'UTC');
      setNotifyChannelIds(initial.notifyChannelIds ?? []);
      setActive(initial.active);
    } else {
      setName('');
      setScopeType(defaultScopeType ?? 'monitor');
      setScopeId(defaultScopeId ?? '');
      setIsOverride(false);
      setScheduleType('one_time');
      setStartAt('');
      setEndAt('');
      setStartTime('02:00');
      setEndTime('04:00');
      setRecurrenceType('weekly');
      setDaysOfWeek([]);
      setTimezone('UTC');
      setNotifyChannelIds([]);
      setActive(true);
    }
    setError('');
  }, [open, initial]);

  const filteredScopes = scopeOptions.filter((s) => s.type === scopeType);

  const toggleDay = (d: number) =>
    setDaysOfWeek((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const toggleChannel = (id: number) =>
    setNotifyChannelIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError('Name is required.');
    if (scopeId === '') return setError('Please select a scope target.');
    if (scheduleType === 'one_time' && (!startAt || !endAt)) return setError('Start and end date/time are required.');
    if (scheduleType === 'one_time' && new Date(startAt) >= new Date(endAt)) return setError('End must be after start.');
    if (scheduleType === 'recurring' && recurrenceType === 'weekly' && daysOfWeek.length === 0) return setError('Select at least one day.');

    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        scopeType,
        scopeId: Number(scopeId),
        isOverride,
        scheduleType,
        startAt: scheduleType === 'one_time' ? new Date(startAt).toISOString() : null,
        endAt: scheduleType === 'one_time' ? new Date(endAt).toISOString() : null,
        startTime: scheduleType === 'recurring' ? startTime : null,
        endTime: scheduleType === 'recurring' ? endTime : null,
        recurrenceType: scheduleType === 'recurring' ? recurrenceType : null,
        daysOfWeek: scheduleType === 'recurring' && recurrenceType === 'weekly' ? daysOfWeek : null,
        timezone,
        notifyChannelIds,
        active,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-bg-secondary shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-accent" />
            <h2 className="text-base font-semibold text-text-primary">
              {initial ? 'Edit Maintenance Window' : 'New Maintenance Window'}
            </h2>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Weekly DB backup" />
          </div>

          {/* Scope */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Scope type</Label>
              <Select value={scopeType} onChange={(e) => { setScopeType(e.target.value as MaintenanceScopeType); setScopeId(''); }}>
                <option value="monitor">Monitor</option>
                <option value="agent">Agent</option>
                <option value="group">Group</option>
              </Select>
            </div>
            <div>
              <Label>Target</Label>
              <Select value={scopeId} onChange={(e) => setScopeId(Number(e.target.value))}>
                <option value="">— select —</option>
                {filteredScopes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Override */}
          {(scopeType === 'monitor' || scopeType === 'agent') && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isOverride}
                onChange={(e) => setIsOverride(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
              />
              <div>
                <span className="text-sm font-medium text-text-primary">Override group maintenance</span>
                <p className="text-xs text-text-muted mt-0.5">
                  When checked, only this window applies — group-level windows are ignored for this target.
                </p>
              </div>
            </label>
          )}

          {/* Schedule type tabs */}
          <div>
            <Label>Schedule type</Label>
            <div className="flex rounded-md overflow-hidden border border-border">
              {(['one_time', 'recurring'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setScheduleType(t)}
                  className={cn(
                    'flex-1 py-1.5 text-sm font-medium transition-colors',
                    scheduleType === t
                      ? 'bg-accent text-white'
                      : 'bg-bg-tertiary text-text-secondary hover:bg-bg-hover',
                  )}
                >
                  {t === 'one_time' ? 'One-time' : 'Recurring'}
                </button>
              ))}
            </div>
          </div>

          {/* One-time fields */}
          {scheduleType === 'one_time' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Start</Label>
                <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
              </div>
              <div>
                <Label>End</Label>
                <Input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
          )}

          {/* Recurring fields */}
          {scheduleType === 'recurring' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Recurrence</Label>
                  <Select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value as MaintenanceRecurrenceType)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly (select days)</option>
                  </Select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </Select>
                </div>
              </div>

              {recurrenceType === 'weekly' && (
                <div>
                  <Label>Days of week</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((d, i) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(i)}
                        className={cn(
                          'px-2.5 py-1 rounded text-xs font-semibold border transition-colors',
                          daysOfWeek.includes(i)
                            ? 'bg-accent border-accent text-white'
                            : 'bg-bg-tertiary border-border text-text-secondary hover:border-accent',
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start time (HH:MM)</Label>
                  <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>End time (HH:MM)</Label>
                  <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Notification channels (optional) */}
          {channelOptions.length > 0 && (
            <div>
              <Label>Notify channels (optional)</Label>
              <p className="text-xs text-text-muted mb-2">Selected channels receive a message when maintenance starts and ends.</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {channelOptions.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyChannelIds.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                      className="h-3.5 w-3.5 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
                    />
                    <span className="text-sm text-text-primary">{ch.name}</span>
                    <span className="text-xs text-text-muted">({ch.type})</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Active toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-bg-tertiary text-accent focus:ring-accent"
            />
            <span className="text-sm font-medium text-text-primary">Active</span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover border border-border transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler<HTMLButtonElement>}
            disabled={saving}
            className="rounded-md px-4 py-2 text-sm font-medium text-white bg-accent hover:bg-accent-hover disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : initial ? 'Save changes' : 'Create window'}
          </button>
        </div>
      </div>
    </div>
  );
}
