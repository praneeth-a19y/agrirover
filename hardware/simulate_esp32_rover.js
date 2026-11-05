/**
 * ============================================================================
 * AGRIROVER — ESP32 HARDWARE SIMULATOR & TEST CLIENT
 * ============================================================================
 * Simulates a physical ESP32 connecting to EMQX Cloud over TLS or local broker.
 *
 * Usage:
 *   node hardware/simulate_esp32_rover.js [deviceId] [brokerUrl] [username] [password]
 * Example:
 *   node hardware/simulate_esp32_rover.js agrirover-01 mqtts://ed61a166.ala.eu-central-1.emqxsl.com:8883 agrirover_esp32 <password>
 * ============================================================================
 */

const mqtt = require('mqtt');
const path = require('path');
const fs = require('fs');

// Try loading local environment variables if available
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
} catch {}

const DEVICE_ID = process.argv[2] || process.env.DEVICE_ID || process.env.DEFAULT_DEVICE_ID || 'agrirover-01';
const BROKER_URL = process.argv[3] || process.env.MQTT_BROKER_URL || 'mqtts://ed61a166.ala.eu-central-1.emqxsl.com:8883';
const USERNAME = process.argv[4] || process.env.MQTT_ESP32_USERNAME || 'agrirover_esp32';
const PASSWORD = process.argv[5] || process.env.MQTT_ESP32_PASSWORD || process.env.MQTT_PASSWORD || '';

const TOPIC_COMMAND   = `devices/${DEVICE_ID}/command`;
const TOPIC_TELEMETRY = `devices/${DEVICE_ID}/telemetry`;
const TOPIC_STATUS    = `devices/${DEVICE_ID}/status`;
const TOPIC_ACK       = `devices/${DEVICE_ID}/ack`;

console.log('\x1b[32m\x1b[1m' + '='.repeat(70) + '\x1b[0m');
console.log(`\x1b[32m\x1b[1m🌱 AGRIROVER ESP32 HARDWARE SIMULATOR [${DEVICE_ID}]\x1b[0m`);
console.log(`📡 Broker Target : ${BROKER_URL}`);
console.log(`👤 Auth User     : ${USERNAME ? USERNAME : '(Anonymous)'}`);
console.log(`📥 Subscribing   : ${TOPIC_COMMAND}`);
console.log(`📤 Publishing    : ${TOPIC_TELEMETRY}, ${TOPIC_STATUS}, ${TOPIC_ACK}`);
console.log('\x1b[32m\x1b[1m' + '='.repeat(70) + '\x1b[0m\n');

const lwtPayload = JSON.stringify({
  deviceId: DEVICE_ID,
  is_online: false,
  status: 'offline',
  timestamp: new Date().toISOString(),
});

const clientOptions = {
  clientId: `ESP32-HW-Sim-${DEVICE_ID}-${Math.random().toString(16).substring(2, 6)}`,
  clean: true,
  connectTimeout: 10000,
  reconnectPeriod: 5000,
  will: {
    topic: TOPIC_STATUS,
    payload: lwtPayload,
    qos: 1,
    retain: true,
  },
};

if (BROKER_URL.startsWith('mqtts://') || BROKER_URL.includes(':8883')) {
  clientOptions.rejectUnauthorized = true;
  const caFile = path.resolve(__dirname, '../backend/certs/emqx-ca.pem');
  if (fs.existsSync(caFile)) {
    clientOptions.ca = [fs.readFileSync(caFile, 'utf8')];
  }
}

if (USERNAME) {
  clientOptions.username = USERNAME;
  clientOptions.password = PASSWORD;
}

const client = mqtt.connect(BROKER_URL, clientOptions);

let isOnline = false;
let batteryLevel = 94.0;

client.on('connect', () => {
  isOnline = true;
  console.log(`\x1b[32m✔ [WIFI & MQTT TLS] ESP32 connected to EMQX broker successfully!\x1b[0m`);

  client.subscribe(TOPIC_COMMAND, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to subscribe to commands:', err);
    } else {
      console.log(`✔ [ESP32] Listening for motor teleoperation commands on: ${TOPIC_COMMAND}`);
    }
  });

  publishStatus(true);
  sendTelemetry();
});

client.on('error', (err) => {
  console.error(`\x1b[31m❌ [MQTT ERROR] ${err.message}\x1b[0m`);
});

client.on('message', (topic, messageBuffer) => {
  if (topic === TOPIC_COMMAND) {
    handleIncomingCommand(messageBuffer.toString());
  }
});

