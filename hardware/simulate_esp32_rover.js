/**
 * ============================================================================
 * SMART AGRICULTURE ROVER — ESP32 HARDWARE SIMULATOR & TEST CLIENT
 * ============================================================================
 * Simulates a physical ESP32 microcontroller connected to the MQTT broker.
 * Tests the entire bidirectional communication loop:
 *   Website (UI) -> Backend -> MQTT Broker -> ESP32 -> Motors -> Ack -> Website
 *
 * Usage:
 *   node hardware/simulate_esp32_rover.js [deviceId] [brokerUrl]
 * Example:
 *   node hardware/simulate_esp32_rover.js rover-001 mqtt://broker.emqx.io:1883
 * ============================================================================
 */

const mqtt = require('mqtt');

const DEVICE_ID = process.argv[2] || process.env.DEFAULT_DEVICE_ID || 'rover-001';
const BROKER_URL = process.argv[3] || process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883';

const TOPIC_COMMAND = `devices/${DEVICE_ID}/command`;
const TOPIC_TELEMETRY = `devices/${DEVICE_ID}/telemetry`;
const TOPIC_STATUS = `devices/${DEVICE_ID}/status`;
const TOPIC_ACK = `devices/${DEVICE_ID}/ack`;

console.log('\x1b[32m\x1b[1m' + '='.repeat(70) + '\x1b[0m');
console.log(`\x1b[32m\x1b[1m🌱 ESP32 ROVER HARDWARE SIMULATOR [${DEVICE_ID}]\x1b[0m`);
console.log(`📡 Broker Target : ${BROKER_URL}`);
console.log(`📥 Subscribing   : ${TOPIC_COMMAND}`);
console.log(`📤 Publishing    : ${TOPIC_TELEMETRY}, ${TOPIC_STATUS}, ${TOPIC_ACK}`);
console.log('\x1b[32m\x1b[1m' + '='.repeat(70) + '\x1b[0m\n');

// Configure Last Will and Testament (LWT)
const lwtPayload = JSON.stringify({
  deviceId: DEVICE_ID,
  device_id: DEVICE_ID,
  is_online: false,
  status: 'offline',
  timestamp: new Date().toISOString(),
});

const client = mqtt.connect(BROKER_URL, {
  clientId: `ESP32-HW-Sim-${DEVICE_ID}-${Math.random().toString(16).substring(2, 8)}`,
  clean: true,
  will: {
    topic: TOPIC_STATUS,
    payload: lwtPayload,
    qos: 1,
    retain: true,
  },
});

let isOnline = false;
let batteryLevel = 94.0;

client.on('connect', () => {
  isOnline = true;
  console.log(`\x1b[32m✔ [WIFI & MQTT] ESP32 connected to broker successfully!\x1b[0m`);

  // Subscribe to command topic
  client.subscribe(TOPIC_COMMAND, { qos: 1 }, (err) => {
    if (err) {
      console.error('❌ Failed to subscribe to commands:', err);
    } else {
      console.log(`✔ [ESP32] Listening for motor teleoperation commands on: ${TOPIC_COMMAND}`);
    }
  });

  // Publish online status
  publishStatus(true);

  // Send initial telemetry packet
  sendTelemetry();
});

client.on('message', (topic, messageBuffer) => {
  if (topic === TOPIC_COMMAND) {
    handleIncomingCommand(messageBuffer.toString());
  }
});

function handleIncomingCommand(payloadStr) {
  try {
    const cmd = JSON.parse(payloadStr);
    const cmdId = cmd.commandId || cmd.command_id || cmd.id || 'cmd-unknown';
    const command = (cmd.type || cmd.command || 'STOP').toUpperCase();
    const durationMs = cmd.durationMs || cmd.duration_ms || 1000;

    console.log(`\n\x1b[36m⚡ [ESP32 HARDWARE ACTUATION] Received Command #${cmdId}:\x1b[0m`);
    console.log(`   Instruction : \x1b[1m${command}\x1b[0m`);
    console.log(`   Duration    : ${durationMs} ms`);

    if (command === 'FORWARD') {
      console.log('   [L298N] Left Forward (IN1=H, IN2=L), Right Forward (IN3=H, IN4=L)');
    } else if (command === 'BACKWARD') {
      console.log('   [L298N] Left Reverse (IN1=L, IN2=H), Right Reverse (IN3=L, IN4=H)');
    } else if (command === 'LEFT') {
      console.log('   [L298N] Differential Left (IN1=L, IN2=H), Right Forward (IN3=H, IN4=L)');
    } else if (command === 'RIGHT') {
      console.log('   [L298N] Differential Right (IN1=H, IN2=L), Right Reverse (IN3=L, IN4=H)');
    } else if (command === 'STOP' || command === 'EMERGENCY_STOP') {
      console.log('   [L298N] Emergency Cutoff: All inputs LOW, ENA/ENB disabled');
    } else if (command === 'LED_SET') {
      console.log(`   [GPIO 2] Auxiliary LED set to: ${cmd.value ? 'HIGH (ON)' : 'LOW (OFF)'}`);
    }

    // Simulate physical motor execution delay and acknowledge back
    setTimeout(() => {
      const ackPayload = JSON.stringify({
        commandId: cmdId,
        command_id: cmdId,
        deviceId: DEVICE_ID,
        status: 'executed',
        message: `Physical ${command} actuation completed successfully (${durationMs}ms)`,
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
    device_id: DEVICE_ID,
    is_online: online,
    status: online ? 'online' : 'offline',
    battery_percent: Math.round(batteryLevel),
    signal_rssi: -58,
    ip_address: '192.168.1.145',
    mode: 'MANUAL',
    timestamp: new Date().toISOString(),
  });

  client.publish(TOPIC_STATUS, statusPayload, { qos: 1, retain: true });
  console.log(`📡 [STATUS] Published heartbeat: is_online=${online}, battery=${Math.round(batteryLevel)}%`);
}

function sendTelemetry() {
  // Realistic sensor measurements with subtle environmental jitter
  const temp = Math.round((28.2 + (Math.random() * 1.0 - 0.5)) * 10) / 10;
  const hum = Math.round((64.0 + (Math.random() * 2.0 - 1.0)) * 10) / 10;
  const rawMoist = Math.round(2140 + (Math.random() * 30 - 15));
  const rawPh = Math.round((2.04 + (Math.random() * 0.04 - 0.02)) * 100) / 100;

  batteryLevel = Math.max(batteryLevel - 0.02, 10.0);

  const telemetryPayload = JSON.stringify({
    deviceId: DEVICE_ID,
    device_id: DEVICE_ID,
    farmId: 'farm-001',
    plotId: 'plot-001',
    temperature: temp,
    temperature_c: temp,
    humidity: hum,
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

// Telemetry interval (every 5 seconds)
const telemetryTimer = setInterval(sendTelemetry, 5000);

// Status heartbeat interval (every 15 seconds)
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
