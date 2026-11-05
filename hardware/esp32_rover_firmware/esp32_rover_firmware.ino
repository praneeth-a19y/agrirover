/**
 * ============================================================================
 * AGRIROVER — ESP32 IOT TELEOPERATION & SENSOR MONITORING FIRMWARE
 * ============================================================================
 * Architecture:
 *   ESP32 (TLS Port 8883) <---> EMQX Cloud Serverless <---> Render Backend <---> Web Dashboard
 * 
 * Target Hardware:
 *   - Microcontroller : ESP32 DevKit V1 (30-pin or 38-pin)
 *   - Motor Driver    : L298N Dual H-Bridge (4WD DC Geared Motors)
 *   - Environment     : DHT22 (Temperature & Humidity)
 *   - Soil Moisture   : Capacitive Analog Moisture Sensor V1.2
 *   - Soil pH         : Analog pH Sensor Board
 *   - Battery Voltage : 10k/10k Resistor Voltage Divider
 * 
 * Required Arduino Libraries:
 *   1. WiFi (built-in ESP32 core)
 *   2. WiFiClientSecure (built-in ESP32 core)
 *   3. PubSubClient by Nick O'Leary
 *   4. ArduinoJson by Benoit Blanchon (v6.x or v7.x)
 *   5. DHT sensor library by Adafruit
 *   6. Adafruit Unified Sensor
 * 
 * Security:
 *   - Connects over MQTT TLS (Port 8883) with DigiCert Root CA verification.
 *   - Never uses insecure plaintext or setInsecure() in production.
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// If secrets.h exists locally, load private Wi-Fi and MQTT credentials from it
#if __has_include("secrets.h")
  #include "secrets.h"
#endif

// ----------------------------------------------------------------------------
// 1. CONFIGURATION FALLBACKS (Override in secrets.h)
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
  #define SECRET_MQTT_USERNAME "agrirover_esp32"
#endif

#ifndef SECRET_MQTT_PASSWORD
  #define SECRET_MQTT_PASSWORD "YOUR_ESP32_MQTT_PASSWORD"
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

// DigiCert Global Root CA (Default for EMQX Cloud *.emqxsl.com TLS verification)
#ifndef EMQX_CA_CERT
static const char EMQX_CA_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIEfjCCA2agAwIBAgIQD+Ayq4RNAzEGxQyOE8iwaDANBgkqhkiG9w0BAQsFADBh
MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3
d3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD
QTAeFw0yNDAxMTgwMDAwMDBaFw0zMTExMDkyMzU5NTlaMGExCzAJBgNVBAYTAlVT
MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j
b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IEcyMIIBIjANBgkqhkiG
9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuzfNNNx7a8myaJCtSnX/RrohCgiN9RlUyfuI
2/Ou8jqJkTx65qsGGmvPrC3oXgkkRLpimn7Wo6h+4FR1IAWsULecYxpsMNzaHxmx
1x7e/dfgy5SDN67sH0NO3Xss0r0upS/kqbitOtSZpLYl6ZtrAGCSYP9PIUkY92eQ
q2EGnI/yuum06ZIya7XzV+hdG82MHauVBJVJ8zUtluNJbd134/tJS7SsVQepj5Wz
tCO7TG1F8PapspUwtP1MVYwnSlcUfIKdzXOS0xZKBgyMUNGPHgm+F6HmIcr9g+UQ
vIOlCsRnKPZzFBQ9RnbDhxSJITRNrw9FDKZJobq7nMWxM4MphQIDAQABo4IBMDCC
ASwwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUTiJUIBiV5uNu5g/6+rkS7QYX
jzkwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUwDgYDVR0PAQH/BAQD
AgGGMHQGCCsGAQUFBwEBBGgwZjAjBggrBgEFBQcwAYYXaHR0cDovL29jc3AuZGln
aWNlcnQuY24wPwYIKwYBBQUHMAKGM2h0dHA6Ly9jYWNlcnRzLmRpZ2ljZXJ0LmNu
L0RpZ2lDZXJ0R2xvYmFsUm9vdENBLmNydDBABgNVHR8EOTA3MDWgM6Axhi9odHRw
Oi8vY3JsLmRpZ2ljZXJ0LmNuL0RpZ2lDZXJ0R2xvYmFsUm9vdENBLmNybDARBgNV
HSAECjAIMAYGBFUdIAAwDQYJKoZIhvcNAQELBQADggEBAHRBl3jN7+XHBUK0dZnu
hMdoNwD1nCROU3BTIh1TNzRI0bQ0m5+C/dCRzzlqoSAFHUlOi+OiDltWkXTzmQn6
Z8bH5PFBy5sYpc/8cNPoSzhyqcpvvEZvv/Ivc0Up+dzma7vBDJC9WrMRUUlSFSQp
kdXSmphDNkXJsgARmxzc18IN6LYMRiOWlY7RE2F900pPW60BvJHHNCX0bbSRj/Ql
bmVq8wuftBD++D+RS8K++ujpMjFBROyWfBX+woQDGsMazkmgulQdnZrdj476elOL
axRvrSgEorju1kJM7M65z2RUZrfzQYW/1rs8mRUXin6iEtad/Rv1ZI1WGYmWPyBm
pbo=
-----END CERTIFICATE-----
)EOF";
#endif

// ----------------------------------------------------------------------------
// 2. HARDWARE PIN DEFINITIONS
// ----------------------------------------------------------------------------
#define STATUS_LED_PIN    2    // Onboard Blue Status LED

// Environmental Sensors
#define DHTPIN            4    // DHT22 1-Wire Digital Data Pin
#define DHTTYPE           DHT22
#define SOIL_MOISTURE_PIN 34   // Capacitive Moisture Sensor (ADC1_CH6)
#define SOIL_PH_PIN       35   // Analog pH Sensor Conditioning Board (ADC1_CH7)
#define BATTERY_PIN       36   // 2:1 Voltage Divider (ADC1_CH0)

// L298N Dual H-Bridge Motor Driver
#define MOTOR_LEFT_IN1    18
#define MOTOR_LEFT_IN2    19
#define MOTOR_RIGHT_IN3   21
#define MOTOR_RIGHT_IN4   22
#define MOTOR_ENABLE_A    23
#define MOTOR_ENABLE_B    25

// ----------------------------------------------------------------------------
// 3. OBJECTS & STATE TIMERS
// ----------------------------------------------------------------------------
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
DHT dht(DHTPIN, DHTTYPE);

String TOPIC_COMMAND;
String TOPIC_TELEMETRY;
String TOPIC_STATUS;
String TOPIC_ACK;

const unsigned long TELEMETRY_INTERVAL_MS = 5000;
const unsigned long STATUS_INTERVAL_MS    = 15000;
unsigned long lastTelemetryTime           = 0;
unsigned long lastStatusTime              = 0;
unsigned long lastReconnectAttempt        = 0;

unsigned long motorCutoffTimestamp        = 0;
bool isMotorActive                        = false;

// ----------------------------------------------------------------------------
// 4. MOTOR CONTROL FUNCTIONS (FAILSAFE WATCHDOG)
// ----------------------------------------------------------------------------
void setupMotors() {
  pinMode(MOTOR_LEFT_IN1, OUTPUT);
  pinMode(MOTOR_LEFT_IN2, OUTPUT);
  pinMode(MOTOR_RIGHT_IN3, OUTPUT);
  pinMode(MOTOR_RIGHT_IN4, OUTPUT);
  pinMode(MOTOR_ENABLE_A, OUTPUT);
  pinMode(MOTOR_ENABLE_B, OUTPUT);

  // Guarantee all motors are off during boot
  digitalWrite(MOTOR_LEFT_IN1, LOW);
  digitalWrite(MOTOR_LEFT_IN2, LOW);
  digitalWrite(MOTOR_RIGHT_IN3, LOW);
  digitalWrite(MOTOR_RIGHT_IN4, LOW);
  digitalWrite(MOTOR_ENABLE_A, LOW);
  digitalWrite(MOTOR_ENABLE_B, LOW);

  isMotorActive = false;
  Serial.println("[MOTORS] Initialized safely in STOPPED state.");
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
  Serial.println("[MOTORS] STOPPED.");
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
  Serial.printf("[MOTORS] FORWARD (%d ms)\n", durationMs);
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
  Serial.printf("[MOTORS] BACKWARD (%d ms)\n", durationMs);
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
  Serial.printf("[MOTORS] TURN LEFT (%d ms)\n", durationMs);
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
  Serial.printf("[MOTORS] TURN RIGHT (%d ms)\n", durationMs);
}

// ----------------------------------------------------------------------------
// 5. SENSORS & TELEMETRY
// ----------------------------------------------------------------------------
float readBatteryPercentage() {
  int rawAdc = analogRead(BATTERY_PIN);
  float voltage = (rawAdc / 4095.0f) * 3.3f * 2.0f;
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
  doc["deviceId"]        = DEVICE_ID;
  doc["farmId"]          = FARM_ID;
  doc["plotId"]          = PLOT_ID;

  if (!isnan(temp)) {
    doc["temperature"]   = round(temp * 10.0f) / 10.0f;
    doc["temperature_c"] = round(temp * 10.0f) / 10.0f;
  }
  if (!isnan(hum)) {
    doc["humidity"]      = round(hum * 10.0f) / 10.0f;
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
  Serial.printf("[TELEMETRY] Temp=%.1fC, Hum=%.1f%%, MoistureADC=%d, pH_V=%.2fV\n",
                temp, hum, rawMoistureAdc, rawPhVoltage);
}

void sendRoverStatus(bool isOnline) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["deviceId"]        = DEVICE_ID;
  doc["is_online"]       = isOnline;
  doc["status"]          = isOnline ? "online" : "offline";
  doc["battery_percent"] = round(readBatteryPercentage());
  doc["signal_rssi"]     = WiFi.RSSI();
  doc["ip_address"]      = WiFi.localIP().toString();
  doc["mode"]            = "MANUAL";

  String jsonString;
  serializeJson(doc, jsonString);

  mqttClient.publish(TOPIC_STATUS.c_str(), jsonString.c_str(), true);
  Serial.printf("[STATUS] is_online=%s (IP: %s)\n", isOnline ? "true" : "false", WiFi.localIP().toString().c_str());
}

void sendAcknowledgement(const char* commandId, const char* statusStr, const char* messageStr) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["commandId"] = commandId;
  doc["deviceId"]  = DEVICE_ID;
  doc["status"]    = statusStr;
  doc["message"]   = messageStr;

  String jsonString;
  serializeJson(doc, jsonString);

  mqttClient.publish(TOPIC_ACK.c_str(), jsonString.c_str());
  Serial.printf("[ACK] Published execution ack for #%s -> Status: %s\n", commandId, statusStr);
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
  
  // Extract command from "value", "type", or "command"
  String action = "";
  if (doc.containsKey("value") && doc["value"].is<const char*>()) {
    action = String(doc["value"].as<const char*>());
  } else if (doc.containsKey("type") && String(doc["type"].as<const char*>()) != "MOTOR_CONTROL") {
    action = String(doc["type"].as<const char*>());
  } else if (doc.containsKey("command")) {
    action = String(doc["command"].as<const char*>());
  }

  int durationMs = doc["durationMs"] | doc["duration_ms"] | 1000;
  action.toUpperCase();

  Serial.printf("[COMMAND] ID: %s | Action: %s | Duration: %d ms\n", cmdId, action.c_str(), durationMs);

  if (action == "FORWARD") {
    moveForward(durationMs);
    sendAcknowledgement(cmdId, "executed", "Motors moved FORWARD successfully");
  } else if (action == "BACKWARD") {
    moveBackward(durationMs);
    sendAcknowledgement(cmdId, "executed", "Motors moved BACKWARD successfully");
  } else if (action == "LEFT") {
    turnLeft(durationMs);
    sendAcknowledgement(cmdId, "executed", "Rover turned LEFT successfully");
  } else if (action == "RIGHT") {
    turnRight(durationMs);
    sendAcknowledgement(cmdId, "executed", "Rover turned RIGHT successfully");
  } else if (action == "STOP" || action == "EMERGENCY_STOP") {
    stopMotors();
    sendAcknowledgement(cmdId, "executed", "Motors EMERGENCY STOPPED");
  } else if (action == "LED_SET" || String(doc["type"].as<const char*>()) == "LED_SET") {
    bool ledVal = doc["value"] | true;
    digitalWrite(STATUS_LED_PIN, ledVal ? HIGH : LOW);
    sendAcknowledgement(cmdId, "executed", ledVal ? "Auxiliary LED ON" : "Auxiliary LED OFF");
  } else {
    Serial.printf("[COMMAND] Unrecognized instruction: %s\n", action.c_str());
    sendAcknowledgement(cmdId, "failed", "Unrecognized hardware instruction");
  }
}

// ----------------------------------------------------------------------------
// 7. WI-FI & SECURE TLS MQTT CONNECTION (WITH LWT)
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
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection timed out. Running offline.");
  }
}

boolean connectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return false;

  Serial.printf("[MQTT TLS] Connecting to %s:%d ...\n", MQTT_BROKER, MQTT_PORT);

  // Configure DigiCert CA Certificate for TLS validation
  espClient.setCACert(EMQX_CA_CERT);

  // LWT payload for unexpected disconnection
  StaticJsonDocument<128> lwtDoc;
  lwtDoc["deviceId"]  = DEVICE_ID;
  lwtDoc["is_online"] = false;
  lwtDoc["status"]    = "offline";
  String lwtPayload;
  serializeJson(lwtDoc, lwtPayload);

  String clientId = "ESP32-" + String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

  boolean connected = mqttClient.connect(
    clientId.c_str(),
    MQTT_USER,
    MQTT_PASS,
    TOPIC_STATUS.c_str(),
    1,
    true,
    lwtPayload.c_str()
  );

  if (connected) {
    Serial.println("[MQTT TLS] Connected to EMQX Cloud successfully!");
    mqttClient.subscribe(TOPIC_COMMAND.c_str(), 1);
    Serial.printf("[MQTT TLS] Subscribed to: %s\n", TOPIC_COMMAND.c_str());

    sendRoverStatus(true);
    sendTelemetry();
  } else {
    Serial.printf("[MQTT TLS] Connection failed, state rc=%d. Will retry in 5s...\n", mqttClient.state());
  }

  return connected;
}

// ----------------------------------------------------------------------------
// 8. ARDUINO SETUP & LOOP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n========================================================");
  Serial.println("  🌱 AGRIROVER — ESP32 TLS EMQX CLOUD FIRMWARE         ");
  Serial.println("========================================================");

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  setupMotors();
  dht.begin();
  analogReadResolution(12);

  TOPIC_COMMAND   = "devices/" + String(DEVICE_ID) + "/command";
  TOPIC_TELEMETRY = "devices/" + String(DEVICE_ID) + "/telemetry";
  TOPIC_STATUS    = "devices/" + String(DEVICE_ID) + "/status";
  TOPIC_ACK       = "devices/" + String(DEVICE_ID) + "/ack";

  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);

  connectWifi();
  if (WiFi.status() == WL_CONNECTED) {
    connectMQTT();
  }
}

void loop() {
  if (isMotorActive && millis() >= motorCutoffTimestamp) {
    stopMotors();
  }

  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectAttempt >= 10000) {
      lastReconnectAttempt = millis();
      connectWifi();
    }
    return;
  }

  if (!mqttClient.connected()) {
    if (millis() - lastReconnectAttempt >= 5000) {
      lastReconnectAttempt = millis();
      if (connectMQTT()) {
        lastReconnectAttempt = 0;
      }
    }
  } else {
    mqttClient.loop();
  }

  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryTime = millis();
    sendTelemetry();
  }

  if (millis() - lastStatusTime >= STATUS_INTERVAL_MS) {
    lastStatusTime = millis();
    sendRoverStatus(true);
  }
}
