const mqtt = require('mqtt');
const config = require('../config/env');
const { MQTT_TOPICS, parseTopic } = require('../config/mqtt');
const logger = require('../utils/logger');
const telemetryService = require('./telemetryService');
const roverService = require('./roverService');
const db = require('../config/db');

let mqttClient = null;
let isConnected = false;

function isValidDeviceId(deviceId) {
  if (!deviceId) return false;
  const d = String(deviceId).toLowerCase();
  if (
    d === config.defaultDeviceId.toLowerCase() ||
    d.startsWith('agrirover') ||
    d.startsWith('rover') ||
    d.startsWith('esp32')
  ) {
    return true;
  }
  const exists = db.prepare('SELECT 1 FROM rover_status WHERE device_id = ?').get(deviceId);
  return Boolean(exists);
}

function initMQTT() {
  logger.mqtt('INIT', `Connecting to MQTT Broker: ${config.mqtt.brokerUrl} (TLS: ${config.mqtt.tls})`);

  const options = {
    clientId: config.mqtt.clientId,
    clean: true,
    connectTimeout: config.mqtt.connectTimeout,
    reconnectPeriod: config.mqtt.reconnectPeriod,
    keepalive: config.mqtt.keepalive,
  };

  if (config.mqtt.tls || config.mqtt.brokerUrl.startsWith('mqtts://')) {
    options.rejectUnauthorized = true; // Strict TLS verification enabled
    if (config.mqtt.host) {
      options.servername = config.mqtt.host;
    }
    if (config.mqtt.caCert && config.mqtt.caCert.includes('-----BEGIN CERTIFICATE-----')) {
      options.ca = [config.mqtt.caCert];
    }
  }

  if (config.mqtt.username) {
    options.username = config.mqtt.username;
    options.password = config.mqtt.password;
  }

  try {
    mqttClient = mqtt.connect(config.mqtt.brokerUrl, options);

    mqttClient.on('connect', () => {
      isConnected = true;
      logger.mqtt('CONNECT', `Connected successfully to broker [${config.mqtt.brokerUrl}]`);

      // Subscribe to all device communication channels
      const topicsToSubscribe = [
        MQTT_TOPICS.SUB_ALL_TELEMETRY,
        MQTT_TOPICS.SUB_ALL_STATUS,
        MQTT_TOPICS.SUB_ALL_ACK,
        MQTT_TOPICS.SUB_ROVER_SENSORS,
        MQTT_TOPICS.SUB_ROVER_COMMANDS,
        MQTT_TOPICS.SUB_ROVER_STATUS,
        MQTT_TOPICS.SUB_ROVER_CAMERA,
      ];

      mqttClient.subscribe(topicsToSubscribe, { qos: 1 }, (err, granted) => {
        if (err) {
          logger.error('MQTT', 'Subscription error:', err);
        } else {
          logger.mqtt('SUBSCRIBE', `Subscribed to topics: ${granted.map((g) => g.topic).join(', ')}`);
        }
      });
    });

    mqttClient.on('message', handleIncomingMessage);

    mqttClient.on('error', (err) => {
      logger.error('MQTT', `Client error: ${err.message}`);
      if (err.message && (err.message.includes('Not authorized') || err.message.includes('connack 4') || err.message.includes('connack 5'))) {
        logger.error('MQTT', 'Authentication rejected: Verify MQTT_USERNAME="backend" and valid MQTT_PASSWORD in Render/environment variables.');
      }
    });

    mqttClient.on('reconnect', () => {
      logger.mqtt('RECONNECT', 'Attempting reconnection to MQTT broker...');
    });

    mqttClient.on('offline', () => {
      isConnected = false;
      logger.warn('MQTT', 'Client went offline from MQTT broker.');
    });

    mqttClient.on('close', () => {
      isConnected = false;
      logger.mqtt('CLOSE', 'Connection closed.');
    });

    // Provide mqttService instance to roverService
    roverService.setMqttService({
      publishCommand,
      isMqttConnected: () => isConnected,
    });
  } catch (err) {
    logger.error('MQTT', 'Failed to initialize MQTT client:', err);
  }

  return mqttClient;
}

function handleIncomingMessage(topic, messageBuffer) {
  const payloadStr = messageBuffer.toString();
  logger.mqtt('MSG_RECV', `[${topic}] ${payloadStr}`);

  let payload;
  try {
    payload = JSON.parse(payloadStr);
  } catch (err) {
    logger.warn('MQTT', `Malformed non-JSON packet on topic [${topic}]: ${payloadStr}`);
    return;
  }

  const parsed = parseTopic(topic);
  if (!parsed) {
    logger.warn('MQTT', `Unrecognized topic format: ${topic}`);
    return;
  }

  const { deviceId, type } = parsed;
  if (!isValidDeviceId(deviceId)) {
    // Ignore unrelated devices on public broker
    return;
  }

  try {
    switch (type) {
      case 'telemetry':
        handleTelemetryMessage(deviceId, payload);
        break;

      case 'status':
        handleStatusMessage(deviceId, payload);
        break;

      case 'ack':
        handleAckMessage(deviceId, payload);
        break;

      default:
        logger.mqtt('UNKNOWN', `No handler for message type '${type}' on topic ${topic}`);
    }
  } catch (err) {
    logger.error('MQTT', `Error processing message from ${topic}:`, err);
  }
}

