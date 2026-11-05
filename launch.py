#!/usr/bin/env python3
"""
Smart Agriculture Rover — All-in-One Application Launcher
Starts both the Node.js IoT Backend (Express + MQTT + Socket.IO) and Vite React Frontend.
Automatically opens http://localhost:3000 in your browser.
"""

import os
import sys
import time
import signal
import socket
import shutil
import subprocess
import webbrowser
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RED = "\033[91m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_banner():
    print(f"{GREEN}{BOLD}" + "=" * 70 + f"{RESET}")
    print(f"{GREEN}{BOLD}🌱 SMART AGRICULTURE ROVER — FULL-STACK IOT MONITORING PLATFORM{RESET}")
    print(f"{GREEN}{BOLD}" + "=" * 70 + f"{RESET}\n")


def ensure_path():
    """Ensure standard tool paths (Homebrew, /usr/local/bin) are in PATH."""
    extra_paths = [
        "/opt/homebrew/bin",
        "/opt/homebrew/sbin",
        "/usr/local/bin",
        str(Path.home() / ".nvm"),
    ]
    cur_path = os.environ.get("PATH", "")
    for p in extra_paths:
        if os.path.exists(p) and p not in cur_path:
            cur_path = f"{p}:{cur_path}"
    os.environ["PATH"] = cur_path


def find_node():
    """Find node binary."""
    node_path = shutil.which("node")
    if node_path:
        return node_path
    candidates = [
        "/usr/local/bin/node",
        "/opt/homebrew/bin/node",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def find_npm():
    """Find npm binary."""
    npm_path = shutil.which("npm")
    if npm_path:
        return npm_path
    candidates = [
        "/usr/local/bin/npm",
        "/opt/homebrew/bin/npm",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def is_port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.5)
        return s.connect_ex(("127.0.0.1", port)) == 0


def kill_port_owners(port: int):
    """Safely terminate any lingering process listening on the specified port."""
    try:
        res = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True,
            text=True,
        )
        pids = [p.strip() for p in res.stdout.strip().split("\n") if p.strip()]
        for pid in pids:
            try:
                print(f"{YELLOW}⚠️  Releasing port {port} (PID {pid})...{RESET}")
                os.kill(int(pid), signal.SIGTERM)
                time.sleep(0.3)
                os.kill(int(pid), signal.SIGKILL)
            except (ProcessLookupError, ValueError):
                pass
    except Exception:
        pass


def main():
    print_banner()
    ensure_path()

    node_bin = find_node()
    npm_bin = find_npm()

    if not node_bin or not npm_bin:
        print(f"{RED}❌ Error: Node.js / npm not found in system PATH.{RESET}")
        print("Please install Node.js from https://nodejs.org or via `brew install node`.")
        input("\nPress Enter to exit...")
        sys.exit(1)

    print(f"✔ Node.js Runtime   : {CYAN}{node_bin}{RESET}")
    print(f"✔ NPM Binary        : {CYAN}{npm_bin}{RESET}")

    # Clear lingering ports
    for port in (8000, 3000):
        if is_port_in_use(port):
            kill_port_owners(port)
            time.sleep(0.5)

    processes = []

    def shutdown(*_):
        print(f"\n{YELLOW}🛑 Stopping Smart Rover services...{RESET}")
        for p in processes:
            try:
                p.terminate()
            except Exception:
                pass
        time.sleep(0.5)
        for p in processes:
            try:
                p.kill()
            except Exception:
                pass
        print(f"{GREEN}✔ All services safely stopped.{RESET}")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # 1. Start Node.js IoT Backend (Port 8000)
    print(f"\n{BOLD}▶ 1/2 Starting Node.js IoT Backend (Port 8000)...{RESET}")
    backend_env = os.environ.copy()
    
    backend_proc = subprocess.Popen(
        [node_bin, "server.js"],
        cwd=str(BACKEND_DIR),
        env=backend_env,
    )
    processes.append(backend_proc)

    # 2. Start Vite Frontend (Port 3000)
    print(f"{BOLD}▶ 2/2 Starting Vite React Frontend (Port 3000)...{RESET}")
    frontend_proc = subprocess.Popen(
        [npm_bin, "run", "dev", "--", "--host", "0.0.0.0"],
        cwd=str(FRONTEND_DIR),
        env=os.environ.copy(),
    )
    processes.append(frontend_proc)

    # Allow services to initialize
    time.sleep(2.5)

    print("\n" + f"{GREEN}{BOLD}" + "=" * 70 + f"{RESET}")
    print(f"{GREEN}{BOLD}✅ SMART AGRICULTURE ROVER PLATFORM IS RUNNING!{RESET}")
    print(f"{GREEN}{BOLD}" + "=" * 70 + f"{RESET}")
    print(f"   🌐 {BOLD}Web Dashboard UI{RESET}   : {CYAN}http://localhost:3000{RESET}")
    print(f"   🩺 {BOLD}IoT Health & State{RESET}  : {CYAN}http://localhost:8000/health{RESET}")
    print(f"   📡 {BOLD}MQTT Broker Target{RESET} : {CYAN}mqtt://broker.emqx.io:1883{RESET}")
    print(f"   🤖 {BOLD}Hardware Simulator{RESET} : {CYAN}node hardware/simulate_esp32_rover.js{RESET}")
    print(f"   📷 {BOLD}ESP32-CAM Ingest{RESET}   : {CYAN}POST http://<your-mac-ip>:8000/upload{RESET}")
    print(f"{GREEN}{BOLD}" + "=" * 70 + f"{RESET}")
    print(f"Press {YELLOW}Ctrl+C{RESET} in this terminal window anytime to stop the rover platform.\n")

    # Automatically launch default web browser
    try:
        webbrowser.open("http://localhost:3000")
    except Exception:
        pass

    try:
        while True:
            if backend_proc.poll() is not None:
                print(f"{RED}⚠️ Backend process exited unexpectedly (code {backend_proc.returncode}).{RESET}")
                break
            if frontend_proc.poll() is not None:
                print(f"{RED}⚠️ Frontend process exited unexpectedly (code {frontend_proc.returncode}).{RESET}")
                break
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown()

    shutdown()


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n{RED}❌ Launch Error: {e}{RESET}")
        input("\nPress Enter to exit...")
