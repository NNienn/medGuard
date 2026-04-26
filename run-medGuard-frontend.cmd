@echo off
setlocal
cd /d "%~dp0frontend"

if not exist "node_modules" (
  echo [medGuard] node_modules not found. Running npm install first...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo [medGuard] npm install failed.
    pause
    exit /b 1
  )
)

echo [medGuard] Starting frontend on http://127.0.0.1:5174 ...
call npm.cmd run dev:web

if errorlevel 1 (
  echo.
  echo [medGuard] Frontend exited with an error.
  pause
)
