import { BaseMonitorWorker, type CheckResult } from './BaseMonitorWorker';

/**
 * Push (passive) monitor worker.
 *
 * Instead of actively checking a target, this worker waits for external
 * systems to push heartbeats to `POST /api/heartbeat/:token`.
 *
 * The worker simply checks how long since the last push was received.
 * If no push arrives within pushMaxIntervalSec, the monitor goes DOWN.
 *
 * The actual push timestamp is stored in a static Map, updated by the
 * push heartbeat route.
 */
export class PushMonitorWorker extends BaseMonitorWorker {
  /** Map of monitorId → last push timestamp */
  static lastPushTimes = new Map<number, number>();

  async performCheck(): Promise<CheckResult> {
    const maxInterval = (this.config.pushMaxIntervalSec as number) || 300;
    const lastPush = PushMonitorWorker.lastPushTimes.get(this.config.id);

    if (!lastPush) {
      return {
        status: 'down',
        message: 'Waiting for first push...',
      };
    }

    const elapsed = (Date.now() - lastPush) / 1000;

    if (elapsed > maxInterval) {
      return {
        status: 'down',
        message: `No push received for ${Math.round(elapsed)}s (max: ${maxInterval}s)`,
      };
    }

    return {
      status: 'up',
      responseTime: Math.round(elapsed * 1000),
      message: `Last push ${Math.round(elapsed)}s ago`,
    };
  }

  /** Called by the push heartbeat route */
  static recordPush(monitorId: number): void {
    PushMonitorWorker.lastPushTimes.set(monitorId, Date.now());
  }
}
