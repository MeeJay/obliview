import { useState, useEffect } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import type { MaintenanceScopeType, NotificationChannel } from '@obliview/shared';
import { MaintenanceWindowList } from '@/components/maintenance/MaintenanceWindowList';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import apiClient from '@/api/client';

interface ScopeOption {
  id: number;
  name: string;
  type: MaintenanceScopeType;
}

export function AdminMaintenancePage() {
  const { t } = useTranslation();
  const [scopeOptions, setScopeOptions] = useState<ScopeOption[]>([]);
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [monitorsRes, agentsRes, groupsRes, channelsRes] = await Promise.all([
          apiClient.get<{ success: boolean; data: { id: number; name: string }[] }>('/monitors'),
          apiClient.get<{ success: boolean; data: { id: number; name: string; hostname: string }[] }>('/agent/devices'),
          apiClient.get<{ success: boolean; data: Array<{ id: number; name: string; children?: unknown[] }> }>('/groups'),
          apiClient.get<{ success: boolean; data: NotificationChannel[] }>('/notifications/channels'),
        ]);

        const scopes: ScopeOption[] = [];
        if (monitorsRes.data.success) {
          for (const m of monitorsRes.data.data) scopes.push({ id: m.id, name: m.name, type: 'monitor' });
        }
        if (agentsRes.data.success) {
          for (const d of agentsRes.data.data) scopes.push({ id: d.id, name: d.name ?? d.hostname, type: 'agent' });
        }
        if (groupsRes.data.success) {
          const flatGroups = (function flatten(nodes: Array<{ id: number; name: string; children?: unknown[] }>): ScopeOption[] {
            return nodes.flatMap((g) => [
              { id: g.id, name: g.name, type: 'group' as MaintenanceScopeType },
              ...flatten((g.children ?? []) as Array<{ id: number; name: string; children?: unknown[] }>),
            ]);
          })(groupsRes.data.data ?? []);
          scopes.push(...flatGroups);
        }
        setScopeOptions(scopes);

        if (channelsRes.data.success) setChannels(channelsRes.data.data);
      } catch {
        toast.error(t('maintenance.failedLoad'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CalendarClock size={22} className="text-accent" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">{t('maintenance.title')}</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {t('maintenance.description')}
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="rounded-lg border border-border bg-bg-secondary p-4 space-y-2">
        <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">{t('maintenance.howItWorks')}</h2>
        <ul className="text-sm text-text-secondary space-y-1">
          <li>• {t('maintenance.rule1')}</li>
          <li>• {t('maintenance.rule2')}</li>
          <li>• {t('maintenance.rule3')}</li>
          <li>• {t('maintenance.rule4')}</li>
          <li>• {t('maintenance.rule5')}</li>
          <li>• {t('maintenance.rule6')}</li>
          <li>• {t('maintenance.rule7')}</li>
          <li>• {t('maintenance.rule8')}</li>
        </ul>
      </div>

      {/* All windows */}
      <div className="rounded-lg border border-border bg-bg-secondary p-5">
        <MaintenanceWindowList
          scopeOptions={scopeOptions}
          channels={channels}
          title={t('maintenance.allWindows')}
        />
      </div>
    </div>
  );
}
