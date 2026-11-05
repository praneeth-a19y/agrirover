import React, { useState, useEffect } from 'react';
import {
  Thermometer,
  Droplets,
  Gauge,
  Sliders,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
  HelpCircle
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { Telemetry, AlertConfig } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socketService';

interface LiveMonitoringPageProps {
  latestTelemetry: Telemetry | null;
  isDemoMode: boolean;
  onOpenCalibration: () => void;
  onRefresh: () => void;
}

export const LiveMonitoringPage: React.FC<LiveMonitoringPageProps> = ({
  latestTelemetry,
  isDemoMode,
  onOpenCalibration,
  onRefresh,
}) => {
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [isEditingThresholds, setIsEditingThresholds] = useState(false);
  const [tempMin, setTempMin] = useState(12);
  const [tempMax, setTempMax] = useState(38);
  const [moistMin, setMoistMin] = useState(30);
  const [moistMax, setMoistMax] = useState(80);
  const [phMin, setPhMin] = useState(6.0);
  const [phMax, setPhMax] = useState(7.5);
  const [autoPoll, setAutoPoll] = useState(true);

  useEffect(() => {
    loadHistory();
    loadConfig();

    // Instant real-time telemetry updates via Socket.IO
    const unsub = socketService.onTelemetry((telemetry) => {
      setHistory((prev) => [...prev.slice(-19), telemetry]);
      onRefresh();
    });

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    let interval: any = null;
    if (autoPoll) {
      interval = setInterval(() => {
        loadHistory();
        onRefresh();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoPoll]);

  const loadHistory = async () => {
    try {
      const data = await api.getTelemetryHistory(undefined, 20);
      setHistory(data.reverse()); // chronological order
    } catch (err) {
      console.error('Error fetching telemetry history:', err);
    }
  };

  const loadConfig = async () => {
    try {
      const cfg = await api.getAlertConfig();
      setAlertConfig(cfg);
      setTempMin(cfg.temp_min);
      setTempMax(cfg.temp_max);
      setMoistMin(cfg.moisture_min);
      setMoistMax(cfg.moisture_max);
      setPhMin(cfg.ph_min);
      setPhMax(cfg.ph_max);
    } catch (err) {
      console.error('Error fetching alert config:', err);
    }
  };

  const handleSaveThresholds = async () => {
    if (!alertConfig) return;
    try {
      const updated: AlertConfig = {
        ...alertConfig,
        temp_min: Number(tempMin),
        temp_max: Number(tempMax),
        moisture_min: Number(moistMin),
        moisture_max: Number(moistMax),
        ph_min: Number(phMin),
        ph_max: Number(phMax),
      };
      await api.updateAlertConfig(updated);
      setAlertConfig(updated);
      setIsEditingThresholds(false);
    } catch (err) {
      alert('Failed to update alert thresholds: ' + (err as Error).message);
    }
  };

  // Helper to determine reading status (Measured, Simulated, Stale, Unavailable)
  const getStatusBadge = (value: number | null | undefined, isSimulated: boolean) => {
    if (value === null || value === undefined) {
      return (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-500/30">
          UNAVAILABLE
        </span>
      );
    }
    if (isSimulated || isDemoMode) {
      return (
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30">
          SIMULATED
        </span>
      );
    }
    return (
      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
        MEASURED LIVE
      </span>
    );
  };

  const chartData = history.map((h) => ({
    time: h.timestamp ? new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    temperature: h.temperature_c,
    humidity: h.humidity_percent,
    moisture: h.soil_moisture_percent,
    ph: h.soil_ph,
  }));

  const lastUpdated = latestTelemetry?.timestamp
    ? new Date(latestTelemetry.timestamp).toLocaleTimeString()
    : 'Waiting for stream...';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-agri-darkest border border-agri-border">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <Radio className="w-5 h-5 text-agri-lime" />
            <span>Environmental Telemetry Ingestion</span>
          </h2>
          <p className="text-xs text-agri-muted flex items-center gap-1.5 mt-0.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Last Packet: {lastUpdated}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Auto Poll Switch */}
          <button
            onClick={() => setAutoPoll(!autoPoll)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all ${
              autoPoll
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-agri-card text-agri-muted border-agri-border'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoPoll ? 'bg-emerald-400 animate-pulse' : 'bg-agri-muted'}`} />
            <span>{autoPoll ? '5s Polling Active' : 'Polling Paused'}</span>
          </button>

          <button
            onClick={onOpenCalibration}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-agri-lime text-xs font-semibold transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Calibration Wizard</span>
          </button>

          <button
            onClick={() => setIsEditingThresholds(!isEditingThresholds)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-agri-offwhite text-xs font-medium transition-all"
          >
            <span>Thresholds</span>
          </button>
        </div>
      </div>

      {/* Threshold Config Drawer if toggled */}
      {isEditingThresholds && (
        <div className="p-5 rounded-2xl bg-agri-dark/90 border border-agri-border space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-agri-border/60 pb-3">
            <h3 className="text-sm font-bold text-agri-offwhite">Configure Agricultural Alert Thresholds</h3>
            <span className="text-xs text-agri-muted">Custom triggers for soil and ambient alerts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-agri-muted">Soil Moisture Range (%):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={moistMin}
                  onChange={(e) => setMoistMin(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
                  placeholder="Min"
                />
                <span className="text-agri-muted">to</span>
                <input
                  type="number"
                  value={moistMax}
                  onChange={(e) => setMoistMax(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
                  placeholder="Max"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-agri-muted">Soil pH Range:</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  value={phMin}
                  onChange={(e) => setPhMin(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
                  placeholder="Min"
                />
                <span className="text-agri-muted">to</span>
                <input
                  type="number"
                  step="0.1"
                  value={phMax}
                  onChange={(e) => setPhMax(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
                  placeholder="Max"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-agri-muted">Canopy Temp (°C):</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempMin}
                  onChange={(e) => setTempMin(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
                  placeholder="Min"
                />
                <span className="text-agri-muted">to</span>
                <input
                  type="number"
                  value={tempMax}
                  onChange={(e) => setTempMax(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEditingThresholds(false)}
              className="px-3 py-1.5 rounded-xl text-xs text-agri-muted hover:text-agri-offwhite"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveThresholds}
              className="px-4 py-1.5 rounded-xl bg-agri-lime text-agri-darkest font-semibold text-xs shadow-md shadow-agri-lime/20"
            >
              Save Thresholds
            </button>
          </div>
        </div>
      )}

      {/* 4 Primary Hardware Sensor Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Sensor 1: Soil Moisture */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-agri-offwhite">Soil Moisture</h3>
                <p className="text-xs text-agri-muted">Capacitive Sensor (ESP32 ADC Pin 34)</p>
              </div>
            </div>
            {getStatusBadge(latestTelemetry?.soil_moisture_percent, latestTelemetry?.is_simulated || false)}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="text-3xl font-extrabold font-mono text-agri-offwhite">
              {latestTelemetry?.soil_moisture_percent !== null && latestTelemetry?.soil_moisture_percent !== undefined
                ? `${latestTelemetry.soil_moisture_percent.toFixed(1)}%`
                : 'Unavailable'}
            </div>
            <div className="text-right text-xs font-mono text-agri-muted">
              <div>Raw ADC: <span className="text-agri-lime">{latestTelemetry?.raw_moisture_adc ?? 2300}</span> / 4095</div>
              <div className="text-[10px]">Two-point calibrated</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-agri-muted">
              <span>Threshold Limits</span>
              <span className="font-mono text-agri-offwhite">{moistMin}% - {moistMax}%</span>
            </div>
            <div className="w-full bg-agri-darkest rounded-full h-2 overflow-hidden border border-agri-border/60">
              <div
                className={`h-full transition-all duration-500 ${
                  (latestTelemetry?.soil_moisture_percent ?? 50) < moistMin
                    ? 'bg-amber-500'
                    : (latestTelemetry?.soil_moisture_percent ?? 50) > moistMax
                    ? 'bg-blue-400'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, latestTelemetry?.soil_moisture_percent ?? 0))}%` }}
              />
            </div>
          </div>

          {/* Mini Chart */}
          <div className="h-28 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#8E9E94" fontSize={9} tickLine={false} />
                <YAxis stroke="#8E9E94" fontSize={9} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="moisture" stroke="#3B82F6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sensor 2: Soil pH */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-agri-offwhite">Soil pH Chemistry</h3>
                <p className="text-xs text-agri-muted">Analog Glass Electrode Probe (Pin 35)</p>
              </div>
            </div>
            {getStatusBadge(latestTelemetry?.soil_ph, latestTelemetry?.is_simulated || false)}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="text-3xl font-extrabold font-mono text-agri-offwhite">
              {latestTelemetry?.soil_ph !== null && latestTelemetry?.soil_ph !== undefined
                ? `${latestTelemetry.soil_ph.toFixed(2)} pH`
                : 'Unavailable'}
            </div>
            <div className="text-right text-xs font-mono text-agri-muted">
              <div>Output: <span className="text-agri-lime">{latestTelemetry?.raw_ph_voltage?.toFixed(2) ?? '2.50'} V</span></div>
              <div className="text-[10px]">Buffer 4.01/7.00 Reference</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-agri-muted">
              <span>Target Agronomic Band</span>
              <span className="font-mono text-agri-offwhite">{phMin} - {phMax} pH</span>
            </div>
            <div className="w-full bg-agri-darkest rounded-full h-2 overflow-hidden border border-agri-border/60">
              <div
                className={`h-full transition-all duration-500 ${
                  (latestTelemetry?.soil_ph ?? 7) < phMin || (latestTelemetry?.soil_ph ?? 7) > phMax
                    ? 'bg-amber-500'
                    : 'bg-purple-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, ((latestTelemetry?.soil_ph ?? 7) / 14) * 100))}%` }}
              />
            </div>
          </div>

          {/* Mini Chart */}
          <div className="h-28 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#8E9E94" fontSize={9} tickLine={false} />
                <YAxis stroke="#8E9E94" fontSize={9} domain={[4, 10]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="ph" stroke="#A855F7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sensor 3: Ambient Temperature */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-agri-offwhite">Air / Canopy Temperature</h3>
                <p className="text-xs text-agri-muted">DHT22 Digital Humidity & Temp (Pin 4)</p>
              </div>
            </div>
            {getStatusBadge(latestTelemetry?.temperature_c, latestTelemetry?.is_simulated || false)}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="text-3xl font-extrabold font-mono text-agri-offwhite">
              {latestTelemetry?.temperature_c !== null && latestTelemetry?.temperature_c !== undefined
                ? `${latestTelemetry.temperature_c.toFixed(1)}°C`
                : 'Unavailable'}
            </div>
            <div className="text-right text-xs font-mono text-agri-muted">
              <div>Comfort: <span className="text-agri-lime">Normal</span></div>
              <div className="text-[10px]">Threshold: {tempMax}°C max</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-agri-muted">
              <span>Heat Stress Range</span>
              <span className="font-mono text-agri-offwhite">{tempMin}°C - {tempMax}°C</span>
            </div>
            <div className="w-full bg-agri-darkest rounded-full h-2 overflow-hidden border border-agri-border/60">
              <div
                className={`h-full transition-all duration-500 ${
                  (latestTelemetry?.temperature_c ?? 25) > tempMax ? 'bg-red-500' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, ((latestTelemetry?.temperature_c ?? 25) / 50) * 100))}%` }}
              />
            </div>
          </div>

          {/* Mini Chart */}
          <div className="h-28 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#8E9E94" fontSize={9} tickLine={false} />
                <YAxis stroke="#8E9E94" fontSize={9} domain={[10, 45]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="temperature" stroke="#F59E0B" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sensor 4: Relative Humidity */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Droplets className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-agri-offwhite">Relative Humidity</h3>
                <p className="text-xs text-agri-muted">DHT22 Digital Sensor (Pin 4)</p>
              </div>
            </div>
            {getStatusBadge(latestTelemetry?.humidity_percent, latestTelemetry?.is_simulated || false)}
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <div className="text-3xl font-extrabold font-mono text-agri-offwhite">
              {latestTelemetry?.humidity_percent !== null && latestTelemetry?.humidity_percent !== undefined
                ? `${latestTelemetry.humidity_percent.toFixed(1)}% RH`
                : 'Unavailable'}
            </div>
            <div className="text-right text-xs font-mono text-agri-muted">
              <div>Vapor Deficit: <span className="text-agri-lime">Optimum</span></div>
              <div className="text-[10px]">Dew Point: ~19°C</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-agri-muted">
              <span>Optimal Foliar Transpiration</span>
              <span className="font-mono text-agri-offwhite">40% - 85% RH</span>
            </div>
            <div className="w-full bg-agri-darkest rounded-full h-2 overflow-hidden border border-agri-border/60">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, latestTelemetry?.humidity_percent ?? 50))}%` }}
              />
            </div>
          </div>

          {/* Mini Chart */}
          <div className="h-28 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="time" stroke="#8E9E94" fontSize={9} tickLine={false} />
                <YAxis stroke="#8E9E94" fontSize={9} domain={[20, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '8px', fontSize: '11px' }}
                />
                <Line type="monotone" dataKey="humidity" stroke="#10B981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
