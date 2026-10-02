@echo off
setlocal
cd /d "%~dp0"
set "PATH=%~dp0.runtime\node20;C:\Program Files\Git\cmd;C:\Program Files\Docker\Docker\resources\bin;%PATH%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-chatpulse.ps1" %*
set "chatpulseExitCode=%errorlevel%"
if not "%chatpulseExitCode%"=="0" (
    echo.
    echo ChatPulse could not start. See the error above and logs\startup.
    pause
)
endlocal & exit /b %chatpulseExitCode%
