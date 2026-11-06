const db = require('../config/db');
const roverService = require('../services/roverService');
const telemetryService = require('../services/telemetryService');
const alertService = require('../services/alertService');
const mlService = require('../services/mlService');

function getOverview(req, res, next) {
  try {
    const totalFarms = db.prepare('SELECT COUNT(*) as count FROM farms').get().count;
    const totalPlots = db.prepare('SELECT COUNT(*) as count FROM plots').get().count;

    const roverStatus = roverService.getRoverStatus();
    const latestTelemetry = telemetryService.getLatestTelemetry();

    const totalScans = db.prepare('SELECT COUNT(*) as count FROM disease_scans WHERE is_demo = 0').get().count;
    const healthyScans = db.prepare('SELECT COUNT(*) as count FROM disease_scans WHERE is_healthy = 1 AND is_demo = 0').get().count;
    const diseasedScans = totalScans - healthyScans;

    const latestScan = db.prepare('SELECT * FROM disease_scans WHERE is_demo = 0 ORDER BY timestamp DESC LIMIT 1').get() || null;
    const recentAlerts = alertService.getAlerts({ limit: 10 });
    const activeAlertsCount = db.prepare('SELECT COUNT(*) as count FROM alerts WHERE acknowledged = 0').get().count;

    // Check system setting for demo mode
    const demoSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'is_demo_mode'").get();
    const isDemoMode = demoSetting ? demoSetting.value === 'true' : false;

    const modelStatus = mlService.getModelStatus();

    const summary = {
      total_farms: totalFarms,
      total_plots: totalPlots,
      rover_status: roverStatus,
      latest_telemetry: latestTelemetry,
      latest_scan: latestScan
        ? {
            ...latestScan,
            is_healthy: Boolean(latestScan.is_healthy),
            is_demo: Boolean(latestScan.is_demo),
          }
        : null,
      total_scans: totalScans,
      healthy_scans: healthyScans,
      diseased_scans: diseasedScans,
      active_alerts_count: activeAlertsCount,
      recent_alerts: recentAlerts,
      is_demo_mode: isDemoMode,
      model_status: modelStatus,
    };

    res.json(summary);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getOverview,
};
