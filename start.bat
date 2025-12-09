@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title GIJIROKU - Starting...

echo.
echo  ========================================
echo     GIJIROKU - AI Meeting Minutes
echo     Frontend + Backend (Python)
echo  ========================================
echo.

:: Find Python 3.10 or 3.11 (prefer py launcher, then direct paths)
set PYTHON_CMD=

:: Try py launcher first (most reliable on Windows)
where py >nul 2>&1
if %errorlevel% equ 0 (
    :: Try Python 3.11 first
    py -3.11 --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py -3.11
        echo [OK] Found Python 3.11 via py launcher
        goto python_found
    )
    :: Try Python 3.10
    py -3.10 --version >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=py -3.10
        echo [OK] Found Python 3.10 via py launcher
        goto python_found
    )
)

:: Try direct paths for Python 3.11
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    echo [OK] Found Python 3.11 at %PYTHON_CMD%
    goto python_found
)
if exist "C:\Python311\python.exe" (
    set PYTHON_CMD=C:\Python311\python.exe
    echo [OK] Found Python 3.11 at %PYTHON_CMD%
    goto python_found
)

:: Try direct paths for Python 3.10
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
    set "PYTHON_CMD=%LOCALAPPDATA%\Programs\Python\Python310\python.exe"
    echo [OK] Found Python 3.10 at %PYTHON_CMD%
    goto python_found
)
if exist "C:\Python310\python.exe" (
    set PYTHON_CMD=C:\Python310\python.exe
    echo [OK] Found Python 3.10 at %PYTHON_CMD%
    goto python_found
)

:: Fallback: check default python
where python >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
    for /f "tokens=1,2 delims=." %%a in ("!PYTHON_VERSION!") do (
        set PYTHON_MAJOR=%%a
        set PYTHON_MINOR=%%b
    )
    
    if "!PYTHON_MAJOR!"=="3" (
        if !PYTHON_MINOR! GEQ 10 if !PYTHON_MINOR! LEQ 11 (
            set PYTHON_CMD=python
            echo [OK] Found Python !PYTHON_VERSION!
            goto python_found
        )
    )
    
    echo [ERROR] Python 3.10 or 3.11 is required. Found Python !PYTHON_VERSION!
    echo         Please install Python 3.10 or 3.11 from https://www.python.org/downloads/
    echo         Backend will not start.
    echo.
    goto start_frontend
)

echo [ERROR] Python 3.10 or 3.11 not found.
echo         Please install Python 3.10 or 3.11 from https://www.python.org/downloads/
echo         Backend will not start.
echo.
goto start_frontend

:python_found

:: Start Backend Setup
echo [INFO] Setting up Python backend...
pushd backend

if not exist "venv" (
    echo [INFO] Creating virtual environment with %PYTHON_CMD%...
    %PYTHON_CMD% -m venv venv
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create virtual environment.
        popd
        goto start_frontend
    )
)

:: Upgrade pip first
echo [INFO] Upgrading pip...
call venv\Scripts\python.exe -m pip install --upgrade pip >nul 2>&1

:: Install PyTorch first (CPU version for faster installation)
echo [INFO] Installing PyTorch...
call venv\Scripts\pip.exe install torch==2.4.0 torchaudio==2.4.0 --index-url https://download.pytorch.org/whl/cpu >nul 2>&1
if !errorlevel! neq 0 (
    echo [WARN] PyTorch installation via CPU index failed, trying default...
    call venv\Scripts\pip.exe install torch torchaudio >nul 2>&1
)

:: Install other dependencies
echo [INFO] Installing other dependencies... (this may take a few minutes)
call venv\Scripts\pip.exe install -r requirements.txt
if !errorlevel! neq 0 (
    echo [ERROR] Failed to install dependencies.
    echo         Please check your internet connection and try again.
    echo         You can also try running: backend\venv\Scripts\pip.exe install -r backend\requirements.txt
    popd
    goto start_frontend
)

echo [OK] Dependencies installed successfully.

:: Check and download kotoba-whisper model (first-time setup)
echo [INFO] Checking kotoba-whisper model...
if not exist "models\kotoba-whisper-v2.2-faster\model.bin" (
    echo.
    echo  ========================================
    echo   First-time Setup: Downloading Model
    echo  ========================================
    echo.
    echo  kotoba-whisper-v2.2-faster (~10GB^)
    echo  This is required for Japanese speech recognition.
    echo  Download will start automatically...
    echo.
    call venv\Scripts\python.exe setup_model.py
    if !errorlevel! neq 0 (
        echo [WARN] Model download may have failed.
        echo        You can download it from the Settings page.
    )
    echo.
) else (
    echo [OK] kotoba-whisper model found.
)

:: Start backend server using venv's python directly
echo [INFO] Starting backend server...

:: Create a startup script for the backend with proper error handling
echo @echo off > _run_backend.bat
echo cd /d "%CD%" >> _run_backend.bat
echo title GIJIROKU Backend >> _run_backend.bat
echo echo Starting backend server... >> _run_backend.bat
echo call venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 >> _run_backend.bat
echo if errorlevel 1 ( >> _run_backend.bat
echo     echo. >> _run_backend.bat
echo     echo [ERROR] Backend failed to start. >> _run_backend.bat
echo     echo Press any key to close... >> _run_backend.bat
echo     pause ^> nul >> _run_backend.bat
echo ^) >> _run_backend.bat

:: Start backend in a new window (not minimized so errors are visible)
start "GIJIROKU Backend" cmd /c "_run_backend.bat"

:: Wait for backend to start
echo [INFO] Waiting for backend...
set BACKEND_READY=0
for /L %%i in (1,1,30) do (
    if !BACKEND_READY! equ 0 (
        timeout /t 1 /nobreak >nul
        powershell -Command "try { (Invoke-WebRequest -Uri 'http://localhost:8000/health' -UseBasicParsing -TimeoutSec 2).StatusCode } catch { 0 }" > _backend_status.tmp 2>nul
        set /p BACKEND_STATUS=<_backend_status.tmp
        if "!BACKEND_STATUS!"=="200" (
            set BACKEND_READY=1
        )
    )
)
del _backend_status.tmp 2>nul

if !BACKEND_READY! equ 1 (
    echo [OK] Backend ready on http://localhost:8000
) else (
    echo [WARN] Backend may not have started correctly.
    echo        Check the backend window for errors.
)

popd
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
    if !errorlevel! neq 0 (
        echo [ERROR] npm install failed
        pause
        exit /b 1
    )
    echo.
)

echo [INFO] Starting frontend server...

:: Start frontend in background
start /b cmd /c "npm run dev"

:: Wait for frontend server
echo [INFO] Waiting for frontend...
:check_frontend
powershell -Command "try { (New-Object Net.Sockets.TcpClient).Connect('localhost', 3000); 'OK' } catch { 'FAIL' }" > _frontend_status.tmp 2>nul
set /p FRONTEND_STATUS=<_frontend_status.tmp
del _frontend_status.tmp 2>nul
if not "!FRONTEND_STATUS!"=="OK" (
    timeout /t 1 /nobreak >nul
    goto check_frontend
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
    echo [INFO] Frontend stopped.
    :: Also kill backend
    taskkill /f /fi "windowtitle eq GIJIROKU Backend*" >nul 2>&1
    del backend\_run_backend.bat 2>nul
    pause
    exit /b 0
)
goto wait_loop
