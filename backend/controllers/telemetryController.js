const telemetryService = require('../services/telemetryService');

function getLatest(req, res, next) {
  try {
    const { plot_id } = req.query;
    const data = telemetryService.getLatestTelemetry(plot_id);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function getHistory(req, res, next) {
  try {
    const { plot_id, limit = 50 } = req.query;
    const data = telemetryService.getTelemetryHistory(plot_id, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function ingest(req, res, next) {
  try {
    const saved = telemetryService.processAndSaveTelemetry(req.body);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLatest,
  getHistory,
  ingest,
};
