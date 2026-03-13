#!/usr/bin/env bash
# Install script for Linux / macOS
set -euo pipefail

echo "═══════════════════════════════════════"
echo " GET DA CHOPPAH — Setup"
echo "═══════════════════════════════════════"

# Check Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: python3 not found. Install Python 3.10+."
    exit 1
fi

PY_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "Python: $PY_VERSION"

# Check ffmpeg
if ! command -v ffmpeg &>/dev/null; then
    echo ""
    echo "WARNING: ffmpeg not found."
    echo "Install it:"
    echo "  macOS:  brew install ffmpeg"
    echo "  Ubuntu: sudo apt install ffmpeg"
    echo "  Fedora: sudo dnf install ffmpeg"
    echo ""
fi

# Create venv
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

echo "Activating venv..."
source .venv/bin/activate

echo "Installing dependencies..."
pip install -r requirements.txt

echo ""
echo "Done! To run:"
echo "  source .venv/bin/activate"
echo "  python app.py"
echo "  → http://localhost:5555"
