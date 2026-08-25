@echo off
setlocal
echo [TOPTOON Tracker] Restarting server on port 8788...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8788" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
start "TOPTOON-Server" /b node scripts/serve.mjs --port 8788
echo [TOPTOON Tracker] Server restarted at http://127.0.0.1:8788/
start http://127.0.0.1:8788/
endlocal
