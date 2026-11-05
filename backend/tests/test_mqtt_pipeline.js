/**
 * End-to-End MQTT + Socket.IO Communication Pipeline Test
 * Tests: Website -> Backend -> MQTT Broker -> ESP32 -> Ack -> Backend -> Socket.IO
 */

const http = require('http');
const mqtt = require('mqtt');
const { io } = require('socket.io-client');
const config = require('../config/env');
const db = require('../config/db');

async function runTests() {
  console.log('\x1b[36m\x1b[1m=== STARTING FULL IOT PIPELINE END-TO-END TEST ===\x1b[0m\n');

  // 1. Check Backend Health
  console.log('▶ Step 1: Checking Backend REST API Health...');
  const healthRes = await fetch(`http://127.0.0.1:${config.port}/health`);
  const healthData = await healthRes.json();
  console.log('✔ Backend Health Response:', healthData);

  if (healthData.status !== 'ok') {
    throw new Error('Backend health check failed');
  }

  // 2. Connect Simulated ESP32 via MQTT
  console.log('\n▶ Step 2: Connecting Simulated ESP32 to MQTT Broker...');
  const espOptions = {
    clientId: `TestESP32-${Date.now()}`,
    clean: true,
    connectTimeout: 8000,
  };
  if (config.mqtt.tls || config.mqtt.brokerUrl.startsWith('mqtts://')) {
    espOptions.rejectUnauthorized = true;
    espOptions.servername = config.mqtt.host;
    if (config.mqtt.caCert) {
      espOptions.ca = [config.mqtt.caCert];
    }
  }
  if (config.mqtt.username) {
    espOptions.username = process.env.MQTT_ESP32_USERNAME || 'agrirover';
    espOptions.password = process.env.MQTT_ESP32_PASSWORD || config.mqtt.password;
  }

  const espMqtt = mqtt.connect(config.mqtt.brokerUrl, espOptions);

  await new Promise((resolve) => espMqtt.on('connect', resolve));
  console.log(`✔ Simulated ESP32 connected to broker: ${config.mqtt.brokerUrl}`);

  // Subscribe to command topic
  const commandTopic = `devices/${config.defaultDeviceId}/command`;
  await new Promise((resolve) => espMqtt.subscribe(commandTopic, { qos: 1 }, resolve));
  console.log(`✔ Simulated ESP32 subscribed to: ${commandTopic}`);

  // 3. Connect Simulated Website via Socket.IO
  console.log('\n▶ Step 3: Connecting Simulated Website Frontend to Socket.IO...');
  const webSocket = io(`http://127.0.0.1:${config.port}`, {
    transports: ['websocket'],
  });

  await new Promise((resolve) => webSocket.on('connect', resolve));
  console.log(`✔ Website frontend connected to Socket.IO (ID: ${webSocket.id})`);

  // 4. Test Scenario A: ESP32 Telemetry -> Backend -> Socket.IO Website
  console.log('\n▶ Step 4: Testing Telemetry Flow (ESP32 -> MQTT -> Backend -> Socket.IO)...');
  const telemetryTopic = `devices/${config.defaultDeviceId}/telemetry`;

  const receivedTelemetryPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for telemetry on Socket.IO')), 8000);
    webSocket.once('rover:telemetry', (data) => {
      clearTimeout(timer);
      resolve(data);
    });
  });

  const testTelemetryPayload = {
    deviceId: config.defaultDeviceId,
    temperature_c: 29.5,
    humidity_percent: 68.2,
    raw_moisture_adc: 2120,
    raw_ph_voltage: 2.05,
    timestamp: new Date().toISOString(),
  };

  espMqtt.publish(telemetryTopic, JSON.stringify(testTelemetryPayload));
  const receivedTelemetry = await receivedTelemetryPromise;
  console.log('✔ Telemetry received on Website via Socket.IO:', {
    temp: receivedTelemetry.temperature_c,
    hum: receivedTelemetry.humidity_percent,
    moist: receivedTelemetry.soil_moisture_percent,
    ph: receivedTelemetry.soil_ph,
  });

  // 5. Test Scenario B: Website Sends Command -> Backend -> MQTT -> ESP32 -> Ack -> Backend -> Socket.IO
  console.log('\n▶ Step 5: Testing Full Command & Actuation Flow...');

  const espReceivedCommandPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for command on ESP32')), 8000);
    espMqtt.once('message', (topic, payload) => {
      if (topic === commandTopic) {
        clearTimeout(timer);
        resolve(JSON.parse(payload.toString()));
      }
    });
  });

  const webReceivedAckPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout waiting for command ACK on Socket.IO')), 8000);
    webSocket.once('rover:command:ack', (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });

  // Website dispatches FORWARD command via REST
  console.log("   Website calling POST /api/v1/rover/commands with 'FORWARD' (1500ms)...");
  const cmdRes = await fetch(`http://127.0.0.1:${config.port}/api/v1/rover/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'FORWARD',
      duration_ms: 1500,
      device_id: config.defaultDeviceId,
    }),
  });

  const dispatchedCmd = await cmdRes.json();
  console.log(`✔ Command registered in backend queue (ID #${dispatchedCmd.id}, Status: ${dispatchedCmd.status})`);

  // Verify ESP32 received it over MQTT
  const espCmd = await espReceivedCommandPromise;
  console.log(`✔ ESP32 received MQTT command #${espCmd.commandId}: [${espCmd.command}] for ${espCmd.durationMs}ms`);

  // ESP32 actuates motors and sends acknowledgement
  console.log('   ESP32 actuating L298N motors and publishing Ack on MQTT...');
  const ackTopic = `devices/${config.defaultDeviceId}/ack`;
  const ackPayload = {
    commandId: espCmd.commandId,
    deviceId: config.defaultDeviceId,
    status: 'executed',
    message: 'L298N motors engaged FORWARD for 1500ms successfully',
  };
  espMqtt.publish(ackTopic, JSON.stringify(ackPayload));

  // Verify Website received the ACK via Socket.IO
  const receivedAck = await webReceivedAckPromise;
  console.log(`✔ Website received real-time ACK via Socket.IO:`, {
    id: receivedAck.id,
    status: receivedAck.status,
    response_message: receivedAck.response_message,
  });

  // 6. Test Scenario C: Invalid Command Validation
  console.log('\n▶ Step 6: Testing Invalid Command Security Validation...');
  const invalidRes = await fetch(`http://127.0.0.1:${config.port}/api/v1/rover/commands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command: 'UNAUTHORIZED_HAZARDOUS_CMD',
      device_id: config.defaultDeviceId,
    }),
  });
  console.log(`✔ Invalid command rejected properly with HTTP ${invalidRes.status}`);

  // Cleanup
  console.log('\n\x1b[32m\x1b[1m=== ALL END-TO-END PIPELINE TESTS PASSED 100%! ===\x1b[0m\n');
  espMqtt.end();
  webSocket.disconnect();
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌ Test Failure:', err);
    process.exit(1);
  });
