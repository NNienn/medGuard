# Local Run Notes

## Double-click flow

1. Run `run-medGuard-backend.cmd`
2. Run `run-medGuard-frontend.cmd`
3. Open `http://127.0.0.1:5174`

The updated backend intentionally runs on `http://127.0.0.1:8010` so it does not collide with the older service already using port `8000` on this machine.

The backend launcher now repairs or recreates `venv\` and installs `requirements.txt` automatically when the checked-in environment is stale.
It also handles both `venv\bin\python.exe` and `venv\Scripts\python.exe` layouts.
The backend dependency set is intentionally minimal: `fastapi` and `uvicorn`.

## Backend endpoints used by the UI

- `GET /poll`
- `GET /playbooks`
- `POST /simulate/playbook/{device_id}/{playbook_name}`
- `POST /devices/{device_id}/quarantine`
- `POST /devices/{device_id}/release`
- `DELETE /alerts/clear`
- `GET /logs/export`

## Current behavior

- Named playbooks replace the old simple attack injector.
- Attack readings are fingerprinted as `SPIKE`, `RAMP`, `SUSTAINED`, or `SPOOF`.
- Critical hostile readings auto-quarantine the target device.
- Releasing a device resets `risk_score` to `0`.
