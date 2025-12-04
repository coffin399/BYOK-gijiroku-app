@echo off
chcp 65001 >nul
title GIJIROKU - Starting...

echo.
echo  ========================================
echo     GIJIROKU - AI Meeting Minutes
echo     Frontend + Backend (Python)
echo  ========================================
echo.

:: Check Python for backend
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Python not found. Backend will not start.
    echo        Install Python 3.10+ for local speech recognition.
    echo.
    goto start_frontend
)

:: Start Backend Setup
echo [INFO] Setting up Python backend...
cd backend

if not exist "venv" (
    echo [INFO] Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

:: Install dependencies
echo [INFO] Checking dependencies...
pip install -r requirements.txt --quiet 2>nul

:: Check and download kotoba-whisper model (first-time setup)
echo [INFO] Checking kotoba-whisper model...
if not exist "models\kotoba-whisper-v2.2-faster\model.bin" (
    echo.
    echo  ========================================
    echo   First-time Setup: Downloading Model
    echo  ========================================
    echo.
    echo  kotoba-whisper-v2.2-faster (~10GB)
    echo  This is required for Japanese speech recognition.
    echo  Download will start automatically...
    echo.
    python setup_model.py
    if %errorlevel% neq 0 (
        echo [WARN] Model download may have failed.
        echo        It will be downloaded on first use.
    )
    echo.
) else (
    echo [OK] kotoba-whisper model found.
)

:: Start backend in background
echo [INFO] Starting backend server...
start /b python -m uvicorn main:app --host 0.0.0.0 --port 8000 >nul 2>&1

cd ..
echo [OK] Backend starting on http://localhost:8000
echo.

:start_frontend
:: Check Node.js
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install Node.js 18+
    pause
    exit /b 1
)

:: Install frontend dependencies
if not exist "node_modules" (
    echo [INFO] Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting frontend server...

:: Start frontend in background
start /b cmd /c "npm run dev"

:: Wait for server
echo [INFO] Waiting for server...
timeout /t 3 /nobreak >nul

:check_server
powershell -Command "(New-Object Net.Sockets.TcpClient).Connect('localhost', 3000)" 2>nul
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto check_server
)

echo [OK] Frontend ready on http://localhost:3000
echo.

:: Open browser
echo [INFO] Opening browser...
start http://localhost:3000

echo.
echo  ========================================
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Press Ctrl+C to stop
echo  ========================================
echo.

:: Keep running
:wait_loop
timeout /t 5 /nobreak >nul
tasklist /fi "imagename eq node.exe" | find /i "node.exe" >nul
if %errorlevel% neq 0 (
    echo [INFO] Server stopped.
    pause
    exit /b 0
)
goto wait_loop
