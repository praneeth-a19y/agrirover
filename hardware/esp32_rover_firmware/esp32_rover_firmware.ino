/**
 * ============================================================================
 * SMART AGRICULTURE ROVER — ESP32 IOT & TELEOPERATION FIRMWARE
 * ============================================================================
 * Architecture:
 *   ESP32 <---> MQTT Broker <---> Node.js Backend <---> React Dashboard (Socket.IO)
 * 
 * Target Hardware:
 *   - Microcontroller : ESP32 DevKit V1 (30-pin or 38-pin)
 *   - Motor Driver    : L298N Dual H-Bridge (4WD DC Geared Motors)
 *   - Environment     : DHT22 (Temperature & Humidity)
 *   - Soil Moisture   : Capacitive Analog Soil Moisture Sensor V1.2
 *   - Soil pH         : Analog pH Sensor with signal conditioning board
 *   - Battery Voltage : 10k/10k Resistor Voltage Divider
 * 
 * Required Arduino Libraries:
 *   1. WiFi (built-in ESP32 core)
 *   2. PubSubClient by Nick O'Leary (install via Arduino Library Manager)
 *   3. ArduinoJson by Benoit Blanchon (v6.x or v7.x)
 *   4. DHT sensor library by Adafruit
 *   5. Adafruit Unified Sensor
 * 
 * MQTT Topics:
 *   - Command Subscription : devices/{DEVICE_ID}/command
 *   - Telemetry Publish    : devices/{DEVICE_ID}/telemetry
 *   - Status & LWT Publish : devices/{DEVICE_ID}/status
 *   - Command Ack Publish  : devices/{DEVICE_ID}/ack
 * ============================================================================
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ----------------------------------------------------------------------------
// 1. NETWORK & MQTT CONFIGURATION
// ----------------------------------------------------------------------------
// Wi-Fi Access Point Credentials (Update for your local Wi-Fi or mobile hotspot)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT Broker Settings
// Public test brokers: "broker.emqx.io" or "test.mosquitto.org"
// For local laptop broker: set to your laptop's LAN IP, e.g. "192.168.1.100"
const char* MQTT_BROKER   = "broker.emqx.io";
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";  // Leave blank if broker has no auth
const char* MQTT_PASS     = "";  // Leave blank if broker has no auth

// Device Identifiers
const char* DEVICE_ID     = "rover-001";
const char* FARM_ID       = "farm-001";
const char* PLOT_ID       = "plot-001";

// ----------------------------------------------------------------------------
// 2. HARDWARE PIN DEFINITIONS
// ----------------------------------------------------------------------------
// Status Indicator LED
#define STATUS_LED_PIN    2    // Built-in blue LED on most ESP32 boards

// Environmental Sensors
#define DHTPIN            4    // DHT22 1-Wire Digital Data Pin (with 10k pullup)
#define DHTTYPE           DHT22
#define SOIL_MOISTURE_PIN 34   // Capacitive Moisture Sensor (ADC1_CH6)
#define SOIL_PH_PIN       35   // Analog pH Conditioning Board (ADC1_CH7)
#define BATTERY_PIN       36   // Battery 2:1 Voltage Divider (ADC1_CH0)

// L298N Dual H-Bridge Motor Driver Pins
#define MOTOR_LEFT_IN1    18   // Left Motors Direction 1
#define MOTOR_LEFT_IN2    19   // Left Motors Direction 2
#define MOTOR_RIGHT_IN3   21   // Right Motors Direction 1
#define MOTOR_RIGHT_IN4   22   // Right Motors Direction 2
#define MOTOR_ENABLE_A    23   // Left Motor Speed PWM (Optional)
#define MOTOR_ENABLE_B    25   // Right Motor Speed PWM (Optional)

// ----------------------------------------------------------------------------
// 3. GLOBAL OBJECTS & STATE TIMERS
// ----------------------------------------------------------------------------
WiFiClient espClient;
PubSubClient mqttClient(espClient);
DHT dht(DHTPIN, DHTTYPE);

// MQTT Dynamic Topic Strings
String TOPIC_COMMAND;
String TOPIC_TELEMETRY;
String TOPIC_STATUS;
String TOPIC_ACK;

// Operational Timing
const unsigned long TELEMETRY_INTERVAL_MS = 5000; // 5 seconds
const unsigned long STATUS_INTERVAL_MS    = 15000; // 15 seconds
unsigned long lastTelemetryTime           = 0;
unsigned long lastStatusTime              = 0;
unsigned long lastReconnectAttempt        = 0;

// Watchdog & Motor Cutoff
unsigned long motorCutoffTimestamp        = 0;
bool isMotorActive                        = false;

// ----------------------------------------------------------------------------
// 4. SAFE MOTOR CONTROL FUNCTIONS
// ----------------------------------------------------------------------------
void setupMotors() {
  // Set all motor pins to OUTPUT and guarantee LOW before power is applied
  pinMode(MOTOR_LEFT_IN1, OUTPUT);
  pinMode(MOTOR_LEFT_IN2, OUTPUT);
  pinMode(MOTOR_RIGHT_IN3, OUTPUT);
  pinMode(MOTOR_RIGHT_IN4, OUTPUT);
  pinMode(MOTOR_ENABLE_A, OUTPUT);
  pinMode(MOTOR_ENABLE_B, OUTPUT);

  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);
  digitalWrite(MOTOR_ENABLE_A, LOW);
  digitalWrite(MOTOR_ENABLE_B, LOW);

  isMotorActive = false;
  Serial.println("[MOTORS] Hardware initialized safely in STOPPED state.");
}

void stopMotors() {
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);
  digitalWrite(MOTOR_ENABLE_A, LOW);
  digitalWrite(MOTOR_ENABLE_B, LOW);
  isMotorActive = false;
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.println("[MOTORS] ALL MOTORS STOPPED (Watchdog / Command).");
}

void moveForward(int durationMs) {
  digitalWrite(MOTOR_ENABLE_A, HIGH);
  digitalWrite(MOTOR_ENABLE_B, HIGH);
  digitalWrite(MOTOR_LEFT_IN1, HIGH);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, HIGH);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);

  isMotorActive = true;
  motorCutoffTimestamp = millis() + durationMs;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] FORWARD drive engaged for %d ms\n", durationMs);
}

void moveBackward(int durationMs) {
  digitalWrite(MOTOR_ENABLE_A, HIGH);
  digitalWrite(MOTOR_ENABLE_B, HIGH);
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, HIGH);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, HIGH);

  isMotorActive = true;
  motorCutoffTimestamp = millis() + durationMs;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] BACKWARD drive engaged for %d ms\n", durationMs);
}

void turnLeft(int durationMs) {
  digitalWrite(MOTOR_ENABLE_A, HIGH);
  digitalWrite(MOTOR_ENABLE_B, HIGH);
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, HIGH);
  digitalWrite(MOTOR_RIGHT_IN3, HIGH);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);

  isMotorActive = true;
  motorCutoffTimestamp = millis() + durationMs;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] TURN LEFT engaged for %d ms\n", durationMs);
}

void turnRight(int durationMs) {
  digitalWrite(MOTOR_ENABLE_A, HIGH);
  digitalWrite(MOTOR_ENABLE_B, HIGH);
  digitalWrite(MOTOR_LEFT_IN1, HIGH);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, HIGH);

  isMotorActive = true;
  motorCutoffTimestamp = millis() + durationMs;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] TURN RIGHT engaged for %d ms\n", durationMs);
}

// ----------------------------------------------------------------------------
// 5. SENSOR ACQUISITION & TELEMETRY
// ----------------------------------------------------------------------------
float readBatteryPercentage() {
  int rawAdc = analogRead(BATTERY_PIN);
  // 12-bit ADC: 0..4095 maps to 0..3.3V; 2:1 divider factor multiplies by 2.0
  float voltage = (rawAdc / 4095.0f) * 3.3f * 2.0f;
  // Standard Li-ion cell range: 3.2V (empty) to 4.2V (fully charged)
  float percent = (voltage - 3.2f) / (4.2f - 3.2f) * 100.0f;
  if (percent < 0.0f) percent = 0.0f;
  if (percent > 100.0f) percent = 100.0f;
  return percent;
}

void sendTelemetry() {
  if (!mqttClient.connected()) return;

  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  int rawMoistureAdc = analogRead(SOIL_MOISTURE_PIN);
  int rawPhAdc = analogRead(SOIL_PH_PIN);
  float rawPhVoltage = (rawPhAdc / 4095.0f) * 3.3f;
  float batteryPercent = readBatteryPercentage();

  StaticJsonDocument<384> doc;
  doc["deviceId"]         = DEVICE_ID;
  doc["device_id"]        = DEVICE_ID;
  doc["farmId"]           = FARM_ID;
  doc["plotId"]           = PLOT_ID;

  if (!isnan(temp)) {
    doc["temperature"]    = round(temp * 10.0f) / 10.0f;
    doc["temperature_c"]  = round(temp * 10.0f) / 10.0f;
  }
  if (!isnan(hum)) {
    doc["humidity"]       = round(hum * 10.0f) / 10.0f;
    doc["humidity_percent"] = round(hum * 10.0f) / 10.0f;
  }

  doc["rawMoistureAdc"]   = rawMoistureAdc;
  doc["raw_moisture_adc"] = rawMoistureAdc;
  doc["rawPhVoltage"]     = round(rawPhVoltage * 100.0f) / 100.0f;
  doc["raw_ph_voltage"]   = round(rawPhVoltage * 100.0f) / 100.0f;
  doc["battery_percent"]  = round(batteryPercent);
  doc["signal_rssi"]      = WiFi.RSSI();
  doc["is_simulated"]     = false;

  String jsonString;
  serializeJson(doc, jsonString);

  mqttClient.publish(TOPIC_TELEMETRY.c_str(), jsonString.c_str());
  Serial.printf("[TELEMETRY] Sent -> Temp=%.1fC, Hum=%.1f%%, MoistADC=%d, pH_V=%.2fV\n",
                temp, hum, rawMoistureAdc, rawPhVoltage);
}

void sendRoverStatus(bool isOnline) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["deviceId"]        = DEVICE_ID;
  doc["device_id"]       = DEVICE_ID;
  doc["is_online"]       = isOnline;
  doc["status"]          = isOnline ? "online" : "offline";
  doc["battery_percent"] = round(readBatteryPercentage());
  doc["signal_rssi"]     = WiFi.RSSI();
  doc["ip_address"]      = WiFi.localIP().toString();
  doc["mode"]            = "MANUAL";

  String jsonString;
  serializeJson(doc, jsonString);

  // Retain true ensures the status is instantly visible to newly connected dashboards
  mqttClient.publish(TOPIC_STATUS.c_str(), jsonString.c_str(), true);
  Serial.printf("[STATUS] Published -> Online=%s, IP=%s, RSSI=%d dBm\n",
                isOnline ? "TRUE" : "FALSE", WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

// ----------------------------------------------------------------------------
// 6. COMMAND ACKNOWLEDGEMENT
// ----------------------------------------------------------------------------
void sendAcknowledgement(const char* commandId, const char* statusStr, const char* messageStr) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["commandId"]  = commandId;
  doc["command_id"] = commandId;
  doc["deviceId"]   = DEVICE_ID;
  doc["status"]     = statusStr;
  doc["message"]    = messageStr;

  String jsonString;
  serializeJson(doc, jsonString);

  mqttClient.publish(TOPIC_ACK.c_str(), jsonString.c_str());
  Serial.printf("[ACK] Published Ack for [%s] -> Status: %s, Message: %s\n",
                commandId, statusStr, messageStr);
}

// ----------------------------------------------------------------------------
// 7. MQTT INCOMING COMMAND CALLBACK
// ----------------------------------------------------------------------------
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.printf("\n[MQTT RECV] Topic: %s (Length: %d)\n", topic, length);

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.printf("[MQTT ERROR] Failed to parse JSON command: %s\n", error.c_str());
    return;
  }

  // Extract fields (supporting both camelCase and snake_case)
  const char* cmdId = doc["commandId"] | doc["command_id"] | "unknown-cmd";
  const char* cmdType = doc["type"] | doc["command"] | "";
  int durationMs = doc["durationMs"] | doc["duration_ms"] | 1000;

  Serial.printf("[COMMAND] ID: %s | Type: %s | Duration: %d ms\n", cmdId, cmdType, durationMs);

  String command = String(cmdType);
  command.toUpperCase();

  // Actuate Hardware Based on Command
  if (command == "FORWARD") {
    moveForward(durationMs);
    sendAcknowledgement(cmdId, "executed", "Motors moved FORWARD successfully");
  } else if (command == "BACKWARD") {
    moveBackward(durationMs);
    sendAcknowledgement(cmdId, "executed", "Motors moved BACKWARD successfully");
  } else if (command == "LEFT") {
    turnLeft(durationMs);
    sendAcknowledgement(cmdId, "executed", "Rover turned LEFT successfully");
  } else if (command == "RIGHT") {
    turnRight(durationMs);
    sendAcknowledgement(cmdId, "executed", "Rover turned RIGHT successfully");
  } else if (command == "STOP" || command == "EMERGENCY_STOP") {
    stopMotors();
    sendAcknowledgement(cmdId, "executed", "Motors EMERGENCY STOPPED immediately");
  } else if (command == "LED_SET") {
    bool ledVal = doc["value"] | true;
    digitalWrite(STATUS_LED_PIN, ledVal ? HIGH : LOW);
    sendAcknowledgement(cmdId, "executed", ledVal ? "Onboard LED turned ON" : "Onboard LED turned OFF");
  } else {
    Serial.printf("[COMMAND] Unrecognized command type: %s\n", command.c_str());
    sendAcknowledgement(cmdId, "failed", "Unrecognized command instruction");
  }
}

// ----------------------------------------------------------------------------
// 8. WI-FI & MQTT CONNECTION WITH LWT (LAST WILL & TESTAMENT)
// ----------------------------------------------------------------------------
void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to SSID: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Flash LED during connect
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.print("[WIFI] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.println("\n[WIFI] Connection timed out. Running offline until Wi-Fi available.");
  }
}

boolean connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.printf("[MQTT] Connecting to broker %s:%d ...\n", MQTT_BROKER, MQTT_PORT);

  // Define Last Will and Testament (LWT) Payload:
  // If the rover suddenly drops connection, the broker immediately broadcasts this message.
  StaticJsonDocument<128> lwtDoc;
  lwtDoc["deviceId"]  = DEVICE_ID;
  lwtDoc["is_online"] = false;
  lwtDoc["status"]    = "offline";
  String lwtPayload;
  serializeJson(lwtDoc, lwtPayload);

  String clientId = "ESP32Rover-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

  boolean connected = false;
  if (strlen(MQTT_USER) > 0) {
    connected = mqttClient.connect(
      clientId.c_str(),
      MQTT_USER,
      MQTT_PASS,
      TOPIC_STATUS.c_str(),
      1,      // QoS 1
      true,   // Retain
      lwtPayload.c_str()
    );
  } else {
    connected = mqttClient.connect(
      clientId.c_str(),
      TOPIC_STATUS.c_str(),
      1,      // QoS 1
      true,   // Retain
      lwtPayload.c_str()
    );
  }

  if (connected) {
    Serial.println("[MQTT] Connected to broker successfully!");

    // Subscribe to incoming motion & teleoperation commands
    mqttClient.subscribe(TOPIC_COMMAND.c_str(), 1);
    Serial.printf("[MQTT] Subscribed to topic: %s\n", TOPIC_COMMAND.c_str());

    // Broadcast online status with retain flag
    sendRoverStatus(true);
    // Send immediate initial telemetry
    sendTelemetry();
  } else {
    Serial.printf("[MQTT] Connect failed, rc=%d. Will retry in 5s...\n", mqttClient.state());
  }

  return connected;
}

// ----------------------------------------------------------------------------
// 9. ARDUINO SETUP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("  🌱 SMART AGRICULTURE ROVER — ESP32 FIRMWARE v2.0     ");
  Serial.println("  Full-Stack IoT Teleoperation & Sensor Monitoring      ");
  Serial.println("========================================================");

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize motors safely in stopped state
  setupMotors();

  // Initialize environmental sensors
  dht.begin();
  analogReadResolution(12); // ESP32 12-bit ADC (0 - 4095)

  // Construct MQTT Topics
  TOPIC_COMMAND   = "devices/" + String(DEVICE_ID) + "/command";
  TOPIC_TELEMETRY = "devices/" + String(DEVICE_ID) + "/telemetry";
  TOPIC_STATUS    = "devices/" + String(DEVICE_ID) + "/status";
  TOPIC_ACK       = "devices/" + String(DEVICE_ID) + "/ack";

  // Configure MQTT Client
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024); // Support larger JSON payloads

  // Connect to Wi-Fi and MQTT
  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    connectMQTT();
  }
}

// ----------------------------------------------------------------------------
// 10. MAIN ARDUINO LOOP
// ----------------------------------------------------------------------------
void loop() {
  // A. Safety Watchdog Cutoff: Stop motors if active duration has expired
  if (isMotorActive && millis() >= motorCutoffTimestamp) {
    stopMotors();
  }

  // B. Wi-Fi Reconnection Check
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectAttempt >= 10000) {
      lastReconnectAttempt = millis();
      connectWifi();
    }
    return;
  }

  // C. MQTT Reconnection Check
  if (!mqttClient.connected()) {
    if (millis() - lastReconnectAttempt >= 5000) {
      lastReconnectAttempt = millis();
      if (connectMQTT()) {
        lastReconnectAttempt = 0;
      }
    }
  } else {
    // Process MQTT incoming and outgoing packet queues
    mqttClient.loop();
  }

  // D. Periodic Telemetry Transmission
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = millis();
    sendTelemetry();
  }

  // E. Periodic Online Heartbeat Transmission
  if (millis() - lastStatusTime >= STATUS_INTERVAL_MS) {
    lastStatusTime = millis();
    sendRoverStatus(true);
  }
}
