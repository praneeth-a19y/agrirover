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
  let query = 'SELECT * FROM telemetry WHERE 1=1';
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

function getTelemetryHistory(plotId, limit = 50) {
  let query = 'SELECT * FROM telemetry WHERE 1=1';
  const params = [];
  if (plotId) {
    query += ' AND plot_id = ?';
    params.push(plotId);
  }
  query += ' ORDER BY id DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => ({
    ...r,
    is_simulated: Boolean(r.is_simulated),
  }));
}

module.exports = {
  processAndSaveTelemetry,
  getLatestTelemetry,
  getTelemetryHistory,
};
