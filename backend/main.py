import csv
import hashlib
import hmac
import random
import secrets
import sqlite3
import struct
import time
from datetime import UTC, datetime
from pathlib import Path

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "medguard.db"
EXPORTS_DIR = ROOT / "exports"
LOGS_DIR = ROOT / "logs"
DOCS_DIR = ROOT / "docs"
API_HOST = "127.0.0.1"
API_PORT = 8010

SENSOR_BLUEPRINTS = [
    {
        "device_id": "PUMP-ALPHA",
        "name": "Insulin Pump Alpha",
        "device_type": "infusion_pump",
        "unit": "U/hr",
        "baseline": 1.2,
        "variance": 0.28,
        "register": "dose_rate",
        "location": "ICU Bed 3",
    },
    {
        "device_id": "PUMP-BETA",
        "name": "Insulin Pump Beta",
        "device_type": "infusion_pump",
        "unit": "U/hr",
        "baseline": 0.9,
        "variance": 0.22,
        "register": "dose_rate",
        "location": "Stepdown Bed 1",
    },
    {
        "device_id": "GLUCOSE-01",
        "name": "Glucose Sensor",
        "device_type": "glucose_sensor",
        "unit": "mg/dL",
        "baseline": 121.0,
        "variance": 12.0,
        "register": "glucose",
        "location": "Central Line",
    },
    {
        "device_id": "CARDIAC-01",
        "name": "Cardiac Monitor",
        "device_type": "patient_monitor",
        "unit": "bpm",
        "baseline": 78.0,
        "variance": 8.0,
        "register": "heart_rate",
        "location": "Telemetry",
    },
    {
        "device_id": "RESERVOIR-01",
        "name": "Reservoir Sensor",
        "device_type": "reservoir_sensor",
        "unit": "%",
        "baseline": 72.0,
        "variance": 3.0,
        "register": "reservoir_fill",
        "location": "Pump Bay",
    },
]

PLAYBOOKS = {
    "OVERDOSE_RAMP": {
        "description": "Slow 10-step escalation that creeps upward until the safety rail decides the drift is no longer acceptable.",
        "strategy": "Ten values gradually rise from plausible telemetry into overdose territory.",
        "steps": 10,
    },
    "REPLAY_ATTACK": {
        "description": "Plausible-looking values are replayed with a subtle but persistent offset so the feed still feels believable.",
        "strategy": "Eight values stay near the baseline while biasing the decoded payload just enough to create drift.",
        "steps": 8,
    },
    "COMMAND_INJECTION": {
        "description": "Chaotic command flooding alternates aggressive highs and lows to overwhelm the gate with extremes.",
        "strategy": "Eight values bounce between low and high anchors with noisy jitter and rapid reversals.",
        "steps": 8,
    },
    "FLATLINE_SPOOF": {
        "description": "The stream snaps to suspiciously perfect midpoint values, removing all healthy noise from the channel.",
        "strategy": "Eight values repeat the same midpoint with nearly zero jitter to mimic a dead-flat spoof.",
        "steps": 8,
    },
}


def ensure_structure() -> None:
    for folder in (EXPORTS_DIR, LOGS_DIR, DOCS_DIR):
        folder.mkdir(exist_ok=True)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def float_to_hex(value: float) -> str:
    packed = struct.pack("<f", float(value))
    return "0x" + packed.hex().upper()


def hex_to_float(hex_payload: str) -> float:
    raw = bytes.fromhex(hex_payload.replace("0x", ""))
    return round(struct.unpack("<f", raw)[0], 3)