function handleIncomingCommand(payloadStr) {
  try {
    const cmd = JSON.parse(payloadStr);
    const cmdId = cmd.commandId || cmd.command_id || 'cmd-unknown';
    const action = (cmd.value || cmd.type || cmd.command || 'STOP').toUpperCase();
    const durationMs = cmd.durationMs || cmd.duration_ms || 1000;

    console.log(`\n\x1b[36m⚡ [ESP32 MOTOR ACTUATION] Command #${cmdId} received:\x1b[0m`);
    console.log(`   Instruction : \x1b[1m${action}\x1b[0m`);
    console.log(`   Duration    : ${durationMs} ms`);

    if (action === 'FORWARD') {
      console.log('   [L298N] Left Forward (IN1=H, IN2=L), Right Forward (IN3=H, IN4=L)');
    } else if (action === 'BACKWARD') {
      console.log('   [L298N] Left Reverse (IN1=L, IN2=H), Right Reverse (IN3=L, IN4=H)');
    } else if (action === 'LEFT') {
      console.log('   [L298N] Differential Turn Left (IN1=L, IN2=H), Right Fwd (IN3=H, IN4=L)');
    } else if (action === 'RIGHT') {
      console.log('   [L298N] Differential Turn Right (IN1=H, IN2=L), Right Rev (IN3=L, IN4=H)');
    } else if (action === 'STOP' || action === 'EMERGENCY_STOP') {
      console.log('   [L298N] EMERGENCY CUTOFF: All motor drivers disabled LOW');
    } else if (action === 'LED_SET' || cmd.type === 'LED_SET') {
      console.log(`   [GPIO 2] Auxiliary LED: ${cmd.value ? 'ON' : 'OFF'}`);
    }

    setTimeout(() => {
      const ackPayload = JSON.stringify({
        commandId: cmdId,
        deviceId: DEVICE_ID,
        status: 'executed',
        message: `Physical ${action} actuation completed successfully (${durationMs}ms)`,
        timestamp: new Date().toISOString(),
      });

      client.publish(TOPIC_ACK, ackPayload, { qos: 1 }, () => {
        console.log(`\x1b[32m✔ [ESP32 ACK] Sent execution confirmation for #${cmdId} to [${TOPIC_ACK}]\x1b[0m\n`);
      });
    }, Math.min(durationMs, 1000));
  } catch (err) {
    console.error('❌ Error handling command payload:', err.message);
  }
}

function publishStatus(online) {
  const statusPayload = JSON.stringify({
    deviceId: DEVICE_ID,
    is_online: online,
    status: online ? 'online' : 'offline',
    battery_percent: Math.round(batteryLevel),
    signal_rssi: -58,
    ip_address: '192.168.1.145',
    mode: 'MANUAL',
    timestamp: new Date().toISOString(),
  });

  client.publish(TOPIC_STATUS, statusPayload, { qos: 1, retain: true });
}

function sendTelemetry() {
  const temp = Math.round((28.4 + (Math.random() * 0.8 - 0.4)) * 10) / 10;
  const hum = Math.round((64.0 + (Math.random() * 2.0 - 1.0)) * 10) / 10;
  const rawMoist = Math.round(2140 + (Math.random() * 30 - 15));
  const rawPh = Math.round((2.04 + (Math.random() * 0.04 - 0.02)) * 100) / 100;

  batteryLevel = Math.max(batteryLevel - 0.01, 15.0);

  const telemetryPayload = JSON.stringify({
    deviceId: DEVICE_ID,
    farmId: 'farm-001',
    plotId: 'plot-001',
    soilMoisture: 45.5,
    temperature: temp,
    humidity: hum,
    temperature_c: temp,
    humidity_percent: hum,
    rawMoistureAdc: rawMoist,
    raw_moisture_adc: rawMoist,
    rawPhVoltage: rawPh,
    raw_ph_voltage: rawPh,
    battery_percent: Math.round(batteryLevel),
    signal_rssi: -58,
    is_simulated: false,
    timestamp: new Date().toISOString(),
  });

  client.publish(TOPIC_TELEMETRY, telemetryPayload, { qos: 1 });
  console.log(`🌱 [TELEMETRY] Temp: ${temp}°C | Hum: ${hum}% | Soil ADC: ${rawMoist} | pH Volt: ${rawPh}V`);
}

const telemetryTimer = setInterval(sendTelemetry, 5000);
const statusTimer = setInterval(() => publishStatus(true), 15000);

function cleanup() {
  console.log('\n\x1b[33m🛑 Disconnecting ESP32 Hardware Simulator...\x1b[0m');
  clearInterval(telemetryTimer);
  clearInterval(statusTimer);

  publishStatus(false);
  setTimeout(() => {
    client.end(false, () => {
      console.log('✔ Simulator disconnected.');
      process.exit(0);
    });
  }, 500);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
