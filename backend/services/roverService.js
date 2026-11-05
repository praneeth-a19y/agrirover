const db = require('../config/db');
const config = require('../config/env');
const socketService = require('./socketService');
const logger = require('../utils/logger');

// Forward reference to mqttService to avoid circular dependency
let mqttService = null;
function setMqttService(service) {
  mqttService = service;
}

const VALID_COMMANDS = ['FORWARD', 'BACKWARD', 'LEFT', 'RIGHT', 'STOP', 'EMERGENCY_STOP', 'LED_SET'];

function getRoverStatus(deviceId = config.defaultDeviceId) {
  let rover = db.prepare('SELECT * FROM rover_status WHERE device_id = ?').get(deviceId);
  if (!rover) {
    db.prepare(`
      INSERT INTO rover_status (device_id, name, is_online, battery_percent, signal_rssi, ip_address, mode, last_heartbeat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(deviceId, 'AgriRover Alpha', 0, 85.0, -65, '192.168.1.120', 'MANUAL', new Date().toISOString());
    rover = db.prepare('SELECT * FROM rover_status WHERE device_id = ?').get(deviceId);
  }

  // Calculate staleness based on last heartbeat
  let isStale = true;
  let isLive = Boolean(rover.is_online);
  if (rover.last_heartbeat) {
    const diffSeconds = (Date.now() - new Date(rover.last_heartbeat).getTime()) / 1000;
    if (diffSeconds <= config.roverOfflineThresholdSeconds && rover.is_online) {
      isStale = false;
      isLive = true;
    } else {
      isStale = true;
      isLive = false;
    }
  }

  return {
    ...rover,
    is_online: isLive,
    is_stale: isStale,
  };
}

function updateRoverStatus(deviceId, statusUpdate = {}) {
  const now = new Date().toISOString();
  const existing = getRoverStatus(deviceId);

  const isOnline = statusUpdate.is_online !== undefined ? (statusUpdate.is_online ? 1 : 0) : existing.is_online ? 1 : 0;
  const battery = statusUpdate.battery_percent ?? existing.battery_percent;
  const rssi = statusUpdate.signal_rssi ?? existing.signal_rssi;
  const ip = statusUpdate.ip_address || existing.ip_address;
  const mode = statusUpdate.mode || existing.mode || 'MANUAL';
  const lastCmd = statusUpdate.last_command || existing.last_command;
  const lastResp = statusUpdate.last_response || existing.last_response;

  db.prepare(`
    UPDATE rover_status
    SET is_online = ?, battery_percent = ?, signal_rssi = ?, ip_address = ?,
        mode = ?, last_heartbeat = ?, last_command = ?, last_response = ?
    WHERE device_id = ?
  `).run(isOnline, battery, rssi, ip, mode, now, lastCmd, lastResp, deviceId);

  const updated = getRoverStatus(deviceId);
  socketService.broadcastRoverStatus(updated);
  return updated;
}

function dispatchRoverCommand({ deviceId = config.defaultDeviceId, command, durationMs = 1000, value = null }) {
  const normalizedCmd = String(command).toUpperCase();
  if (!VALID_COMMANDS.includes(normalizedCmd)) {
    throw new Error(`Invalid rover command '${command}'. Permitted: ${VALID_COMMANDS.join(', ')}`);
  }

  const safeDuration = Math.min(Math.max(parseInt(durationMs, 10) || 1000, 100), 15000);
  const now = new Date().toISOString();
  const uniqueCommandId = `cmd-${Date.now()}-${Math.random().toString(16).substring(2, 6)}`;

  // Save command in DB with PENDING status
  const stmt = db.prepare(`
    INSERT INTO rover_commands (command_id, device_id, command, duration_ms, status, issued_at, response_message)
    VALUES (?, ?, ?, ?, 'PENDING', ?, 'Dispatched to MQTT queue')
  `);
  const info = stmt.run(uniqueCommandId, deviceId, normalizedCmd, safeDuration, now);

  const commandRecord = {
    id: info.lastInsertRowid,
    command_id: uniqueCommandId,
    commandId: uniqueCommandId,
    device_id: deviceId,
    deviceId: deviceId,
    command: normalizedCmd,
    type: normalizedCmd,
    duration_ms: safeDuration,
    durationMs: safeDuration,
    value: value ?? safeDuration,
    status: 'PENDING',
    issued_at: now,
    response_message: 'Dispatched to MQTT queue',
  };

  // Update last command on rover status
  db.prepare(`UPDATE rover_status SET last_command = ? WHERE device_id = ?`).run(normalizedCmd, deviceId);

  // Broadcast command issued via Socket.IO
  socketService.broadcastCommandIssued(commandRecord);

  // Publish to MQTT Broker
  if (mqttService) {
    mqttService.publishCommand(deviceId, commandRecord);
  } else {
    logger.warn('ROVER', 'MQTT service not bound yet; command saved to database only.');
  }

  return commandRecord;
}

function acknowledgeRoverCommand(commandIdentifier, status = 'ACKNOWLEDGED', responseMessage = 'Command executed successfully') {
  const now = new Date().toISOString();

  // Command identifier could be numeric ID or string command_id
  let row = null;
  if (!isNaN(commandIdentifier) && Number.isInteger(Number(commandIdentifier))) {
    row = db.prepare('SELECT * FROM rover_commands WHERE id = ?').get(Number(commandIdentifier));
  }
  if (!row) {
    row = db.prepare('SELECT * FROM rover_commands WHERE command_id = ?').get(String(commandIdentifier));
  }

  if (!row) {
    logger.warn('ROVER', `Received ACK for unknown command ID: ${commandIdentifier}`);
    return null;
  }

  const normalizedStatus = status.toUpperCase() === 'EXECUTED' ? 'ACKNOWLEDGED' : status.toUpperCase();

  db.prepare(`
    UPDATE rover_commands
    SET status = ?, acknowledged_at = ?, response_message = ?
    WHERE id = ?
  `).run(normalizedStatus, now, responseMessage, row.id);

  db.prepare(`
    UPDATE rover_status
    SET last_response = ?
    WHERE device_id = ?
  `).run(responseMessage, row.device_id);

  const updatedRecord = {
    ...row,
    id: row.id,
    commandId: row.command_id || String(row.id),
    status: normalizedStatus,
    acknowledged_at: now,
    response_message: responseMessage,
  };

  logger.info('ROVER', `Command #${row.id} (${row.command}) ACKNOWLEDGED: ${responseMessage}`);

  // Broadcast ACK via Socket.IO
  socketService.broadcastCommandAck(updatedRecord);

  return updatedRecord;
}

function getPendingCommands(deviceId = config.defaultDeviceId) {
  return db.prepare(`
    SELECT * FROM rover_commands
    WHERE device_id = ? AND status = 'PENDING'
    ORDER BY id ASC
  `).all(deviceId);
}

function getRoverCommandHistory(limit = 30) {
  return db.prepare(`
    SELECT * FROM rover_commands
    ORDER BY id DESC
    LIMIT ?
  `).all(parseInt(limit, 10));
}

module.exports = {
  setMqttService,
  getRoverStatus,
  updateRoverStatus,
  dispatchRoverCommand,
  acknowledgeRoverCommand,
  getPendingCommands,
  getRoverCommandHistory,
};
