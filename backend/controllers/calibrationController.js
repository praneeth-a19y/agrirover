const calibrationService = require('../services/calibrationService');

function getCalibration(req, res, next) {
  try {
    const data = calibrationService.getCalibration();
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function updateMoisture(req, res, next) {
  try {
    const { dry_adc, wet_adc, notes } = req.body;
    if (dry_adc === undefined || wet_adc === undefined) {
      return res.status(400).json({ detail: 'dry_adc and wet_adc are required.' });
    }
    const updated = calibrationService.updateMoistureCalibration(dry_adc, wet_adc, notes);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function updatePH(req, res, next) {
  try {
    const { ph4_voltage, ph7_voltage, notes } = req.body;
    if (ph4_voltage === undefined || ph7_voltage === undefined) {
      return res.status(400).json({ detail: 'ph4_voltage and ph7_voltage are required.' });
    }
    const updated = calibrationService.updatePHCalibration(ph4_voltage, ph7_voltage, notes);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function testCalibration(req, res, next) {
  try {
    const { raw_moisture_adc, raw_ph_voltage } = req.body;
    const result = calibrationService.testCalibration(raw_moisture_adc, raw_ph_voltage);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCalibration,
  updateMoisture,
  updatePH,
  testCalibration,
};
