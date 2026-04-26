# medGuard

A professional, cyber-physical demonstration application visualizing hostile telemetry targeting medical infusion devices. The application features a stylized React-based terminal dashboard powered by a resilient FastAPI simulation backend.

## About

**medGuard** simulates a real-time hospital environment where critical medical devices—such as insulin pumps and cardiac monitors—broadcast telemetry data. It focuses on the intersection of cybersecurity and healthcare, illustrating how simulated cyberattacks can inject malicious command sequences into patient care infrastructure.

The simulation highlights critical defensive strategies including real-time payload translation, z-score anomaly detection, telemetry fingerprinting, automated safety guardrails, and cryptographic signature validation. It serves as an educational and demonstration platform for securing IoT and embedded medical networks.

## Architecture

The project has been refactored into a clear, modular architecture separating the simulation engine from the operator interface.

### System Components

#### 1. Backend (`/backend`)
A high-performance simulation engine built with **FastAPI** and **Python**.
- **Simulator (`main.py`)**: Models the behavior of various medical sensors (e.g., Infusion Pumps, Cardiac Monitors). It generates baseline telemetry with realistic jitter and noise.
- **Key Management & Cryptography**: Each device is issued a 256-bit cryptographic key upon initialization. Telemetry payloads are signed using HMAC-SHA256 to ensure data integrity. Keys are automatically rotated every 5 minutes to limit exposure and are immediately dropped/revoked if a device falls under hostile control.
- **Attack Playbooks**: Sophisticated attack models (`OVERDOSE_RAMP`, `REPLAY_ATTACK`, `COMMAND_INJECTION`, `FLATLINE_SPOOF`) inject anomalies into the stream.
- **Anomaly Detection & Guardrails**: A rolling-window analysis fingerprints incoming attacks (e.g., `SPIKE`, `RAMP`, `SUSTAINED`) and computes z-scores. Critical events auto-trigger device quarantines.
- **Database (`sqlite3`)**: Persists all alerts, telemetry frames, and key rotation events, enabling CSV exports for forensic analysis.

#### 2. Frontend (`/frontend`)
A terminal-grade, highly stylized **React** operator dashboard built with **Vite**.
- **Dashboard UI (`Dashboard.jsx`)**: The primary command center. Displays live system status, active sensors, their cryptographic states, and recent telemetry logs.
- **AsciiFX (`AsciiFX.jsx`)**: Renders dynamic, responsive ASCII art components (e.g., beating heart, infusion syringe, patient monitor, and data pipeline) that react to real-time telemetry and network stress.
- **Responsive Layout (`index.css`)**: Implements a dark-mode, glassmorphic visual system with strict layout boundaries, preventing ASCII overflow while maintaining a cinematic aesthetic.

## Quick Start (Windows)

The repository provides one-click launchers configured to automatically handle dependency installation and virtual environment bootstrapping.

1. **Start the Backend**:
   Double-click `run-medGuard-backend.cmd`
   *(Sets up Python `venv`, installs FastAPI/Uvicorn, and starts the server on `http://127.0.0.1:8010`)*

2. **Start the Frontend**:
   Double-click `run-medGuard-frontend.cmd`
   *(Runs `npm install` if needed and starts the Vite dev server on `http://127.0.0.1:5174`)*

## Manual Execution

**Backend**:
```powershell
cd backend
python -m venv venv
venv\Scripts\pip install -r requirements.txt
venv\Scripts\python main.py
```

**Frontend**:
```powershell
cd frontend
npm install
npm run dev:web
```

## API Highlights

- `GET /poll` - Fetches the live snapshot of all sensors, recent alerts, and key management logs.
- `GET /playbooks` - Retrieves available hostile simulation scenarios.
- `POST /simulate/playbook/{device_id}/{playbook_name}` - Injects a targeted attack against a specific device.
- `POST /devices/{device_id}/quarantine` - Engages a manual hardware quarantine on a device.
- `POST /devices/{device_id}/release` - Releases a quarantine, restoring nominal state and issuing a fresh cryptographic key.
- `GET /logs/export` - Generates a forensic CSV export of all telemetry events.
