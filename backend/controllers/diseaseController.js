const mlService = require('../services/mlService');

function predict(req, res, next) {
  try {
    const file = req.file;
    const metadata = {
      device_id: req.body.device_id || 'rover-001',
      farm_id: req.body.farm_id || 'farm-001',
      plot_id: req.body.plot_id || 'plot-001',
      row_id: req.body.row_id || 'Row-A',
      is_demo: req.body.is_demo === 'true' || req.body.is_demo === true,
      source: req.body.source || 'web_upload',
    };

    const result = mlService.diagnoseLeafImage(file, metadata);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

function getScans(req, res, next) {
  try {
    const { plot_id, is_healthy, limit = 50 } = req.query;
    let healthyBool = undefined;
    if (is_healthy !== undefined) {
      healthyBool = is_healthy === 'true' || is_healthy === true;
    }

    const scans = mlService.getDiseaseScans({
      plotId: plot_id,
      isHealthy: healthyBool,
      limit,
    });
    res.json(scans);
  } catch (err) {
    next(err);
  }
}

function getScanDetail(req, res, next) {
  try {
    const scan = mlService.getDiseaseScanDetail(req.params.id);
    if (!scan) {
      return res.status(404).json({ detail: `Scan #${req.params.id} not found.` });
    }
    res.json(scan);
  } catch (err) {
    next(err);
  }
}

function getModelStatus(req, res, next) {
  try {
    const status = mlService.getModelStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
}

function getLatestCapture(req, res, next) {
  try {
    const capture = mlService.getLatestCapture();
    res.json(capture);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  predict,
  getScans,
  getScanDetail,
  getModelStatus,
  getLatestCapture,
};
