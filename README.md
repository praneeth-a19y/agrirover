# AgriRover — AI-Powered Smart Agriculture IoT Platform

> **Live Production Architecture:** React + TypeScript (Vite) Frontend | Node.js Express & Socket.IO Backend on Render | EMQX Cloud Serverless MQTT (TLS 8883) | ESP32 DevKit V1 (4WD L298N + DHT22 + Capacitive Moisture + Analog pH)

---

## 1. System Architecture & Cloud Topology

```
+-----------------------------------------------------------------------------------+
|                            PUBLIC INTERNET / BROWSER                              |
|   https://<your-app>.onrender.com (React 18 + Tailwind + Recharts + Socket.IO)    |
+-----------------------------------------+-----------------------------------------+
                                          |
                      (HTTPS REST API & WSS WebSockets)
                                          v
+-----------------------------------------------------------------------------------+
|                        RENDER CLOUD WEB SERVICE (Frankfurt)                       |
|   Node.js 20+ Express Backend                                                     |
|   - Port: process.env.PORT (10000 on Render)                                      |
|   - Serves Frontend Single-Page App & REST Endpoints (/api/v1/...)                |
|   - Real-Time Socket.IO Broadcaster                                               |
|   - SQLite Database & Alert Engine                                                |
|   - MQTTS TLS Client with DigiCert Root CA Validation                             |
+-----------------------------------------+-----------------------------------------+
                                          |
                        (MQTTS TLS Port 8883 / TLS v1.3)
                        Auth: backend
                                          v
+-----------------------------------------------------------------------------------+
|                            EMQX CLOUD SERVERLESS BROKER                           |
|   Host: ed61a166.ala.eu-central-1.emqxsl.com (Port 8883 TLS)                      |
|   - devices/agrirover-01/command   (Backend Publishes -> ESP32 Subscribes)        |
|   - devices/agrirover-01/ack       (ESP32 Publishes -> Backend Subscribes)        |
|   - devices/agrirover-01/telemetry (ESP32 Publishes -> Backend Subscribes)        |
|   - devices/agrirover-01/status    (ESP32 Publishes -> Backend Subscribes + LWT)  |
+-----------------------------------------+-----------------------------------------+
                                          ^
                        (MQTTS TLS Port 8883 / TLS v1.3)
                        Auth: agrirover
                                          |
+-----------------------------------------+-----------------------------------------+
|                       ESP32 ROVER EMBEDDED HARDWARE                               |
|   ESP32 DevKit V1 (WiFiClientSecure + PubSubClient + ArduinoJson)                 |
|   - Pins 18, 19, 21, 22, 23, 25: L298N Dual H-Bridge (4WD Motors + Watchdog)    |
|   - Pin 4: DHT22 Canopy Temperature & Humidity                                    |
|   - Pin 34: Capacitive Soil Moisture Sensor V1.2 (ADC1_CH6)                       |
|   - Pin 35: Analog Soil pH Sensor Board (ADC1_CH7)                                |
|   - Pin 36: Battery Voltage Divider (ADC1_CH0)                                    |
|   - Pin 2: Auxiliary Headlight / Status LED                                       |
+-----------------------------------------------------------------------------------+
```

---

## 2. Diagnosing & Fixing the Render Deployment Failure

### Root Cause of Previous Failure
When the repository was first connected to Render without configuration:
1. Render inspected the root repository directory and found Python scripts (`launch.py`, `train_epics_model.py`).
2. Render inferred the runtime was **Python 3.14.x**.
3. It attempted to run:
   ```bash
   pip install -r requirements.txt
   ```
4. It failed with `Error: Could not open requirements file: No such file or directory: requirements.txt` because the primary server is **Node.js**, and dependencies were located inside `backend/package.json` and `frontend/package.json`.

### Permanent Solution Implemented
1. **Infrastructure as Code (`render.yaml`)**:
   Render now natively detects the [`render.yaml`](render.yaml) blueprint, locking the runtime to **Node.js** in region `frankfurt` (closest to EMQX Cloud `eu-central-1`), using the Free tier.
2. **Root `package.json` & Build Pipeline**:
   Added a root [`package.json`](package.json) orchestrating:
   - `npm run build`: Compiles the React Vite frontend into `frontend/dist` and installs backend dependencies.
   - `npm start`: Starts `backend/server.js`.
3. **Unified Single-Service Hosting (Option A)**:
   In production, `backend/server.js` serves the compiled frontend assets directly from `frontend/dist`.
   - **Zero CORS issues** because the browser and API share the same origin.
   - **Zero extra cost** on the Render Free plan.
   - Socket.IO connects directly to `/` with no configuration.
4. **Fallback `requirements.txt`**:
   Created a root [`requirements.txt`](requirements.txt) to prevent pipeline failures if Python is accidentally selected.

---

## 3. Render Deployment Setup (Step-by-Step)

### Option 1: Automatic Deploy via Blueprint (`render.yaml`) — Recommended
1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub repository: `praneeth-a19y/agrirover`.
4. Render will parse `render.yaml` automatically.
5. In the **Environment Variables** prompt, enter:
   - `MQTT_PASSWORD`: *(Your EMQX Cloud password for `backend`)*
6. Click **Apply**. Render will build and deploy your live public website!

### Option 2: Manual Web Service Setup on Render
If creating a manual Web Service instead of using the Blueprint:
- **Type**: Web Service
- **Name**: `agrirover`
- **Region**: `Frankfurt (EU Central)` *(matches EMQX Cloud)*
- **Branch**: `main`
- **Runtime**: `Node`
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
- **Plan**: `Free`
- **Health Check Path**: `/health`

