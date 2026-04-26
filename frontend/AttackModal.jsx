import { useEffect, useState } from 'react'

function useTicker(interval) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), interval)
    return () => clearInterval(id)
  }, [interval])

  return tick
}

function normalizeAscii(source) {
  const lines = source.replace(/\r/g, '').split('\n')
  while (lines.length && lines[0].trim() === '') lines.shift()
  while (lines.length && lines[lines.length - 1].trim() === '') lines.pop()
  const indents = lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length)
  const minIndent = indents.length ? Math.min(...indents) : 0
  return lines.map((line) => line.slice(minIndent)).join('\n')
}

const hostileAlertArt = normalizeAscii(String.raw`
     .-^^^^^^^^^^^^^^^^-.
   ./####################\.
  /##########!!###########\
 |###########!!############|
 |###########!!############|
 |###########!!############|
 |###########..############|
  \########################/
   '----------------------'
`)

export default function AttackModal({ sensor, playbookName, onClose }) {
  const [step, setStep] = useState(0)
  const pulse = useTicker(520)
  const reading = sensor?.latest
  const launchedPlaybook = reading?.playbook_name && reading.playbook_name !== 'NONE' ? reading.playbook_name : playbookName

  useEffect(() => {
    const handleKeydown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeydown)
    
    const timers = [
      setTimeout(() => setStep(1), 240),
      setTimeout(() => setStep(2), 900),
      setTimeout(() => setStep(3), 1800),
      setTimeout(() => setStep(4), 3000),
      setTimeout(() => onClose(), 7600),
    ]
    return () => {
      window.removeEventListener('keydown', handleKeydown)
      timers.forEach(clearTimeout)
    }
  }, [onClose])

  if (!sensor) return null

  return (
    <div className="modal-overlay">
      <div className="modal-card caution-card">
        <div className="modal-head">
          <div className="hostile-title-stack">
            <div className={`hostile-alert-pop ${step > 0 ? 'live' : ''} burst-${pulse % 3}`}>
              <pre className="ascii hostile-alert-ascii">{hostileAlertArt}</pre>
            </div>
            <div>
              <div className="panel-title">Cautionary playback</div>
              <div className="modal-title">Hostile command intercepted</div>
              <div className="modal-badge-row">
                <span className="modal-badge danger">{launchedPlaybook || 'COMMAND_INJECTION'}</span>
                <span className="modal-badge warning">{reading?.attack_type || 'SPIKE'}</span>
                <span className="modal-badge">{reading?.severity || 'CRITICAL'}</span>
              </div>
            </div>
          </div>
          <button className="action-button caution" onClick={onClose}>Back</button>
        </div>

        <pre className="modal-stream danger">{`ATTACKER -> ${reading?.hex_payload || '0xDEADBEEF'}
           >>> RADIO BRIDGE >>> HEX TRANSLATOR >>> SAFETY GATE`}</pre>

        {step >= 1 && (
          <pre className="modal-stream warning">{`translation   ${Number(reading?.translated_value || 0).toFixed(3)} ${reading?.unit || ''}
register      ${reading?.register || 'dose_rate'}
playbook      ${launchedPlaybook || 'COMMAND_INJECTION'}
origin        COMPROMISED`}</pre>
        )}

        {step >= 2 && (
          <pre className="modal-stream danger">{`fingerprint   ${reading?.attack_type || 'SPIKE'}
signature     ${reading?.fingerprint || 'Abrupt hostile deviations detected in the rolling window.'}
deviation     ${Number(reading?.z_score || 0).toFixed(2)} sigma
decision      COMMAND REJECTED / ALERT RISING`}</pre>
        )}

        {step >= 3 && (
          <pre className="modal-stream smoke">{String.raw`
  !!!  !!!  !!!
   \    |    /
 [ SAFETY GATE SHUT ]
 [ QUARANTINE ARMED ]
`}
          </pre>
        )}

        {step >= 4 && (
          <div className="modal-footer">
            <strong>{sensor.last_mitigation}</strong>
            <div>{reading?.clinical_action}</div>
            {sensor.quarantine_reason && <div>{sensor.quarantine_reason}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
