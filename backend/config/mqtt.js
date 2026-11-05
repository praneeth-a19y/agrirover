const config = require('./env');

const MQTT_TOPICS = {
  // Topic templates
  COMMAND_TOPIC: (deviceId = '+') => `devices/${deviceId}/command`,
  TELEMETRY_TOPIC: (deviceId = '+') => `devices/${deviceId}/telemetry`,
  STATUS_TOPIC: (deviceId = '+') => `devices/${deviceId}/status`,
  ACK_TOPIC: (deviceId = '+') => `devices/${deviceId}/ack`,

  // Wildcard subscriptions for backend listening
  SUB_ALL_TELEMETRY: 'devices/+/telemetry',
  SUB_ALL_STATUS: 'devices/+/status',
  SUB_ALL_ACK: 'devices/+/ack',
  SUB_ALL_COMMANDS: 'devices/+/command',
};

function parseTopic(topic) {
  // Pattern: devices/{deviceId}/{type}
  const parts = topic.split('/');
  if (parts.length === 3 && parts[0] === 'devices') {
    return {
      deviceId: parts[1],
      type: parts[2], // 'telemetry', 'status', 'ack', 'command'
    };
  }
  return null;
}

module.exports = {
  MQTT_TOPICS,
  parseTopic,
};
