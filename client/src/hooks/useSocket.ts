import { useEffect } from 'react';
import { getSocket } from '../socket/socketClient';
import { useMonitorStore } from '../store/monitorStore';
import { useGroupStore } from '../store/groupStore';
import { useAuthStore } from '../store/authStore';
import { SOCKET_EVENTS } from '@obliview/shared';
import type { Monitor, MonitorGroup, Heartbeat } from '@obliview/shared';

export function useSocket() {
  const { user } = useAuthStore();
  const { addMonitor, updateMonitor, removeMonitor, addHeartbeat } = useMonitorStore();
  const { addGroup, updateGroup, removeGroup, fetchTree } = useGroupStore();

  useEffect(() => {
    if (!user) return;

    const socket = getSocket();
    if (!socket) return;

    // Monitor heartbeat
    socket.on(SOCKET_EVENTS.MONITOR_HEARTBEAT, (data: { monitorId: number; heartbeat: Heartbeat }) => {
      addHeartbeat(data.monitorId, data.heartbeat);
    });

    // Monitor status change
    socket.on(SOCKET_EVENTS.MONITOR_STATUS_CHANGE, (data: { monitorId: number; newStatus: string }) => {
      updateMonitor(data.monitorId, { status: data.newStatus as Monitor['status'] });

      // Auto-expand parent groups when a monitor goes DOWN
      if (data.newStatus === 'down') {
        const monitor = useMonitorStore.getState().getMonitor(data.monitorId);
        if (monitor?.groupId) {
          const groupStore = useGroupStore.getState();
          groupStore.expandGroup(monitor.groupId);
          groupStore.expandAncestors(monitor.groupId);
        }
      }
    });

    // Monitor CRUD events
    socket.on(SOCKET_EVENTS.MONITOR_CREATED, (data: { monitor: Monitor }) => {
      addMonitor(data.monitor);
    });

    socket.on(SOCKET_EVENTS.MONITOR_UPDATED, (data: { monitorId: number; changes: Partial<Monitor> }) => {
      updateMonitor(data.monitorId, data.changes);
    });

    socket.on(SOCKET_EVENTS.MONITOR_DELETED, (data: { monitorId: number }) => {
      removeMonitor(data.monitorId);
    });

    socket.on(SOCKET_EVENTS.MONITOR_PAUSED, (data: { monitorId: number; isPaused: boolean }) => {
      updateMonitor(data.monitorId, { status: data.isPaused ? 'paused' : 'pending' });
    });

    // Group events
    socket.on(SOCKET_EVENTS.GROUP_CREATED, (data: { group: MonitorGroup }) => {
      addGroup(data.group);
      fetchTree();
    });

    socket.on(SOCKET_EVENTS.GROUP_UPDATED, (data: { group: MonitorGroup }) => {
      updateGroup(data.group.id, data.group);
      fetchTree();
    });

    socket.on(SOCKET_EVENTS.GROUP_DELETED, (data: { groupId: number }) => {
      removeGroup(data.groupId);
      fetchTree();
    });

    socket.on(SOCKET_EVENTS.GROUP_MOVED, (data: { group: MonitorGroup }) => {
      updateGroup(data.group.id, data.group);
      fetchTree();
    });

    return () => {
      socket.off(SOCKET_EVENTS.MONITOR_HEARTBEAT);
      socket.off(SOCKET_EVENTS.MONITOR_STATUS_CHANGE);
      socket.off(SOCKET_EVENTS.MONITOR_CREATED);
      socket.off(SOCKET_EVENTS.MONITOR_UPDATED);
      socket.off(SOCKET_EVENTS.MONITOR_DELETED);
      socket.off(SOCKET_EVENTS.MONITOR_PAUSED);
      socket.off(SOCKET_EVENTS.GROUP_CREATED);
      socket.off(SOCKET_EVENTS.GROUP_UPDATED);
      socket.off(SOCKET_EVENTS.GROUP_DELETED);
      socket.off(SOCKET_EVENTS.GROUP_MOVED);
    };
  }, [user, addMonitor, updateMonitor, removeMonitor, addHeartbeat, addGroup, updateGroup, removeGroup, fetchTree]);
}