#### Environment Variables to Set on Render:
| Variable Key | Recommended Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations & static serving |
| `MQTT_HOST` | `ed61a166.ala.eu-central-1.emqxsl.com` | EMQX Cloud Serverless broker host |
| `MQTT_PORT` | `8883` | Secure MQTTS TLS port |
| `MQTT_TLS` | `true` | Enforces TLS with certificate verification |
| `MQTT_USERNAME` | `backend` | Backend MQTT user |
| `MQTT_PASSWORD` | `<your_backend_mqtt_password>` | Entered securely in Render settings |
| `MQTT_CLIENT_ID`| `agrirover-backend` | Client ID identifier |
| `DEVICE_ID` | `agrirover-01` | Default rover hardware identifier |
| `DEFAULT_DEVICE_ID` | `agrirover-01` | Matching device filter |
| `FRONTEND_ORIGIN` | `*` | Allowed CORS origin |

---

## 4. EMQX Cloud MQTT Serverless Configuration

### Broker Overview
- **Broker Host**: `ed61a166.ala.eu-central-1.emqxsl.com`
- **TLS Port**: `8883` (MQTTS over TLS v1.3 / v1.2)
- **WebSockets Port**: `8084` (WSS)
- **Certificate Authority**: Signed by **DigiCert Global Root CA** (Valid through 2027+). Embedded in `backend/certs/emqx-ca.pem`.

### MQTT Topic Topology

| MQTT Topic | Direction | Content |
| :--- | :--- | :--- |
| `devices/{deviceId}/command` | Backend → ESP32 | Motor actuation & teleoperation (`FORWARD`, `BACKWARD`, `LEFT`, `RIGHT`, `STOP`, `EMERGENCY_STOP`, `LED_SET`) |
| `devices/{deviceId}/ack` | ESP32 → Backend | Hardware confirmation (`{"commandId":"...","status":"executed"}`) |
| `devices/{deviceId}/telemetry`| ESP32 → Backend | Real-time sensor packet (Temp, Humidity, Soil Moisture ADC, pH Voltage, Battery) |
| `devices/{deviceId}/status` | ESP32 → Backend | Heartbeat & Last Will and Testament (LWT) (`{"is_online":true/false}`) |

### Recommended Access Control (ACL) in EMQX Cloud Dashboard
Under **EMQX Cloud Console** → **Authentication** & **Access Control**:
1. **User `backend`**:
   - **Publish Rule**: Allow `devices/+/command`, `devices/agrirover-01/command`
   - **Subscribe Rule**: Allow `devices/+/telemetry`, `devices/+/status`, `devices/+/ack`
2. **User `agrirover`**:
   - **Subscribe Rule**: Allow `devices/agrirover-01/command`
   - **Publish Rule**: Allow `devices/agrirover-01/telemetry`, `devices/agrirover-01/status`, `devices/agrirover-01/ack`

---

## 5. ESP32 Firmware Setup & Secure Flashing

### 1. Configure Private Credentials
In `hardware/esp32_rover_firmware/`:
1. Copy `secrets.h.example` to `secrets.h`:
   ```bash
   cp hardware/esp32_rover_firmware/secrets.h.example hardware/esp32_rover_firmware/secrets.h
   ```
2. Open `secrets.h` and fill in:
   ```cpp
   #define SECRET_WIFI_SSID     "Your_Home_WiFi_Or_Hotspot"
   #define SECRET_WIFI_PASSWORD "Your_WiFi_Password"
   #define SECRET_MQTT_PASSWORD "Your_ESP32_MQTT_Password"
   ```
   *(Note: `secrets.h` is excluded by `.gitignore` so your private credentials will never be committed).*

### 2. Required Arduino IDE Libraries
Install via **Tools** → **Manage Libraries**:
- `PubSubClient` by Nick O'Leary
- `ArduinoJson` by Benoit Blanchon (v6 or v7)
- `DHT sensor library` by Adafruit
- `Adafruit Unified Sensor`

### 3. Flash to ESP32
1. Open [`hardware/esp32_rover_firmware/esp32_rover_firmware.ino`](hardware/esp32_rover_firmware/esp32_rover_firmware.ino).
2. Select **Board**: `ESP32 Dev Module`.
3. Connect your ESP32 via USB and select the serial port.
4. Click **Upload**.
5. Open Serial Monitor at **115200 baud** to view TLS handshake and telemetry output.

---

## 6. Testing with the Hardware Simulator

If your physical rover is not powered or wired yet, test the full cloud loop with the simulator:

```bash
# Syntax: node hardware/simulate_esp32_rover.js [deviceId] [brokerUrl] [username] [password]
node hardware/simulate_esp32_rover.js agrirover-01 mqtts://ed61a166.ala.eu-central-1.emqxsl.com:8883 agrirover <YOUR_PASSWORD>
```

1. The simulator performs a secure TLS handshake with EMQX Cloud.
2. It publishes `is_online: true` to `devices/agrirover-01/status`.
3. Your Render website dashboard status pill immediately turns **Green (ONLINE)**.
4. The simulator publishes telemetry every 5 seconds.
5. Click **FWD** or **REV** on your live website: the simulator receives the command, logs motor pins, and returns an execution ack; the website displays confirmation.

---

## 7. Local Development

To run both backend and frontend locally:
```bash
python3 launch.py
```
*(or run `./run_project.sh`)*

- **Dashboard UI**: [http://localhost:3000](http://localhost:3000) (Dev) or [http://localhost:8000](http://localhost:8000) (Unified)
- **API Health**: [http://localhost:8000/health](http://localhost:8000/health)
