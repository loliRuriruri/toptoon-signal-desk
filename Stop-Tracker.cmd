@echo off
setlocal
echo [TOPTOON Tracker] Stopping server on port 8788...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8788" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [TOPTOON Tracker] Server stopped.
endlocal
