const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables from backend/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const port = parseInt(process.env.PORT || '8000', 10);
const host = process.env.HOST || '0.0.0.0';
const nodeEnv = process.env.NODE_ENV || 'development';

const defaultDeviceId = process.env.DEVICE_ID || process.env.DEFAULT_DEVICE_ID || 'agrirover-01';

// MQTT Configuration
const mqttHost = process.env.MQTT_HOST || 'ed61a166.ala.eu-central-1.emqxsl.com';
const mqttPort = parseInt(process.env.MQTT_PORT || '8883', 10);
const mqttTls = process.env.MQTT_TLS !== 'false' && (process.env.MQTT_TLS === 'true' || mqttPort === 8883);

// Protocol & Broker URL determination
let mqttProtocol = mqttTls ? 'mqtts:' : 'mqtt:';
let brokerUrl = `${mqttProtocol}//${mqttHost}:${mqttPort}`;
if (process.env.MQTT_BROKER_URL && !process.env.MQTT_HOST) {
  brokerUrl = process.env.MQTT_BROKER_URL;
}

// CA Certificate handling
let caCert = (process.env.MQTT_CA_CERT || '').trim();

if (caCert && caCert.includes('-----BEGIN CERTIFICATE-----')) {
  // It's already the raw PEM certificate string
} else {
  // Treat as potential relative or absolute file path
  const candidatePaths = [
    caCert ? path.resolve(process.cwd(), caCert) : null,
    caCert ? path.resolve(__dirname, '..', caCert) : null,
    path.resolve(__dirname, '../certs/emqx-ca.pem'),
    path.resolve(process.cwd(), 'backend/certs/emqx-ca.pem'),
    path.resolve(process.cwd(), 'certs/emqx-ca.pem'),
  ].filter(Boolean);

  let loadedCert = '';
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const content = fs.readFileSync(p, 'utf8').trim();
        if (content.includes('-----BEGIN CERTIFICATE-----')) {
          loadedCert = content;
          break;
        }
      } catch (err) {
        // Continue searching
      }
    }
  }
  caCert = loadedCert;
}

const frontendOrigin = process.env.FRONTEND_ORIGIN || process.env.CORS_ORIGIN || '*';

const config = {
  port,
  host,
  nodeEnv,
  corsOrigin: frontendOrigin,
  frontendOrigin,

  defaultDeviceId,
  defaultFarmId: process.env.DEFAULT_FARM_ID || 'farm-001',
  defaultPlotId: process.env.DEFAULT_PLOT_ID || 'plot-001',

  mqtt: {
    host: mqttHost,
    port: mqttPort,
    tls: mqttTls,
    brokerUrl,
    clientId: process.env.MQTT_CLIENT_ID || `agrirover-backend-${Math.random().toString(16).substring(2, 8)}`,
    username: process.env.MQTT_USERNAME || 'agrirover_backend',
    password: process.env.MQTT_PASSWORD || '',
    caCert: caCert || null,
    keepalive: parseInt(process.env.MQTT_KEEPALIVE || '60', 10),
    reconnectPeriod: parseInt(process.env.MQTT_RECONNECT_PERIOD || '5000', 10),
    connectTimeout: 30 * 1000,
  },

  roverOfflineThresholdSeconds: parseInt(process.env.ROVER_OFFLINE_THRESHOLD_SECONDS || '20', 10),
  simulatedDataEnabled: process.env.SIMULATED_DATA_ENABLED !== 'false',
  dbPath: path.resolve(__dirname, process.env.DB_PATH || '../../agri_rover.db'),
  uploadDir: path.resolve(__dirname, '../static/uploads'),
};

module.exports = config;
