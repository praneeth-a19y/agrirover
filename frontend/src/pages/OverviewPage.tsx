import React from 'react';
import {
  Sprout,
  Droplets,
  Thermometer,
  Gauge,
  Bot,
  AlertTriangle,
  CheckCircle2,
  ScanEye,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { OverviewSummary } from '../types';
import { PageId } from '../components/Sidebar';

interface OverviewPageProps {
  overviewData: OverviewSummary | null;
  onNavigate: (page: PageId) => void;
  onOpenCalibration: () => void;
  onAcknowledgeAlert: (id: number) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  overviewData,
  onNavigate,
  onOpenCalibration,
  onAcknowledgeAlert,
}) => {
  if (!overviewData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Activity className="w-8 h-8 text-agri-lime animate-spin mx-auto" />
          <p className="text-sm text-agri-muted">Loading agritech dashboard telemetry...</p>
        </div>
      </div>
    );
  }

  const {
    total_farms,
    total_plots,
    rover_status,
    latest_telemetry,
    latest_scan,
    total_scans,
    healthy_scans,
    diseased_scans,
    active_alerts_count,
    recent_alerts,
    is_demo_mode,
    model_status
  } = overviewData;

  const isRoverOnline = rover_status.is_online && !rover_status.is_stale;

  // Mock mini-trend for visual dashboard chart
  const miniChartData = [
    { time: '04:00', temp: 22, moisture: 46 },
    { time: '08:00', temp: 24, moisture: 45 },
    { time: '12:00', temp: 30, moisture: 41 },
    { time: '16:00', temp: 29, moisture: 43 },
    { time: '20:00', temp: 25, moisture: 45 },
    { time: 'Now', temp: latest_telemetry?.temperature_c ?? 27, moisture: latest_telemetry?.soil_moisture_percent ?? 44 },
  ];

  return (
    <div className="space-y-6">
      {/* Top EPICS College Project Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-agri-card via-agri-forest to-agri-dark border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-agri-lime/20 text-agri-lime border border-agri-lime/30 font-semibold">
              EPICS Project Demo
            </span>
            <span className="text-xs text-agri-muted">|</span>
            <span className="text-xs text-agri-offwhite/90">Autonomous Crop Health Rover</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            AI-Powered Smart Agriculture Monitoring Platform
          </h2>
          <p className="text-xs text-agri-offwhite/70 max-w-2xl">
            Live integration hub for 4-wheel mobile rover, ESP32 telemetry, analog soil chemistry sensors, and offline leaf disease classification.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={() => onNavigate('disease')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-agri-lime hover:bg-agri-limeBright text-agri-darkest font-semibold text-xs transition-all shadow-md shadow-agri-lime/20"
          >
            <ScanEye className="w-4 h-4" />
            <span>Scan Crop Foliage</span>
          </button>
          <button
            onClick={() => onNavigate('control')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-agri-darkest/70 hover:bg-agri-darkest border border-agri-border text-agri-offwhite font-medium text-xs transition-all"
          >
            <Bot className="w-4 h-4 text-agri-lime" />
            <span>Rover Teleop</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Plots */}
        <div className="agri-card agri-card-hover p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-agri-muted">Monitored Acreage</span>
            <div className="p-2 rounded-xl bg-agri-forest/50 text-agri-lime border border-agri-border">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-agri-offwhite">{total_plots}</span>
            <span className="text-xs text-agri-muted">Plots ({total_farms} Farms)</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-agri-offwhite/70 pt-2 border-t border-agri-border/40">
            <span>Grid Layout Active</span>
            <button
              onClick={() => onNavigate('farms')}
              className="text-agri-lime hover:underline flex items-center gap-1"
            >
              View Plots <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Rover Telemetry State */}
        <div className="agri-card agri-card-hover p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-agri-muted">Rover Teleoperation</span>
            <div
              className={`p-2 rounded-xl border ${
                isRoverOnline
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                  : 'bg-red-950/60 text-red-400 border-red-500/40'
              }`}
            >
              <Bot className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold font-mono text-agri-offwhite">
              {isRoverOnline ? 'Connected' : is_demo_mode ? 'Demo Link' : 'Offline'}
            </span>
            <span className="text-xs text-agri-muted font-mono">
              {rover_status.battery_percent ? `${rover_status.battery_percent.toFixed(0)}% Bat` : ''}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-agri-offwhite/70 pt-2 border-t border-agri-border/40">
            <span className="font-mono text-[10px] text-agri-muted">IP: {rover_status.ip_address || '192.168.1.100'}</span>
            <button
              onClick={() => onNavigate('control')}
              className="text-agri-lime hover:underline flex items-center gap-1"
            >
              Controls <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Crop Health State */}
        <div className="agri-card agri-card-hover p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-agri-muted">Crop Health Ratio</span>
            <div className="p-2 rounded-xl bg-agri-forest/50 text-agri-lime border border-agri-border">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-agri-offwhite">
              {total_scans > 0 ? `${Math.round((healthy_scans / total_scans) * 100)}%` : '100%'}
            </span>
            <span className="text-xs text-agri-muted">Healthy Leaves</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-agri-offwhite/70 pt-2 border-t border-agri-border/40">
            <span>{diseased_scans} Pathogen Alerts</span>
            <button
              onClick={() => onNavigate('scans')}
              className="text-agri-lime hover:underline flex items-center gap-1"
            >
              History <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Active Alerts */}
        <div className="agri-card agri-card-hover p-4 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-agri-muted">Actionable Alerts</span>
            <div
              className={`p-2 rounded-xl border ${
                active_alerts_count > 0
                  ? 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-agri-offwhite">{active_alerts_count}</span>
            <span className="text-xs text-agri-muted">Unresolved Items</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-agri-offwhite/70 pt-2 border-t border-agri-border/40">
            <span>{active_alerts_count > 0 ? 'Requires attention' : 'All systems nominal'}</span>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-agri-lime hover:underline flex items-center gap-1"
            >
              Review <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Real-Time Telemetry & Disease Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Environmental Sensor Hub */}
        <div className="lg:col-span-2 space-y-4">
          <div className="agri-card p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-agri-border/40 pb-3">
              <div>
                <h3 className="text-base font-bold text-agri-offwhite flex items-center gap-2">
                  <Activity className="w-4 h-4 text-agri-lime" />
                  <span>Real-Time Environmental Readings</span>
                </h3>
                <p className="text-xs text-agri-muted">
                  Calibrated sensor telemetry captured from Plot: {latest_telemetry?.plot_id ?? 'North Tomato Field'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenCalibration}
                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-agri-darkest border border-agri-border text-agri-muted hover:text-agri-offwhite hover:border-agri-lime transition-all"
                >
                  Sensor Calibration
                </button>
                <button
                  onClick={() => onNavigate('live')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-agri-lime/10 border border-agri-lime/30 text-agri-lime hover:bg-agri-lime/20 transition-all"
                >
                  Live Monitor
                </button>
              </div>
            </div>

            {/* 4 Sensor Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Soil Moisture */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60">
                <div className="flex items-center justify-between text-xs text-agri-muted mb-1">
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-blue-400" /> Moisture
                  </span>
                  <span className="text-[10px] text-agri-lime font-mono">Calibrated</span>
                </div>
                <div className="text-xl font-bold font-mono text-agri-offwhite">
                  {latest_telemetry?.soil_moisture_percent !== null && latest_telemetry?.soil_moisture_percent !== undefined
                    ? `${latest_telemetry.soil_moisture_percent.toFixed(1)}%`
                    : '--'}
                </div>
                <div className="text-[10px] text-agri-muted mt-1">Target: 30% - 80%</div>
              </div>

              {/* Soil pH */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60">
                <div className="flex items-center justify-between text-xs text-agri-muted mb-1">
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3.5 h-3.5 text-purple-400" /> Soil pH
                  </span>
                  <span className="text-[10px] text-purple-300 font-mono">Analog</span>
                </div>
                <div className="text-xl font-bold font-mono text-agri-offwhite">
                  {latest_telemetry?.soil_ph !== null && latest_telemetry?.soil_ph !== undefined
                    ? `${latest_telemetry.soil_ph.toFixed(2)}`
                    : '--'}
                </div>
                <div className="text-[10px] text-agri-muted mt-1">Optimum: 6.0 - 7.5</div>
              </div>

              {/* Temperature */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60">
                <div className="flex items-center justify-between text-xs text-agri-muted mb-1">
                  <span className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-amber-400" /> Canopy Temp
                  </span>
                  <span className="text-[10px] text-agri-muted font-mono">DHT22</span>
                </div>
                <div className="text-xl font-bold font-mono text-agri-offwhite">
                  {latest_telemetry?.temperature_c !== null && latest_telemetry?.temperature_c !== undefined
                    ? `${latest_telemetry.temperature_c.toFixed(1)}°C`
                    : '--'}
                </div>
                <div className="text-[10px] text-agri-muted mt-1">Threshold: &lt; 38°C</div>
              </div>

              {/* Humidity */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60">
                <div className="flex items-center justify-between text-xs text-agri-muted mb-1">
                  <span className="flex items-center gap-1">
                    <Droplets className="w-3.5 h-3.5 text-emerald-400" /> Rel. Humidity
                  </span>
                  <span className="text-[10px] text-agri-muted font-mono">DHT22</span>
                </div>
                <div className="text-xl font-bold font-mono text-agri-offwhite">
                  {latest_telemetry?.humidity_percent !== null && latest_telemetry?.humidity_percent !== undefined
                    ? `${latest_telemetry.humidity_percent.toFixed(1)}%`
                    : '--'}
                </div>
                <div className="text-[10px] text-agri-muted mt-1">Target: 40% - 85%</div>
              </div>
            </div>

            {/* 24-Hour Trends Chart */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-agri-muted">
                  24-Hour Diurnal Progression
                </span>
                <span className="text-[11px] text-agri-muted">Temperature (°C) & Moisture (%)</span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={miniChartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="moistGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#8E9E94" fontSize={10} tickLine={false} />
                    <YAxis stroke="#8E9E94" fontSize={10} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F291E',
                        border: '1px solid #275E47',
                        borderRadius: '12px',
                        fontSize: '11px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="moisture"
                      name="Moisture (%)"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#moistGrad)"
                    />
                    <Area
                      type="monotone"
                      dataKey="temp"
                      name="Temperature (°C)"
                      stroke="#F59E0B"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#tempGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Latest AI Disease Scan & Model Status */}
        <div className="space-y-4">
          <div className="agri-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
              <h3 className="text-base font-bold text-agri-offwhite flex items-center gap-2">
                <ScanEye className="w-4 h-4 text-agri-lime" />
                <span>Latest AI Camera Scan</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-agri-card border border-agri-border text-agri-lime">
                ESP32-CAM
              </span>
            </div>

            {latest_scan ? (
              <div className="space-y-3">
                <div className="relative aspect-video rounded-xl overflow-hidden border border-agri-border bg-agri-darkest">
                  <img
                    src={latest_scan.image_url}
                    alt={latest_scan.predicted_class}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 right-2">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shadow-md ${
                        latest_scan.is_healthy
                          ? 'bg-emerald-600/90 text-white'
                          : 'bg-amber-600/90 text-white'
                      }`}
                    >
                      {latest_scan.is_healthy ? 'HEALTHY' : 'DISEASE DETECTED'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-agri-offwhite">
                      {latest_scan.predicted_class}
                    </h4>
                    <span className="font-mono text-xs font-bold text-agri-lime">
                      {Math.round(latest_scan.confidence * 100)}% Conf.
                    </span>
                  </div>
                  <p className="text-[11px] text-agri-muted mt-0.5">
                    Plot: {latest_scan.plot_id || 'North Tomato Field'} | Row: {latest_scan.row_id || 'Row A1'}
                  </p>
                </div>

                <div className="pt-2 border-t border-agri-border/40 flex items-center justify-between text-xs">
                  <span className="text-agri-muted text-[11px]">
                    Mode: {latest_scan.inference_mode}
                  </span>
                  <button
                    onClick={() => onNavigate('disease')}
                    className="text-agri-lime hover:underline font-medium flex items-center gap-1 text-xs"
                  >
                    Diagnose Now <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <ScanEye className="w-8 h-8 text-agri-muted mx-auto opacity-40" />
                <p className="text-xs text-agri-muted">No crop scans recorded yet.</p>
                <button
                  onClick={() => onNavigate('disease')}
                  className="px-3 py-1.5 rounded-lg bg-agri-lime text-agri-darkest font-semibold text-xs inline-block"
                >
                  Upload First Leaf Image
                </button>
              </div>
            )}
          </div>

          {/* Model Status Card */}
          <div className="p-4 rounded-2xl bg-agri-dark/60 border border-agri-border/60 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-agri-offwhite">ML Engine Offline Status</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                  model_status.model_loaded
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {model_status.model_loaded ? 'TFLITE LOADED' : 'OFFLINE HEURISTIC ADAPTER'}
              </span>
            </div>
            <p className="text-[11px] text-agri-muted leading-relaxed">
              {model_status.runtime} configured for {model_status.supported_crops.join(', ')}. Local model weights path configurable in Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Alerts Feed */}
      <div className="agri-card p-5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-agri-offwhite">Active Farm Alerts & Notifications</h3>
          </div>
          <button
            onClick={() => onNavigate('alerts')}
            className="text-xs text-agri-lime hover:underline flex items-center gap-1 font-medium"
          >
            Manage All Alerts <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {recent_alerts.length === 0 ? (
          <div className="py-4 text-center text-xs text-agri-muted flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-agri-emerald" />
            <span>No unacknowledged warnings. Crop and soil parameters are within normal thresholds.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {recent_alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs ${
                  alert.severity === 'CRITICAL'
                    ? 'bg-red-950/40 border-red-500/40 text-red-200'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                }`}
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-agri-offwhite">{alert.title}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-agri-darkest/50 border border-current">
                      {alert.severity}
                    </span>
                    <span className="text-[11px] text-agri-muted">
                      {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80">{alert.message}</p>
                </div>

                {!alert.acknowledged && (
                  <button
                    onClick={() => onAcknowledgeAlert(alert.id)}
                    className="px-3 py-1 rounded-lg bg-agri-darkest hover:bg-agri-card border border-agri-border text-agri-offwhite text-[11px] font-medium transition-all flex-shrink-0"
                  >
                    Acknowledge
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
