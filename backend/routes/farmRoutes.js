const express = require('express');
const router = express.Router();
const farmController = require('../controllers/farmController');

router.get('/', farmController.getFarms);
router.post('/', farmController.createFarm);
router.get('/plots', farmController.getPlots);
router.post('/plots', farmController.createPlot);
router.get('/plots/:id/summary', farmController.getPlotSummary);

module.exports = router;
