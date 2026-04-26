export default function AlertCard({ alert }) {
  return (
    <div className={`alert-card ${alert.is_attack ? 'attack' : ''}`}>
      <div className="alert-top">
        <span>{alert.device_id}</span>
        <span>{alert.timestamp.split('T')[1].slice(0, 8)}</span>
      </div>
      <div className="alert-main">{alert.plain_english}</div>
      {alert.is_attack && (
        <div className="alert-fingerprint">
          {alert.playbook_name} / {alert.attack_type}
        </div>
      )}
      <div className="alert-meta">
        <span>{alert.hex_payload}</span>
        <span>{alert.mitigation || alert.clinical_action}</span>
      </div>
    </div>
  )
}
