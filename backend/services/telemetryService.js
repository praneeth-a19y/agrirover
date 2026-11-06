const db = require('../config/db');
const calibrationService = require('./calibrationService');
const alertService = require('./alertService');
const socketService = require('./socketService');
const { calibrateSoilMoisture, calibrateSoilPH } = require('../utils/calibrationUtils');
const logger = require('../utils/logger');

function processAndSaveTelemetry(payload) {
  const deviceId = payload.deviceId || payload.device_id || 'rover-001';
  const farmId = payload.farmId || payload.farm_id || 'farm-001';
  const plotId = payload.plotId || payload.plot_id || 'plot-001';
  const isSimulated = Boolean(payload.isSimulated ?? payload.is_simulated ?? false);
  const timestamp = payload.timestamp || new Date().toISOString();

  let tempC = payload.temperature ?? payload.temperature_c ?? null;
  let humPercent = payload.humidity ?? payload.humidity_percent ?? null;
  let rawMoistureAdc = payload.rawMoistureAdc ?? payload.raw_moisture_adc ?? null;
  let rawPhVoltage = payload.rawPhVoltage ?? payload.raw_ph_voltage ?? null;
  let soilMoisture = payload.soilMoisture ?? payload.soil_moisture_percent ?? null;
  let soilPh = payload.soilPh ?? payload.soil_ph ?? null;

  // Calibrate raw readings if calibrated values not explicitly provided
  const calib = calibrationService.getCalibration();
  if (soilMoisture === null && rawMoistureAdc !== null) {
    soilMoisture = calibrateSoilMoisture(rawMoistureAdc, calib.soil_moisture.dry_adc, calib.soil_moisture.wet_adc);
  }
  if (soilPh === null && rawPhVoltage !== null) {
    soilPh = calibrateSoilPH(rawPhVoltage, calib.soil_ph.ph4_voltage, calib.soil_ph.ph7_voltage);
  }

  // Insert into SQLite
  const stmt = db.prepare(`
    INSERT INTO telemetry (
      device_id, farm_id, plot_id,
      temperature_c, humidity_percent, soil_moisture_percent, soil_ph,
      raw_moisture_adc, raw_ph_voltage, is_simulated, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    deviceId,
    farmId,
    plotId,
    tempC,
    humPercent,
    soilMoisture,
    soilPh,
    rawMoistureAdc,
    rawPhVoltage,
    isSimulated ? 1 : 0,
    timestamp
  );

  const savedRecord = {
    id: info.lastInsertRowid,
    device_id: deviceId,
    farm_id: farmId,
    plot_id: plotId,
    temperature_c: tempC,
    humidity_percent: humPercent,
    soil_moisture_percent: soilMoisture,
    soil_ph: soilPh,
    raw_moisture_adc: rawMoistureAdc,
    raw_ph_voltage: rawPhVoltage,
    is_simulated: isSimulated,
    timestamp,
  };

  // Check alerts
  alertService.checkTelemetryAlerts(savedRecord);

  // Broadcast real-time over Socket.IO
  socketService.broadcastTelemetry(savedRecord);

  return savedRecord;
}

function getLatestTelemetry(plotId) {
  let query = 'SELECT * FROM telemetry WHERE is_simulated = 0';
  const params = [];
  if (plotId) {
    query += ' AND plot_id = ?';
    params.push(plotId);
  }
  query += ' ORDER BY id DESC LIMIT 1';
  const row = db.prepare(query).get(...params);
  if (!row) return null;
  return {
    ...row,
    is_simulated: Boolean(row.is_simulated),
  };
}

function getTelemetryHistory(options = {}) {
  // Support either (plotId, limit) legacy signature or options object
  let plotId = null;
  let limit = 50;
  let range = 'day';

  if (typeof options === 'string' || typeof options === 'number') {
    plotId = options;
    if (arguments[1]) limit = arguments[1];
  } else if (options && typeof options === 'object') {
    plotId = options.plotId || options.plot_id || null;
    limit = options.limit || 50;
    range = options.range || 'day';
  }

  let query = 'SELECT * FROM telemetry WHERE is_simulated = 0';
  const params = [];
  if (plotId) {
    query += ' AND plot_id = ?';
    params.push(plotId);
  }

  if (range === 'day' || range === 'daily') {
    query += " AND datetime(timestamp) >= datetime('now', '-1 day')";
  } else if (range === 'week' || range === 'weekly') {
    query += " AND datetime(timestamp) >= datetime('now', '-7 days')";
  } else if (range === 'month' || range === 'monthly') {
    query += " AND datetime(timestamp) >= datetime('now', '-30 days')";
  }

  query += ' ORDER BY id DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  let rows = db.prepare(query).all(...params);

  // If no rows found within the specific time-window, fall back to recent non-simulated records
  if (rows.length === 0) {
    const fallbackQuery = plotId
      ? 'SELECT * FROM telemetry WHERE is_simulated = 0 AND plot_id = ? ORDER BY id DESC LIMIT ?'
      : 'SELECT * FROM telemetry WHERE is_simulated = 0 ORDER BY id DESC LIMIT ?';
    const fallbackParams = plotId ? [plotId, parseInt(limit, 10)] : [parseInt(limit, 10)];
    rows = db.prepare(fallbackQuery).all(...fallbackParams);
  }

  return rows.map((r) => ({
    ...r,
    is_simulated: Boolean(r.is_simulated),
  }));
}

function getTelemetryStats(options = {}) {
  const plotId = options.plotId || options.plot_id || null;
  const range = options.range || 'day';

  let query = `
    SELECT
      MIN(temperature_c) as min_temp,
      MAX(temperature_c) as max_temp,
      AVG(temperature_c) as avg_temp,
      MIN(humidity_percent) as min_hum,
      MAX(humidity_percent) as max_hum,
      AVG(humidity_percent) as avg_hum,
      COUNT(*) as count
    FROM telemetry
    WHERE is_simulated = 0 AND temperature_c IS NOT NULL
  `;
  const params = [];
  if (plotId) {
    query += ' AND plot_id = ?';
    params.push(plotId);
  }

  if (range === 'day' || range === 'daily') {
    query += " AND datetime(timestamp) >= datetime('now', '-1 day')";
  } else if (range === 'week' || range === 'weekly') {
    query += " AND datetime(timestamp) >= datetime('now', '-7 days')";
  } else if (range === 'month' || range === 'monthly') {
    query += " AND datetime(timestamp) >= datetime('now', '-30 days')";
  }

  let stats = db.prepare(query).get(...params);
  if (!stats || stats.count === 0) {
    const fallbackQuery = plotId
      ? 'SELECT MIN(temperature_c) as min_temp, MAX(temperature_c) as max_temp, AVG(temperature_c) as avg_temp, MIN(humidity_percent) as min_hum, MAX(humidity_percent) as max_hum, AVG(humidity_percent) as avg_hum, COUNT(*) as count FROM telemetry WHERE is_simulated = 0 AND temperature_c IS NOT NULL AND plot_id = ?'
      : 'SELECT MIN(temperature_c) as min_temp, MAX(temperature_c) as max_temp, AVG(temperature_c) as avg_temp, MIN(humidity_percent) as min_hum, MAX(humidity_percent) as max_hum, AVG(humidity_percent) as avg_hum, COUNT(*) as count FROM telemetry WHERE is_simulated = 0 AND temperature_c IS NOT NULL';
    const fallbackParams = plotId ? [plotId] : [];
    stats = db.prepare(fallbackQuery).get(...fallbackParams);
  }

  return {
    range,
    count: stats?.count || 0,
    temperature: {
      min: stats?.min_temp != null ? Math.round(stats.min_temp * 10) / 10 : null,
      max: stats?.max_temp != null ? Math.round(stats.max_temp * 10) / 10 : null,
      avg: stats?.avg_temp != null ? Math.round(stats.avg_temp * 10) / 10 : null,
    },
    humidity: {
      min: stats?.min_hum != null ? Math.round(stats.min_hum * 10) / 10 : null,
      max: stats?.max_hum != null ? Math.round(stats.max_hum * 10) / 10 : null,
      avg: stats?.avg_hum != null ? Math.round(stats.avg_hum * 10) / 10 : null,
    },
  };
}

module.exports = {
  processAndSaveTelemetry,
  getLatestTelemetry,
  getTelemetryHistory,
  getTelemetryStats,
};
