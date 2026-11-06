import React, { useState, useEffect } from 'react';
import {
  Thermometer,
  Droplets,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Clock,
  Radio,
  CheckCircle2,
  WifiOff,
  Activity,
  TrendingUp,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, AreaChart, Area } from 'recharts';
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
  onRefresh,
}) => {
  const [history, setHistory] = useState<Telemetry[]>([]);
  const [selectedRange, setSelectedRange] = useState<'day' | 'week' | 'month'>('day');
  const [stats, setStats] = useState<{
    temperature: { min: number | null; max: number | null; avg: number | null };
    humidity: { min: number | null; max: number | null; avg: number | null };
    count: number;
  }>({
    temperature: { min: null, max: null, avg: null },
    humidity: { min: null, max: null, avg: null },
    count: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  useEffect(() => {
    loadData();

    // Instant real-time telemetry updates via Socket.IO from MQTT pipeline
    const unsub = socketService.onTelemetry((telemetry) => {
      if (telemetry && !telemetry.is_simulated) {
        setHistory((prev) => [...prev.slice(-39), telemetry]);
        setLastUpdateTime(new Date());
        onRefresh();
      }
    });

    return () => {
      unsub();
    };
  }, [selectedRange]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [histData, statsData] = await Promise.all([
        api.getTelemetryHistory(undefined, 50, selectedRange),
        api.getTelemetryStats(undefined, selectedRange),
      ]);
      setHistory(histData.reverse()); // Chronological order
      setStats(statsData);
      if (histData.length > 0) {
        setLastUpdateTime(new Date(histData[histData.length - 1].timestamp));
      }
    } catch (err) {
      console.error('Error fetching live telemetry data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Format real chart data points
  const chartData = history
    .filter((t) => t.temperature_c !== null || t.humidity_percent !== null)
    .map((t) => ({
      time: new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date(t.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      temperature: t.temperature_c !== null ? Number(t.temperature_c.toFixed(1)) : null,
      humidity: t.humidity_percent !== null ? Number(t.humidity_percent.toFixed(1)) : null,
    }));

  const hasData = latestTelemetry && (latestTelemetry.temperature_c !== null || latestTelemetry.humidity_percent !== null);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-agri-lime animate-pulse" />
            <span className="text-xs font-mono uppercase tracking-wider text-agri-lime font-bold">
              Physical Hardware Live Telemetry
            </span>
          </div>
          <h2 className="text-xl font-bold text-agri-offwhite tracking-tight mt-1">
            DHT22 Temperature & Humidity Environmental Monitoring
          </h2>
          <p className="text-xs text-agri-muted">
            Direct real-time readings received from ESP32 GPIO 4 over EMQX Cloud MQTT TLS and Render backend.
          </p>
        </div>

        {/* Range Selector & Manual Refresh */}
        <div className="flex items-center gap-2">
          {/* Daily, Weekly, Monthly Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-agri-card border border-agri-border text-xs font-medium">
            <button
              onClick={() => setSelectedRange('day')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === 'day'
                  ? 'bg-agri-lime text-agri-darkest font-bold shadow-sm'
                  : 'text-agri-muted hover:text-white'
              }`}
            >
              Daily (24h)
            </button>
            <button
              onClick={() => setSelectedRange('week')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === 'week'
                  ? 'bg-agri-lime text-agri-darkest font-bold shadow-sm'
                  : 'text-agri-muted hover:text-white'
              }`}
            >
              Weekly (7d)
            </button>
            <button
              onClick={() => setSelectedRange('month')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedRange === 'month'
                  ? 'bg-agri-lime text-agri-darkest font-bold shadow-sm'
                  : 'text-agri-muted hover:text-white'
              }`}
            >
              Monthly (30d)
            </button>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-agri-card border border-agri-border text-agri-muted hover:text-agri-offwhite hover:border-agri-lime transition-all disabled:opacity-50"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-agri-lime' : ''}`} />
          </button>
        </div>
      </div>

      {/* Disconnected / Waiting for Sensor Notice if no real data */}
      {!hasData && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <span className="font-bold text-amber-300 block">Waiting for hardware sensor telemetry...</span>
              <span className="text-amber-200/80">
                Flash your Main ESP32 with the provided firmware. When powered on and connected to Wi-Fi, DHT22 readings will automatically stream into this dashboard.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-black/40 font-mono text-amber-300 font-bold border border-amber-500/30 whitespace-nowrap">
            MQTT TOPIC: rover/sensors/data
          </span>
        </div>
      )}

      {/* TWO PRIMARY HARDWARE SENSOR CARDS ONLY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: TEMPERATURE (°C) */}
        <div className="agri-card p-6 rounded-2xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between border-b border-agri-border/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Thermometer className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-agri-offwhite">Ambient Temperature</h3>
                  <p className="text-xs text-agri-muted">DHT22 Digital Temperature Sensor (GPIO 4)</p>
                </div>
              </div>

              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                  latestTelemetry?.temperature_c !== null && latestTelemetry?.temperature_c !== undefined
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-agri-card text-agri-muted border-agri-border'
                }`}
              >
                {latestTelemetry?.temperature_c !== null && latestTelemetry?.temperature_c !== undefined
                  ? 'LIVE HARDWARE'
                  : 'WAITING FOR DATA'}
              </span>
            </div>

            {/* Current Reading Hero */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-xs uppercase font-mono text-agri-muted tracking-wider block">Current Reading</span>
                <div className="text-4xl font-extrabold font-mono text-agri-offwhite mt-1">
                  {latestTelemetry?.temperature_c !== null && latestTelemetry?.temperature_c !== undefined
                    ? `${latestTelemetry.temperature_c.toFixed(1)}°C`
                    : '-- °C'}
                </div>
              </div>

              <div className="text-right text-xs font-mono text-agri-muted">
                <div>Sensor Status: <span className="text-agri-lime font-bold">1-Wire Digital</span></div>
                <div className="text-[10px] text-agri-muted">Resolution: 0.1°C</div>
              </div>
            </div>

            {/* Summary Statistics Pills (Min, Max, Avg) */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-agri-darkest/80 border border-agri-border/60 text-center">
                <span className="text-[10px] text-agri-muted uppercase font-mono block">Minimum</span>
                <span className="text-sm font-bold font-mono text-blue-400">
                  {stats.temperature.min !== null ? `${stats.temperature.min}°C` : '--'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-agri-darkest/80 border border-agri-border/60 text-center">
                <span className="text-[10px] text-agri-muted uppercase font-mono block">Average</span>
                <span className="text-sm font-bold font-mono text-amber-300">
                  {stats.temperature.avg !== null ? `${stats.temperature.avg}°C` : '--'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-agri-darkest/80 border border-agri-border/60 text-center">
                <span className="text-[10px] text-agri-muted uppercase font-mono block">Maximum</span>
                <span className="text-sm font-bold font-mono text-red-400">
                  {stats.temperature.max !== null ? `${stats.temperature.max}°C` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Historical Temperature Chart */}
          <div className="space-y-2 pt-3 border-t border-agri-border/40">
            <div className="flex items-center justify-between text-xs text-agri-muted">
              <span className="font-semibold text-agri-offwhite flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                <span>Historical Temperature Progression ({selectedRange.toUpperCase()})</span>
              </span>
              <span className="font-mono text-[10px] text-agri-muted">
                {chartData.length} Readings Logged
              </span>
            </div>

            <div className="h-44 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#8E9E94" fontSize={10} tickLine={false} />
                    <YAxis stroke="#8E9E94" fontSize={10} domain={['auto', 'auto']} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F291E',
                        border: '1px solid #275E47',
                        borderRadius: '10px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Area type="monotone" dataKey="temperature" stroke="#F59E0B" strokeWidth={2.5} fill="url(#tempGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-agri-border/60 rounded-xl bg-agri-darkest/40 text-xs text-agri-muted">
                  No historical temperature readings recorded in this time range.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: HUMIDITY (%) */}
        <div className="agri-card p-6 rounded-2xl space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-start justify-between border-b border-agri-border/40 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Droplets className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-agri-offwhite">Relative Humidity</h3>
                  <p className="text-xs text-agri-muted">DHT22 Digital Humidity Sensor (GPIO 4)</p>
                </div>
              </div>

              <span
                className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full border ${
                  latestTelemetry?.humidity_percent !== null && latestTelemetry?.humidity_percent !== undefined
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-agri-card text-agri-muted border-agri-border'
                }`}
              >
                {latestTelemetry?.humidity_percent !== null && latestTelemetry?.humidity_percent !== undefined
                  ? 'LIVE HARDWARE'
                  : 'WAITING FOR DATA'}
              </span>
            </div>

            {/* Current Reading Hero */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-xs uppercase font-mono text-agri-muted tracking-wider block">Current Reading</span>
                <div className="text-4xl font-extrabold font-mono text-agri-offwhite mt-1">
                  {latestTelemetry?.humidity_percent !== null && latestTelemetry?.humidity_percent !== undefined
                    ? `${latestTelemetry.humidity_percent.toFixed(1)}%`
                    : '-- %'}
                </div>
              </div>

              <div className="text-right text-xs font-mono text-agri-muted">
                <div>Sensor Status: <span className="text-agri-lime font-bold">1-Wire Digital</span></div>
                <div className="text-[10px] text-agri-muted">Range: 0% – 100% RH</div>
              </div>
            </div>

            {/* Summary Statistics Pills (Min, Max, Avg) */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <div className="p-3 rounded-xl bg-agri-darkest/80 border border-agri-border/60 text-center">
                <span className="text-[10px] text-agri-muted uppercase font-mono block">Minimum</span>
                <span className="text-sm font-bold font-mono text-blue-400">
                  {stats.humidity.min !== null ? `${stats.humidity.min}%` : '--'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-agri-darkest/80 border border-agri-border/60 text-center">
                <span className="text-[10px] text-agri-muted uppercase font-mono block">Average</span>
                <span className="text-sm font-bold font-mono text-emerald-300">
                  {stats.humidity.avg !== null ? `${stats.humidity.avg}%` : '--'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-agri-darkest/80 border border-agri-border/60 text-center">
                <span className="text-[10px] text-agri-muted uppercase font-mono block">Maximum</span>
                <span className="text-sm font-bold font-mono text-cyan-400">
                  {stats.humidity.max !== null ? `${stats.humidity.max}%` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Historical Humidity Chart */}
          <div className="space-y-2 pt-3 border-t border-agri-border/40">
            <div className="flex items-center justify-between text-xs text-agri-muted">
              <span className="font-semibold text-agri-offwhite flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Historical Humidity Progression ({selectedRange.toUpperCase()})</span>
              </span>
              <span className="font-mono text-[10px] text-agri-muted">
                {chartData.length} Readings Logged
              </span>
            </div>

            <div className="h-44 w-full">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="humGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" stroke="#8E9E94" fontSize={10} tickLine={false} />
                    <YAxis stroke="#8E9E94" fontSize={10} domain={[0, 100]} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F291E',
                        border: '1px solid #275E47',
                        borderRadius: '10px',
                        fontSize: '11px',
                        color: '#fff',
                      }}
                    />
                    <Area type="monotone" dataKey="humidity" stroke="#10B981" strokeWidth={2.5} fill="url(#humGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center border border-dashed border-agri-border/60 rounded-xl bg-agri-darkest/40 text-xs text-agri-muted">
                  No historical humidity readings recorded in this time range.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hardware Telemetry Pipeline Status Banner */}
      <div className="p-4 rounded-xl bg-agri-card/20 border border-agri-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 text-agri-muted">
          <Clock className="w-4 h-4 text-agri-lime" />
          <span>Last Database Record:</span>
          <span className="text-agri-offwhite font-bold">
            {lastUpdateTime ? lastUpdateTime.toLocaleString() : 'No hardware record received yet'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-emerald-400 font-bold">SOCKET.IO & MQTT AUTO-SYNC ACTIVE</span>
        </div>
      </div>
    </div>
  );
};
