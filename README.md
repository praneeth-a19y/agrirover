# Smart Agriculture Rover — AI-Powered Crop & Soil IoT Monitoring System

> **College EPICS Engineering Project**  
> An autonomous/teleoperated four-wheel agricultural rover integrating real-time MQTT IoT communication, two-point soil chemistry calibration, edge vision via ESP32-CAM, and machine learning foliar disease diagnosis.

---

## 1. Full-Stack IoT System Architecture

```
               +--------------------------------------------------------+
               |              4-Wheel Mobile Rover Hardware             |
               |       ESP32 DevKit V1 + L298N Dual H-Bridge Driver     |
               |      Sensors: DHT22, Capacitive Moisture, pH Probe     |
               +---------------------------+----------------------------+
                                           |
                                (MQTT Pub/Sub Protocol)
                                           v
               +--------------------------------------------------------+
               |                  Public or Local MQTT Broker           |
               |       (broker.emqx.io:1883 or test.mosquitto.org)       |
               +---------------------------+----------------------------+
                                           |
                                (MQTT Pub/Sub Protocol)
                                           v
               +--------------------------------------------------------+
               |           Node.js + Express + MQTT.js Backend          |
               |     - SQLite Database (agri_rover.db)                  |
               |     - MQTT Engine: devices/{id}/(command|telemetry|ack)|
               |     - Socket.IO Real-Time Event Broadcaster            |
               |     - PlantVillage 38-Class Agronomic Diagnostic Engine|
               +---------------------------+----------------------------+
                                           |
                             (Socket.IO & HTTP REST API)
                                           v
               +--------------------------------------------------------+
               |         React 18 + TypeScript + Vite Dashboard         |
               |        (Real-time D-Pad, Live Charts, Alerts)          |
               +--------------------------------------------------------+
```

---

## 2. MQTT Communication Pipeline & Topic Structure

Communication flows bidirectionally between the Website, Backend, MQTT Broker, and ESP32 hardware:

```
[Website Dashboard] ──(REST/Socket.IO)──> [Backend Server] ──(MQTT Publish)──> [Broker] ──> [ESP32 Rover]
                                                                                               │
                                                                                          Actuate Motors
                                                                                               │
[Website Dashboard] <──(Socket.IO Push)── [Backend Server] <──(MQTT Publish)── [Broker] <── [ESP32 Ack]
```

### Topic Conventions

| Direction | MQTT Topic | Purpose | Payload Schema |
| :--- | :--- | :--- | :--- |
| **Backend → ESP32** | `devices/{deviceId}/command` | Motor actuation, motion pulses, emergency stop | `{"commandId":"...","deviceId":"rover-001","type":"FORWARD","durationMs":1000}` |
| **ESP32 → Backend** | `devices/{deviceId}/ack` | Execution confirmation from physical hardware | `{"commandId":"...","deviceId":"rover-001","status":"executed","message":"..."}` |
| **ESP32 → Backend** | `devices/{deviceId}/telemetry`| Periodic environmental & soil sensor readings | `{"deviceId":"rover-001","temperature":28.5,"humidity":65,"rawMoistureAdc":2100,...}` |
| **ESP32 → Backend** | `devices/{deviceId}/status` | Heartbeat & Last Will and Testament (LWT) | `{"deviceId":"rover-001","is_online":true,"battery_percent":92,"signal_rssi":-62}` |

---

## 3. Hardware Pinout & Wiring (ESP32 DevKit V1)

| Component | Pin Label | ESP32 GPIO | Description / Operating Voltage |
| :--- | :--- | :--- | :--- |
| **DHT22 Sensor** | DATA | **GPIO 4** | 1-Wire Digital Signal (10kΩ pullup to 3.3V) |
| **Capacitive Moisture Sensor**| AOUT | **GPIO 34** | Analog ADC1 Channel 6 (0–3.3V) |
| **Analog pH Sensor Board** | AOUT | **GPIO 35** | Analog ADC1 Channel 7 (0–3.3V output) |
| **Battery Divider (2:1)** | V_SENSE | **GPIO 36** | 10kΩ / 10kΩ resistor divider from battery |
| **Status LED** | LED | **GPIO 2** | Built-in Blue LED Indicator (Auxiliary Light) |
| **L298N Motor Driver** | IN1 | **GPIO 18** | Left Motors Forward |
| | IN2 | **GPIO 19** | Left Motors Reverse |
| | IN3 | **GPIO 21** | Right Motors Forward |
| | IN4 | **GPIO 22** | Right Motors Reverse |
| | ENA | **GPIO 23** | Left Motor PWM Speed Enable |
| | ENB | **GPIO 25** | Right Motor PWM Speed Enable |
| | GND | **GND** | **Common Ground** with ESP32 & Battery |

