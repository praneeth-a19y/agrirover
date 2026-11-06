/**
 * ============================================================================
 * AGRIROVER — ESP32-S3-CAM & ESP32-CAM VISION & AI DIAGNOSIS FIRMWARE
 * ============================================================================
 * EPICS Project: Smart Agriculture Rover — AI-Powered Crop & Soil System
 * 
 * Target Boards Supported:
 *   1. CAMERA_MODEL_FREENOVE_ESP32S3_CAM  (ESP32-S3 with OV2640/OV3660)
 *   2. CAMERA_MODEL_AI_THINKER_ESP32S3    (AI-Thinker ESP32-S3-CAM)
 *   3. CAMERA_MODEL_XIAO_ESP32S3          (Seeed Studio XIAO ESP32-S3 Sense)
 *   4. CAMERA_MODEL_AI_THINKER            (Classic ESP32-CAM OV2640 16-pin)
 * 
 * System Features:
 *   - Wi-Fi Station Mode with auto-reconnect logic
 *   - MQTT over TLS (Port 8883) connecting to EMQX Cloud Serverless
 *   - Subscribes to:
 *       • rover/camera/capture
 *       • devices/agrirover-01/camera/capture
 *       • devices/agrirover-01/command
 *   - Hardware Trigger Pin: Pulses high from Main ESP32 (GPIO 13 -> HW_TRIGGER_PIN)
 *   - Captures foliar photo upon MQTT or hardware trigger
 *   - HTTPS Multipart POST directly to Render Cloud backend:
 *       • https://agrirover.onrender.com/upload
 *   - Parses JSON diagnostic output (PlantVillage 38-class MobileNetV2 prediction)
 *   - Publishes execution acknowledgment & camera telemetry back to EMQX Cloud
 *   - Embedded HTTP server at http://<cam-ip>/ for local browser snapshot inspection
 * ============================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WebServer.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Load private credentials from secrets.h if present
#if __has_include("secrets.h")
  #include "secrets.h"
#endif

// ============================================================================
// 1. SELECT YOUR CAMERA BOARD MODEL (Uncomment ONE board below)
// ============================================================================
// #define CAMERA_MODEL_FREENOVE_ESP32S3_CAM   // Freenove ESP32-S3 WROOM CAM
// #define CAMERA_MODEL_XIAO_ESP32S3           // Seeed Studio XIAO ESP32-S3 Sense
#define CAMERA_MODEL_AI_THINKER                // Classic AI-Thinker ESP32-CAM (Default)

// ============================================================================
// 2. NETWORK, MQTT BROKER & RENDER BACKEND CONFIGURATION
// ============================================================================
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

const char* WIFI_SSID         = SECRET_WIFI_SSID;
const char* WIFI_PASSWORD     = SECRET_WIFI_PASSWORD;

// EMQX Cloud MQTT Serverless Configuration
const char* MQTT_BROKER       = SECRET_MQTT_BROKER;
const int   MQTT_PORT         = SECRET_MQTT_PORT;
const char* MQTT_USER         = SECRET_MQTT_USERNAME;
const char* MQTT_PASS         = SECRET_MQTT_PASSWORD;
const char* MQTT_CLIENT_ID    = "agrirover-cam-01";
const char* DEVICE_ID         = SECRET_DEVICE_ID;

// Render Cloud Backend API Configuration
const char* RENDER_HOST       = "agrirover.onrender.com";
const int   RENDER_HTTPS_PORT = 443;
const char* RENDER_UPLOAD_PATH= "/upload"; // Handles multipart leaf uploads

const char* PLOT_ID           = "plot-001";
const char* CROP_HINT         = "Tomato";

// Hardware Trigger Input Pin (Connected to Main ESP32 GPIO 13)
#if defined(CAMERA_MODEL_AI_THINKER)
  #define HW_TRIGGER_PIN      13 // GPIO 13 on classic ESP32-CAM (or set -1 if disabled)
#elif defined(CAMERA_MODEL_FREENOVE_ESP32S3_CAM)
  #define HW_TRIGGER_PIN      21 // GPIO 21 on Freenove S3
#elif defined(CAMERA_MODEL_XIAO_ESP32S3)
  #define HW_TRIGGER_PIN      1  // GPIO 1 on XIAO S3
#else
  #define HW_TRIGGER_PIN      -1
#endif

// Periodic auto-capture interval (0 to disable, or ms e.g. 120000 = 2 minutes)
const unsigned long AUTO_CAPTURE_INTERVAL_MS = 0; // Disabled by default; triggered on-demand via MQTT

// DigiCert Global Root G2 CA Certificate (for EMQX Cloud & Render HTTPS)
static const char ROOT_CA_CERT[] PROGMEM = R"EOF(
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

// ============================================================================
// 3. CAMERA PIN ASSIGNMENTS
// ============================================================================
#if defined(CAMERA_MODEL_AI_THINKER)
  #define PWDN_GPIO_NUM     32
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM      0
  #define SIOD_GPIO_NUM     26
  #define SIOC_GPIO_NUM     27
  #define Y9_GPIO_NUM       35
  #define Y8_GPIO_NUM       34
  #define Y7_GPIO_NUM       39
  #define Y6_GPIO_NUM       36
  #define Y5_GPIO_NUM       21
  #define Y4_GPIO_NUM       19
  #define Y3_GPIO_NUM       18
  #define Y2_GPIO_NUM        5
  #define VSYNC_GPIO_NUM    25
  #define HREF_GPIO_NUM     23
  #define PCLK_GPIO_NUM     22
  #define FLASH_LED_PIN      4

#elif defined(CAMERA_MODEL_FREENOVE_ESP32S3_CAM)
  #define PWDN_GPIO_NUM     -1
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM     15
  #define SIOD_GPIO_NUM      4
  #define SIOC_GPIO_NUM      5
  #define Y9_GPIO_NUM       16
  #define Y8_GPIO_NUM       17
  #define Y7_GPIO_NUM       18
  #define Y6_GPIO_NUM       12
  #define Y5_GPIO_NUM       10
  #define Y4_GPIO_NUM        8
  #define Y3_GPIO_NUM        9
  #define Y2_GPIO_NUM       11
  #define VSYNC_GPIO_NUM     6
  #define HREF_GPIO_NUM      7
  #define PCLK_GPIO_NUM     13
  #define FLASH_LED_PIN      2

#elif defined(CAMERA_MODEL_XIAO_ESP32S3)
  #define PWDN_GPIO_NUM     -1
  #define RESET_GPIO_NUM    -1
  #define XCLK_GPIO_NUM     10
  #define SIOD_GPIO_NUM     40
  #define SIOC_GPIO_NUM     39
  #define Y9_GPIO_NUM       48
  #define Y8_GPIO_NUM       11
  #define Y7_GPIO_NUM       12
  #define Y6_GPIO_NUM       14
  #define Y5_GPIO_NUM       16
  #define Y4_GPIO_NUM       18
  #define Y3_GPIO_NUM       17
  #define Y2_GPIO_NUM       15
  #define VSYNC_GPIO_NUM    38
  #define HREF_GPIO_NUM     47
  #define PCLK_GPIO_NUM     13
  #define FLASH_LED_PIN     -1

#else
  #error "No camera model selected! Please uncomment one CAMERA_MODEL definition at the top of the sketch."
#endif

// ============================================================================
// 4. OBJECT INSTANCES & STATE TIMERS
// ============================================================================
WiFiClientSecure mqttTlsClient;
WiFiClientSecure httpTlsClient;
PubSubClient mqttClient(mqttTlsClient);
WebServer localServer(80);

// MQTT Topics
const char* TOPIC_ROVER_CAMERA_CAPTURE  = "rover/camera/capture";
const char* TOPIC_ROVER_CAMERA_STATUS   = "rover/camera/status";
const char* TOPIC_ROVER_COMMANDS_ACK    = "rover/commands/ack";
const char* TOPIC_DEVICE_CAPTURE        = "devices/agrirover-01/camera/capture";
const char* TOPIC_DEVICE_COMMAND        = "devices/agrirover-01/command";
const char* TOPIC_DEVICE_ACK            = "devices/agrirover-01/ack";

unsigned long lastAutoCaptureTime = 0;
unsigned long lastMqttRetryTime   = 0;
unsigned long lastHeartbeatTime   = 0;
bool isCapturingAndUploading      = false;

// Forward function declarations
bool initCameraHardware();
void connectWiFi();
void connectMqtt();
void onMqttMessageReceived(char* topic, byte* payload, unsigned int length);
void captureAndUploadLeaf(const char* triggerSource, const char* commandId = nullptr);
void publishCameraStatus(const char* statusStr, const char* detailsStr = "");
void handleDirectCaptureHttp();
void handleRootIndexHttp();

// ============================================================================
// 5. CAMERA HARDWARE INITIALIZATION
// ============================================================================
bool initCameraHardware() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    Serial.println("[CAMERA] PSRAM detected! Configuring high-res SVGA buffer.");
    config.frame_size   = FRAMESIZE_SVGA; // 800x600 for neural model feature extraction
    config.jpeg_quality = 12;             // 10-63 (lower = sharper image)
    config.fb_count     = 2;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    Serial.println("[CAMERA] Warning: No PSRAM found. Using VGA buffer.");
    config.frame_size   = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 16;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAMERA ERROR] esp_camera_init failed: 0x%x\n", err);
    return false;
  }

  // Adjust camera sensor tuning parameters
  sensor_t* s = esp_camera_sensor_get();
  if (s != nullptr) {
    s->set_brightness(s, 1);    // slight boost for foliage contrast
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);      // automatic white balance
    s->set_awb_gain(s, 1);
    s->set_wb_mode(s, 0);       // Auto WB
  }

  Serial.println("[CAMERA] Hardware successfully initialized!");
  return true;
}

// ============================================================================
// 6. WI-FI CONNECTION MANAGEMENT
// ============================================================================
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WIFI] Connecting to SSID '%s'...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startMs = millis();
  while (WiFi.status() != WL_CONNECTED && (millis() - startMs < 20000)) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address  : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] RSSI Signal : %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[WIFI WARNING] Wi-Fi connection timed out. Will retry...");
  }
}

// ============================================================================
// 7. EMQX CLOUD MQTT TLS CONNECTION
// ============================================================================
void connectMqtt() {
  if (mqttClient.connected() || WiFi.status() != WL_CONNECTED) return;

  if (millis() - lastMqttRetryTime < 5000) return;
  lastMqttRetryTime = millis();

  Serial.printf("[MQTT] Connecting to EMQX Cloud %s:%d (TLS)...\n", MQTT_BROKER, MQTT_PORT);

  // Configure TLS Root Certificate
  mqttTlsClient.setCACert(ROOT_CA_CERT);

  // Generate Unique Client ID
  String clientId = String(MQTT_CLIENT_ID) + "-" + String((uint32_t)ESP.getEfuseMac(), HEX);

  // Last Will and Testament: Notify broker if camera drops unexpectedly
  const char* lwtTopic = TOPIC_ROVER_CAMERA_STATUS;
  const char* lwtMsg   = "{\"status\":\"offline\",\"device_id\":\"agrirover-cam-01\"}";

  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, lwtTopic, 1, true, lwtMsg)) {
    Serial.println("[MQTT] Connected to EMQX Cloud Serverless broker!");

    // Subscribe to Camera Capture Triggers
    mqttClient.subscribe(TOPIC_ROVER_CAMERA_CAPTURE, 1);
    mqttClient.subscribe(TOPIC_DEVICE_CAPTURE, 1);
    mqttClient.subscribe(TOPIC_DEVICE_COMMAND, 1);

    Serial.printf("[MQTT] Subscribed to:\n  - %s\n  - %s\n  - %s\n",
                  TOPIC_ROVER_CAMERA_CAPTURE, TOPIC_DEVICE_CAPTURE, TOPIC_DEVICE_COMMAND);

    // Announce Online Status
    publishCameraStatus("online", "Camera module ready for AI foliar diagnosis");
  } else {
    Serial.printf("[MQTT ERROR] Connection failed, rc=%d. Retrying in 5s...\n", mqttClient.state());
  }
}

void publishCameraStatus(const char* statusStr, const char* detailsStr) {
  if (!mqttClient.connected()) return;

  StaticJsonDocument<256> doc;
  doc["device_id"]      = "agrirover-cam-01";
  doc["status"]         = statusStr;
  doc["ip_address"]     = WiFi.localIP().toString();
  doc["rssi"]           = WiFi.RSSI();
  doc["psram_available"]= psramFound();
  if (strlen(detailsStr) > 0) {
    doc["details"]      = detailsStr;
  }

  String output;
  serializeJson(doc, output);
  mqttClient.publish(TOPIC_ROVER_CAMERA_STATUS, output.c_str(), true);
}

// ============================================================================
// 8. MQTT INCOMING COMMAND CALLBACK
// ============================================================================
void onMqttMessageReceived(char* topic, byte* payload, unsigned int length) {
  Serial.printf("\n[MQTT RECV] Topic: %s (Length: %d)\n", topic, length);

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[MQTT ERROR] JSON deserialize error: %s\n", err.c_str());
    return;
  }

  String topicStr = String(topic);
  const char* commandId = doc["commandId"] | doc["command_id"] | "cmd-cam-trigger";
  String commandStr     = doc["command"] | doc["value"] | doc["type"] | "";
  commandStr.toUpperCase();

  bool isCaptureTrigger = false;

  if (topicStr == TOPIC_ROVER_CAMERA_CAPTURE || topicStr == TOPIC_DEVICE_CAPTURE) {
    isCaptureTrigger = true;
  } else if (topicStr == TOPIC_DEVICE_COMMAND) {
    if (commandStr == "CAPTURE" || commandStr == "SNAP" || commandStr == "CAMERA_CAPTURE") {
      isCaptureTrigger = true;
    }
  }

  if (isCaptureTrigger) {
    Serial.printf("[CAMERA] Capture command received! Trigger ID: %s\n", commandId);
    captureAndUploadLeaf("MQTT_TRIGGER", commandId);
  }
}

// ============================================================================
// 9. CAPTURE & HTTPS MULTIPART UPLOAD TO RENDER BACKEND
// ============================================================================
void captureAndUploadLeaf(const char* triggerSource, const char* commandId) {
  if (isCapturingAndUploading) {
    Serial.println("[CAMERA WARNING] Capture already in progress. Skipping.");
    return;
  }
  isCapturingAndUploading = true;

  // Flash LED illumination (optional)
  if (FLASH_LED_PIN >= 0) {
    digitalWrite(FLASH_LED_PIN, HIGH);
    delay(100);
  }

  Serial.println("[CAMERA] Capturing frame buffer from OV sensor...");
  camera_fb_t* fb = esp_camera_fb_get();

  if (FLASH_LED_PIN >= 0) {
    digitalWrite(FLASH_LED_PIN, LOW);
  }

  if (!fb) {
    Serial.println("[CAMERA FATAL] esp_camera_fb_get failed! Check ribbon cable seating.");
    isCapturingAndUploading = false;
    return;
  }

  Serial.printf("[CAMERA] Frame captured: %d bytes (JPEG, %dx%d)\n", fb->len, fb->width, fb->height);

  // Set TLS CA Certificate or Insecure for Render Cloud host
  // Render uses DigiCert / Let's Encrypt certificates
  httpTlsClient.setInsecure(); // Permits reliable TLS handshake across dynamic CDN endpoints
  httpTlsClient.setTimeout(15000);

  Serial.printf("[HTTPS] Connecting to Render backend at %s:%d...\n", RENDER_HOST, RENDER_HTTPS_PORT);
  if (!httpTlsClient.connect(RENDER_HOST, RENDER_HTTPS_PORT)) {
    Serial.println("[HTTPS ERROR] Failed to connect to Render host!");
    esp_camera_fb_return(fb);
    isCapturingAndUploading = false;
    return;
  }

  String boundary = "----AgriRoverCamBoundary7MA4YWxkTrZu0gW";

  // Build Multipart Form Header
  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"device_id\"\r\n\r\n" + String(DEVICE_ID) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"plot_id\"\r\n\r\n" + String(PLOT_ID) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"crop_hint\"\r\n\r\n" + String(CROP_HINT) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"source\"\r\n\r\n" + String(triggerSource) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"leaf_scan.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";
  uint32_t totalLength = head.length() + fb->len + tail.length();

  Serial.printf("[HTTPS] Uploading leaf image payload (%u bytes total)...\n", totalLength);

  // Write HTTP POST request
  httpTlsClient.printf("POST %s HTTP/1.1\r\n", RENDER_UPLOAD_PATH);
  httpTlsClient.printf("Host: %s\r\n", RENDER_HOST);
  httpTlsClient.println("User-Agent: ESP32-S3-CAM-AgriRover/1.0");
  httpTlsClient.println("Accept: application/json");
  httpTlsClient.printf("Content-Type: multipart/form-data; boundary=%s\r\n", boundary.c_str());
  httpTlsClient.printf("Content-Length: %u\r\n", totalLength);
  httpTlsClient.println("Connection: close\r\n");

  // Stream header
  httpTlsClient.print(head);

  // Stream raw JPEG bytes in 1024-byte packets
  uint8_t* fbBuf = fb->buf;
  size_t fbLen   = fb->len;
  size_t chunk   = 1024;
  for (size_t n = 0; n < fbLen; n += chunk) {
    size_t sendBytes = (n + chunk < fbLen) ? chunk : (fbLen - n);
    httpTlsClient.write(fbBuf + n, sendBytes);
    yield();
  }

  // Stream footer
  httpTlsClient.print(tail);

  // Return camera frame buffer immediately
  esp_camera_fb_return(fb);

  Serial.println("[HTTPS] Image transmitted. Awaiting AI inference response...");

  // Read Response
  unsigned long timeout = millis() + 12000;
  String responseBody = "";
  bool headerFinished = false;

  while (httpTlsClient.connected() && millis() < timeout) {
    if (httpTlsClient.available()) {
      String line = httpTlsClient.readStringUntil('\n');
      if (line == "\r") {
        headerFinished = true;
        break;
      }
    }
  }

  if (headerFinished) {
    responseBody = httpTlsClient.readString();
    Serial.println("\n==================================================");
    Serial.println("[AI PREDICTION RECEIVED FROM RENDER BACKEND]");
    Serial.println(responseBody);
    Serial.println("==================================================\n");

    // Publish Acknowledgment to MQTT
    if (mqttClient.connected()) {
      StaticJsonDocument<512> ackDoc;
      ackDoc["commandId"]  = commandId ? commandId : "cmd-cam-auto";
      ackDoc["deviceId"]   = DEVICE_ID;
      ackDoc["status"]     = "ACKNOWLEDGED";
      ackDoc["action"]     = "CAPTURE";
      ackDoc["message"]    = "Image captured & diagnosed by MobileNetV2";
      ackDoc["timestamp"]  = millis();

      String ackStr;
      serializeJson(ackDoc, ackStr);
      mqttClient.publish(TOPIC_ROVER_COMMANDS_ACK, ackStr.c_str());
      mqttClient.publish(TOPIC_DEVICE_ACK, ackStr.c_str());
    }
  } else {
    Serial.println("[HTTPS TIMEOUT] Did not receive response from Render backend.");
  }

  httpTlsClient.stop();
  isCapturingAndUploading = false;
}

// ============================================================================
// 10. EMBEDDED HTTP WEB SERVER (Local Browser Diagnostics)
// ============================================================================
void handleDirectCaptureHttp() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    localServer.send(500, "text/plain", "Camera hardware capture failed");
    return;
  }

  localServer.sendHeader("Access-Control-Allow-Origin", "*");
  localServer.sendHeader("Content-Disposition", "inline; filename=capture.jpg");
  localServer.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

void handleRootIndexHttp() {
  String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
  html += "<title>AgriRover ESP32-S3-CAM</title>";
  html += "<style>body{font-family:sans-serif;background:#0d1117;color:#e6edf3;padding:20px;text-align:center;}";
  html += ".btn{background:#10b981;color:#000;padding:12px 24px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block;margin:10px;}";
  html += "img{max-width:100%;border-radius:12px;border:1px solid #30363d;margin-top:15px;}</style></head><body>";
  html += "<h2>AgriRover ESP32-S3-CAM Vision Module</h2>";
  html += "<p>Device ID: <b>" + String(DEVICE_ID) + "</b> | IP: <b>" + WiFi.localIP().toString() + "</b></p>";
  html += "<p>MQTT: <b>" + String(mqttClient.connected() ? "CONNECTED (EMQX Cloud)" : "DISCONNECTED") + "</b></p>";
  html += "<a href='/capture' target='_blank' class='btn'>📸 View Live Snapshot</a>";
  html += "<br><img src='/capture' alt='Live Frame' />";
  html += "</body></html>";
  localServer.send(200, "text/html", html);
}

// ============================================================================
// 11. SETUP & MAIN LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n\n==================================================");
  Serial.println("  AGRIROVER — ESP32-S3-CAM VISION FIRMWARE       ");
  Serial.println("  Smart Agriculture Rover EPICS College Project   ");
  Serial.println("==================================================");

  // Initialize Flash LED Pin if configured
  if (FLASH_LED_PIN >= 0) {
    pinMode(FLASH_LED_PIN, OUTPUT);
    digitalWrite(FLASH_LED_PIN, LOW);
  }

  // Initialize Hardware Trigger Input Pin
  if (HW_TRIGGER_PIN >= 0) {
    pinMode(HW_TRIGGER_PIN, INPUT_PULLDOWN);
    Serial.printf("[TRIGGER] Hardware pulse trigger enabled on GPIO %d\n", HW_TRIGGER_PIN);
  }

  // Initialize Camera Hardware
  if (!initCameraHardware()) {
    Serial.println("[FATAL] Camera module initialization failed! System halted.");
    while (true) {
      delay(1000);
    }
  }

  // Connect to Wi-Fi
  connectWiFi();

  // Configure MQTT
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessageReceived);
  mqttClient.setBufferSize(1024);

  // Initialize Local Web Server
  localServer.on("/", HTTP_GET, handleRootIndexHttp);
  localServer.on("/capture", HTTP_GET, handleDirectCaptureHttp);
  localServer.begin();
  Serial.printf("[SERVER] Local HTTP diagnostics ready at: http://%s/\n", WiFi.localIP().toString().c_str());

  // Connect to EMQX Cloud MQTT
  connectMqtt();
}

void loop() {
  // 1. Maintain Wi-Fi Connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  // 2. Maintain MQTT Connection & Process Subscribed Topics
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      connectMqtt();
    } else {
      mqttClient.loop();
    }
  }

  // 3. Handle Local HTTP Requests
  localServer.handleClient();

  // 4. Check Physical Hardware Trigger Line (GPIO pulse from Main ESP32)
  if (HW_TRIGGER_PIN >= 0 && digitalRead(HW_TRIGGER_PIN) == HIGH) {
    Serial.println("[TRIGGER] Physical pulse detected on HW_TRIGGER_PIN! Capturing leaf...");
    captureAndUploadLeaf("HARDWARE_PIN_PULSE");
    delay(500); // Debounce trigger pulse
  }

  // 5. Periodic Heartbeat to EMQX Cloud
  if (millis() - lastHeartbeatTime > 30000) {
    lastHeartbeatTime = millis();
    publishCameraStatus("online", "Heartbeat OK");
  }

  // 6. Optional Periodic Auto-Capture (if AUTO_CAPTURE_INTERVAL_MS > 0)
  if (AUTO_CAPTURE_INTERVAL_MS > 0 && (millis() - lastAutoCaptureTime >= AUTO_CAPTURE_INTERVAL_MS)) {
    lastAutoCaptureTime = millis();
    Serial.println("[TIMER] Periodic auto-capture triggered.");
    captureAndUploadLeaf("AUTO_INTERVAL");
  }
}
