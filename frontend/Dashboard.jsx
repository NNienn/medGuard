import { useEffect, useMemo, useState } from 'react'
import AlertCard from './AlertCard'
import AttackModal from './AttackModal'
import DeviationChart from './DeviationChart'
import {
  AsciiArchitecture,
  AsciiHeart,
  AsciiPump,
  AsciiPatient,
  AsciiPipeline,
  AsciiTranslator,
  SensorTerminal,
} from './AsciiFX'

const API = 'http://127.0.0.1:8010'

const DEFAULT_PLAYBOOKS = [
  {
    name: 'OVERDOSE_RAMP',
    description: 'Slow 10-step escalation',
  },
  {
    name: 'REPLAY_ATTACK',
    description: 'Plausible values with subtle offset',
  },
  {
    name: 'COMMAND_INJECTION',
    description: 'Chaotic extremes and reversals',
  },
  {
    name: 'FLATLINE_SPOOF',
    description: 'Perfect midpoint flatline stream',
  },
]

function formatPlaybookName(name) {
  return name
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(null)
  const [playbooks, setPlaybooks] = useState(DEFAULT_PLAYBOOKS)
  const [activeDeviceId, setActiveDeviceId] = useState(null)
  const [netError, setNetError] = useState('')
  const [operatorNote, setOperatorNote] = useState('')
  const [attackModal, setAttackModal] = useState(null)

  const applySnapshot = (data) => {
    setSnapshot(data)
    setPlaybooks(data.playbooks?.length ? data.playbooks : DEFAULT_PLAYBOOKS)
    setActiveDeviceId((current) => current || data.sensors?.[0]?.device_id || null)
    setNetError('')
  }

  const refreshSnapshot = async () => {
    const response = await fetch(`${API}/poll`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    applySnapshot(data)
  }

  useEffect(() => {
    let active = true

    const fetchSnapshot = async () => {
      try {
        const response = await fetch(`${API}/poll`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        if (!active) return
        applySnapshot(data)
      } catch (error) {
        if (!active) return
        setNetError(error.message === 'Failed to fetch' ? 'Backend offline at http://127.0.0.1:8010' : error.message)
      }
    }

    const fetchPlaybooks = async () => {
      try {
        const response = await fetch(`${API}/playbooks`)
        if (!response.ok) return
        const data = await response.json()
        if (!active || !data.playbooks?.length) return
        setPlaybooks(data.playbooks)
      } catch {
        // Snapshot includes playbooks as a fallback.
      }
    }

    fetchPlaybooks()
    fetchSnapshot()
    const id = setInterval(fetchSnapshot, 1000)

    return () => {
      active = false
      clearInterval(id)
    }
  }, [])

  const sensors = snapshot?.sensors || []
  const activeSensor = useMemo(
    () => sensors.find((sensor) => sensor.device_id === activeDeviceId) || sensors[0],
    [activeDeviceId, sensors],
  )
  const latest = activeSensor?.latest

  const callApi = async (path, options = {}, note = '') => {
    const response = await fetch(`${API}${path}`, options)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.detail || `HTTP ${response.status}`)
    if (note) setOperatorNote(note)
    return data
  }

  const triggerPlaybook = async (deviceId, playbookName = 'COMMAND_INJECTION') => {
    try {
      await callApi(
        `/simulate/playbook/${deviceId}/${playbookName}`,
        { method: 'POST' },
        `${formatPlaybookName(playbookName)} executed on ${deviceId}`,
      )
      await refreshSnapshot()
      setAttackModal({ deviceId, playbookName })
    } catch (error) {
      setOperatorNote(error.message)
    }
  }

  const releaseSensor = async (deviceId) => {
    try {
      await callApi(`/devices/${deviceId}/release`, { method: 'POST' }, `Quarantine released on ${deviceId}`)
      await refreshSnapshot()
    } catch (error) {
      setOperatorNote(error.message)
    }
  }

  const quarantineSensor = async (deviceId) => {
    try {
      await callApi(`/devices/${deviceId}/quarantine`, { method: 'POST' }, `Manual quarantine engaged on ${deviceId}`)
      await refreshSnapshot()
    } catch (error) {
      setOperatorNote(error.message)
    }
  }

  const clearAlerts = async () => {
    try {
      await callApi('/alerts/clear', { method: 'DELETE' }, 'Telemetry stream reset')
      await refreshSnapshot()
    } catch (error) {
      setOperatorNote(error.message)
    }
  }

  const exportLogs = async () => {
    try {
      const response = await fetch(`${API}/logs/export`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'medGuard-log-export.csv'
      anchor.click()
      URL.revokeObjectURL(url)
      setOperatorNote('CSV export downloaded')
    } catch (error) {
      setOperatorNote(error.message)
    }
  }

  if (netError) {
    return (
      <div className="boot-screen">
        <div className="boot-card">
          <div className="boot-title">Telemetry link unavailable</div>
          <pre className="boot-copy">
{`One-click launchers from the repo root:
run-medGuard-backend.cmd
run-medGuard-frontend.cmd

Current error:
${netError}`}
          </pre>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="main-stage">
        <header className="topbar">
          <div>
            <div className="brand" style={{flexDirection: 'row', alignItems: 'baseline', gap: '12px', marginBottom: '18px'}}>
              <span>medGuard</span>
              <small>terminal-grade infusion theater</small>
            </div>
            <div className="eyebrow">Realtime simulation</div>
            <h1>{activeSensor?.name || 'medGuard'}</h1>
            <div className="status-strip">
              <span className={`status-pill ${activeSensor?.quarantined ? 'danger' : latest?.is_attack ? 'warning' : 'safe'}`}>
                {activeSensor?.quarantined ? 'QUARANTINED' : latest?.is_attack ? 'ATTACK DETECTED' : 'NOMINAL'}
              </span>
              <span className="telemetry-note">
                {activeSensor?.quarantine_reason || latest?.fingerprint || 'Rolling 10-value fingerprinting active'}
              </span>
            </div>
          </div>

          <div className="top-actions">
            <button className="action-button" onClick={clearAlerts}>Reset stream</button>
            <button className="action-button" onClick={exportLogs}>Export logs</button>
            {activeSensor?.quarantined ? (
              <button className="action-button caution" onClick={() => releaseSensor(activeSensor.device_id)}>
                Release quarantine
              </button>
            ) : (
              <>
                <button className="action-button caution" onClick={() => activeSensor && quarantineSensor(activeSensor.device_id)}>
                  Quarantine device
                </button>
                <button className="action-button danger" onClick={() => activeSensor && triggerPlaybook(activeSensor.device_id, 'COMMAND_INJECTION')}>
                  Inject attack
                </button>
              </>
            )}
          </div>
        </header>

        {operatorNote && <div className="operator-note">{operatorNote}</div>}

        <section className="patient-room">
          <div className="sensor-column">
            {sensors.slice(0, Math.ceil(sensors.length / 2)).map((sensor) => (
              <SensorTerminal
                key={sensor.device_id}
                sensor={sensor}
                isActive={sensor.device_id === activeSensor?.device_id}
                onSelect={setActiveDeviceId}
                onAttack={triggerPlaybook}
                onRelease={releaseSensor}
              />
            ))}
          </div>
          
          <AsciiPipeline side="left" direction="left" isAttack={Boolean(latest?.is_attack || activeSensor?.attack_flash > 0 || activeSensor?.quarantined)} />

          <div className="patient-center">
            <AsciiPatient isAttack={Boolean(latest?.is_attack || activeSensor?.attack_flash > 0 || activeSensor?.quarantined)} />
          </div>

          <AsciiPipeline side="right" direction="right" isAttack={Boolean(latest?.is_attack || activeSensor?.attack_flash > 0 || activeSensor?.quarantined)} />

          <div className="sensor-column">
            {sensors.slice(Math.ceil(sensors.length / 2)).map((sensor) => (
              <SensorTerminal
                key={sensor.device_id}
                sensor={sensor}
                isActive={sensor.device_id === activeSensor?.device_id}
                onSelect={setActiveDeviceId}
                onAttack={triggerPlaybook}
                onRelease={releaseSensor}
              />
            ))}
          </div>
        </section>

        <section className="hero-grid">
          <div className="panel hero-panel">
            <div className="panel-title">Central Heart</div>
            <AsciiHeart
              isAttack={Boolean(latest?.is_attack || activeSensor?.attack_flash > 0 || activeSensor?.quarantined)}
              bpm={latest?.translated_value}
              attackType={latest?.attack_type}
            />
            <AsciiArchitecture reading={latest} pulse={snapshot?.tick || 0} flash={activeSensor?.attack_flash || 0} />
          </div>

          <div className="panel hero-panel right">
            <AsciiPump
              dose={latest?.dose_delivered}
              isAttack={Boolean(latest?.is_attack || activeSensor?.attack_flash > 0)}
              offline={Boolean(activeSensor?.quarantined)}
              attackType={latest?.attack_type}
            />
            <AsciiTranslator reading={latest} mitigation={activeSensor?.last_mitigation || latest?.mitigation} sensor={activeSensor} />
            <div className="clinical-strip">
              <div className="panel-title">Clinical response</div>
              <div className="clinical-callout">{activeSensor?.last_mitigation}</div>
              {snapshot?.system_status?.response?.map((line) => (
                <div key={line} className="clinical-line">{line}</div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-grid">
          <DeviationChart sensor={activeSensor} />

          <div className="panel telemetry-panel">
            <div className="panel-title">Selected Sensor Metadata</div>
            <div className="meta-grid">
              <div><span>ID</span><strong>{activeSensor?.device_id}</strong></div>
              <div><span>Status</span><strong>{activeSensor?.status}</strong></div>
              <div><span>Uptime</span><strong>{activeSensor?.uptime}</strong></div>
              <div><span>Location</span><strong>{activeSensor?.location}</strong></div>
              <div><span>Delivered</span><strong>{Number(latest?.dose_delivered || 0).toFixed(3)} U/hr</strong></div>
              <div><span>Risk score</span><strong>{activeSensor?.risk_score ?? 0}/100</strong></div>
              <div><span>Playbook</span><strong>{latest?.playbook_name && latest.playbook_name !== 'NONE' ? formatPlaybookName(latest.playbook_name) : 'None'}</strong></div>
              <div><span>Attack type</span><strong>{latest?.attack_type || 'NONE'}</strong></div>
            </div>

            <div className="sub-title">Attack playbooks</div>
            <div className="playbook-grid">
              {playbooks.map((playbook) => (
                <button
                  key={playbook.name}
                  type="button"
                  className="playbook-button"
                  disabled={!activeSensor || activeSensor.quarantined}
                  onClick={() => triggerPlaybook(activeSensor.device_id, playbook.name)}
                  title={playbook.description}
                >
                  <strong>{formatPlaybookName(playbook.name)}</strong>
                  <span>{playbook.description}</span>
                </button>
              ))}
            </div>

            <div className="telemetry-note inline">
              {activeSensor?.quarantine_reason || 'Manual quarantine freezes polling. Release resets the risk score to 0.'}
            </div>

            <div className="sub-title">Recent feed</div>
            <div className="alerts-feed">
              {(snapshot?.recent_alerts || []).slice(0, 6).map((alert) => (
                <AlertCard key={`${alert.device_id}-${alert.timestamp}`} alert={alert} />
              ))}
            </div>

            <div className="sub-title">Raw instruction log</div>
            <div className="log-terminal">
              {(snapshot?.logs || []).slice(0, 10).map((entry) => (
                <div key={`${entry.device_id}-${entry.timestamp}`} className="log-row">
                  <span>{entry.timestamp.split('T')[1].slice(0, 8)}</span>
                  <span>{entry.device_id}</span>
                  <span>{entry.playbook_name !== 'NONE' ? `${entry.playbook_name} / ${entry.attack_type}` : entry.hex_payload}</span>
                  <span>{Number(entry.dose_delivered || 0).toFixed(3)}</span>
                </div>
              ))}
            </div>

            <div className="sub-title" style={{ marginTop: '18px' }}>Key Management</div>
            <div className="log-terminal">
              {(snapshot?.key_logs || []).slice(0, 6).map((entry) => (
                <div key={`${entry.device_id}-${entry.timestamp}-${entry.event}`} className="log-row key-log-row">
                  <span>{entry.timestamp.split('T')[1].slice(0, 8)}</span>
                  <span>{entry.device_id}</span>
                  <span className={`status-${entry.event.toLowerCase()}`}>{entry.event}</span>
                  <span>{entry.key !== 'NONE' ? `0x${entry.key.slice(0, 6)}...` : 'DROPPED'}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {attackModal && (
        <AttackModal
          sensor={sensors.find((sensor) => sensor.device_id === attackModal.deviceId)}
          playbookName={attackModal.playbookName}
          onClose={() => setAttackModal(null)}
        />
      )}
    </div>
  )
}
