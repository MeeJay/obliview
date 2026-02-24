import type { NotificationPlugin, NotificationPayload } from '../types';

const STATUS_COLORS: Record<string, number> = {
  up: 0x2ecc71,
  down: 0xe74c3c,
  pending: 0xf39c12,
  maintenance: 0x3498db,
  paused: 0x95a5a6,
  value_changed: 0x3498db,
};

export const discordPlugin: NotificationPlugin = {
  type: 'discord',
  name: 'Discord',
  description: 'Send to a Discord channel via webhook',
  configFields: [
    { key: 'webhookUrl', label: 'Discord Webhook URL', type: 'url', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
    { key: 'username', label: 'Bot Username (optional)', type: 'text', placeholder: 'Obliview' },
  ],

  async send(config, payload) {
    const embed = {
      title: `${payload.newStatus === 'up' ? '✅' : payload.newStatus === 'value_changed' ? '🔄' : '🔴'} ${payload.monitorName}`,
      description: payload.message || `Status changed: **${payload.oldStatus}** → **${payload.newStatus}**`,
      color: STATUS_COLORS[payload.newStatus] ?? 0x95a5a6,
      fields: [
        { name: 'Status', value: payload.newStatus.toUpperCase(), inline: true },
        ...(payload.monitorUrl ? [{ name: 'URL', value: payload.monitorUrl, inline: true }] : []),
      ],
      timestamp: payload.timestamp,
    };

    const body: Record<string, unknown> = { embeds: [embed] };
    if (config.username) body.username = config.username;

    const res = await fetch(String(config.webhookUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Discord returned ${res.status}: ${await res.text()}`);
  },

  async sendTest(config) {
    await this.send(config, {
      monitorName: 'Test Monitor',
      oldStatus: 'up',
      newStatus: 'down',
      message: 'This is a test notification from Obliview',
      timestamp: new Date().toISOString(),
    });
  },
};
