const db = require('../config/db');
const telemetryService = require('../services/telemetryService');
const roverService = require('../services/roverService');
const mlService = require('../services/mlService');

function toggleDemo(req, res, next) {
  try {
    const enabled = req.query.enabled === 'true';
    const simulateOnline = req.query.simulate_rover_online === 'true';

    db.prepare(`
      INSERT INTO system_settings (key, value, updated_at)
      VALUES ('is_demo_mode', ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(String(enabled));

    if (enabled && simulateOnline) {
      roverService.updateRoverStatus('rover-001', {
        is_online: true,
        battery_percent: 88,
        signal_rssi: -58,
        mode: 'MANUAL',
        last_response: 'Simulated online state active',
      });
    }

    res.json({ demo_mode: enabled, rover_online: simulateOnline });
  } catch (err) {
    next(err);
  }
}

function telemetryTick(req, res, next) {
  try {
    // Generate realistic fluctuating telemetry reading
    const temp = Math.round((26.0 + (Math.random() * 4.0 - 2.0)) * 10) / 10;
    const hum = Math.round((62.0 + (Math.random() * 6.0 - 3.0)) * 10) / 10;
    const rawMoist = Math.round(2100 + (Math.random() * 100 - 50));
    const rawPh = Math.round((2.05 + (Math.random() * 0.1 - 0.05)) * 100) / 100;

    const record = telemetryService.processAndSaveTelemetry({
      device_id: 'rover-001',
      farm_id: 'farm-001',
      plot_id: 'plot-001',
      temperature_c: temp,
      humidity_percent: hum,
      raw_moisture_adc: rawMoist,
      raw_ph_voltage: rawPh,
      is_simulated: true,
      timestamp: new Date().toISOString(),
    });

    res.json(record);
  } catch (err) {
    next(err);
  }
}

function seedDemoData(req, res, next) {
  try {
    // Seed 10 realistic historical telemetry records
    const now = Date.now();
    for (let i = 10; i >= 1; i--) {
      const pastTime = new Date(now - i * 15 * 60 * 1000).toISOString();
      telemetryService.processAndSaveTelemetry({
        device_id: 'rover-001',
        farm_id: 'farm-001',
        plot_id: 'plot-001',
        temperature_c: Math.round((27.5 - i * 0.3 + Math.random()) * 10) / 10,
        humidity_percent: Math.round((60.0 + i * 0.8 + Math.random()) * 10) / 10,
        raw_moisture_adc: Math.round(2200 - i * 20),
        raw_ph_voltage: 2.08,
        is_simulated: true,
        timestamp: pastTime,
      });
    }

    // Seed sample plant scans
    mlService.diagnoseLeafImage({ filename: 'tomato_early_blight.jpg' }, {
      device_id: 'rover-001',
      farm_id: 'farm-001',
      plot_id: 'plot-001',
      row_id: 'Row-A',
      is_demo: true,
    });

    mlService.diagnoseLeafImage({ filename: 'tomato_healthy.jpg' }, {
      device_id: 'rover-001',
      farm_id: 'farm-001',
      plot_id: 'plot-001',
      row_id: 'Row-B',
      is_demo: true,
    });

    res.json({ message: 'Demo simulation data seeded successfully.' });
  } catch (err) {
    next(err);
  }
}

function clearSimulated(req, res, next) {
  try {
    db.prepare('DELETE FROM telemetry WHERE is_simulated = 1').run();
    db.prepare('DELETE FROM disease_scans WHERE is_demo = 1').run();
    res.json({ message: 'Simulated data records cleared.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  toggleDemo,
  telemetryTick,
  seedDemoData,
  clearSimulated,
};
