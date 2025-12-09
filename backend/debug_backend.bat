@echo off
setlocal enabledelayedexpansion
chcp 65001
title GIJIROKU Backend - Debug Mode

echo.
echo ========================================
echo   GIJIROKU Backend - Debug Mode
echo ========================================
echo.

:: Check if venv exists
if not exist "venv" (
    echo [ERROR] Virtual environment not found.
    echo         Please run start.bat first to create it.
    pause
    exit /b 1
)

:: Show Python version
echo [INFO] Checking Python version...
call venv\Scripts\python.exe --version
echo.

:: Show installed packages
echo [INFO] Checking installed packages...
call venv\Scripts\pip.exe list | findstr /i "fastapi uvicorn torch"
echo.

:: Check if main.py exists
if not exist "main.py" (
    echo [ERROR] main.py not found in backend directory.
    pause
    exit /b 1
)

:: Check if requirements are installed
echo [INFO] Verifying key dependencies...
call venv\Scripts\python.exe -c "import fastapi; print('✓ FastAPI')" 2>nul || echo ✗ FastAPI missing
call venv\Scripts\python.exe -c "import uvicorn; print('✓ Uvicorn')" 2>nul || echo ✗ Uvicorn missing
call venv\Scripts\python.exe -c "import torch; print('✓ PyTorch')" 2>nul || echo ✗ PyTorch missing
call venv\Scripts\python.exe -c "import faster_whisper; print('✓ faster-whisper')" 2>nul || echo ✗ faster-whisper missing
echo.

:: Try to import main.py
echo [INFO] Testing main.py import...
call venv\Scripts\python.exe -c "import sys; sys.path.insert(0, '.'); from main import app; print('✓ main.py loads successfully')"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to import main.py
    echo         Check the error above for details.
    echo.
    pause
    exit /b 1
)
echo.

:: Start the server with full output
echo [INFO] Starting backend server with full logging...
echo [INFO] Press Ctrl+C to stop
echo.
echo ========================================
echo.

call venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level debug

pause

