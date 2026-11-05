const { Server } = require('socket.io');
const logger = require('../utils/logger');
const config = require('../config/env');

let ioInstance = null;

function initSocketIO(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin === '*' ? '*' : [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance.on('connection', (socket) => {
    logger.socket('CONNECTION', `Client connected: ${socket.id} (Total: ${ioInstance.engine.clientsCount})`);

    socket.on('disconnect', (reason) => {
      logger.socket('DISCONNECT', `Client disconnected: ${socket.id} (Reason: ${reason})`);
    });

    socket.on('ping_rover', (data) => {
      socket.emit('pong_rover', { timestamp: new Date().toISOString(), server: 'agri-rover-iot' });
    });
  });

  logger.info('SOCKET', 'Socket.IO real-time server initialized successfully');
  return ioInstance;
}

function getIO() {
  return ioInstance;
}

function broadcastRoverStatus(statusData) {
  if (!ioInstance) return;
  ioInstance.emit('rover:status', statusData);
  // Also emit legacy name for broad compatibility
  ioInstance.emit('rover_status', statusData);
}

function broadcastTelemetry(telemetryData) {
  if (!ioInstance) return;
  ioInstance.emit('rover:telemetry', telemetryData);
  ioInstance.emit('rover_telemetry', telemetryData);
}

function broadcastCommandIssued(commandData) {
  if (!ioInstance) return;
  ioInstance.emit('rover:command:issued', commandData);
  ioInstance.emit('rover_command_issued', commandData);
}

function broadcastCommandAck(ackData) {
  if (!ioInstance) return;
  ioInstance.emit('rover:command:ack', ackData);
  ioInstance.emit('rover_command_ack', ackData);
}

function broadcastAlert(alertData) {
  if (!ioInstance) return;
  ioInstance.emit('rover:alert', alertData);
  ioInstance.emit('rover_alert', alertData);
}

module.exports = {
  initSocketIO,
  getIO,
  broadcastRoverStatus,
  broadcastTelemetry,
  broadcastCommandIssued,
  broadcastCommandAck,
  broadcastAlert,
};
