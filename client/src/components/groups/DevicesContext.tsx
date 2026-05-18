import { createContext, useContext, type ReactNode } from 'react';
import type { AgentDevice, MonitorStatus } from '@obliview/shared';

/**
 * Provides the list of agent devices to the group tree so each GroupNode can
 * render its devices as leaf items alongside monitors.
 *
 * Sidebar is the canonical owner of the devices list (it already polls + listens
 * to socket events); other consumers of <GroupTree> (e.g. GroupPicker) simply
 * don't wrap with this provider — GroupNode then renders zero devices.
 */
export interface DevicesContextValue {
  devices: AgentDevice[];
  /** Per-device operational status (from `agent:status` socket frames). */
  statuses: Map<number, MonitorStatus | 'suspended' | undefined>;
  /** Whether devices should be rendered at all (admin gate on the sidebar). */
  enabled: boolean;
}

const DevicesContext = createContext<DevicesContextValue>({
  devices: [],
  statuses: new Map(),
  enabled: false,
});

export function DevicesProvider({
  devices,
  statuses,
  enabled,
  children,
}: DevicesContextValue & { children: ReactNode }) {
  return (
    <DevicesContext.Provider value={{ devices, statuses, enabled }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useGroupDevices(groupId: number | null): {
  list: AgentDevice[];
  enabled: boolean;
  statuses: Map<number, MonitorStatus | 'suspended' | undefined>;
} {
  const ctx = useContext(DevicesContext);
  if (!ctx.enabled) return { list: [], enabled: false, statuses: ctx.statuses };
  return {
    list: ctx.devices.filter((d) => d.groupId === groupId),
    enabled: true,
    statuses: ctx.statuses,
  };
}
