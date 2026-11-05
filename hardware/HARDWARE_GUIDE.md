# Smart Agriculture Rover — Hardware & Embedded Systems Guide

This document details the complete hardware architecture, pinout assignments, wiring schematics, power distribution, and flashing instructions for the **Smart Agriculture Rover (EPICS Project)**.

---

## 1. System Block Diagram

```
                 +--------------------------------------+
                 |      7.4V / 11.1V Li-ion Battery     |
                 +-------------------+------------------+
                                     |
               +---------------------+---------------------+
               |                                           |
      (Motor Power 7-12V)                       (LM2596 Buck Converter)
               |                                           | 5V DC
               v                                           v
     +-------------------+                       +-------------------+
     | L298N Dual Motor  |                       |  ESP32 DevKit V1  |
     |      Driver       |                       |  (Main Telemetry) |
     +---------+---------+                       +---------+---------+
               |                                           |
   +-----------+-----------+                     +---------+---------+
   | Left & Right Geared   |                     | Sensors:          |
   | DC Drive Motors (4WD) |                     | • DHT22 (Pin 4)   |
   +-----------------------+                     | • Moisture (Pin 34)
                                                 | • pH Probe (Pin 35)
                                                 +-------------------+
                                                           |
                                           +---------------+---------------+
                                           |                               |
                                           v                               v
                                  +-----------------+             +-----------------+
                                  |    ESP32-CAM    |             | Local Agritech  |
                                  | (Vision Module) |             | Backend Server  |
                                  +-----------------+             +-----------------+
```

---

## 2. Pinout & Wiring Table

### A. ESP32 Main Rover Controller

| Component | Pin Label | ESP32 GPIO | Description / Operating Voltage |
| :--- | :--- | :--- | :--- |
| **DHT22 Sensor** | VCC | 3.3V / 5V | Power supply |
| | DATA | **GPIO 4** | 1-Wire Digital Signal (10kΩ pullup to 3.3V) |
| | GND | GND | System Ground |
| **Capacitive Moisture Sensor**| VCC | 3.3V | 3.3V recommended to keep ADC range < 3.3V |
| | AOUT | **GPIO 34** | Analog ADC1 Channel 6 |
| | GND | GND | System Ground |
| **Analog pH Sensor Board** | VCC | 5.0V | Signal conditioning board power |
| | AOUT | **GPIO 35** | Analog ADC1 Channel 7 (0–3.3V output) |
| | GND | GND | System Ground |
| **L298N Motor Driver** | IN1 | **GPIO 18** | Left Motors Forward |
| | IN2 | **GPIO 19** | Left Motors Reverse |
| | IN3 | **GPIO 21** | Right Motors Forward |
| | IN4 | **GPIO 22** | Right Motors Reverse |
| | ENA | **GPIO 23** | Left PWM Speed Control (optional) |
| | ENB | **GPIO 25** | Right PWM Speed Control (optional) |
| | GND | GND | **Common Ground** with ESP32 |
| **Battery Divider (Optional)** | Out | **GPIO 36** | 10kΩ / 10kΩ voltage divider from V_BAT |

> [!IMPORTANT]
> **Common Ground:** The ground (GND) of the battery, the L298N driver, the LM2596 buck converter, and the ESP32 **must all be tied together**. Without a common ground, logic signals cannot switch the motor transistors correctly.

---

### B. ESP32-CAM (AI-Thinker OV2640 Module)

| Component | Pin Label | ESP32-CAM GPIO | Description |
| :--- | :--- | :--- | :--- |
| **Power Supply** | 5V | 5V | Minimum 2A required during Wi-Fi transmission |
| | GND | GND | System Ground |
| **Programming (FTDI)** | U0T | FTDI RX | Serial Transmit |
| | U0R | FTDI TX | Serial Receive |
| | **GPIO 0** | GND | **Tie to GND only during flashing**, disconnect for normal run |

---

## 3. Power Supply Architecture

1. **Battery Pack:** 2S (7.4V) or 3S (11.1V) Li-ion/LiPo battery (2200mAh - 4000mAh).
2. **Motors:** Direct connection from battery output to the 12V terminal on the L298N board.
3. **Microcontrollers & Sensors:** Step down battery voltage to regulated **5.0V DC** using a high-efficiency **LM2596 DC-DC Buck Converter**.

---

## 4. Hardware Calibration Procedures

### A. Capacitive Soil Moisture Sensor (Two-Point Calibration)
1. **Dry Air Calibration:** Hold the dry sensor in air. Note the raw ADC count in the Serial Monitor (typically ~3200 for 12-bit ADC). Enter this as `Dry Air ADC` in the Web Dashboard.
2. **Water Saturation Calibration:** Dip the sensor into a cup of water up to the white boundary line. Note the raw ADC count (typically ~1400). Enter this as `Wet ADC`.
3. The dashboard and backend will automatically scale:
   $$\text{Moisture \%} = \frac{\text{Dry ADC} - \text{Raw ADC}}{\text{Dry ADC} - \text{Wet ADC}} \times 100$$

### B. Analog Soil pH Sensor (Buffer Calibration)
1. Rinse probe with distilled water.
2. Dip into **pH 7.00 Buffer Solution**. Allow voltage to stabilize and record output voltage ($V_7$, typically ~2.50V).
3. Rinse probe with distilled water.
4. Dip into **pH 4.01 Buffer Solution**. Record output voltage ($V_4$, typically ~3.05V).
5. Enter these two reference voltages in the dashboard calibration modal.

---

## 5. Arduino IDE Flashing Instructions

1. Install **Arduino IDE** (v2.0 or higher).
2. Add ESP32 Board URL in `Preferences`:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Install `esp32` by Espressif from Boards Manager.
4. Install required libraries from Library Manager:
   - `ArduinoJson` (v6 or v7)
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor`
5. Copy `hardware/esp32_rover_firmware/secrets.h.example` to `secrets.h` in the same directory.
6. In `secrets.h`, enter your Wi-Fi SSID, Wi-Fi Password, and ESP32 EMQX Cloud password (MQTT username is already configured as `agrirover`, port `8883` TLS).
7. Open `hardware/esp32_rover_firmware/esp32_rover_firmware.ino` in Arduino IDE.
8. Select Board **"ESP32 Dev Module"**, connect via USB, and click **Upload**.
9. Open the Serial Monitor at **115200 baud** to view Wi-Fi connection, DigiCert TLS validation, and EMQX telemetry loop.
