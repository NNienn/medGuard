@echo off
setlocal
cd /d "%~dp0backend"

set "PY_CMD="
if exist "%LocalAppData%\Programs\Python\Python311\python.exe" set "PY_CMD=%LocalAppData%\Programs\Python\Python311\python.exe"
if not defined PY_CMD if exist "%LocalAppData%\Programs\Python\Python310\python.exe" set "PY_CMD=%LocalAppData%\Programs\Python\Python310\python.exe"
if not defined PY_CMD if exist "%LocalAppData%\Programs\Python\Python313\python.exe" set "PY_CMD=%LocalAppData%\Programs\Python\Python313\python.exe"
if not defined PY_CMD set "PY_CMD=python"

set "VENV_PY="
if exist "venv\Scripts\python.exe" set "VENV_PY=venv\Scripts\python.exe"
if exist "venv\bin\python.exe" set "VENV_PY=venv\bin\python.exe"

call "%PY_CMD%" --version >nul 2>nul
if errorlevel 1 (
  echo [medGuard] A usable Python installation was not found.
  echo Install Python 3.10+ and rerun this launcher.
  pause
  exit /b 1
)

set "BOOTSTRAP_VENV=0"
if defined VENV_PY (
  call "%VENV_PY%" -c "import fastapi, uvicorn" >nul 2>nul
  if errorlevel 1 set "BOOTSTRAP_VENV=1"
) else (
  set "BOOTSTRAP_VENV=1"
)

if "%BOOTSTRAP_VENV%"=="1" (
  echo [medGuard] Creating or repairing local virtual environment...
  call "%PY_CMD%" -m venv venv --clear
  if errorlevel 1 (
    echo [medGuard] Failed to create local virtual environment.
    pause
    exit /b 1
  )

  set "VENV_PY="
  if exist "venv\Scripts\python.exe" set "VENV_PY=venv\Scripts\python.exe"
  if exist "venv\bin\python.exe" set "VENV_PY=venv\bin\python.exe"
  if not defined VENV_PY (
    echo [medGuard] Created venv but no Python executable was found inside it.
    pause
    exit /b 1
  )

  echo [medGuard] Installing backend requirements...
  call "%VENV_PY%" -m pip install --upgrade pip
  call "%VENV_PY%" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [medGuard] Dependency installation failed.
    pause
    exit /b 1
  )
)

echo [medGuard] Starting backend on http://127.0.0.1:8010 ...
call "%VENV_PY%" main.py

if errorlevel 1 (
  echo.
  echo [medGuard] Backend exited with an error.
  pause
)