def average(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def variance(values: list[float]) -> float:
    if not values:
        return 0.0
    mean = average(values)
    return sum((item - mean) ** 2 for item in values) / len(values)


def init_db() -> None:
    ensure_structure()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                name TEXT NOT NULL,
                device_type TEXT NOT NULL,
                register_name TEXT NOT NULL,
                unit TEXT NOT NULL,
                hex_payload TEXT NOT NULL,
                translated_value REAL NOT NULL,
                dose_delivered REAL NOT NULL,
                z_score REAL NOT NULL,
                severity TEXT NOT NULL,
                source TEXT NOT NULL,
                clinical_action TEXT NOT NULL,
                mitigation TEXT NOT NULL,
                attack_type TEXT NOT NULL DEFAULT 'NONE',
                fingerprint TEXT NOT NULL DEFAULT '',
                playbook_name TEXT NOT NULL DEFAULT 'NONE',
                timestamp TEXT NOT NULL,
                is_attack INTEGER NOT NULL DEFAULT 0
            )
            """
        )

        existing_columns = {
            row[1]
            for row in conn.execute("PRAGMA table_info(alerts)").fetchall()
        }
        required_columns = {
            "dose_delivered": "REAL NOT NULL DEFAULT 0",
            "mitigation": "TEXT NOT NULL DEFAULT ''",
            "attack_type": "TEXT NOT NULL DEFAULT 'NONE'",
            "fingerprint": "TEXT NOT NULL DEFAULT ''",
            "playbook_name": "TEXT NOT NULL DEFAULT 'NONE'",
        }
        for column, spec in required_columns.items():
            if column not in existing_columns:
                conn.execute(f"ALTER TABLE alerts ADD COLUMN {column} {spec}")


def save_alert(alert: dict) -> None:
    with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
        conn.execute(
            """
            INSERT INTO alerts (
                device_id, name, device_type, register_name, unit,
                hex_payload, translated_value, dose_delivered, z_score, severity,
                source, clinical_action, mitigation, attack_type, fingerprint,
                playbook_name, timestamp, is_attack
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert["device_id"],
                alert["name"],
                alert["device_type"],
                alert["register"],
                alert["unit"],
                alert["hex_payload"],
                alert["translated_value"],
                alert["dose_delivered"],
                alert["z_score"],
                alert["severity"],
                alert["source"],
                alert["clinical_action"],
                alert["mitigation"],
                alert["attack_type"],
                alert["fingerprint"],
                alert["playbook_name"],
                alert["timestamp"],
                int(alert["is_attack"]),
            ),
        )


def export_logs_to_csv() -> Path:
    ensure_structure()
    export_path = EXPORTS_DIR / f"medGuard-log-export-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.csv"
    with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM alerts ORDER BY id DESC").fetchall()
    with export_path.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(
            [
                "timestamp",
                "device_id",
                "name",
                "device_type",
                "register_name",
                "hex_payload",
                "translated_value",
                "dose_delivered",
                "z_score",
                "severity",
                "source",
                "clinical_action",
                "mitigation",
                "attack_type",
                "fingerprint",
                "playbook_name",
                "is_attack",
            ]
        )
        for row in rows:
            writer.writerow(
                [
                    row["timestamp"],
                    row["device_id"],
                    row["name"],
                    row["device_type"],
                    row["register_name"],
                    row["hex_payload"],
                    row["translated_value"],
                    row["dose_delivered"],
                    row["z_score"],
                    row["severity"],
                    row["source"],
                    row["clinical_action"],
                    row["mitigation"],
                    row["attack_type"],
                    row["fingerprint"],
                    row["playbook_name"],
                    row["is_attack"],
                ]
            )
    return export_path


