@echo off
chcp 65001 >nul
title GIJIROKU - Stopping...

echo.
echo  ========================================
echo     GIJIROKU - Stopping all services
echo  ========================================
echo.

:: Stop Frontend (Node.js on port 3000)
echo [INFO] Stopping frontend...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Frontend stopped (PID %%a)
)

:: Stop Backend (Python on port 8000)
echo [INFO] Stopping backend...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [OK] Backend stopped (PID %%a)
)

:: Kill remaining Node.js processes
tasklist /fi "imagename eq node.exe" | find /i "node.exe" >nul
if %errorlevel% equ 0 (
    echo [INFO] Stopping remaining Node.js...
    taskkill /F /IM node.exe >nul 2>&1
    echo [OK] Node.js stopped
)

echo.
echo  ========================================
echo   All services stopped
echo  ========================================
echo.
pause
