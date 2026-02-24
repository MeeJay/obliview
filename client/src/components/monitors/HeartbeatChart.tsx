import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { Heartbeat } from '@obliview/shared';

interface HeartbeatChartProps {
  heartbeats: Heartbeat[];
  height?: number;
  period?: string;
  /** When true, chart plots heartbeat.value instead of responseTime */
  valueMode?: boolean;
}

function formatTimeLabel(createdAt: string, period?: string): string {
  const d = new Date(createdAt);
  if (period === '7d' || period === '30d' || period === '365d') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString();
}

export function HeartbeatChart({ heartbeats, height = 200, period, valueMode = false }: HeartbeatChartProps) {
  const data = valueMode
    ? heartbeats
        .filter((h) => h.value !== null && h.value !== undefined)
        .map((h) => ({
          time: formatTimeLabel(h.createdAt, period),
          value: Number(h.value),
          status: h.status,
        }))
        .filter((d) => !isNaN(d.value))
    : heartbeats
        .filter((h) => h.responseTime !== null)
        .map((h) => ({
          time: formatTimeLabel(h.createdAt, period),
          responseTime: h.responseTime,
          status: h.status,
        }));

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-border bg-bg-secondary text-text-muted text-sm"
        style={{ height }}
      >
        {valueMode ? 'No value data available' : 'No response time data available'}
      </div>
    );
  }

  const dataKey = valueMode ? 'value' : 'responseTime';
  const strokeColor = valueMode ? '#f0b429' : '#58a6ff';
  const gradientId = valueMode ? 'valueGradient' : 'responseTimeGradient';
  const unit = valueMode ? '' : 'ms';
  const tooltipLabel = valueMode ? 'Value' : 'Response Time';
  const tooltipFormatter = valueMode
    ? (v: number) => [v.toLocaleString(), tooltipLabel]
    : (v: number) => [`${v}ms`, tooltipLabel];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
        <XAxis
          dataKey="time"
          tick={{ fill: '#8b949e', fontSize: 11 }}
          stroke="#30363d"
        />
        <YAxis
          tick={{ fill: '#8b949e', fontSize: 11 }}
          stroke="#30363d"
          unit={unit}
          tickFormatter={valueMode ? (v: number) => v.toLocaleString() : undefined}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
            color: '#e6edf3',
            fontSize: '12px',
          }}
          formatter={tooltipFormatter}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={strokeColor}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
