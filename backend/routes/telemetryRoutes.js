const express = require('express');
const router = express.Router();
const telemetryController = require('../controllers/telemetryController');
const { validateTelemetryPayload } = require('../middleware/validator');

router.get('/latest', telemetryController.getLatest);
router.get('/history', telemetryController.getHistory);
router.post('/', validateTelemetryPayload, telemetryController.ingest);

module.exports = router;
