/**
 * ============================================================================
 * SMART AGRICULTURE ROVER — ESP32-CAM VISION FIRMWARE
 * Microcontroller: AI-Thinker ESP32-CAM (OV2640 Sensor)
 * 
 * Capabilities:
 *  1. Dual-Path Image Transmission:
 *     A. Automatic HTTP Multipart POST to backend (/upload or /predict).
 *     B. Embedded Web Server at http://<esp32-ip>/capture for direct in-browser
 *        retrieval and real-time verification.
 *  2. PlantVillage 224x224 RGB compatible image capture.
 *  3. Ingestion of predicted pathogen class, confidence, and treatment protocol.
 * ============================================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WebServer.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ----------------------------------------------------------------------------
// 1. CONFIGURATION
// ----------------------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Server Host & Port (Local LAN IP of backend computer)
const char* SERVER_HOST   = "192.168.1.100";
const int   SERVER_PORT   = 8000;
const char* SERVER_PATH   = "/upload";  // Compatible with /upload or /predict or /api/v1/disease/predict

const char* DEVICE_ID     = "rover-001";
const char* PLOT_ID       = "plot-001";
const char* CROP_HINT     = "Tomato";

WebServer server(80);

// ----------------------------------------------------------------------------
// 2. AI-THINKER ESP32-CAM PINOUT DEFINITIONS
// ----------------------------------------------------------------------------
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

#define FLASH_LED_PIN      4 // High-power onboard flash LED (optional)

unsigned long lastUploadTime = 0;
const unsigned long UPLOAD_INTERVAL_MS = 25000; // Auto-send to backend every 25s

// ----------------------------------------------------------------------------
// 3. CAMERA SETUP
// ----------------------------------------------------------------------------
bool initCamera() {
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
    config.frame_size   = FRAMESIZE_SVGA; // 800x600 for neural model input
    config.jpeg_quality = 12;             // 10-63 (lower is higher quality)
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 16;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAMERA] Camera init failed with error 0x%x\n", err);
    return false;
  }
  return true;
}

// ----------------------------------------------------------------------------
// 4. EMBEDDED HTTP SERVER FOR DIRECT BROWSER RETRIEVAL
// ----------------------------------------------------------------------------
void handleDirectCapture() {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    server.send(500, "text/plain", "Camera capture failed");
    return;
  }

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send_P(200, "image/jpeg", (const char*)fb->buf, fb->len);
  esp_camera_fb_return(fb);
}

// ----------------------------------------------------------------------------
// 5. MULTIPART IMAGE TRANSMISSION TO BACKEND
// ----------------------------------------------------------------------------
void captureAndUploadLeaf() {
  Serial.println("[CAMERA] Taking leaf photograph...");
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[CAMERA] Frame capture failed!");
    return;
  }
  Serial.printf("[CAMERA] Image captured: %d bytes (JPEG)\n", fb->len);

  // Connect TCP Client to Laptop/Backend
  WiFiClient client;
  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[HTTP] Connection to backend server failed!");
    esp_camera_fb_return(fb);
    return;
  }

  String boundary = "------------------------ESP32CamBoundary";
  
  // Build form field payloads
  String head = "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"plot_id\"\r\n\r\n" + String(PLOT_ID) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"crop_hint\"\r\n\r\n" + String(CROP_HINT) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"device_id\"\r\n\r\n" + String(DEVICE_ID) + "\r\n";
  head += "--" + boundary + "\r\n";
  head += "Content-Disposition: form-data; name=\"image\"; filename=\"leaf_scan.jpg\"\r\n";
  head += "Content-Type: image/jpeg\r\n\r\n";

  String tail = "\r\n--" + boundary + "--\r\n";
  uint32_t totalLen = head.length() + fb->len + tail.length();

  // Send HTTP POST headers
  client.printf("POST %s HTTP/1.1\r\n", SERVER_PATH);
  client.printf("Host: %s:%d\r\n", SERVER_HOST, SERVER_PORT);
  client.println("User-Agent: ESP32-CAM-Rover/1.0");
  client.println("Accept: application/json");
  client.printf("Content-Type: multipart/form-data; boundary=%s\r\n", boundary.c_str());
  client.printf("Content-Length: %d\r\n", totalLen);
  client.println("Connection: close\r\n");

  client.print(head);

  // Send raw image buffer in chunks
  uint8_t* fbBuf = fb->buf;
  size_t fbLen = fb->len;
  size_t chunkSize = 1024;
  for (size_t n = 0; n < fbLen; n += chunkSize) {
    if (n + chunkSize < fbLen) {
      client.write(fbBuf + n, chunkSize);
    } else {
      client.write(fbBuf + n, fbLen - n);
    }
  }

  client.print(tail);
  esp_camera_fb_return(fb);

  Serial.println("[HTTP] Image uploaded to backend. Awaiting prediction...");

  unsigned long timeout = millis() + 6000;
  while (client.connected() && millis() < timeout) {
    if (client.available()) {
      String line = client.readStringUntil('\n');
      if (line == "\r") {
        String jsonBody = client.readString();
        Serial.println("[AI PREDICTION] Result:");
        Serial.println(jsonBody);
        break;
      }
    }
  }
  client.stop();
}

// ----------------------------------------------------------------------------
// 6. SETUP & LOOP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  if (!initCamera()) {
    Serial.println("[FATAL] Camera module not initialized. Check flex cable ribbon.");
    while (true) delay(1000);
  }

  Serial.printf("[WIFI] Connecting to %s ", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WIFI] Connected! Assigned IP: ");
  Serial.println(WiFi.localIP());

  // Direct In-Browser capture endpoint
  server.on("/capture", HTTP_GET, handleDirectCapture);
  server.begin();
  Serial.println("[SERVER] In-Browser HTTP Capture ready on http://<esp32-ip>/capture");
}

void loop() {
  server.handleClient();

  if (millis() - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = millis();
    captureAndUploadLeaf();
  }
}
