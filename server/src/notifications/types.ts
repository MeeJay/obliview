import type { NotificationConfigField } from '@obliview/shared';

export interface NotificationPayload {
  monitorName: string;
  monitorUrl?: string;
  oldStatus: string;
  newStatus: string;
  message?: string;
  timestamp: string;
  appName?: string;
  // Group notification fields
  groupName?: string;
  groupId?: number;
  downMonitors?: string[];       // Names of confirmed-down monitors
  failingMonitors?: string[];    // Names of ALL failing monitors (confirmed + retrying)
  totalFailingCount?: number;    // Total count of failing monitors in the group
  isGroupNotification?: boolean;
}

export interface NotificationPlugin {
  type: string;
  name: string;
  description: string;
  configFields: NotificationConfigField[];

  send(config: Record<string, unknown>, payload: NotificationPayload): Promise<void>;
  sendTest(config: Record<string, unknown>): Promise<void>;
}