function handleTelemetryMessage(deviceId, payload) {
  const telemetryData = {
    ...payload,
    deviceId: payload.deviceId || payload.device_id || deviceId,
  };
  telemetryService.processAndSaveTelemetry(telemetryData);

  // Mark rover online upon receiving telemetry
  roverService.updateRoverStatus(deviceId, {
    is_online: true,
    last_response: 'Telemetry received via MQTT',
  });
}

function handleStatusMessage(deviceId, payload) {
  // LWT or regular heartbeat
  const isOnline = payload.is_online ?? payload.status === 'online' ?? payload.online ?? true;
  const statusUpdate = {
    is_online: Boolean(isOnline),
    battery_percent: payload.battery_percent ?? payload.battery ?? null,
    signal_rssi: payload.signal_rssi ?? payload.rssi ?? null,
    ip_address: payload.ip_address ?? payload.ip ?? null,
    mode: payload.mode || 'MANUAL',
    last_response: isOnline ? 'Online heartbeat' : 'Device disconnected (LWT)',
  };

  logger.info('ROVER', `Rover ${deviceId} status update: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  roverService.updateRoverStatus(deviceId, statusUpdate);
}

function handleAckMessage(deviceId, payload) {
  const commandIdentifier = payload.commandId || payload.command_id || payload.id;
  const status = payload.status || 'ACKNOWLEDGED';
  const responseMsg = payload.message || payload.response_message || 'Command executed by ESP32';

  if (commandIdentifier) {
    roverService.acknowledgeRoverCommand(commandIdentifier, status, responseMsg);
  } else {
    logger.warn('MQTT', `Ack payload missing commandId: ${JSON.stringify(payload)}`);
  }
}

function publishCommand(deviceId, commandRecord) {
  if (!mqttClient || !isConnected) {
    logger.warn('MQTT', `Cannot publish command: MQTT client disconnected from broker.`);
    return false;
  }

  const topic = MQTT_TOPICS.COMMAND_TOPIC(deviceId);
  const isCapture = commandRecord.command === 'CAPTURE';
  const isSpeed = commandRecord.command === 'SPEED_SET';
  const isLed = commandRecord.command === 'LED_SET';

  const payload = {
    commandId: commandRecord.command_id || String(commandRecord.id),
    command_id: commandRecord.command_id || String(commandRecord.id),
    id: commandRecord.id,
    deviceId: deviceId,
    device_id: deviceId,
    type: isCapture ? 'CAMERA_CAPTURE' : isSpeed ? 'SPEED_SET' : isLed ? 'LED_SET' : 'MOTOR_CONTROL',
    value: isLed ? commandRecord.value : isSpeed ? commandRecord.value : commandRecord.command,
    command: commandRecord.command,
    speed: isSpeed ? commandRecord.value : undefined,
    durationMs: commandRecord.duration_ms || 1000,
    duration_ms: commandRecord.duration_ms || 1000,
    timestamp: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);

  // Publish on device-scoped topic
  mqttClient.publish(topic, payloadString, { qos: 1 }, (err) => {
    if (err) {
      logger.error('MQTT', `Failed to publish command to ${topic}:`, err);
    } else {
      logger.mqtt('PUBLISH', `Dispatched command #${commandRecord.id} [${commandRecord.command}] to ${topic}`);
    }
  });

  // Also publish on functional rover topic
  if (isCapture) {
    mqttClient.publish(MQTT_TOPICS.ROVER_CAMERA_CAPTURE, payloadString, { qos: 1 });
    mqttClient.publish(MQTT_TOPICS.CAMERA_CAPTURE_TOPIC(deviceId), payloadString, { qos: 1 });
  } else {
    mqttClient.publish(MQTT_TOPICS.ROVER_COMMANDS_MOTOR, payloadString, { qos: 1 });
  }

  return true;
}

function publishAiResult(prediction) {
  if (!mqttClient || !isConnected) return false;
  try {
    const payloadString = JSON.stringify({
      device_id: prediction.device_id || config.defaultDeviceId,
      scan_id: prediction.scan_id,
      predicted_class: prediction.predicted_class,
      confidence: prediction.confidence,
      severity: prediction.severity,
      disease_name: prediction.diseaseName,
      is_healthy: prediction.is_healthy,
      image_url: prediction.image_url,
      recommendations: prediction.recommendations,
      timestamp: prediction.timestamp || new Date().toISOString(),
    });

    mqttClient.publish(MQTT_TOPICS.ROVER_AI_RESULTS, payloadString, { qos: 1 });
    mqttClient.publish(MQTT_TOPICS.AI_RESULTS_TOPIC(prediction.device_id || config.defaultDeviceId), payloadString, { qos: 1 });
    logger.mqtt('PUBLISH', `Published AI diagnosis result to ${MQTT_TOPICS.ROVER_AI_RESULTS}`);
    return true;
  } catch (err) {
    logger.error('MQTT', 'Failed to publish AI result:', err);
    return false;
  }
}

module.exports = {
  initMQTT,
  publishCommand,
  publishAiResult,
  isMqttConnected: () => Boolean(isConnected && mqttClient && mqttClient.connected),
  getClient: () => mqttClient,
};
