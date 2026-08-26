@echo off
setlocal
echo [TOPTOON Tracker] Stopping local server...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8888" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8788" ^| findstr "LISTENING"') do (
    taskkill /f /pid %%a >nul 2>&1
)
echo [TOPTOON Tracker] Server stopped.
endlocal
