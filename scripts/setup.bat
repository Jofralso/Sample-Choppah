@echo off
REM Install script for Windows
echo ═══════════════════════════════════════
echo  GET DA CHOPPAH — Setup
echo ═══════════════════════════════════════

REM Check Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: python not found. Install Python 3.10+ from python.org
    exit /b 1
)

python --version

REM Check ffmpeg
where ffmpeg >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo.
    echo WARNING: ffmpeg not found.
    echo Install it:
    echo   winget install ffmpeg
    echo   OR download from https://ffmpeg.org/download.html
    echo.
)

REM Create venv
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating venv...
call .venv\Scripts\activate.bat

echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Done! To run:
echo   .venv\Scripts\activate
echo   python app.py
echo   → http://localhost:5555
