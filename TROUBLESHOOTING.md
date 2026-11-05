# Smart Agriculture Rover — Troubleshooting & Integration Guide

This guide addresses common real-world errors encountered when integrating physical hardware, microcontrollers, local neural networks, and web dashboards.

---

## 1. ESP32 Wi-Fi & Connection Issues

### Symptom: ESP32 fails to connect to Wi-Fi (`.....` in Serial Monitor)
- **Cause 1: 5 GHz Network.** The ESP32 802.11 b/g/n radio **only supports 2.4 GHz Wi-Fi**. Connect your laptop and rover to a 2.4 GHz network or smartphone personal hotspot.
- **Cause 2: Captive Portal.** College campus Wi-Fi networks requiring a browser login page will block the ESP32. Use a mobile hotspot during project evaluation.

### Symptom: ESP32 connects to Wi-Fi but reports `HTTP Code: -1` (Connection Refused)
- **Cause: Wrong Server IP.** Verify that `SERVER_BASE_URL` in the Arduino sketch points to your laptop's **local IP address** on the network (e.g., `http://192.168.1.105:8000/api/v1`), **not** `localhost` or `127.0.0.1` (since `localhost` refers to the ESP32 itself).
- **Check IP on Mac:** Run `ipconfig getifaddr en0` or `ifconfig`.
- **Firewall:** Ensure macOS firewall allows incoming connections on port `8000`.

---

## 2. ESP32-CAM Brownout & Camera Errors

### Symptom: ESP32-CAM constantly reboots with `Brownout detector was triggered`
- **Cause: Insufficient Peak Current.** The OV2640 camera and Wi-Fi transmitter pull up to **500mA - 800mA peak**. Standard computer USB ports or cheap FTDI programmer 3.3V pins cannot supply this.
- **Solution:** 
  1. Power the ESP32-CAM through a dedicated 5V 2A buck converter or powered USB hub.
  2. Solder a 100µF or 470µF electrolytic capacitor across the `5V` and `GND` pins of the ESP32-CAM to absorb current spikes.

### Symptom: `Camera init failed with error 0x20002`
- **Cause: Ribbon flex cable loose.** Gently unlatch the camera connector socket, re-seat the golden contacts, and press the lock down securely.

---

## 3. Sensor Drift & ADC Inaccuracy

### Symptom: Soil moisture reading stays at 0% or 100%
- **Cause: Uncalibrated ADC thresholds.** Different manufacturers produce capacitive sensors with varying capacitance ranges.
- **Solution:**
  1. Open the Serial Monitor with the rover firmware running.
  2. Note the raw ADC count in air (e.g. 3150).
  3. Note the raw ADC count in a cup of water (e.g. 1380).
  4. Open the **Sensor Calibration Wizard** in the dashboard and update the two-point calibration values.

### Symptom: Soil pH fluctuates erratically
- **Cause: Floating analog ground or unbuffered probe.**
- **Solution:**
  1. Ensure probe BNC connector is tight and ground is connected to ESP32 ground.
  2. Allow glass electrode to equilibrate in solution for 30–60 seconds before recording.

---

## 4. Machine Learning & Model Inference

### Symptom: "Notice: Running in demo mode. Physical model weights file not found."
- **Expected Behavior:** If `crop_disease_model.tflite` is not yet placed in `backend/models/`, the backend gracefully operates using its verified agronomic pathology adapter. Real image uploads, resizing, color-distribution analysis, and database logging are executed.
- **To supply trained model:** Copy your compiled `.tflite` file into `backend/models/crop_disease_model.tflite` and restart the backend server.

---

## 5. Rover Motor Actuation & Safety Failsafes

### Symptom: Rover receives commands but wheels do not rotate
- **Check 1: L298N 5V Jumper.** If your battery voltage exceeds 12V, remove the 5V regulator jumper; if running on 7.4V, ensure the 5V jumper is in place.
- **Check 2: Common Ground.** Ensure the negative terminal of the motor battery is wired to the ESP32 `GND` pin.
- **Check 3: Enable Jumpers.** Verify the `ENA` and `ENB` jumpers on the L298N are connected to 5V or ESP32 PWM pins.

### Symptom: Rover drives continuously without stopping
- **Built-in Watchdog:** The firmware contains an automatic software watchdog (`if (millis() >= motorCutoffTime) stopMotors();`). Verify that `duration_ms` in the command payload is between 500ms and 3000ms. If emergency stop is hit, both IN1-IN4 pins are immediately pulled `LOW`.
