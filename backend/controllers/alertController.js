const alertService = require('../services/alertService');

function getAlerts(req, res, next) {
  try {
    const { acknowledged, severity, limit = 50 } = req.query;
    let ackBool = undefined;
    if (acknowledged !== undefined) {
      ackBool = acknowledged === 'true' || acknowledged === true;
    }

    const alerts = alertService.getAlerts({
      acknowledged: ackBool,
      severity,
      limit,
    });
    res.json(alerts);
  } catch (err) {
    next(err);
  }
}

function acknowledge(req, res, next) {
  try {
    const alertId = parseInt(req.params.id, 10);
    const updated = alertService.acknowledgeAlert(alertId);
    if (!updated) {
      return res.status(404).json({ detail: `Alert #${alertId} not found.` });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

function getConfig(req, res, next) {
  try {
    const config = alertService.getAlertConfig();
    res.json(config);
  } catch (err) {
    next(err);
  }
}

function updateConfig(req, res, next) {
  try {
    const updated = alertService.updateAlertConfig(req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAlerts,
  acknowledge,
  getConfig,
  updateConfig,
};
