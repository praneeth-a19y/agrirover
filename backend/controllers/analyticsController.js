const db = require('../config/db');

function getTimeseries(req, res, next) {
  try {
    const { range_filter = '24h', plot_id } = req.query;

    let limit = 48;
    if (range_filter === '1h') limit = 12;
    if (range_filter === '6h') limit = 24;
    if (range_filter === '7d') limit = 100;

    let query = 'SELECT * FROM telemetry WHERE 1=1';
    const params = [];
    if (plot_id) {
      query += ' AND plot_id = ?';
      params.push(plot_id);
    }
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params).reverse();
    res.json(rows.map((r) => ({
      ...r,
      is_simulated: Boolean(r.is_simulated),
    })));
  } catch (err) {
    next(err);
  }
}

function getDiseaseDistribution(req, res, next) {
  try {
    const { plot_id } = req.query;
    let query = 'SELECT predicted_class, is_healthy, COUNT(*) as count FROM disease_scans WHERE 1=1';
    const params = [];
    if (plot_id) {
      query += ' AND plot_id = ?';
      params.push(plot_id);
    }
    query += ' GROUP BY predicted_class, is_healthy';

    const rows = db.prepare(query).all(...params);

    let total = 0;
    let healthyCount = 0;
    let diseasedCount = 0;

    const breakdown = rows.map((r) => {
      total += r.count;
      if (r.is_healthy) {
        healthyCount += r.count;
      } else {
        diseasedCount += r.count;
      }
      return {
        name: r.predicted_class.replace(/___/g, ' - ').replace(/_/g, ' '),
        count: r.count,
      };
    });

    const healthRate = total > 0 ? (healthyCount / total) * 100.0 : 100.0;

    res.json({
      total_scans: total,
      healthy_count: healthyCount,
      diseased_count: diseasedCount,
      health_rate_percent: Math.round(healthRate * 10) / 10,
      breakdown,
    });
  } catch (err) {
    next(err);
  }
}

function exportCsv(req, res, next) {
  try {
    const { data_type = 'telemetry', plot_id } = req.query;

    if (data_type === 'telemetry') {
      let query = 'SELECT * FROM telemetry WHERE 1=1';
      const params = [];
      if (plot_id) {
        query += ' AND plot_id = ?';
        params.push(plot_id);
      }
      query += ' ORDER BY id DESC LIMIT 500';

      const rows = db.prepare(query).all(...params);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="telemetry_export.csv"');

      let csv = 'id,device_id,farm_id,plot_id,temperature_c,humidity_percent,soil_moisture_percent,soil_ph,is_simulated,timestamp\n';
      for (const r of rows) {
        csv += `${r.id},${r.device_id},${r.farm_id},${r.plot_id},${r.temperature_c},${r.humidity_percent},${r.soil_moisture_percent},${r.soil_ph},${r.is_simulated},"${r.timestamp}"\n`;
      }
      return res.send(csv);
    }

    // Scans export
    let query = 'SELECT * FROM disease_scans WHERE 1=1';
    const params = [];
    if (plot_id) {
      query += ' AND plot_id = ?';
      params.push(plot_id);
    }
    query += ' ORDER BY timestamp DESC LIMIT 500';

    const rows = db.prepare(query).all(...params);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="disease_scans_export.csv"');

    let csv = 'id,device_id,farm_id,plot_id,predicted_class,confidence,severity,is_healthy,timestamp\n';
    for (const r of rows) {
      csv += `${r.id},${r.device_id},${r.farm_id},${r.plot_id},"${r.predicted_class}",${r.confidence},${r.severity},${r.is_healthy},"${r.timestamp}"\n`;
    }
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getTimeseries,
  getDiseaseDistribution,
  exportCsv,
};
