import { exec } from 'node:child_process';
import type { ProxyMonitorConfig, CheckResult } from '../types.js';

export async function pingCheck(cfg: ProxyMonitorConfig): Promise<CheckResult> {
  const hostname = cfg.hostname;
  if (!hostname) return { status: 'down', message: 'No hostname provided' };

  const timeoutSec = Math.max(1, Math.round((cfg.timeoutMs || 10000) / 1000));
  const isWin = process.platform === 'win32';
  const cmd = isWin
    ? `ping -n 1 -w ${timeoutSec * 1000} ${hostname}`
    : `ping -c 1 -W ${timeoutSec} ${hostname}`;

  const start = performance.now();
  return new Promise((resolve) => {
    exec(cmd, { timeout: (timeoutSec + 2) * 1000 }, (err, stdout) => {
      const responseTime = Math.round(performance.now() - start);
      if (err) {
        resolve({ status: 'down', responseTime, message: 'Host unreachable' });
        return;
      }
      const ping = extractPingTime(stdout);
      resolve({
        status: 'up',
        responseTime,
        ping,
        message: `Alive (${ping.toFixed(1)}ms)`,
      });
    });
  });
}

function extractPingTime(output: string): number {
  const match = output.match(/(?:time[=<]|=)\s*([\d.]+)\s*ms/);
  return match ? parseFloat(match[1]) : 0;
}
