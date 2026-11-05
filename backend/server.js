const http = require('http');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config/env');
const logger = require('./utils/logger');
require('./config/db'); // Initialize DB & tables
const { securityHeaders } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');

const apiRoutes = require('./routes/apiRoutes');
const { upload } = require('./routes/diseaseRoutes');
const diseaseController = require('./controllers/diseaseController');

const { initSocketIO } = require('./services/socketService');
const { initMQTT, isMqttConnected } = require('./services/mqttService');

const app = express();

// 1. Cross-Origin Resource Sharing
app.use(
  cors({
    origin: config.corsOrigin === '*' ? '*' : [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  })
);

// 2. Request Parsers & Security Headers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(securityHeaders);

// 3. Static Media Directory
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}
app.use('/static/uploads', express.static(config.uploadDir));
app.use('/static', express.static(path.resolve(__dirname, 'static')));

// 4. API v1 Namespace
app.use('/api/v1', apiRoutes);

// 5. Root-level Compatibility Routes (ESP32-CAM & Direct Predictors)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Smart Agriculture Rover IoT Backend',
    timestamp: new Date().toISOString(),
    mqtt_connected: isMqttConnected(),
    mqtt_broker: config.mqtt.brokerUrl,
    node_version: process.version,
  });
});

app.post('/predict', upload.single('file'), diseaseController.predict);
app.post('/upload', upload.single('image'), (req, res, next) => {
  req.file = req.file || req.files?.image;
  req.body.source = 'esp32_cam';
  diseaseController.predict(req, res, next);
});

// 6. Centralized Error Handler
app.use(errorHandler);

// 7. Create HTTP Server & Bind Real-Time Services
const httpServer = http.createServer(app);
initSocketIO(httpServer);
initMQTT();

// 8. Start Listening
httpServer.listen(config.port, config.host, () => {
  logger.info('SERVER', `Smart Agriculture Rover Backend listening on http://${config.host}:${config.port}`);
  logger.info('SERVER', `Swagger/Health endpoint: http://${config.host}:${config.port}/health`);
  logger.info('SERVER', `MQTT Broker connection active on: ${config.mqtt.brokerUrl}`);
});

// 9. Graceful Shutdown Handlers
function shutdown(signal) {
  logger.info('SHUTDOWN', `Received ${signal}. Shutting down services gracefully...`);
  httpServer.close(() => {
    logger.info('SHUTDOWN', 'HTTP and Socket.IO server closed.');
    process.exit(0);
  });
  // Force exit after 3 seconds if pending connections hang
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = { app, httpServer };
