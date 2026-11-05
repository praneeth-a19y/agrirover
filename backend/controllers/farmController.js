const db = require('../config/db');

function getFarms(req, res, next) {
  try {
    const farms = db.prepare('SELECT * FROM farms ORDER BY created_at DESC').all();
    const plots = db.prepare('SELECT * FROM plots').all();

    const result = farms.map((f) => ({
      ...f,
      plots: plots.filter((p) => p.farm_id === f.id),
    }));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

function createFarm(req, res, next) {
  try {
    const { id, name, location, area_acres = 1.0, notes = '' } = req.body;
    if (!id || !name || !location) {
      return res.status(400).json({ detail: 'Missing required farm fields: id, name, location.' });
    }

    db.prepare(`
      INSERT INTO farms (id, name, location, area_acres, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, location, area_acres, notes);

    const farm = db.prepare('SELECT * FROM farms WHERE id = ?').get(id);
    res.status(201).json({ ...farm, plots: [] });
  } catch (err) {
    next(err);
  }
}

function getPlots(req, res, next) {
  try {
    const { farm_id } = req.query;
    let query = 'SELECT * FROM plots';
    const params = [];
    if (farm_id) {
      query += ' WHERE farm_id = ?';
      params.push(farm_id);
    }
    const plots = db.prepare(query).all(...params);
    res.json(plots);
  } catch (err) {
    next(err);
  }
}

function createPlot(req, res, next) {
  try {
    const {
      id,
      farm_id,
      name,
      crop_type,
      grid_row = 1,
      grid_col = 1,
      dimensions_meters = '20x50m',
      row_identifiers = 'Row-A',
      assigned_rover_id = 'rover-001',
    } = req.body;

    if (!id || !farm_id || !name || !crop_type) {
      return res.status(400).json({ detail: 'Missing required plot fields: id, farm_id, name, crop_type.' });
    }

    db.prepare(`
      INSERT INTO plots (id, farm_id, name, crop_type, grid_row, grid_col, dimensions_meters, row_identifiers, assigned_rover_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, farm_id, name, crop_type, grid_row, grid_col, dimensions_meters, row_identifiers, assigned_rover_id);

    const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(id);
    res.status(201).json(plot);
  } catch (err) {
    next(err);
  }
}

function getPlotSummary(req, res, next) {
  try {
    const plotId = req.params.id;
    const plot = db.prepare('SELECT * FROM plots WHERE id = ?').get(plotId);
    if (!plot) {
      return res.status(404).json({ detail: `Plot #${plotId} not found.` });
    }

    const latestTelemetry = db.prepare('SELECT * FROM telemetry WHERE plot_id = ? ORDER BY id DESC LIMIT 1').get(plotId) || null;
    const recentScans = db.prepare('SELECT * FROM disease_scans WHERE plot_id = ? ORDER BY timestamp DESC LIMIT 5').all(plotId);

    res.json({
      plot,
      latest_telemetry: latestTelemetry ? { ...latestTelemetry, is_simulated: Boolean(latestTelemetry.is_simulated) } : null,
      recent_scans: recentScans.map((s) => ({ ...s, is_healthy: Boolean(s.is_healthy), is_demo: Boolean(s.is_demo) })),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getFarms,
  createFarm,
  getPlots,
  createPlot,
  getPlotSummary,
};
