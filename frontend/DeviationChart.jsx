import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

function SensorTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload

  return (
    <div className="chart-tooltip">
      <div className="tooltip-time">{label}</div>
      <div>Delivered: {Number(point.dose_delivered || 0).toFixed(3)} U/hr</div>
      <div>Translated: {Number(point.translated_value).toFixed(3)} {point.unit}</div>
      <div>Z-score: {Number(point.z_score).toFixed(2)}</div>
      <div>Hex: {point.hex_payload}</div>
    </div>
  )
}

export default function DeviationChart({ sensor }) {
  if (!sensor?.history?.length) {
    return <div className="panel chart-shell">Awaiting realtime telemetry...</div>
  }

  const data = sensor.history.map((entry) => ({
    ...entry,
    time: entry.timestamp.split('T')[1].slice(0, 8),
  }))

  return (
    <div className="panel chart-shell">
      <div className="panel-title">Realtime Dosage Deviation</div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 18, right: 18, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="doseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f7f9fb" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f7f9fb" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="dangerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff4d57" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#ff4d57" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="time" tick={{ fill: '#9da7b3', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#9da7b3', fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip content={<SensorTooltip />} />
          <ReferenceLine y={3.2} stroke="#ff4d57" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="z_score"
            stroke="#ff4d57"
            fill={sensor.latest?.is_attack ? 'url(#dangerFill)' : 'url(#doseFill)'}
            strokeWidth={2}
            isAnimationActive
          />
          <Line
            type="monotone"
            dataKey="dose_delivered"
            stroke="#f7f9fb"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#ff4d57', stroke: '#0b0f14', strokeWidth: 2 }}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
