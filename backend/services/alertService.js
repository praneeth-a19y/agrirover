const db = require('../config/db');
const logger = require('../utils/logger');
const socketService = require('./socketService');

function getAlertConfig() {
  const conf = db.prepare('SELECT * FROM alert_config WHERE id = 1').get();
  if (conf) return conf;
  return {
    moisture_min: 25.0,
    moisture_max: 75.0,
    ph_min: 6.0,
    ph_max: 7.5,
    temp_min: 12.0,
    temp_max: 36.0,
    humidity_min: 35.0,
    humidity_max: 85.0,
    disease_confidence_threshold: 0.65,
  };
}

function updateAlertConfig(payload) {
  db.prepare(`
    UPDATE alert_config
    SET moisture_min = ?, moisture_max = ?, ph_min = ?, ph_max = ?,
        temp_min = ?, temp_max = ?, humidity_min = ?, humidity_max = ?,
        disease_confidence_threshold = ?
    WHERE id = 1
  `).run(
    payload.moisture_min,
    payload.moisture_max,
    payload.ph_min,
    payload.ph_max,
    payload.temp_min,
    payload.temp_max,
    payload.humidity_min,
    payload.humidity_max,
    payload.disease_confidence_threshold || 0.65
  );
  return getAlertConfig();
}

function checkTelemetryAlerts(telemetry) {
  const conf = getAlertConfig();
  const alertsToInsert = [];

  // Soil Moisture Check
  if (telemetry.soil_moisture_percent !== null && telemetry.soil_moisture_percent !== undefined) {
    if (telemetry.soil_moisture_percent < conf.moisture_min) {
      alertsToInsert.push({
        type: 'LOW_SOIL_MOISTURE',
        severity: 'WARNING',
        title: 'Critical Soil Drought Detected',
        message: `Soil moisture dropped to ${telemetry.soil_moisture_percent.toFixed(1)}% (Threshold minimum: ${conf.moisture_min}%). Irrigation needed.`,
        value: telemetry.soil_moisture_percent,
        threshold: conf.moisture_min,
      });
    } else if (telemetry.soil_moisture_percent > conf.moisture_max) {
      alertsToInsert.push({
        type: 'HIGH_SOIL_MOISTURE',
        severity: 'WARNING',
        title: 'Soil Waterlogging Detected',
        message: `Soil moisture saturated at ${telemetry.soil_moisture_percent.toFixed(1)}% (Threshold maximum: ${conf.moisture_max}%). Root hypoxia risk.`,
        value: telemetry.soil_moisture_percent,
        threshold: conf.moisture_max,
      });
    }
  }

  // Soil pH Check
  if (telemetry.soil_ph !== null && telemetry.soil_ph !== undefined) {
    if (telemetry.soil_ph < conf.ph_min) {
      alertsToInsert.push({
        type: 'ACIDIC_SOIL',
        severity: 'WARNING',
        title: 'Soil Acidification Detected',
        message: `Soil pH measured at ${telemetry.soil_ph.toFixed(2)} (Safe range: ${conf.ph_min} - ${conf.ph_max}). Lime treatment recommended.`,
        value: telemetry.soil_ph,
        threshold: conf.ph_min,
      });
    } else if (telemetry.soil_ph > conf.ph_max) {
      alertsToInsert.push({
        type: 'ALKALINE_SOIL',
        severity: 'WARNING',
        title: 'Soil Alkalinity Detected',
        message: `Soil pH measured at ${telemetry.soil_ph.toFixed(2)} (Safe range: ${conf.ph_min} - ${conf.ph_max}). Elemental sulfur recommended.`,
        value: telemetry.soil_ph,
        threshold: conf.ph_max,
      });
    }
  }

  // Temperature Check
  if (telemetry.temperature_c !== null && telemetry.temperature_c !== undefined) {
    if (telemetry.temperature_c > conf.temp_max) {
      alertsToInsert.push({
        type: 'HEAT_STRESS',
        severity: 'CRITICAL',
        title: 'High Canopy Heat Stress',
        message: `Ambient temperature reached ${telemetry.temperature_c.toFixed(1)}°C (Exceeds upper limit: ${conf.temp_max}°C).`,
        value: telemetry.temperature_c,
        threshold: conf.temp_max,
      });
    }
  }

  // Persist alerts and broadcast via Socket.IO
  const insertStmt = db.prepare(`
    INSERT INTO alerts (alert_type, severity, farm_id, plot_id, title, message, reading_value, threshold_value, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of alertsToInsert) {
    const timestamp = new Date().toISOString();
    const info = insertStmt.run(
      a.type,
      a.severity,
      telemetry.farm_id || 'farm-001',
      telemetry.plot_id || 'plot-001',
      a.title,
      a.message,
      a.value,
      a.threshold,
      timestamp
    );

    const alertRecord = {
      id: info.lastInsertRowid,
      alert_type: a.type,
      severity: a.severity,
      farm_id: telemetry.farm_id || 'farm-001',
      plot_id: telemetry.plot_id || 'plot-001',
      title: a.title,
      message: a.message,
      reading_value: a.value,
      threshold_value: a.threshold,
      acknowledged: false,
      timestamp,
    };

    logger.warn('ALERT', `[${a.severity}] ${a.title}: ${a.message}`);
    socketService.broadcastAlert(alertRecord);
  }
}

function getAlerts({ acknowledged, severity, limit = 50 }) {
  let query = 'SELECT * FROM alerts WHERE 1=1';
  const params = [];

  if (acknowledged !== undefined && acknowledged !== null) {
    query += ' AND acknowledged = ?';
    params.push(acknowledged ? 1 : 0);
  }

  if (severity) {
    query += ' AND severity = ?';
    params.push(severity);
  }

  query += ' ORDER BY id DESC LIMIT ?';
  params.push(parseInt(limit, 10));

  const rows = db.prepare(query).all(...params);
  return rows.map((r) => ({
    ...r,
    acknowledged: Boolean(r.acknowledged),
  }));
}

function acknowledgeAlert(alertId) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE alerts
    SET acknowledged = 1, acknowledged_at = ?
    WHERE id = ?
  `).run(now, alertId);

  const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
  return updated ? { ...updated, acknowledged: Boolean(updated.acknowledged) } : null;
}

module.exports = {
  getAlertConfig,
  updateAlertConfig,
  checkTelemetryAlerts,
  getAlerts,
  acknowledgeAlert,
};
