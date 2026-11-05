const express = require('express');
const router = express.Router();
const overviewController = require('../controllers/overviewController');

router.get('/', overviewController.getOverview);

module.exports = router;
