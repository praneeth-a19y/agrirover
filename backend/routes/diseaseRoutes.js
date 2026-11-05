const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const diseaseController = require('../controllers/diseaseController');
const config = require('../config/env');

if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `leaf_${Date.now()}_${Math.random().toString(16).substring(2, 6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.post('/predict', upload.single('file'), diseaseController.predict);
router.get('/scans', diseaseController.getScans);
router.get('/scans/:id', diseaseController.getScanDetail);
router.get('/model-status', diseaseController.getModelStatus);
router.get('/latest-capture', diseaseController.getLatestCapture);

module.exports = {
  router,
  upload,
};
