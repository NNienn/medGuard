export default function DeviationChart({ sensor }) {
  if (!sensor?.history?.length) {
    return <div className="panel chart-shell">Awaiting realtime telemetry...</div>
  }

  const maxPoints = 56;
  const data = sensor.history.slice(-maxPoints);
  
  const nominalPoints = data.filter(d => Math.abs(d.z_score || 0) < 1.0);
  const dynamicBaseline = nominalPoints.length > 0 
    ? nominalPoints.reduce((sum, d) => sum + Number(d.dose_delivered || 0), 0) / nominalPoints.length 
    : 3.2;

  const values = data.map(d => Number(d.dose_delivered || 0));
  const maxVal = Math.max(...values, dynamicBaseline * 1.5, 4.5);
  const minVal = 0; 
  const range = maxVal - minVal || 1;

  const height = 12;
  const chars = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
  
  const grid = Array.from({ length: height }, () => []);

  data.forEach((d) => {
    const val = Number(d.dose_delivered || 0);
    const totalEighths = Math.max(0, Math.round(((val - minVal) / range) * (height * 8)));
    const baselineEighths = Math.max(0, Math.round(((dynamicBaseline - minVal) / range) * (height * 8)));

    for (let r = 0; r < height; r++) {
      const rowIndex = height - 1 - r; 
      const cellBottomEighths = rowIndex * 8;
      const cellTopEighths = cellBottomEighths + 8;

      let char = ' ';
      if (totalEighths >= cellTopEighths) {
        char = '█';
      } else if (totalEighths > cellBottomEighths) {
        const remainder = totalEighths - cellBottomEighths;
        char = chars[remainder] || ' ';
      }

      let isRed = false;
      if (char !== ' ' && cellBottomEighths >= baselineEighths) {
          isRed = true;
      } else if (char !== ' ' && totalEighths > baselineEighths && cellTopEighths > baselineEighths) {
          isRed = true;
      }

      grid[r].push({ char, isRed });
    }
  });

  const paddingCount = Math.max(0, maxPoints - data.length);

  return (
    <div className="panel chart-shell">
      <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span>Realtime Dosage (ASCII)</span>
        <span className={sensor.latest?.is_attack ? 'danger' : 'safe'}>
          CUR: {Number(sensor.latest?.dose_delivered || 0).toFixed(3)} | BASE: {dynamicBaseline.toFixed(3)}
        </span>
      </div>
      <div className="ascii" style={{ display: 'flex', flexDirection: 'column' }}>
        {grid.map((row, r) => {
          let yAxisLabel = '     | ';
          if (r === 0) yAxisLabel = maxVal.toFixed(1).padStart(4) + ' | ';
          if (r === height - 1) yAxisLabel = minVal.toFixed(1).padStart(4) + ' | ';
          
          const baselineRow = height - 1 - Math.floor((Math.max(0, Math.round(((dynamicBaseline - minVal) / range) * (height * 8)))) / 8);
          if (r === baselineRow && r !== 0 && r !== height - 1) {
            yAxisLabel = dynamicBaseline.toFixed(1).padStart(4) + ' | ';
          }

          return (
            <div key={r} style={{ display: 'flex' }}>
              <span style={{ color: 'var(--muted)' }}>{yAxisLabel}</span>
              {Array.from({ length: paddingCount }).map((_, i) => <span key={`pad-${i}`}> </span>)}
              {row.map((cell, c) => (
                <span key={c} className={cell.isRed ? 'danger' : 'safe'}>{cell.char}</span>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