class Simulator:
    def __init__(self) -> None:
        self.sequence = 0
        self.last_tick = time.time()
        self.global_alerts = []
        self.key_logs = []
        self.sensors = {}
        for blueprint in SENSOR_BLUEPRINTS:
            self.sensors[blueprint["device_id"]] = self._make_sensor(blueprint)
            self.log_key_event(blueprint["device_id"], "ISSUED", self.sensors[blueprint["device_id"]]["key"])
        self.bootstrap()

    def log_key_event(self, device_id: str, event: str, key: str | None) -> None:
        self.key_logs.insert(0, {
            "timestamp": datetime.now(UTC).isoformat(),
            "device_id": device_id,
            "event": event,
            "key": key or "NONE"
        })
        self.key_logs = self.key_logs[:50]

    def _make_sensor(self, blueprint: dict) -> dict:
        return {
            **blueprint,
            "key": secrets.token_hex(32),
            "uptime_seconds": random.randint(18, 420) * 3600,
            "history": [],
            "latest": None,
            "status": "Nominal",
            "manual_mode": False,
            "locked_down": False,
            "offline": False,
            "requires_manual_restart": False,
            "quarantined": False,
            "risk_score": 0,
            "quarantine_reason": "",
            "attack_flash": 0,
            "last_mitigation": "Guardrails stable",
        }

    def bootstrap(self) -> None:
        for _ in range(28):
            self.tick()

    def playbook_catalog(self) -> list[dict]:
        return [
            {
                "name": name,
                "description": config["description"],
                "strategy": config["strategy"],
                "steps": config["steps"],
            }
            for name, config in PLAYBOOKS.items()
        ]

    def _normal_value(self, sensor: dict) -> float:
        base = sensor["baseline"]
        jitter = random.uniform(-sensor["variance"], sensor["variance"])
        if sensor["device_type"] == "reservoir_sensor":
            base = max(10.0, base - random.uniform(0.0, 0.12))
            sensor["baseline"] = base
        return round(max(0.05, base + jitter), 3)

    def _limits_for(self, sensor: dict) -> tuple[float, float]:
        if sensor["device_type"] == "infusion_pump":
            return 0.0, 18.5
        if sensor["device_type"] == "patient_monitor":
            return 35.0, 185.0
        if sensor["device_type"] == "glucose_sensor":
            return 55.0, 360.0
        if sensor["device_type"] == "reservoir_sensor":
            return 0.0, 100.0
        return 0.0, sensor["baseline"] + sensor["variance"] * 8

    def _recent_window(self, sensor: dict, incoming_value: float, length: int = 10) -> list[float]:
        previous = [entry["translated_value"] for entry in sensor["history"][-(length - 1) :]]
        window = previous + [incoming_value]
        while len(window) < length:
            window.insert(0, sensor["baseline"])
        return window[-length:]

    def _fingerprint_attack(self, sensor: dict, incoming_value: float) -> tuple[str, str]:
        window = self._recent_window(sensor, incoming_value)
        deltas = [right - left for left, right in zip(window, window[1:])]
        spread = max(window) - min(window)
        std = variance(window) ** 0.5
        max_jump = max((abs(delta) for delta in deltas), default=0.0)
        unique_values = len({round(item, 3) for item in window})
        baseline_gap = abs(average(window) - sensor["baseline"])
        midpoint = round((max(window) + min(window)) / 2, 3)
        midpoint_band = max(sensor["variance"] * 0.08, 0.02)
        monotonic_up = sum(1 for delta in deltas if delta >= -midpoint_band) >= len(deltas) - 2
        monotonic_down = sum(1 for delta in deltas if delta <= midpoint_band) >= len(deltas) - 2

        if unique_values <= 2 and all(abs(item - midpoint) <= midpoint_band for item in window[-6:]):
            return (
                "SPOOF",
                "Suspiciously perfect midpoint values with almost no jitter across the rolling window.",
            )

        if (monotonic_up or monotonic_down) and abs(window[-1] - window[0]) >= max(sensor["variance"] * 2.5, 0.5):
            return (
                "RAMP",
                "A stepwise climb or slide is unfolding gradually enough to look staged instead of organic.",
            )

        if max_jump >= max(sensor["variance"] * 3.2, abs(sensor["baseline"]) * 0.18, 0.8) and spread >= max(sensor["variance"] * 4.6, 1.0):
            return (
                "SPIKE",
                "The stream shows abrupt amplitude jumps and wide spread consistent with injected extremes.",
            )

        if std <= max(sensor["variance"] * 0.35, 0.08) and baseline_gap >= max(sensor["variance"] * 1.4, 0.35):
            return (
                "SUSTAINED",
                "Values are being held in a biased band long enough to look like a pinned or replayed channel.",
            )

        return (
            "SUSTAINED",
            "Hostile values remain biased for several samples even though the shape avoids an obvious single-step spike.",
        )

    def _compute_z(self, sensor: dict, value: float) -> float:
        baseline_window = [entry["translated_value"] for entry in sensor["history"][-25:]]
        if len(baseline_window) < 5:
            baseline_window = [sensor["baseline"]] * 8
        mean = average(baseline_window)
        std = max(0.02, variance(baseline_window) ** 0.5)
        return round(abs((value - mean) / std), 2)

    def _route(self, is_attack: bool, quarantined: bool) -> str:
        if quarantined:
            return "QUARANTINE -> SAFETY GATE LATCHED -> RELEASE REQUIRED"
        if is_attack:
            return "ATTACKER -> RADIO BRIDGE -> HEX TRANSLATOR -> SAFETY GATE -> PUMP"
        return "EMR -> CARE GATEWAY -> HEX TRANSLATOR -> SAFETY GATE -> PUMP"

    def _severity_for(self, sensor: dict, z_score: float, is_attack: bool, attack_type: str, playbook_name: str) -> str:
        if not is_attack:
            if z_score >= 3.2:
                return "CRITICAL"
            if z_score >= 1.9:
                return "WARNING"
            return "INFO"

        if playbook_name == "COMMAND_INJECTION":
            if z_score >= 2.2 or attack_type == "SPIKE":
                return "CRITICAL"
            return "WARNING"

        if playbook_name == "OVERDOSE_RAMP":
            if z_score >= 3.8:
                return "CRITICAL"
            if z_score >= 2.1 or attack_type == "RAMP":
                return "WARNING"
            return "INFO"

        if playbook_name == "FLATLINE_SPOOF":
            if attack_type == "SPOOF":
                return "CRITICAL"
            return "WARNING"

        if z_score >= 3.4 or attack_type in {"SPIKE", "SUSTAINED"}:
            return "CRITICAL"
        return "WARNING"

    def _mitigation_for(
        self,
        sensor: dict,
        is_attack: bool,
        severity: str,
        attack_type: str,
        playbook_name: str,
    ) -> tuple[str, str]:
        if sensor["quarantined"]:
            reason = sensor["quarantine_reason"] or "Operator-held quarantine"
            return (
                "Quarantine latched",
                f"{sensor['name']} is quarantined; telemetry is frozen until release. Reason: {reason}",
            )

        if not is_attack:
            return (
                "No mitigation",
                f"{sensor['name']} is operating inside nominal guardrails with normal telemetry variance.",
            )

        if severity == "CRITICAL":
            return (
                "Auto quarantine engaged",
                f"{sensor['name']} triggered automatic quarantine after {playbook_name} produced a {attack_type} fingerprint.",
            )

        if sensor["device_type"] == "infusion_pump":
            return (
                "Command held for review",
                f"Infusion command on {sensor['name']} was blocked while the gate inspects the {attack_type.lower()} pattern.",
            )
        if sensor["device_type"] == "patient_monitor":
            return (
                "Vitals path isolated",
                f"Cardiac telemetry from {sensor['name']} is being cross-checked after the {playbook_name} signature appeared.",
            )
        if sensor["device_type"] == "glucose_sensor":
            return (
                "Shadow reading enabled",
                f"{sensor['name']} is serving shadow estimates while operators inspect the {attack_type.lower()} drift.",
            )
        return (
            "Reservoir command gate tightened",
            f"{sensor['name']} is under closer review after the {playbook_name} stream lost its expected noise profile.",
        )

    def _build_alert(self, sensor: dict, value: float, is_attack: bool, playbook_name: str = "NONE") -> dict:
        hex_payload = float_to_hex(value)
        translated = hex_to_float(hex_payload)
        
        device_key = sensor.get("key")
        if device_key:
            signature = hmac.new(device_key.encode(), hex_payload.encode(), hashlib.sha256).hexdigest()
        else:
            signature = "NO_KEY"
            
        z_score = self._compute_z(sensor, translated)
        attack_type, fingerprint = ("NONE", "Nominal telemetry window.")
        if is_attack:
            attack_type, fingerprint = self._fingerprint_attack(sensor, translated)
        severity = self._severity_for(sensor, z_score, is_attack, attack_type, playbook_name)
        source = "compromised" if is_attack else "legit"
        dose_delivered = translated if sensor["device_type"] == "infusion_pump" and not sensor["quarantined"] else 0.0
        mitigation, clinical_action = self._mitigation_for(sensor, is_attack, severity, attack_type, playbook_name)
        timestamp = datetime.now(UTC).isoformat()
        plain_english = (
            f"{sensor['register']} => {translated:.2f} {sensor['unit']} | "
            f"{attack_type if is_attack else 'NORMAL'} | z={z_score:.2f}"
        )
        return {
            "device_key": device_key or "NONE",
            "signature": signature,
            "device_id": sensor["device_id"],
            "name": sensor["name"],
            "device_type": sensor["device_type"],
            "register": sensor["register"],
            "unit": sensor["unit"],
            "hex_payload": hex_payload,
            "translated_value": translated,
            "raw_value": translated,
            "dose_delivered": round(dose_delivered, 3),
            "z_score": z_score,
            "severity": severity,
            "source": source,
            "clinical_action": clinical_action,
            "mitigation": mitigation,
            "route": self._route(is_attack, sensor["quarantined"]),
            "plain_english": plain_english,
            "timestamp": timestamp,
            "is_attack": is_attack,
            "attack_type": attack_type,
            "fingerprint": fingerprint,
            "playbook_name": playbook_name,
        }

    def _risk_increment(self, severity: str) -> int:
        if severity == "CRITICAL":
            return 36
        if severity == "WARNING":
            return 18
        return 7

    def _quarantine_sensor(self, sensor: dict, reason: str) -> None:
        sensor["quarantined"] = True
        sensor["offline"] = True
        sensor["manual_mode"] = True
        sensor["locked_down"] = True
        sensor["requires_manual_restart"] = False
        sensor["status"] = "Quarantined"
        sensor["attack_flash"] = max(sensor["attack_flash"], 8)
        sensor["quarantine_reason"] = reason
        sensor["last_mitigation"] = "Quarantine latched; operator release required"
        sensor["key"] = None
        self.log_key_event(sensor["device_id"], "DROPPED", None)

    def _release_sensor(self, sensor: dict) -> dict:
        sensor["quarantined"] = False
        sensor["offline"] = False
        sensor["manual_mode"] = False
        sensor["locked_down"] = False
        sensor["requires_manual_restart"] = False
        sensor["status"] = "Nominal"
        sensor["attack_flash"] = 0
        sensor["risk_score"] = 0
        sensor["quarantine_reason"] = ""
        sensor["last_mitigation"] = "Operator released quarantine and resumed live polling"
        sensor["uptime_seconds"] = 0
        sensor["key"] = secrets.token_hex(32)
        self.log_key_event(sensor["device_id"], "ISSUED", sensor["key"])
        return {"status": "released", "device_id": sensor["device_id"]}

    def _record_alert(self, sensor: dict, alert: dict) -> None:
        sensor["latest"] = alert
        sensor["history"].append(alert)
        sensor["history"] = sensor["history"][-80:]
        sensor["last_mitigation"] = alert["mitigation"]
        sensor["attack_flash"] = max(sensor["attack_flash"] - 1, 0)

        if alert["is_attack"]:
            sensor["risk_score"] = min(100, sensor["risk_score"] + self._risk_increment(alert["severity"]))
            sensor["status"] = "Compromised" if not sensor["quarantined"] else "Quarantined"
        else:
            sensor["status"] = "Observed" if alert["severity"] == "WARNING" else "Nominal"

        self.global_alerts.insert(0, alert)
        self.global_alerts = self.global_alerts[:160]
        save_alert(alert)

        if alert["is_attack"] and alert["severity"] == "CRITICAL" and not sensor["quarantined"]:
            reason = (
                f"Auto quarantine: {alert['playbook_name']} generated a {alert['attack_type']} fingerprint "
                f"at severity {alert['severity']}"
            )
            self._quarantine_sensor(sensor, reason)

    def _generate_playbook_sequence(self, sensor: dict, playbook_name: str) -> list[float]:
        if playbook_name not in PLAYBOOKS:
            raise HTTPException(status_code=404, detail="Playbook not found")

        low, high = self._limits_for(sensor)
        baseline = sensor["baseline"]
        variance_band = sensor["variance"]
        history = [entry["translated_value"] for entry in sensor["history"][-10:]] or [baseline]

        if playbook_name == "OVERDOSE_RAMP":
            start = baseline + max(variance_band * 0.6, baseline * 0.08, 0.15)
            end = baseline + max(variance_band * 5.4, baseline * 1.55, 4.0 if sensor["device_type"] == "infusion_pump" else 0.0)
            sequence = []
            for index in range(PLAYBOOKS[playbook_name]["steps"]):
                progress = (index + 1) / PLAYBOOKS[playbook_name]["steps"]
                curve = progress ** 1.25
                value = start + (end - start) * curve + random.uniform(-variance_band * 0.08, variance_band * 0.08)
                sequence.append(round(clamp(value, low, high), 3))
            return sequence

        if playbook_name == "REPLAY_ATTACK":
            offset = max(variance_band * 0.62, baseline * 0.035, 0.2)
            anchor = average(history[-5:]) + offset
            return [
                round(clamp(anchor + random.uniform(-variance_band * 0.18, variance_band * 0.18), low, high), 3)
                for _ in range(PLAYBOOKS[playbook_name]["steps"])
            ]

        if playbook_name == "COMMAND_INJECTION":
            high_anchor = baseline + max(variance_band * 5.8, baseline * 0.82, 5.0 if sensor["device_type"] != "reservoir_sensor" else 0.0)
            low_anchor = baseline - max(variance_band * 4.8, baseline * 0.55, 0.75)
            sequence = []
            for index in range(PLAYBOOKS[playbook_name]["steps"]):
                anchor = high_anchor if index % 2 == 0 else low_anchor
                jitter = random.uniform(-variance_band * 1.05, variance_band * 1.05)
                sequence.append(round(clamp(anchor + jitter, low, high), 3))
            return sequence

        midpoint = round((min(history) + max(history)) / 2, 3)
        return [round(clamp(midpoint, low, high), 3) for _ in range(PLAYBOOKS[playbook_name]["steps"])]

    def trigger_playbook(self, device_id: str, playbook_name: str) -> dict:
        sensor = self.sensors[device_id]
        if sensor["quarantined"]:
            raise HTTPException(status_code=403, detail="Device is quarantined and must be released before another playbook can run")

        sequence = self._generate_playbook_sequence(sensor, playbook_name)
        sensor["attack_flash"] = 10
        executed_steps = 0

        for value in sequence:
            alert = self._build_alert(sensor, value, is_attack=True, playbook_name=playbook_name)
            self._record_alert(sensor, alert)
            executed_steps += 1
            if sensor["quarantined"]:
                break

        return {
            "status": "executed",
            "device_id": device_id,
            "playbook_name": playbook_name,
            "description": PLAYBOOKS[playbook_name]["description"],
            "steps_planned": len(sequence),
            "steps_executed": executed_steps,
            "quarantined": sensor["quarantined"],
            "risk_score": sensor["risk_score"],
            "latest": sensor["latest"],
        }

    def trigger_attack(self, device_id: str) -> dict:
        return self.trigger_playbook(device_id, "COMMAND_INJECTION")

    def restart_sensor(self, device_id: str) -> dict:
        return self.release_sensor(device_id)

    def quarantine_sensor(self, device_id: str, reason: str = "Manual operator quarantine") -> dict:
        sensor = self.sensors[device_id]
        self._quarantine_sensor(sensor, reason)
        return {
            "status": "quarantined",
            "device_id": device_id,
            "quarantine_reason": sensor["quarantine_reason"],
            "risk_score": sensor["risk_score"],
        }

    def release_sensor(self, device_id: str) -> dict:
        sensor = self.sensors[device_id]
        return self._release_sensor(sensor)

    def clear(self) -> None:
        self.sequence = 0
        self.global_alerts = []
        self.key_logs = []
        for blueprint in SENSOR_BLUEPRINTS:
            self.sensors[blueprint["device_id"]] = self._make_sensor(blueprint)
            self.log_key_event(blueprint["device_id"], "ISSUED", self.sensors[blueprint["device_id"]]["key"])
        with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
            conn.execute("DELETE FROM alerts")
        self.bootstrap()

    def tick(self) -> None:
        self.sequence += 1
        for sensor in self.sensors.values():
            if sensor["quarantined"]:
                sensor["attack_flash"] = max(sensor["attack_flash"] - 1, 0)
                continue

            sensor["uptime_seconds"] += 1
            if sensor["uptime_seconds"] > 0 and sensor["uptime_seconds"] % 300 == 0:
                sensor["key"] = secrets.token_hex(32)
                self.log_key_event(sensor["device_id"], "ROTATED", sensor["key"])
                
            value = self._normal_value(sensor)
            alert = self._build_alert(sensor, value, is_attack=False)
            self._record_alert(sensor, alert)

    def maybe_advance(self) -> None:
        now = time.time()
        elapsed = int(now - self.last_tick)
        if elapsed <= 0:
            return
        for _ in range(min(elapsed, 5)):
            self.tick()
        self.last_tick = now

    def _format_uptime(self, seconds: int) -> str:
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"

    def recent_logs(self, limit: int = 40) -> list[dict]:
        with sqlite3.connect(DB_PATH, timeout=5.0) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(row) for row in rows]

    def snapshot(self) -> dict:
        self.maybe_advance()
        sensors = []
        for sensor in self.sensors.values():
            sensors.append(
                {
                    "device_id": sensor["device_id"],
                    "name": sensor["name"],
                    "device_type": sensor["device_type"],
                    "unit": sensor["unit"],
                    "register": sensor["register"],
                    "uptime": self._format_uptime(sensor["uptime_seconds"]),
                    "location": sensor["location"],
                    "status": sensor["status"],
                    "manual_mode": sensor["manual_mode"],
                    "locked_down": sensor["locked_down"],
                    "offline": sensor["offline"],
                    "requires_manual_restart": sensor["requires_manual_restart"],
                    "quarantined": sensor["quarantined"],
                    "risk_score": sensor["risk_score"],
                    "quarantine_reason": sensor["quarantine_reason"],
                    "attack_flash": sensor["attack_flash"],
                    "last_mitigation": sensor["last_mitigation"],
                    "latest": sensor["latest"],
                    "history": sensor["history"][-30:],
                }
            )
        return {
            "tick": self.sequence,
            "timestamp": datetime.now(UTC).isoformat(),
            "system_status": self.system_status(),
            "playbooks": self.playbook_catalog(),
            "sensors": sensors,
            "recent_alerts": self.global_alerts[:20],
            "logs": self.recent_logs(32),
            "key_logs": self.key_logs[:20],
            "exports_dir": str(EXPORTS_DIR),
        }

    def system_status(self) -> dict:
        quarantined = [sensor for sensor in self.sensors.values() if sensor["quarantined"]]
        compromised = [
            sensor
            for sensor in self.sensors.values()
            if sensor["latest"] and sensor["latest"]["is_attack"] and not sensor["quarantined"]
        ]
        warnings = sum(
            1
            for sensor in self.sensors.values()
            if sensor["status"] in {"Observed", "Compromised", "Quarantined"}
        )
        response = ["Pharmacy checksum verified"]
        if compromised:
            response.append(f"{len(compromised)} device(s) show active hostile telemetry")
        elif quarantined:
            response.append(f"{len(quarantined)} device(s) are quarantined and no longer polling")
        else:
            response.append("Infusion rails nominal")

        if quarantined:
            response.append("Quarantine latch engaged, release required before data resumes")
        elif compromised:
            response.append("Attack fingerprinting active while the gate scores the stream")
        else:
            response.append("Telemetry synced with care gateway")

        return {
            "mode": "code-blue" if compromised or quarantined else "guarded-normal",
            "warnings": warnings,
            "response": response,
        }


