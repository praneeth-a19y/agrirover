const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demoController');

router.post('/toggle', demoController.toggleDemo);
router.post('/telemetry-tick', demoController.telemetryTick);
router.post('/seed', demoController.seedDemoData);
router.post('/clear-simulated', demoController.clearSimulated);

module.exports = router;
