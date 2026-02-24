import type { NotificationPlugin, NotificationPayload } from '../types';

export const slackPlugin: NotificationPlugin = {
  type: 'slack',
  name: 'Slack',
  description: 'Send to a Slack channel via webhook',
  configFields: [
    { key: 'webhookUrl', label: 'Slack Webhook URL', type: 'url', required: true, placeholder: 'https://hooks.slack.com/services/...' },
    { key: 'channel', label: 'Channel (optional)', type: 'text', placeholder: '#monitoring' },
  ],

  async send(config, payload) {
    const icon = payload.newStatus === 'up' ? ':white_check_mark:' : payload.newStatus === 'value_changed' ? ':arrows_counterclockwise:' : ':red_circle:';
    const color = payload.newStatus === 'up' ? '#2ecc71' : payload.newStatus === 'value_changed' ? '#3498db' : '#e74c3c';

    const body: Record<string, unknown> = {
      attachments: [{
        color,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${icon} *${payload.monitorName}*\nStatus: *${payload.oldStatus}* → *${payload.newStatus}*${payload.message ? `\n${payload.message}` : ''}`,
          },
        }],
      }],
    };
    if (config.channel) body.channel = config.channel;

    const res = await fetch(String(config.webhookUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`Slack returned ${res.status}`);
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
