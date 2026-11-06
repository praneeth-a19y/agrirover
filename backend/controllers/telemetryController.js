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
    const { plot_id, limit = 50, range = 'day' } = req.query;
    const data = telemetryService.getTelemetryHistory({
      plotId: plot_id,
      limit,
      range,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

function getStats(req, res, next) {
  try {
    const { plot_id, range = 'day' } = req.query;
    const stats = telemetryService.getTelemetryStats({
      plotId: plot_id,
      range,
    });
    res.json(stats);
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
  getStats,
  ingest,
};
