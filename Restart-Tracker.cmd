@echo off
setlocal
echo [TOPTOON Tracker] Checking and restarting local server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8888" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8788" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul
start "TOPTOON-Server" /b node scripts/serve.mjs --port 8888
echo [TOPTOON Tracker] Server started at http://127.0.0.1:8888/
start http://127.0.0.1:8888/
endlocal
