const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./env');
const logger = require('../utils/logger');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  logger.info('DB', `Initializing SQLite database at: ${config.dbPath}`);

  // 1. Farms
  db.exec(`
    CREATE TABLE IF NOT EXISTS farms (
      id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      location VARCHAR(200) NOT NULL,
      area_acres FLOAT DEFAULT 1.0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Plots
  db.exec(`
    CREATE TABLE IF NOT EXISTS plots (
      id VARCHAR(50) PRIMARY KEY,
      farm_id VARCHAR(50) NOT NULL,
      name VARCHAR(100) NOT NULL,
      crop_type VARCHAR(100) NOT NULL,
      grid_row INTEGER DEFAULT 1,
      grid_col INTEGER DEFAULT 1,
      dimensions_meters VARCHAR(50) DEFAULT '20x50m',
      row_identifiers VARCHAR(100) DEFAULT 'Row-A, Row-B, Row-C',
      assigned_rover_id VARCHAR(50) DEFAULT 'rover-001',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (farm_id) REFERENCES farms (id) ON DELETE CASCADE
    );
  `);

  // 3. Rover Status
  db.exec(`
    CREATE TABLE IF NOT EXISTS rover_status (
      device_id VARCHAR(50) PRIMARY KEY,
      name VARCHAR(100) DEFAULT 'AgriRover Alpha',
      is_online BOOLEAN DEFAULT 0,
      battery_percent FLOAT DEFAULT 85.0,
      signal_rssi INTEGER DEFAULT -65,
      ip_address VARCHAR(45) DEFAULT '192.168.1.120',
      mode VARCHAR(20) DEFAULT 'MANUAL',
      last_heartbeat DATETIME,
      last_command VARCHAR(50),
      last_response VARCHAR(200)
    );
  `);

  // 4. Rover Commands
  db.exec(`
    CREATE TABLE IF NOT EXISTS rover_commands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command_id VARCHAR(100),
      device_id VARCHAR(50) NOT NULL,
      command VARCHAR(50) NOT NULL,
      duration_ms INTEGER DEFAULT 1000,
      status VARCHAR(30) DEFAULT 'PENDING',
      issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      executed_at DATETIME,
      acknowledged_at DATETIME,
      response_message VARCHAR(250)
    );
  `);

  // Ensure command_id column exists if table was created previously without it
  try {
    db.exec(`ALTER TABLE rover_commands ADD COLUMN command_id VARCHAR(100);`);
  } catch {
    // Column already exists
  }

  // 5. Telemetry
  db.exec(`
    CREATE TABLE IF NOT EXISTS telemetry (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id VARCHAR(50) NOT NULL,
      farm_id VARCHAR(50),
      plot_id VARCHAR(50),
      temperature_c FLOAT,
      humidity_percent FLOAT,
      soil_moisture_percent FLOAT,
      soil_ph FLOAT,
      raw_moisture_adc INTEGER,
      raw_ph_voltage FLOAT,
      is_simulated BOOLEAN DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Alerts
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      farm_id VARCHAR(50),
      plot_id VARCHAR(50),
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      reading_value FLOAT,
      threshold_value FLOAT,
      acknowledged BOOLEAN DEFAULT 0,
      acknowledged_at DATETIME,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Sensor Calibration
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_calibration (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_type VARCHAR(50) NOT NULL,
      dry_adc FLOAT DEFAULT 3200.0,
      wet_adc FLOAT DEFAULT 1400.0,
      ph4_voltage FLOAT DEFAULT 2.50,
      ph7_voltage FLOAT DEFAULT 2.00,
      notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. Alert Configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      moisture_min FLOAT DEFAULT 25.0,
      moisture_max FLOAT DEFAULT 75.0,
      ph_min FLOAT DEFAULT 6.0,
      ph_max FLOAT DEFAULT 7.5,
      temp_min FLOAT DEFAULT 12.0,
      temp_max FLOAT DEFAULT 36.0,
      humidity_min FLOAT DEFAULT 35.0,
      humidity_max FLOAT DEFAULT 85.0,
      disease_confidence_threshold FLOAT DEFAULT 0.65
    );
  `);

  // 9. Disease Scans
  db.exec(`
    CREATE TABLE IF NOT EXISTS disease_scans (
      id VARCHAR(64) PRIMARY KEY,
      device_id VARCHAR(50) DEFAULT 'rover-001',
      farm_id VARCHAR(50),
      plot_id VARCHAR(50),
      row_id VARCHAR(50),
      image_url VARCHAR(500) NOT NULL,
      original_filename VARCHAR(200),
      predicted_class VARCHAR(120) NOT NULL,
      confidence FLOAT NOT NULL,
      severity VARCHAR(50) NOT NULL,
      symptoms TEXT,
      recommendations TEXT,
      is_healthy BOOLEAN DEFAULT 0,
      inference_mode VARCHAR(50) DEFAULT 'heuristic',
      model_version VARCHAR(50) DEFAULT 'PlantVillage-MobileNetV2-v1',
      is_demo BOOLEAN DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. System Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key VARCHAR(50) PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedInitialData();
}

function seedInitialData() {
  // Seed Default Farm
  const farmCount = db.prepare('SELECT COUNT(*) as count FROM farms').get().count;
  if (farmCount === 0) {
    db.prepare(`
      INSERT INTO farms (id, name, location, area_acres, notes)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      'farm-001',
      'Campus Agritech Experimental Farm',
      'EPICS Demonstration Field, Sector 4',
      3.5,
      'High-precision IoT & Computer Vision field trial for mobile rover.'
    );
  }

  // Seed Default Plot
  const plotCount = db.prepare('SELECT COUNT(*) as count FROM plots').get().count;
  if (plotCount === 0) {
    db.prepare(`
      INSERT INTO plots (id, farm_id, name, crop_type, grid_row, grid_col, dimensions_meters, row_identifiers, assigned_rover_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'plot-001',
      'farm-001',
      'Plot Alpha — Tomato Canopy',
      'Tomato (Solanum lycopersicum)',
      1,
      1,
      '20m x 40m',
      'Row-1, Row-2, Row-3, Row-4',
      'rover-001'
    );
  }

  // Seed Rover Status
  const rover = db.prepare('SELECT * FROM rover_status WHERE device_id = ?').get('rover-001');
  if (!rover) {
    db.prepare(`
      INSERT INTO rover_status (device_id, name, is_online, battery_percent, signal_rssi, ip_address, mode, last_heartbeat)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('rover-001', 'Smart AgriRover 4WD', 0, 92.0, -62, '192.168.1.120', 'MANUAL', new Date().toISOString());
  }

  // Seed Sensor Calibration
  const calibCount = db.prepare('SELECT COUNT(*) as count FROM sensor_calibration').get().count;
  if (calibCount === 0) {
    db.prepare(`
      INSERT INTO sensor_calibration (sensor_type, dry_adc, wet_adc, ph4_voltage, ph7_voltage, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('capacitive_moisture', 3200.0, 1400.0, 2.50, 2.00, 'Two-point calibration for capacitive V1.2 probe');

    db.prepare(`
      INSERT INTO sensor_calibration (sensor_type, dry_adc, wet_adc, ph4_voltage, ph7_voltage, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('analog_ph', 3200.0, 1400.0, 2.50, 2.00, 'Standard buffer calibration (pH 4.01 & pH 6.86)');
  }

  // Seed Alert Config
  const alertConf = db.prepare('SELECT COUNT(*) as count FROM alert_config').get().count;
  if (alertConf === 0) {
    db.prepare(`
      INSERT INTO alert_config (id, moisture_min, moisture_max, ph_min, ph_max, temp_min, temp_max, humidity_min, humidity_max, disease_confidence_threshold)
      VALUES (1, 25.0, 75.0, 6.0, 7.5, 12.0, 36.0, 35.0, 85.0, 0.65)
    `).run();
  }
}

initDatabase();

module.exports = db;