> [!IMPORTANT]
> **Common Ground:** The ground (GND) of the battery, L298N driver, buck converter, and ESP32 **must all be connected together**.

---

## 4. Quick Start & Execution

### 🚀 Recommended 1-Line Launch (Starts Backend + Frontend + Auto-Browser)

Open Terminal on macOS / Linux and run:

```bash
python3 launch.py
```
*(or run `./run_project.sh`)*

- **Web Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend Health Check**: [http://localhost:8000/health](http://localhost:8000/health)

---

## 5. Testing Without Physical Hardware (ESP32 Simulator)

If your ESP32 is not yet wired or you want to demonstrate the platform locally on your computer:

In a separate terminal window, launch the **Hardware Simulator**:
```bash
node hardware/simulate_esp32_rover.js
```

1. The simulator connects to the MQTT broker as `rover-001`.
2. The dashboard header instantly turns **Green: Connected (ONLINE)**.
3. Every 5 seconds, live DHT22, soil moisture, and pH telemetry appear on the dashboard in real time.
4. Click **FWD**, **REV**, **LEFT**, **RIGHT**, or **STOP** on the website:
   - The simulator receives the MQTT command.
   - It actuates the simulated motors.
   - It publishes an MQTT acknowledgement back.
   - The website turns green and displays: *"Command executed successfully"*.

---

## 6. Flashing the Physical ESP32 Firmware

1. Install the [Arduino IDE](https://www.arduino.cc/en/software).
2. Add ESP32 Board Support:
   - Go to **Preferences** → **Additional Boards Manager URLs**:  
     `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Open **Tools** → **Board Manager**, search for `esp32`, and click **Install**.
3. Install required libraries via **Sketch** → **Include Library** → **Manage Libraries**:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoit Blanchon (v6 or v7)
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor`
4. Open [hardware/esp32_rover_firmware/esp32_rover_firmware.ino](hardware/esp32_rover_firmware/esp32_rover_firmware.ino).
5. Update your Wi-Fi credentials at lines 40-41:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_NAME";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   ```
6. Select **Tools** → **Board** → **ESP32 Dev Module** and choose your Serial Port.
7. Click **Upload**.
8. Open the Serial Monitor at **115200 baud** to verify connection.

---

## 7. Environment Variables (`.env`)

Configure in `backend/.env`:

```env
PORT=8000
HOST=0.0.0.0
NODE_ENV=development
CORS_ORIGIN=*

DEFAULT_DEVICE_ID=rover-001
DEFAULT_FARM_ID=farm-001
DEFAULT_PLOT_ID=plot-001

# MQTT Broker (EMQX Cloud, Mosquitto, or local)
MQTT_BROKER_URL=mqtt://broker.emqx.io:1883
MQTT_CLIENT_ID=agri-rover-backend-server
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_KEEPALIVE=60
MQTT_RECONNECT_PERIOD=5000

ROVER_OFFLINE_THRESHOLD_SECONDS=15
DB_PATH=../agri_rover.db
```

---

## 8. Verification & Test Suite

Run the automated end-to-end integration test:

```bash
# Ensure backend is running, then run:
node backend/tests/test_mqtt_pipeline.js
```

This automated test validates:
- [x] Backend REST API health
- [x] MQTT broker connectivity
- [x] Socket.IO real-time event pipeline
- [x] ESP32 telemetry ingestion and calibration
- [x] Command validation, queueing, and dispatching
- [x] ESP32 motor actuation & execution acknowledgement
- [x] Security rate limiting & invalid command rejection
