export interface Telemetry {
  id: number;
  device_id: string;
  farm_id?: string;
  plot_id?: string;
  temperature_c?: number | null;
  humidity_percent?: number | null;
  soil_moisture_percent?: number | null;
  soil_ph?: number | null;
  raw_moisture_adc?: number | null;
  raw_ph_voltage?: number | null;
  is_simulated: boolean;
  timestamp: string;
}

export interface RoverStatus {
  device_id: string;
  name: string;
  is_online: boolean;
  battery_percent?: number | null;
  signal_rssi?: number | null;
  ip_address?: string | null;
  mode: 'MANUAL' | 'AUTOMATIC';
  last_heartbeat?: string | null;
  last_command?: string | null;
  last_response?: string | null;
  is_stale: boolean;
}

export interface RoverCommand {
  id: number;
  command_id?: string;
  commandId?: string;
  device_id: string;
  command: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP' | 'EMERGENCY_STOP' | 'LED_SET';
  duration_ms: number;
  status: 'PENDING' | 'EXECUTED' | 'ACKNOWLEDGED' | 'FAILED' | 'TIMED_OUT' | 'CANCELED';
  issued_at: string;
  executed_at?: string | null;
  acknowledged_at?: string | null;
  response_message?: string | null;
}

export interface DiseasePrediction {
  scan_id: string;
  predicted_class: string;
  confidence: number;
  severity: 'Healthy' | 'Low' | 'Moderate' | 'Severe';
  symptoms: string;
  recommendations: string;
  is_healthy: boolean;
  model_version: string;
  inference_mode: string;
  is_demo: boolean;
  image_url: string;
  farm_id?: string | null;
  plot_id?: string | null;
  row_id?: string | null;
  timestamp: string;
  // EPICS PlantVillage ML response fields
  status?: string;
  diseaseName?: string;
  predictedClass?: string;
  confidencePercent?: number;
  needsReview?: boolean;
  pathogen?: string;
  note?: string;
}

export interface DiseaseScanHistoryItem {
  id: string;
  device_id: string;
  farm_id?: string | null;
  plot_id?: string | null;
  row_id?: string | null;
  image_url: string;
  predicted_class: string;
  confidence: number;
  severity: string;
  is_healthy: boolean;
  inference_mode: string;
  is_demo: boolean;
  timestamp: string;
}

export interface Alert {
  id: number;
  alert_type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  farm_id?: string | null;
  plot_id?: string | null;
  title: string;
  message: string;
  reading_value?: number | null;
  threshold_value?: number | null;
  acknowledged: boolean;
  acknowledged_at?: string | null;
  timestamp: string;
}

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  crop_type: string;
  grid_row: number;
  grid_col: number;
  dimensions_meters: string;
  row_identifiers: string;
  assigned_rover_id?: string | null;
  created_at: string;
}

export interface Farm {
  id: string;
  name: string;
  location: string;
  area_acres: number;
  notes?: string | null;
  created_at: string;
  plots: Plot[];
}

export interface ModelStatus {
  model_configured: boolean;
  model_loaded: boolean;
  model_path?: string | null;
  model_version: string;
  runtime: string;
  supported_crops: string[];
  classes_count: number;
}

export interface OverviewSummary {
  total_farms: number;
  total_plots: number;
  rover_status: RoverStatus;
  latest_telemetry?: Telemetry | null;
  latest_scan?: DiseaseScanHistoryItem | null;
  total_scans: number;
  healthy_scans: number;
  diseased_scans: number;
  active_alerts_count: number;
  recent_alerts: Alert[];
  is_demo_mode: boolean;
  model_status: ModelStatus;
}

export interface AlertConfig {
  moisture_min: number;
  moisture_max: number;
  ph_min: number;
  ph_max: number;
  temp_min: number;
  temp_max: number;
  humidity_min: number;
  humidity_max: number;
  disease_confidence_threshold: number;
}

export interface CalibrationStatus {
  soil_moisture: {
    dry_adc: number;
    wet_adc: number;
    notes?: string;
  };
  soil_ph: {
    ph4_voltage: number;
    ph7_voltage: number;
    notes?: string;
  };
  updated_at?: string | null;
}
