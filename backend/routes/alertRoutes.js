const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

router.get('/', alertController.getAlerts);
router.post('/:id/ack', alertController.acknowledge);
router.get('/config', alertController.getConfig);
router.put('/config', alertController.updateConfig);

module.exports = router;
