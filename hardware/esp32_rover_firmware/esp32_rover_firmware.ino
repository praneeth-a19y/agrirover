/**
 * ============================================================================
 * AGRIROVER — COMPLETE ESP32 TELEOPERATION & SENSOR MONITORING FIRMWARE
 * ============================================================================
 * EPICS Project: Smart Agriculture Rover — AI-Powered Crop & Soil System
 * 
 * Target Board: ESP32 DevKit V1 (30-pin or 38-pin module)
 * 
 * Hardware Peripherals Connected:
 *   - L298N Dual H-Bridge Motor Driver (4WD Geared DC Motors):
 *       • IN1 -> GPIO 18 (Left Forward)
 *       • IN2 -> GPIO 19 (Left Reverse)
 *       • IN3 -> GPIO 21 (Right Forward)
 *       • IN4 -> GPIO 22 (Right Reverse)
 *       • ENA -> GPIO 23 (Left Motor PWM Speed)
 *       • ENB -> GPIO 25 (Right Motor PWM Speed)
 *   - Environmental Sensors:
 *       • DHT22 Temperature & Humidity -> GPIO 4 (1-Wire digital with 10k pull-up)
 *       • Capacitive Soil Moisture Sensor -> GPIO 34 (ADC1 Channel 6)
 *       • Analog Soil pH Sensor Board -> GPIO 35 (ADC1 Channel 7)
 *       • Battery Voltage Divider (10k/10k) -> GPIO 36 (ADC1 Channel 0)
 *   - Indicators & Auxiliary:
 *       • Auxiliary Headlight / Status LED -> GPIO 2
 *       • Camera Hardware Trigger Line -> GPIO 13 (Pulses high on CAPTURE)
 * 
 * Communication & Cloud Architecture:
 *   ESP32 (Port 8883 TLS) <---> EMQX Cloud Serverless <---> Render Backend <---> Web Dashboard
 * 
 * Required Arduino IDE Libraries:
 *   1. WiFi (built-in ESP32 core)
 *   2. WiFiClientSecure (built-in ESP32 core)
 *   3. PubSubClient by Nick O'Leary (install via Library Manager)
 *   4. ArduinoJson by Benoit Blanchon (v6.x or v7.x)
 *   5. DHT sensor library by Adafruit
 *   6. Adafruit Unified Sensor
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// Load private credentials from secrets.h if present
#if __has_include("secrets.h")
  #include "secrets.h"
#endif

// ----------------------------------------------------------------------------
// 1. NETWORK & CLOUD BROKER CREDENTIALS
// ----------------------------------------------------------------------------
#ifndef SECRET_WIFI_SSID
  #define SECRET_WIFI_SSID     "YOUR_WIFI_SSID"
#endif

#ifndef SECRET_WIFI_PASSWORD
  #define SECRET_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif

#ifndef SECRET_MQTT_BROKER
  #define SECRET_MQTT_BROKER   "ed61a166.ala.eu-central-1.emqxsl.com"
#endif

#ifndef SECRET_MQTT_PORT
  #define SECRET_MQTT_PORT     8883
#endif

#ifndef SECRET_MQTT_USERNAME
  #define SECRET_MQTT_USERNAME "agrirover"
#endif

#ifndef SECRET_MQTT_PASSWORD
  #define SECRET_MQTT_PASSWORD "Kavya@2030"
#endif

#ifndef SECRET_DEVICE_ID
  #define SECRET_DEVICE_ID     "agrirover-01"
#endif

const char* WIFI_SSID     = SECRET_WIFI_SSID;
const char* WIFI_PASSWORD = SECRET_WIFI_PASSWORD;
const char* MQTT_BROKER   = SECRET_MQTT_BROKER;
const int   MQTT_PORT     = SECRET_MQTT_PORT;
const char* MQTT_USER     = SECRET_MQTT_USERNAME;
const char* MQTT_PASS     = SECRET_MQTT_PASSWORD;
const char* DEVICE_ID     = SECRET_DEVICE_ID;

const char* FARM_ID       = "farm-001";
const char* PLOT_ID       = "plot-001";

// DigiCert Global Root G2 CA Certificate (EMQX Cloud *.emqxsl.com TLS verification)
#ifndef EMQX_CA_CERT
static const char EMQX_CA_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDjjCCAnagAwIBAgIQAzrx5qcRqaC7KGSxHQn65TANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBH
MjAeFw0xMzA4MDExMjAwMDBaFw0zODAxMTUxMjAwMDBaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu3fNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo0IwQDAP
BgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBhjAdBgNVHQ4EFgQUTiJUIBiV
5uNu5g/6+rkS7QYXjzkwDQYJKoZIhvcNAQELBQADggEBAGBnKJRvDkhj6zHd6mcY
1Yl9PMWLSn/pvtsrF9+wX3N3KjITOYFnQoQj8kVnNeyIv/iPsGEMNKSuIEyExtv4
NeF22d+mQrvHRAiGfzZ0JFrabA0UWTW98kndth/Jsw1HKj2ZL7tcu7XUIOGZX1NG
Fdtom/DzMNU+MeKNhJ7jitralj41E6Vf8PlwUHBHQRFXGU7Aj64GxJUTFy8bJZ91
8rGOmaFvE7FBcf6IKshPECBV1/MUReXgRPTqh5Uykw7+U0b6LJ3/iyK5S9kJRaTe
pLiaWN0bfVKfjllDiIGknibVb63dDcY3fe0Dkhvld1927jyNxF1WW6LZZm6zNTfl
MrY=
-----END CERTIFICATE-----
)EOF";
#endif

// ----------------------------------------------------------------------------
// 2. HARDWARE PIN DEFINITIONS
// ----------------------------------------------------------------------------
#define STATUS_LED_PIN       2    // Onboard Blue Status / Headlight LED
#define CAMERA_TRIGGER_PIN   13   // Hardware pulse trigger to ESP32-S3-CAM

// Environmental Sensors
#define DHTPIN               4    // DHT22 1-Wire Digital Data Pin
#define DHTTYPE              DHT22
#define SOIL_MOISTURE_PIN    34   // Capacitive Moisture Sensor (ADC1_CH6)
#define SOIL_PH_PIN          35   // Analog pH Sensor Conditioning Board (ADC1_CH7)
#define BATTERY_PIN          36   // 2:1 Voltage Divider (ADC1_CH0)

// L298N Dual H-Bridge Motor Driver
#define MOTOR_LEFT_IN1       18
#define MOTOR_LEFT_IN2       19
#define MOTOR_RIGHT_IN3      21
#define MOTOR_RIGHT_IN4      22
#define MOTOR_ENABLE_A       23   // PWM Left Motor Channel
#define MOTOR_ENABLE_B       25   // PWM Right Motor Channel

// PWM Configuration
const int PWM_FREQ        = 5000;
const int PWM_RESOLUTION  = 8;     // 8-bit resolution: 0 - 255
const int PWM_CH_LEFT     = 0;
const int PWM_CH_RIGHT    = 1;
int currentMotorSpeed     = 220;   // Default motor speed PWM (0-255)

// ----------------------------------------------------------------------------
// 3. OBJECTS & STATE TIMERS
// ----------------------------------------------------------------------------
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
DHT dht(DHTPIN, DHTTYPE);

// MQTT Topics (Device scoped + Rover standard topology)
String TOPIC_COMMAND_DEVICE;
String TOPIC_TELEMETRY_DEVICE;
String TOPIC_STATUS_DEVICE;
String TOPIC_ACK_DEVICE;

const char* TOPIC_ROVER_SENSORS_DATA = "rover/sensors/data";
const char* TOPIC_ROVER_SENSORS_TEMP = "rover/sensors/temperature";
const char* TOPIC_ROVER_SENSORS_HUM  = "rover/sensors/humidity";
const char* TOPIC_ROVER_STATUS_CONN  = "rover/status/connection";
const char* TOPIC_ROVER_STATUS_TELEM = "rover/status/telemetry";
const char* TOPIC_ROVER_COMMANDS_MOTOR = "rover/commands/motor";
const char* TOPIC_ROVER_COMMANDS_ACK = "rover/commands/ack";
const char* TOPIC_ROVER_CAMERA_CAPTURE = "rover/camera/capture";

// Timing intervals
const unsigned long TELEMETRY_INTERVAL_MS = 5000;  // Publish telemetry every 5s
const unsigned long STATUS_INTERVAL_MS    = 15000; // Heartbeat every 15s
const unsigned long SAFETY_WATCHDOG_MS   = 2500;  // Max motor run if no keepalive

unsigned long lastTelemetryTime  = 0;
unsigned long lastStatusTime     = 0;
unsigned long motorCutoffTime    = 0;
unsigned long lastWifiCheckTime  = 0;
unsigned long lastMqttRetryTime  = 0;

bool isMotorActive          = false;
bool emergencyStopActive    = false;
bool ledState               = false;

// Forward function declarations
void stopMotors();
void sendRoverStatus(bool isOnline);
void sendTelemetry();
void sendAcknowledgement(const char* commandId, const char* statusStr, const char* messageStr);
void onMqttMessage(char* topic, byte* payload, unsigned int length);

// ----------------------------------------------------------------------------
// 4. MOTOR CONTROL & WATCHDOG SAFETY
// ----------------------------------------------------------------------------
void applyMotorPwm(int speedPwm) {
  currentMotorSpeed = constrain(speedPwm, 80, 255);
  #if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    ledcWrite(MOTOR_ENABLE_A, currentMotorSpeed);
    ledcWrite(MOTOR_ENABLE_B, currentMotorSpeed);
  #else
    ledcWrite(PWM_CH_LEFT, currentMotorSpeed);
    ledcWrite(PWM_CH_RIGHT, currentMotorSpeed);
  #endif
}

void stopMotors() {
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);
  
  #if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    ledcWrite(MOTOR_ENABLE_A, 0);
    ledcWrite(MOTOR_ENABLE_B, 0);
  #else
    ledcWrite(PWM_CH_LEFT, 0);
    ledcWrite(PWM_CH_RIGHT, 0);
  #endif

  isMotorActive = false;
  digitalWrite(STATUS_LED_PIN, ledState ? HIGH : LOW);
  Serial.println("[MOTORS] All 4 DC motors STOPPED.");
}

void moveForward(int durationMs) {
  if (emergencyStopActive) return;
  applyMotorPwm(currentMotorSpeed);
  digitalWrite(MOTOR_LEFT_IN1, HIGH);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, HIGH);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);

  isMotorActive = true;
  int safeDuration = constrain(durationMs, 100, (int)SAFETY_WATCHDOG_MS);
  motorCutoffTime = millis() + safeDuration;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] FORWARD (Speed: %d, Duration: %d ms)\n", currentMotorSpeed, safeDuration);
}

void moveBackward(int durationMs) {
  if (emergencyStopActive) return;
  applyMotorPwm(currentMotorSpeed);
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, HIGH);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, HIGH);

  isMotorActive = true;
  int safeDuration = constrain(durationMs, 100, (int)SAFETY_WATCHDOG_MS);
  motorCutoffTime = millis() + safeDuration;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] BACKWARD (Speed: %d, Duration: %d ms)\n", currentMotorSpeed, safeDuration);
}

void turnLeft(int durationMs) {
  if (emergencyStopActive) return;
  applyMotorPwm(currentMotorSpeed);
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, HIGH);
  digitalWrite(MOTOR_RIGHT_IN3, HIGH);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);

  isMotorActive = true;
  int safeDuration = constrain(durationMs, 100, (int)SAFETY_WATCHDOG_MS);
  motorCutoffTime = millis() + safeDuration;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] TURN LEFT (Speed: %d, Duration: %d ms)\n", currentMotorSpeed, safeDuration);
}

void turnRight(int durationMs) {
  if (emergencyStopActive) return;
  applyMotorPwm(currentMotorSpeed);
  digitalWrite(MOTOR_LEFT_IN1, HIGH);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, HIGH);

  isMotorActive = true;
  int safeDuration = constrain(durationMs, 100, (int)SAFETY_WATCHDOG_MS);
  motorCutoffTime = millis() + safeDuration;
  digitalWrite(STATUS_LED_PIN, HIGH);
  Serial.printf("[MOTORS] TURN RIGHT (Speed: %d, Duration: %d ms)\n", currentMotorSpeed, safeDuration);
}

void emergencyStop() {
  emergencyStopActive = true;
  stopMotors();
  Serial.println("[EMERGENCY STOP] Triggered! Rover halted. Send STOP or clear to reset.");
}

void checkMotorWatchdog() {
  if (isMotorActive && (millis() >= motorCutoffTime)) {
    stopMotors();
    Serial.println("[WATCHDOG] Timed out: Motors halted automatically for crop safety.");
  }
}

// ----------------------------------------------------------------------------
// 5. SENSORS & TELEMETRY
// ----------------------------------------------------------------------------
float readBatteryPercentage() {
  int rawAdc = analogRead(BATTERY_PIN);
  float voltage = (rawAdc / 4095.0f) * 3.3f * 2.0f; // 2:1 divider factor
  float percent = (voltage - 3.2f) / (4.2f - 3.2f) * 100.0f;
  return constrain(percent, 0.0f, 100.0f);
}

void sendTelemetry() {
  if (!mqttClient.connected()) return;

  float temp = dht.readTemperature();
  float hum = dht.readHumidity();
  float batteryPercent = readBatteryPercentage();

  StaticJsonDocument<384> doc;
  doc["device_id"]        = DEVICE_ID;
  doc["deviceId"]         = DEVICE_ID;
  doc["farm_id"]          = FARM_ID;
  doc["plot_id"]          = PLOT_ID;

  if (!isnan(temp)) {
    doc["temperature"]    = round(temp * 10.0f) / 10.0f;
    doc["temperature_c"]  = round(temp * 10.0f) / 10.0f;
  }
  if (!isnan(hum)) {
    doc["humidity"]       = round(hum * 10.0f) / 10.0f;
    doc["humidity_percent"] = round(hum * 10.0f) / 10.0f;
  }

  // Only real physical hardware readings are transmitted (Soil moisture & pH excluded)
  doc["battery"]          = round(batteryPercent);
  doc["battery_percent"]  = round(batteryPercent);
  doc["signal_rssi"]      = WiFi.RSSI();
  doc["is_simulated"]     = false;

  String jsonString;
  serializeJson(doc, jsonString);

  // Publish to device topic + standard rover topics
  mqttClient.publish(TOPIC_TELEMETRY_DEVICE.c_str(), jsonString.c_str());
  mqttClient.publish(TOPIC_ROVER_SENSORS_DATA, jsonString.c_str());
  mqttClient.publish(TOPIC_ROVER_STATUS_TELEM, jsonString.c_str());

  // Individual temperature & humidity streams
  if (!isnan(temp)) {
    char tBuf[32];
    snprintf(tBuf, sizeof(tBuf), "{\"temperature\":%.1f}", temp);
    mqttClient.publish(TOPIC_ROVER_SENSORS_TEMP, tBuf);
  }
  if (!isnan(hum)) {
    char hBuf[32];
    snprintf(hBuf, sizeof(hBuf), "{\"humidity\":%.1f}", hum);
    mqttClient.publish(TOPIC_ROVER_SENSORS_HUM, hBuf);
  }

  Serial.printf("[TELEMETRY] DHT22 Temp=%.1fC | DHT22 Hum=%.1f%% | Batt=%.0f%% | RSSI=%d dBm\n",
                temp, hum, batteryPercent, WiFi.RSSI());
}

void sendRoverStatus(bool isOnline) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["device_id"]       = DEVICE_ID;
  doc["deviceId"]        = DEVICE_ID;
  doc["is_online"]       = isOnline;
  doc["status"]          = isOnline ? "online" : "offline";
  doc["battery_percent"] = round(readBatteryPercentage());
  doc["signal_rssi"]     = WiFi.RSSI();
  doc["ip_address"]      = WiFi.localIP().toString();
  doc["mode"]            = "MANUAL";
  doc["speed_pwm"]       = currentMotorSpeed;

  String jsonString;
  serializeJson(doc, jsonString);

  mqttClient.publish(TOPIC_STATUS_DEVICE.c_str(), jsonString.c_str(), true);
  mqttClient.publish(TOPIC_ROVER_STATUS_CONN, jsonString.c_str(), true);

  Serial.printf("[STATUS] Status update: %s (IP: %s)\n", isOnline ? "ONLINE" : "OFFLINE", WiFi.localIP().toString().c_str());
}

void sendAcknowledgement(const char* commandId, const char* statusStr, const char* messageStr) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["commandId"] = commandId;
  doc["command_id"] = commandId;
  doc["deviceId"]  = DEVICE_ID;
  doc["device_id"] = DEVICE_ID;
  doc["status"]    = statusStr;
  doc["message"]   = messageStr;

  String jsonString;
  serializeJson(doc, jsonString);

  mqttClient.publish(TOPIC_ACK_DEVICE.c_str(), jsonString.c_str());
  mqttClient.publish(TOPIC_ROVER_COMMANDS_ACK, jsonString.c_str());
  Serial.printf("[ACK] Published execution ack #%s: %s (%s)\n", commandId, statusStr, messageStr);
}

// ----------------------------------------------------------------------------
// 6. MQTT INCOMING COMMAND CALLBACK
// ----------------------------------------------------------------------------
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  Serial.printf("\n[MQTT RECV] Topic: %s (Length: %d)\n", topic, length);

  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.printf("[MQTT ERROR] Failed to parse command JSON: %s\n", error.c_str());
    return;
  }

  const char* cmdId = doc["commandId"] | doc["command_id"] | "cmd-unknown";
  
  String action = "";
  if (doc.containsKey("command") && doc["command"].is<const char*>()) {
    action = String(doc["command"].as<const char*>());
  } else if (doc.containsKey("value") && doc["value"].is<const char*>()) {
    action = String(doc["value"].as<const char*>());
  } else if (doc.containsKey("type") && String(doc["type"].as<const char*>()) != "MOTOR_CONTROL") {
    action = String(doc["type"].as<const char*>());
  }

  action.toUpperCase();
  int durationMs = doc["durationMs"] | doc["duration_ms"] | 1000;

  Serial.printf("[COMMAND] Action: %s | Duration: %d ms | ID: %s\n", action.c_str(), durationMs, cmdId);

  // Command Execution Dispatcher
  if (action == "FORWARD") {
    emergencyStopActive = false;
    moveForward(durationMs);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "Motors moving FORWARD");
  } else if (action == "BACKWARD") {
    emergencyStopActive = false;
    moveBackward(durationMs);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "Motors moving BACKWARD");
  } else if (action == "LEFT") {
    emergencyStopActive = false;
    turnLeft(durationMs);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "Motors turning LEFT");
  } else if (action == "RIGHT") {
    emergencyStopActive = false;
    turnRight(durationMs);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "Motors turning RIGHT");
  } else if (action == "STOP") {
    emergencyStopActive = false;
    stopMotors();
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "Motors STOPPED");
  } else if (action == "EMERGENCY_STOP") {
    emergencyStop();
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "EMERGENCY STOP engaged");
  } else if (action == "SPEED_SET") {
    int speedVal = doc["value"] | doc["speed"] | 220;
    applyMotorPwm(speedVal);
    char sMsg[64];
    snprintf(sMsg, sizeof(sMsg), "Motor PWM speed set to %d", currentMotorSpeed);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", sMsg);
  } else if (action == "LED_SET") {
    int val = doc["value"] | 0;
    ledState = (val > 0);
    digitalWrite(STATUS_LED_PIN, ledState ? HIGH : LOW);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", ledState ? "Headlight ON" : "Headlight OFF");
  } else if (action == "CAPTURE") {
    // Pulse camera hardware trigger line for ESP32-S3-CAM
    digitalWrite(CAMERA_TRIGGER_PIN, HIGH);
    delay(50);
    digitalWrite(CAMERA_TRIGGER_PIN, LOW);
    sendAcknowledgement(cmdId, "ACKNOWLEDGED", "Hardware capture trigger line pulsed to ESP32-S3-CAM");
  } else {
    Serial.printf("[COMMAND WARNING] Unknown command action: %s\n", action.c_str());
  }
}

// ----------------------------------------------------------------------------
// 7. WI-FI & MQTT TLS CONNECTION MANAGEMENT
// ----------------------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WIFI] Connecting to SSID: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
  }

  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, LOW);
    Serial.printf("\n[WIFI] Connected! Assigned IP: %s | RSSI: %d dBm\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.println("\n[WIFI WARNING] Connection timed out. Running offline mode.");
  }
}

boolean connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.printf("[MQTT TLS] Connecting to broker: %s:%d as user: '%s' ...\n", MQTT_BROKER, MQTT_PORT, MQTT_USER);

  // Apply verified DigiCert Global Root G2 certificate
  espClient.setCACert(EMQX_CA_CERT);

  // Last Will and Testament (LWT) for unexpected disconnect detection
  StaticJsonDocument<128> lwtDoc;
  lwtDoc["deviceId"]  = DEVICE_ID;
  lwtDoc["device_id"] = DEVICE_ID;
  lwtDoc["is_online"] = false;
  lwtDoc["status"]    = "offline";
  String lwtPayload;
  serializeJson(lwtDoc, lwtPayload);

  String clientId = "ESP32-Rover-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

  boolean connected = mqttClient.connect(
    clientId.c_str(),
    MQTT_USER,
    MQTT_PASS,
    TOPIC_STATUS_DEVICE.c_str(),
    1,
    true,
    lwtPayload.c_str()
  );

  if (connected) {
    Serial.println("[MQTT TLS] Connected to EMQX Cloud successfully!");

    // Subscribe to both command channels
    mqttClient.subscribe(TOPIC_COMMAND_DEVICE.c_str(), 1);
    mqttClient.subscribe(TOPIC_ROVER_COMMANDS_MOTOR, 1);
    Serial.printf("[MQTT TLS] Subscribed to:\n  -> %s\n  -> %s\n",
                  TOPIC_COMMAND_DEVICE.c_str(), TOPIC_ROVER_COMMANDS_MOTOR);

    sendRoverStatus(true);
    sendTelemetry();
  } else {
    Serial.printf("[MQTT TLS ERROR] Connection failed, rc=%d.\n", mqttClient.state());
    if (mqttClient.state() == 4 || mqttClient.state() == 5) {
      Serial.println("[MQTT TLS ERROR] Authentication failed: Check SECRET_MQTT_USERNAME and SECRET_MQTT_PASSWORD.");
    }
  }

  return connected;
}

// ----------------------------------------------------------------------------
// 8. ARDUINO SETUP & LOOP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n" + String('=', 65));
  Serial.println("🌱 AGRIROVER MAIN ESP32DevKit V1 FIRMWARE INITIALIZING");
  Serial.println(String('=', 65));

  // Initialize GPIO pins
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(CAMERA_TRIGGER_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);
  digitalWrite(CAMERA_TRIGGER_PIN, LOW);

  pinMode(MOTOR_LEFT_IN1, OUTPUT);
  pinMode(MOTOR_LEFT_IN2, OUTPUT);
  pinMode(MOTOR_RIGHT_IN3, OUTPUT);
  pinMode(MOTOR_RIGHT_IN4, OUTPUT);
  pinMode(SOIL_MOISTURE_PIN, INPUT);
  pinMode(SOIL_PH_PIN, INPUT);
  pinMode(BATTERY_PIN, INPUT);

  // Setup PWM Channels for Motor Speed Control
  #if defined(ESP_ARDUINO_VERSION) && ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    ledcAttach(MOTOR_ENABLE_A, PWM_FREQ, PWM_RESOLUTION);
    ledcAttach(MOTOR_ENABLE_B, PWM_FREQ, PWM_RESOLUTION);
  #else
    ledcSetup(PWM_CH_LEFT, PWM_FREQ, PWM_RESOLUTION);
    ledcSetup(PWM_CH_RIGHT, PWM_FREQ, PWM_RESOLUTION);
    ledcAttachPin(MOTOR_ENABLE_A, PWM_CH_LEFT);
    ledcAttachPin(MOTOR_ENABLE_B, PWM_CH_RIGHT);
  #endif

  stopMotors();

  // Initialize DHT22 Sensor
  dht.begin();
  Serial.println("[SENSORS] DHT22 Temperature & Humidity initialized on GPIO 4.");

  // Build topic strings
  TOPIC_COMMAND_DEVICE   = "devices/" + String(DEVICE_ID) + "/command";
  TOPIC_TELEMETRY_DEVICE = "devices/" + String(DEVICE_ID) + "/telemetry";
  TOPIC_STATUS_DEVICE    = "devices/" + String(DEVICE_ID) + "/status";
  TOPIC_ACK_DEVICE       = "devices/" + String(DEVICE_ID) + "/ack";

  // Setup MQTT Client
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(768); // Support full telemetry & command packets

  // Connect Wi-Fi & MQTT
  connectWiFi();
  connectMQTT();

  Serial.println("[SYSTEM] AgriRover ESP32 firmware running. Ready for cloud teleoperation.\n");
}

void loop() {
  // 1. Maintain Wi-Fi Connection
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastWifiCheckTime >= 10000) {
      lastWifiCheckTime = millis();
      connectWiFi();
    }
  } else {
    // 2. Maintain MQTT TLS Connection
    if (!mqttClient.connected()) {
      if (millis() - lastMqttRetryTime >= 5000) {
        lastMqttRetryTime = millis();
        connectMQTT();
      }
    } else {
      mqttClient.loop();
    }
  }

  // 3. Safety Watchdog - Auto-stop motors on timeout
  checkMotorWatchdog();

  // 4. Periodic Telemetry Stream
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = millis();
    sendTelemetry();
  }

  // 5. Periodic Status / Heartbeat
  if (millis() - lastStatusTime >= STATUS_INTERVAL_MS) {
    lastStatusTime = millis();
    sendRoverStatus(true);
  }
}
