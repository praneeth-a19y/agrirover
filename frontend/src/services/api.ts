import {
  OverviewSummary,
  Telemetry,
  RoverStatus,
  RoverCommand,
  DiseasePrediction,
  DiseaseScanHistoryItem,
  Alert,
  AlertConfig,
  Farm,
  Plot,
  CalibrationStatus,
  ModelStatus
} from '../types';

const customApiBase = import.meta.env.VITE_API_BASE_URL;
const API_BASE = customApiBase
  ? `${customApiBase.replace(/\/+$/, '')}${customApiBase.endsWith('/api/v1') ? '' : '/api/v1'}`
  : '/api/v1';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorDetail = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.detail) errorDetail = errJson.detail;
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const api = {
  // Overview
  getOverview: () => request<OverviewSummary>('/overview'),

  // Telemetry
  getLatestTelemetry: (plotId?: string) =>
    request<Telemetry | null>(`/telemetry/latest${plotId ? `?plot_id=${plotId}` : ''}`),
  getTelemetryHistory: (plotId?: string, limit: number = 50) =>
    request<Telemetry[]>(`/telemetry/history?limit=${limit}${plotId ? `&plot_id=${plotId}` : ''}`),
  ingestTelemetry: (payload: Partial<Telemetry>) =>
    request<Telemetry>('/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),

  // AI Disease Detection
  predictCropDisease: async (formData: FormData): Promise<DiseasePrediction> => {
    const res = await fetch(`${API_BASE}/disease/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Inference error: ${res.statusText}`);
    }
    return res.json();
  },
  getDiseaseScans: (plotId?: string, isHealthy?: boolean, limit: number = 50) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (plotId) params.append('plot_id', plotId);
    if (isHealthy !== undefined) params.append('is_healthy', isHealthy.toString());
    return request<DiseaseScanHistoryItem[]>(`/disease/scans?${params.toString()}`);
  },
  getDiseaseScanDetail: (id: string) => request<DiseasePrediction>(`/disease/scans/${id}`),
  getModelStatus: () => request<ModelStatus>('/disease/model-status'),
  getLatestCapture: () =>
    request<{
      has_image: boolean;
      image_url: string | null;
      scan_id: string | null;
      prediction: DiseasePrediction | null;
      timestamp: string | null;
      source: string;
    }>('/disease/latest-capture'),

  // Rover Control & Teleoperation
  getRoverStatus: () => request<RoverStatus>('/rover/status'),
  sendRoverCommand: (command: string, durationMs: number = 1000, value?: number | string) =>
    request<RoverCommand>('/rover/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, duration_ms: durationMs, value, device_id: 'agrirover-01' }),
    }),
  getRoverCommandHistory: (limit: number = 30) =>
    request<RoverCommand[]>(`/rover/commands/history?limit=${limit}`),

  // Farms & Plots
  getFarms: () => request<Farm[]>('/farms'),
  createFarm: (data: { id: string; name: string; location: string; area_acres?: number; notes?: string }) =>
    request<Farm>('/farms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getPlots: (farmId?: string) =>
    request<Plot[]>(`/farms/plots${farmId ? `?farm_id=${farmId}` : ''}`),
  createPlot: (data: {
    id: string;
    farm_id: string;
    name: string;
    crop_type: string;
    grid_row: number;
    grid_col: number;
    dimensions_meters: string;
    row_identifiers: string;
    assigned_rover_id?: string;
  }) =>
    request<Plot>('/farms/plots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  getPlotSummary: (plotId: string) =>
    request<{ plot: Plot; latest_telemetry: Telemetry | null; recent_scans: DiseaseScanHistoryItem[] }>(
      `/farms/plots/${plotId}/summary`
    ),

  // Alerts
  getAlerts: (acknowledged?: boolean, severity?: string) => {
    const params = new URLSearchParams();
    if (acknowledged !== undefined) params.append('acknowledged', acknowledged.toString());
    if (severity) params.append('severity', severity);
    return request<Alert[]>(`/alerts?${params.toString()}`);
  },
  acknowledgeAlert: (alertId: number) =>
    request<Alert>(`/alerts/${alertId}/ack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acknowledged: true }),
    }),
  getAlertConfig: () => request<AlertConfig>('/alerts/config'),
  updateAlertConfig: (config: AlertConfig) =>
    request<AlertConfig>('/alerts/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }),

  // Sensor Analytics
  getTimeseries: (rangeFilter: string = '24h', plotId?: string) => {
    const params = new URLSearchParams({ range_filter: rangeFilter });
    if (plotId) params.append('plot_id', plotId);
    return request<any[]>(`/analytics/timeseries?${params.toString()}`);
  },
  getDiseaseDistribution: (plotId?: string) =>
    request<{
      total_scans: number;
      healthy_count: number;
      diseased_count: number;
      health_rate_percent: number;
      breakdown: { name: string; count: number }[];
    }>(`/analytics/disease-distribution${plotId ? `?plot_id=${plotId}` : ''}`),
  getExportCsvUrl: (type: 'telemetry' | 'scans', plotId?: string) =>
    `${API_BASE}/analytics/export/csv?data_type=${type}${plotId ? `&plot_id=${plotId}` : ''}`,

  // Sensor Calibration
  getCalibration: () => request<CalibrationStatus>('/calibration'),
  updateMoistureCalibration: (data: { dry_adc: number; wet_adc: number; notes?: string }) =>
    request<any>('/calibration/soil-moisture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  updatePHCalibration: (data: { ph4_voltage: number; ph7_voltage: number; notes?: string }) =>
    request<any>('/calibration/soil-ph', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
  testCalibration: (data: { raw_moisture_adc?: number; raw_ph_voltage?: number }) =>
    request<{ calibrated_moisture_percent?: number; calibrated_ph?: number }>('/calibration/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  // Demo Mode Controls
  seedDemoData: () => request<{ message: string }>('/demo/seed', { method: 'POST' }),
  telemetryTick: () => request<Telemetry>('/demo/telemetry-tick', { method: 'POST' }),
  toggleDemoMode: (enabled: boolean, simulateRoverOnline: boolean = true) =>
    request<{ demo_mode: boolean; rover_online: boolean }>(
      `/demo/toggle?enabled=${enabled}&simulate_rover_online=${simulateRoverOnline}`,
      { method: 'POST' }
    ),
  clearSimulatedData: () => request<any>('/demo/clear-simulated', { method: 'POST' }),
};
