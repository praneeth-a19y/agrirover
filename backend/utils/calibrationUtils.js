/**
 * Sensor Calibration Utilities
 * Provides mathematical conversions between raw ADC/voltage and physical calibrated units.
 */

function calibrateSoilMoisture(rawAdc, dryAdc = 3200.0, wetAdc = 1400.0) {
  if (rawAdc === null || rawAdc === undefined || isNaN(rawAdc)) {
    return null;
  }
  if (dryAdc === wetAdc) {
    return 50.0;
  }
  // Lower ADC reading indicates higher water moisture
  const percent = ((dryAdc - rawAdc) / (dryAdc - wetAdc)) * 100.0;
  return Math.min(Math.max(Math.round(percent * 10) / 10, 0.0), 100.0);
}

function calibrateSoilPH(rawVoltage, ph4Voltage = 2.50, ph7Voltage = 2.00) {
  if (rawVoltage === null || rawVoltage === undefined || isNaN(rawVoltage)) {
    return null;
  }
  if (ph4Voltage === ph7Voltage) {
    return 7.0;
  }
  // Standard linear Nernstian electrode response
  const slope = (4.0 - 7.0) / (ph4Voltage - ph7Voltage);
  const ph = 7.0 + (rawVoltage - ph7Voltage) * slope;
  return Math.min(Math.max(Math.round(ph * 100) / 100, 0.0), 14.0);
}

module.exports = {
  calibrateSoilMoisture,
  calibrateSoilPH,
};