init_db()
simulator = Simulator()

app = FastAPI(title="medGuard Simulation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "sensors": len(simulator.sensors),
        "playbooks": len(PLAYBOOKS),
    }


@app.get("/snapshot")
def get_snapshot() -> dict:
    return simulator.snapshot()


@app.get("/poll")
def poll() -> dict:
    return simulator.snapshot()


@app.get("/playbooks")
def list_playbooks() -> dict:
    return {"playbooks": simulator.playbook_catalog()}


@app.post("/simulate/attack/{device_id}")
def simulate_attack(device_id: str) -> dict:
    if device_id not in simulator.sensors:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return simulator.trigger_attack(device_id)


@app.post("/simulate/playbook/{device_id}/{playbook_name}")
def simulate_playbook(device_id: str, playbook_name: str) -> dict:
    if device_id not in simulator.sensors:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return simulator.trigger_playbook(device_id, playbook_name)


@app.post("/restart/{device_id}")
def restart_sensor(device_id: str) -> dict:
    if device_id not in simulator.sensors:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return simulator.restart_sensor(device_id)


@app.post("/devices/{device_id}/quarantine")
def quarantine_sensor(device_id: str) -> dict:
    if device_id not in simulator.sensors:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return simulator.quarantine_sensor(device_id)


@app.post("/devices/{device_id}/release")
def release_sensor(device_id: str) -> dict:
    if device_id not in simulator.sensors:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return simulator.release_sensor(device_id)


@app.get("/logs/export")
def export_logs() -> FileResponse:
    export_path = export_logs_to_csv()
    return FileResponse(export_path, filename=export_path.name, media_type="text/csv")


@app.delete("/alerts/clear")
def clear_logs() -> dict:
    simulator.clear()
    return {"status": "cleared"}


if __name__ == "__main__":
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=False)
