const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',

  defaultDeviceId: process.env.DEFAULT_DEVICE_ID || 'rover-001',
  defaultFarmId: process.env.DEFAULT_FARM_ID || 'farm-001',
  defaultPlotId: process.env.DEFAULT_PLOT_ID || 'plot-001',

  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.emqx.io:1883',
    clientId: process.env.MQTT_CLIENT_ID || `agri-backend-${Math.random().toString(16).substring(2, 10)}`,
    username: process.env.MQTT_USERNAME || '',
    password: process.env.MQTT_PASSWORD || '',
    keepalive: parseInt(process.env.MQTT_KEEPALIVE || '60', 10),
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '5000', 10),
    connectTimeout: 30 * 1000,
  },

  roverOfflineThresholdSeconds: parseInt(process.env.ROVER_OFFLINE_THRESHOLD_SECONDS || '15', 10),
  simulatedDataEnabled: process.env.SIMULATED_DATA_ENABLED !== 'false',
  dbPath: path.resolve(__dirname, process.env.DB_PATH || '../../agri_rover.db'),
  uploadDir: path.resolve(__dirname, '../static/uploads'),
};

module.exports = config;
