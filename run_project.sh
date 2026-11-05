#!/usr/bin/env bash

# ==============================================================================
# SMART AGRICULTURE ROVER — UNIFIED STARTUP SCRIPT
# Starts both the Node.js IoT backend (Port 8000) and Vite React frontend (Port 3000).
# ==============================================================================

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
FRONTEND_DIR="$PROJECT_ROOT/frontend"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:$PATH"

echo "======================================================================"
echo "🌱 SMART AGRICULTURE ROVER — FULL-STACK IOT MONITORING PLATFORM"
echo "======================================================================"

# Determine Node / npm
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Error: Node.js is not installed or not in PATH. Please install Node.js."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo "❌ Error: npm is not installed or not in PATH."
    exit 1
fi

echo "✔ Using Node : $(which node) ($(node -v))"
echo "✔ Using NPM  : $(which npm) ($(npm -v))"

# Clean any stale processes on port 8000 or 3000 if hung
OLD_8000=$(lsof -ti :8000 || true)
if [ -n "$OLD_8000" ]; then
    echo "⚠️ Port 8000 was in use by PID(s): $OLD_8000. Releasing port..."
    kill -9 $OLD_8000 2>/dev/null || true
fi

OLD_3000=$(lsof -ti :3000 || true)
if [ -n "$OLD_3000" ]; then
    echo "⚠️ Port 3000 was in use by PID(s): $OLD_3000. Releasing port..."
    kill -9 $OLD_3000 2>/dev/null || true
fi

# 1. Start Node.js IoT Backend
echo "▶ Starting Node.js IoT Backend on http://127.0.0.1:8000 ..."
cd "$BACKEND_DIR"
node server.js &
BACKEND_PID=$!

# Trap Ctrl+C to shut down both processes cleanly
trap "echo ''; echo 'Shutting down services...'; kill $BACKEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM

sleep 1.5

# 2. Start Vite Frontend
echo "▶ Starting Vite React Frontend on http://localhost:3000 ..."
cd "$FRONTEND_DIR"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

sleep 2

echo ""
echo "======================================================================"
echo "✅ ALL SERVICES ACTIVE!"
echo "======================================================================"
echo "   🌐 Web Dashboard UI : http://localhost:3000"
echo "   🩺 IoT Health Check  : http://localhost:8000/health"
echo "   📡 MQTT Broker       : mqtt://broker.emqx.io:1883"
echo "   🤖 Test Simulator    : node hardware/simulate_esp32_rover.js"
echo "======================================================================"
echo "Press Ctrl+C in this terminal to stop both servers."
echo ""

# Try opening the web browser automatically on macOS
if command -v open >/dev/null 2>&1; then
    open "http://localhost:3000" 2>/dev/null || true
fi

wait $BACKEND_PID $FRONTEND_PID
