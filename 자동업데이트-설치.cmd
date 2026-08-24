@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-auto-update-task.ps1" -IntervalHours 1 -RunNow
echo.
echo TOPTOON Signal Desk automatic update is scheduled every hour.
pause
