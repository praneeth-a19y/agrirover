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
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Middleware that accepts any file field name (image, file, photo)
const uploadAnyImage = (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
};

router.post('/detect', uploadAnyImage, diseaseController.predict);
router.post('/predict', uploadAnyImage, diseaseController.predict);
router.post('/upload', uploadAnyImage, (req, res, next) => {
  req.body.source = req.body.source || 'esp32_cam';
  diseaseController.predict(req, res, next);
});

router.get('/scans', diseaseController.getScans);
router.get('/scans/:id', diseaseController.getScanDetail);
router.get('/model-status', diseaseController.getModelStatus);
router.get('/latest-capture', diseaseController.getLatestCapture);

module.exports = {
  router,
  upload,
  uploadAnyImage,
};
