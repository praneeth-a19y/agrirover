const db = require('../config/db');
const { calibrateSoilMoisture, calibrateSoilPH } = require('../utils/calibrationUtils');

function getCalibration() {
  const moistureRow = db.prepare("SELECT * FROM sensor_calibration WHERE sensor_type = 'capacitive_moisture'").get() || {
    dry_adc: 3200,
    wet_adc: 1400,
    notes: 'Default capacitive moisture 2-point calibration',
  };

  const phRow = db.prepare("SELECT * FROM sensor_calibration WHERE sensor_type = 'analog_ph'").get() || {
    ph4_voltage: 2.50,
    ph7_voltage: 2.00,
    notes: 'Default pH probe 2-point buffer calibration',
  };

  return {
    soil_moisture: {
      dry_adc: moistureRow.dry_adc,
      wet_adc: moistureRow.wet_adc,
      notes: moistureRow.notes,
    },
    soil_ph: {
      ph4_voltage: phRow.ph4_voltage,
      ph7_voltage: phRow.ph7_voltage,
      notes: phRow.notes,
    },
    updated_at: moistureRow.updated_at || new Date().toISOString(),
  };
}

function updateMoistureCalibration(dryAdc, wetAdc, notes = '') {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sensor_calibration
    SET dry_adc = ?, wet_adc = ?, notes = ?, updated_at = ?
    WHERE sensor_type = 'capacitive_moisture'
  `).run(dryAdc, wetAdc, notes, now);
  return getCalibration();
}

function updatePHCalibration(ph4Voltage, ph7Voltage, notes = '') {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE sensor_calibration
    SET ph4_voltage = ?, ph7_voltage = ?, notes = ?, updated_at = ?
    WHERE sensor_type = 'analog_ph'
  `).run(ph4Voltage, ph7Voltage, notes, now);
  return getCalibration();
}

function testCalibration(rawMoistureAdc, rawPhVoltage) {
  const calib = getCalibration();
  let calibratedMoisture = null;
  let calibratedPh = null;

  if (rawMoistureAdc !== undefined && rawMoistureAdc !== null) {
    calibratedMoisture = calibrateSoilMoisture(
      rawMoistureAdc,
      calib.soil_moisture.dry_adc,
      calib.soil_moisture.wet_adc
    );
  }

  if (rawPhVoltage !== undefined && rawPhVoltage !== null) {
    calibratedPh = calibrateSoilPH(
      rawPhVoltage,
      calib.soil_ph.ph4_voltage,
      calib.soil_ph.ph7_voltage
    );
  }

  return {
    calibrated_moisture_percent: calibratedMoisture,
    calibrated_ph: calibratedPh,
  };
}

module.exports = {
  getCalibration,
  updateMoistureCalibration,
  updatePHCalibration,
  testCalibration,
};
