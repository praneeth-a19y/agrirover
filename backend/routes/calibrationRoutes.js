const express = require('express');
const router = express.Router();
const calibrationController = require('../controllers/calibrationController');

router.get('/', calibrationController.getCalibration);
router.post('/soil-moisture', calibrationController.updateMoisture);
router.post('/soil-ph', calibrationController.updatePH);
router.post('/test', calibrationController.testCalibration);

module.exports = router;
