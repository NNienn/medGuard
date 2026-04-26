import {
  ComposedChart,
  Bar,
  Line,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell
} from 'recharts'

const Candlestick = (props) => {
  const { x, y, width, height, payload } = props
  const isOver = payload.close > payload.baseline
  const color = isOver ? '#FF1744' : '#00E676'

  const h = Math.max(payload.high, payload.low)
  const l = Math.min(payload.high, payload.low)
  const range = h - l || 1
  const pixelPerUnit = height / range
  
  const bodyTop = y + (h - Math.max(payload.open, payload.close)) * pixelPerUnit
  const bodyHeight = Math.max(2, Math.abs(payload.close - payload.open) * pixelPerUnit)

  return (
    <g>
      {/* Wick */}
      <line x1={x + width / 2} y1={y} x2={x + width / 2} y2={y + height} stroke={color} strokeWidth={1} />
      {/* Body */}
      <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={color} stroke={color} />
    </g>
  )
}

const CandleTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null
  const data = payload[0].payload
  return (
    <div className="chart-tooltip" style={{ fontFamily: 'Courier, monospace', fontSize: '12px' }}>
      <div style={{ color: '#8ba1b1', marginBottom: '4px' }}>{label}</div>
      <div>O: {data.open.toFixed(3)}</div>
      <div>H: {data.high.toFixed(3)}</div>
      <div>L: {data.low.toFixed(3)}</div>
      <div>C: {data.close.toFixed(3)}</div>
      <div style={{ marginTop: '4px', color: '#b39ddb' }}>SMA: {data.sma.toFixed(3)}</div>
      <div style={{ color: data.isAttack ? '#FF1744' : '#8ba1b1' }}>Z-Vol: {data.volume.toFixed(2)}</div>
    </div>
  )
}

export default function DeviationChart({ sensor }) {
  if (!sensor?.history?.length) {
    return <div className="panel chart-shell">Awaiting realtime telemetry...</div>
  }

  const nominalPoints = sensor.history.filter(d => Math.abs(d.z_score || 0) < 1.0)
  const dynamicBaseline = nominalPoints.length > 0 
    ? nominalPoints.reduce((sum, d) => sum + Number(d.dose_delivered || 0), 0) / nominalPoints.length 
    : 3.2

  let prevDose = Number(sensor.history[0]?.dose_delivered || 0)
  const data = sensor.history.map((entry, index) => {
    const dose = Number(entry.dose_delivered || 0)
    const zScore = Number(entry.z_score || 0)
    const time = entry.timestamp.split('T')[1].slice(0, 8)
    
    const open = index === 0 ? dose : prevDose
    const close = dose
    const high = Math.max(open, close) + (Math.abs(zScore) * 0.01) + 0.005
    const low = Math.min(open, close) - (Math.abs(zScore) * 0.01) - 0.005
    
    prevDose = dose

    return {
      time,
      open, close, high, low,
      range: [low, high],
      volume: Math.abs(zScore),
      isAttack: entry.is_attack === 1 || zScore > 3.0,
      baseline: dynamicBaseline,
      sma: 0
    }
  })
  
  data.forEach((d, i) => {
    let sum = 0
    let count = 0
    for(let j = Math.max(0, i - 4); j <= i; j++) {
      sum += data[j].close
      count++
    }
    d.sma = sum / count
  })

  return (
    <div className="panel chart-shell">
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span>Realtime Dosage Analysis</span>
        <span style={{ fontFamily: 'Courier, monospace', fontWeight: 'bold', color: data[data.length - 1].close >= data[data.length - 1].open ? '#00E676' : '#FF1744' }}>
          {data[data.length - 1].close.toFixed(3)}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(119, 154, 176, 0.22)" vertical={true} />
          
          <YAxis 
            yAxisId="price" 
            orientation="right" 
            domain={['auto', 'auto']} 
            tick={{ fill: '#8ba1b1', fontFamily: 'Courier, monospace', fontSize: 11 }} 
            axisLine={false} 
            tickLine={false} 
            width={40}
          />
          
          <YAxis 
            yAxisId="volume" 
            orientation="left" 
            domain={[0, dataMax => dataMax * 4]} 
            hide={true} 
          />
          
          <XAxis 
            dataKey="time" 
            tick={{ fill: '#8ba1b1', fontFamily: 'Courier, monospace', fontSize: 11 }} 
            axisLine={false} 
            tickLine={false} 
          />
          
          <Tooltip content={<CandleTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
          
          <Bar yAxisId="volume" dataKey="volume" isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.close > entry.baseline ? 'rgba(255, 23, 68, 0.25)' : 'rgba(0, 230, 118, 0.25)'} />
            ))}
          </Bar>

          <Line yAxisId="price" type="monotone" dataKey="sma" stroke="#b39ddb" strokeWidth={1.5} dot={false} isAnimationActive={false} />

          <Bar yAxisId="price" dataKey="range" shape={<Candlestick />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
