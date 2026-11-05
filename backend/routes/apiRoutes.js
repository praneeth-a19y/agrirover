const express = require('express');
const router = express.Router();

const overviewRoutes = require('./overviewRoutes');
const telemetryRoutes = require('./telemetryRoutes');
const roverRoutes = require('./roverRoutes');
const { router: diseaseRoutes } = require('./diseaseRoutes');
const farmRoutes = require('./farmRoutes');
const alertRoutes = require('./alertRoutes');
const calibrationRoutes = require('./calibrationRoutes');
const analyticsRoutes = require('./analyticsRoutes');
const demoRoutes = require('./demoRoutes');

router.use('/overview', overviewRoutes);
router.use('/telemetry', telemetryRoutes);
router.use('/rover', roverRoutes);
router.use('/disease', diseaseRoutes);
router.use('/farms', farmRoutes);
router.use('/alerts', alertRoutes);
router.use('/calibration', calibrationRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/demo', demoRoutes);

module.exports = router;
