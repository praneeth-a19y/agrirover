const config = require('./env');

const MQTT_TOPICS = {
  // Device-centric topic templates
  COMMAND_TOPIC: (deviceId = '+') => `devices/${deviceId}/command`,
  TELEMETRY_TOPIC: (deviceId = '+') => `devices/${deviceId}/telemetry`,
  STATUS_TOPIC: (deviceId = '+') => `devices/${deviceId}/status`,
  ACK_TOPIC: (deviceId = '+') => `devices/${deviceId}/ack`,
  CAMERA_CAPTURE_TOPIC: (deviceId = '+') => `devices/${deviceId}/camera/capture`,
  AI_RESULTS_TOPIC: (deviceId = '+') => `devices/${deviceId}/ai/results`,

  // Standard EPICS Rover Topic Topology
  ROVER_SENSORS_DATA: 'rover/sensors/data',
  ROVER_SENSORS_TEMP: 'rover/sensors/temperature',
  ROVER_SENSORS_HUMIDITY: 'rover/sensors/humidity',
  ROVER_CAMERA_CAPTURE: 'rover/camera/capture',
  ROVER_CAMERA_STATUS: 'rover/camera/status',
  ROVER_COMMANDS_MOTOR: 'rover/commands/motor',
  ROVER_COMMANDS_ACK: 'rover/commands/ack',
  ROVER_STATUS_CONNECTION: 'rover/status/connection',
  ROVER_STATUS_TELEMETRY: 'rover/status/telemetry',
  ROVER_AI_RESULTS: 'rover/ai/results',

  // Wildcard subscriptions for backend listening
  SUB_ALL_TELEMETRY: 'devices/+/telemetry',
  SUB_ALL_STATUS: 'devices/+/status',
  SUB_ALL_ACK: 'devices/+/ack',
  SUB_ALL_COMMANDS: 'devices/+/command',
  SUB_ROVER_SENSORS: 'rover/sensors/+',
  SUB_ROVER_COMMANDS: 'rover/commands/+',
  SUB_ROVER_STATUS: 'rover/status/+',
  SUB_ROVER_CAMERA: 'rover/camera/+',
};

function parseTopic(topic) {
  if (!topic) return null;

  // 1. Pattern: devices/{deviceId}/{type} or devices/{deviceId}/{category}/{type}
  const parts = topic.split('/');
  if (parts.length >= 3 && parts[0] === 'devices') {
    return {
      deviceId: parts[1],
      type: parts.slice(2).join('/'), // e.g. 'telemetry', 'status', 'ack', 'command', 'camera/capture'
    };
  }

  // 2. Pattern: rover/{category}/{type}
  if (parts.length >= 2 && parts[0] === 'rover') {
    const category = parts[1]; // 'sensors', 'status', 'commands', 'camera', 'ai'
    const leaf = parts[2] || '';

    if (category === 'sensors' || leaf === 'telemetry') {
      return {
        deviceId: config.defaultDeviceId,
        type: 'telemetry',
        subType: leaf,
      };
    }
    if (category === 'status' || leaf === 'connection') {
      return {
        deviceId: config.defaultDeviceId,
        type: 'status',
        subType: leaf,
      };
    }
    if (category === 'commands' && leaf === 'ack') {
      return {
        deviceId: config.defaultDeviceId,
        type: 'ack',
        subType: leaf,
      };
    }
    if (category === 'commands' && leaf === 'motor') {
      return {
        deviceId: config.defaultDeviceId,
        type: 'command',
        subType: leaf,
      };
    }
    if (category === 'camera' && (leaf === 'status' || leaf === 'capture')) {
      return {
        deviceId: config.defaultDeviceId,
        type: leaf === 'status' ? 'status' : 'command',
        subType: 'camera',
      };
    }
    if (category === 'ai' && leaf === 'results') {
      return {
        deviceId: config.defaultDeviceId,
        type: 'ai_results',
      };
    }
  }

  return null;
}

module.exports = {
  MQTT_TOPICS,
  parseTopic,
};
