import WebSocket from 'ws';
import os from 'node:os';
import crypto from 'node:crypto';
import { config } from './config.js';
import { handleProxySync } from './scheduler.js';
import type { CheckResult } from './types.js';

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const RECONNECT_BASE = 2000;
const RECONNECT_MAX = 60000;
let backoff = RECONNECT_BASE;

// Auto-generate a stable UUID if none provided (persisted in env for consistency).
if (!config.deviceUuid) {
  config.deviceUuid = crypto.randomUUID();
  console.log(`Generated device UUID: ${config.deviceUuid}`);
}

export function connect(): void {
  const base = config.serverUrl.replace(/\/$/, '');
  const wsBase = base.replace(/^http/, 'ws');
  const url = `${wsBase}/api/agent/ws?uuid=${encodeURIComponent(config.deviceUuid)}`;

  console.log(`Connecting to ${base}...`);
  ws = new WebSocket(url, { headers: { 'X-API-Key': config.apiKey } });

  ws.on('open', () => {
    console.log('Connected to Obliview server');
    backoff = RECONNECT_BASE;
    sendHeartbeat();
    heartbeatTimer = setInterval(sendHeartbeat, config.heartbeatInterval * 1000);
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'config':
          // Server config response — nothing to do for proxy (interval managed locally)
          break;
        case 'proxy_sync':
          handleProxySync(msg.monitors ?? []);
          break;
        case 'command':
          // One-shot commands (future) — ack with unsupported for now
          if (msg.id) {
            send({ type: 'ack', id: msg.id, commandType: msg.commandType, success: false, error: 'not implemented' });
          }
          break;
      }
    } catch { /* malformed JSON */ }
  });

  ws.on('close', () => {
    console.log(`Disconnected — reconnecting in ${backoff}ms`);
    cleanup();
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error(`WS error: ${err.message}`);
    cleanup();
    scheduleReconnect();
  });
}

function cleanup(): void {
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  ws = null;
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    backoff = Math.min(backoff * 1.5, RECONNECT_MAX);
    connect();
  }, backoff);
}

function sendHeartbeat(): void {
  const hostname = config.hostname || os.hostname();
  send({
    type: 'heartbeat',
    hostname,
    agentVersion: '1.0.0',
    deviceType: 'proxy',
    osInfo: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
    },
    metrics: {
      cpu: { percent: 0 },
      memory: {
        totalMB: Math.round(os.totalmem() / 1048576),
        usedMB: Math.round((os.totalmem() - os.freemem()) / 1048576),
        percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 1000) / 10,
      },
    },
  });
}

export function send(data: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

export function sendProxyResult(monitorId: number, result: CheckResult): void {
  send({ type: 'proxy_result', monitorId, result });
}
