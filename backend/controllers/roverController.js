const roverService = require('../services/roverService');
const config = require('../config/env');

function getStatus(req, res, next) {
  try {
    const deviceId = req.query.device_id || config.defaultDeviceId;
    const status = roverService.getRoverStatus(deviceId);
    res.json(status);
  } catch (err) {
    next(err);
  }
}

function updateStatus(req, res, next) {
  try {
    const deviceId = req.body.device_id || req.body.deviceId || config.defaultDeviceId;
    const updated = roverService.updateRoverStatus(deviceId, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function sendCommand(req, res, next) {
  try {
    const { device_id, deviceId, command, duration_ms, durationMs, value } = req.body;
    const targetDevice = device_id || deviceId || config.defaultDeviceId;
    const duration = duration_ms ?? durationMs ?? 1000;

    const cmd = roverService.dispatchRoverCommand({
      deviceId: targetDevice,
      command,
      durationMs: duration,
      value,
    });

    res.status(201).json(cmd);
  } catch (err) {
    next(err);
  }
}

function getPending(req, res, next) {
  try {
    const deviceId = req.query.device_id || config.defaultDeviceId;
    // Heartbeat update since ESP32 is polling
    roverService.updateRoverStatus(deviceId, {
      is_online: true,
      last_response: 'ESP32 polled pending commands',
    });
    const pending = roverService.getPendingCommands(deviceId);
    res.json(pending);
  } catch (err) {
    next(err);
  }
}

function ackCommand(req, res, next) {
  try {
    const commandId = req.params.id;
    const status = req.body.status || 'ACKNOWLEDGED';
    const message = req.body.response_message || req.body.message || 'Motor actuation executed';

    const updated = roverService.acknowledgeRoverCommand(commandId, status, message);
    if (!updated) {
      return res.status(404).json({ detail: `Command ${commandId} not found.` });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function getCommandHistory(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '30', 10);
    const history = roverService.getRoverCommandHistory(limit);
    res.json(history);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStatus,
  updateStatus,
  sendCommand,
  getPending,
  ackCommand,
  getCommandHistory,
};
