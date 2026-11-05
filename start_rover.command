#!/usr/bin/env bash

# ==============================================================================
# SMART AGRICULTURE ROVER — MACOS DOUBLE-CLICKABLE LAUNCHER
# Double-click this file from Finder to start both backend & frontend.
# ==============================================================================

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "======================================================================"
echo "🌱 Launching Smart Agriculture Rover Platform..."
echo "======================================================================"

if [ -f "$DIR/backend/venv/bin/python" ]; then
    "$DIR/backend/venv/bin/python" "$DIR/launch.py"
elif command -v python3 >/dev/null 2>&1; then
    python3 "$DIR/launch.py"
elif [ -f "$DIR/run_project.sh" ]; then
    chmod +x "$DIR/run_project.sh"
    "$DIR/run_project.sh"
else
    echo "❌ Error: Could not locate launcher or Python interpreter."
fi

# Keep Terminal open if the process terminates or hits an error
echo ""
read -p "Press [Enter] to exit..."
