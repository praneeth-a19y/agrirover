const express = require('express');
const router = express.Router();
const roverController = require('../controllers/roverController');
const { validateCommandPayload } = require('../middleware/validator');
const { commandRateLimiter } = require('../middleware/security');

router.get('/status', roverController.getStatus);
router.post('/status', roverController.updateStatus);

router.post('/commands', commandRateLimiter, validateCommandPayload, roverController.sendCommand);
router.get('/commands/pending', roverController.getPending);
router.post('/commands/:id/ack', roverController.ackCommand);
router.get('/commands/history', roverController.getCommandHistory);

module.exports = router;
