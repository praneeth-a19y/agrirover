const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/timeseries', analyticsController.getTimeseries);
router.get('/disease-distribution', analyticsController.getDiseaseDistribution);
router.get('/export/csv', analyticsController.exportCsv);

module.exports = router;
