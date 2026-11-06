import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import {
  Download,
  Calendar,
  Filter,
  Activity,
  Layers,
  Thermometer,
  Droplets,
  Gauge,
  PieChart as PieIcon,
  Sprout
} from 'lucide-react';
import { api } from '../services/api';
import { Plot } from '../types';

export const SensorAnalyticsPage: React.FC = () => {
  const [rangeFilter, setRangeFilter] = useState<string>('24h');
  const [selectedPlot, setSelectedPlot] = useState<string>('');
  const [plots, setPlots] = useState<Plot[]>([]);
  const [timeseriesData, setTimeseriesData] = useState<any[]>([]);
  const [diseaseDistribution, setDiseaseDistribution] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPlots();
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [rangeFilter, selectedPlot]);

  const loadPlots = async () => {
    try {
      const data = await api.getPlots();
      setPlots(data);
    } catch (err) {
      console.error('Error loading plots:', err);
    }
  };

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const [ts, dist] = await Promise.all([
        api.getTimeseries(rangeFilter, selectedPlot || undefined),
        api.getDiseaseDistribution(selectedPlot || undefined),
      ]);
      setTimeseriesData(ts);
      setDiseaseDistribution(dist);
    } catch (err) {
      console.error('Error loading analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Filters */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <Activity className="w-5 h-5 text-agri-lime" />
            <span>Environmental Trends & Agronomic Analytics</span>
          </h2>
          <p className="text-xs text-agri-muted">
            Aggregated sensor telemetry queries and epidemiological crop disease patterns.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Range Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-agri-card border border-agri-border text-xs font-mono">
            {['24h', '7d', '30d', 'all'].map((r) => (
              <button
                key={r}
                onClick={() => setRangeFilter(r)}
                className={`px-3 py-1 rounded-lg uppercase transition-all ${
                  rangeFilter === r
                    ? 'bg-agri-lime text-agri-darkest font-bold'
                    : 'text-agri-muted hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Plot Sector Filter */}
          <select
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
            className="px-3 py-2 rounded-xl bg-agri-card border border-agri-border text-agri-offwhite text-xs outline-none focus:border-agri-lime"
          >
            <option value="">All Plot Sectors</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {/* CSV Export Dropdown / Buttons */}
          <div className="flex items-center gap-1.5">
            <a
              href={api.getExportCsvUrl('telemetry', selectedPlot || undefined)}
              download
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-lime/40 text-xs font-semibold text-agri-lime transition-all shadow-sm"
              title="Download historical sensor telemetry spreadsheet"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Telemetry</span>
            </a>
            <a
              href={api.getExportCsvUrl('scans', selectedPlot || undefined)}
              download
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-xs font-semibold text-agri-offwhite transition-all shadow-sm"
              title="Download plant disease scan log"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Scans</span>
            </a>
          </div>
        </div>
      </div>

      {/* Main Charts Grid: Dedicated to physical DHT22 Temperature & Humidity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Ambient Temperature (°C) */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-amber-400" />
                <span>Ambient Temperature (°C)</span>
              </h3>
              <p className="text-xs text-agri-muted">Physical DHT22 thermal trendline</p>
            </div>
            <span className="text-[10px] font-mono text-agri-lime">Range: {rangeFilter.toUpperCase()}</span>
          </div>

          <div className="h-64 w-full">
            {timeseriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseriesData}>
                  <defs>
                    <linearGradient id="tempArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" stroke="#8E9E94" fontSize={10} tickLine={false} />
                  <YAxis stroke="#F59E0B" domain={['auto', 'auto']} fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="temperature_c"
                    name="Temperature (°C)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fill="url(#tempArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Thermometer className="w-8 h-8 text-agri-muted opacity-40 mb-2" />
                <p className="text-xs font-semibold text-agri-offwhite">Waiting for Sensor Data</p>
                <p className="text-[11px] text-agri-muted">DHT22 telemetry will plot dynamically upon transmission.</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart 2: Relative Humidity (% RH) */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
                <Droplets className="w-4 h-4 text-emerald-400" />
                <span>Relative Humidity (% RH)</span>
              </h3>
              <p className="text-xs text-agri-muted">Physical DHT22 moisture saturation curve</p>
            </div>
            <span className="text-[10px] font-mono text-agri-lime">DHT22 Telemetry</span>
          </div>

          <div className="h-64 w-full">
            {timeseriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeseriesData}>
                  <defs>
                    <linearGradient id="humArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" stroke="#8E9E94" fontSize={10} tickLine={false} />
                  <YAxis stroke="#10B981" domain={[0, 100]} fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="humidity_percent"
                    name="Humidity (% RH)"
                    stroke="#10B981"
                    strokeWidth={2}
                    fill="url(#humArea)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <Droplets className="w-8 h-8 text-agri-muted opacity-40 mb-2" />
                <p className="text-xs font-semibold text-agri-offwhite">Waiting for Sensor Data</p>
                <p className="text-[11px] text-agri-muted">DHT22 humidity records will plot dynamically.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Disease Distribution & Health Ratio Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Breakdown by Disease Class */}
        <div className="lg:col-span-8 agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
            <div>
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
                <Sprout className="w-4 h-4 text-agri-lime" />
                <span>Foliar Disease Diagnoses by Class</span>
              </h3>
              <p className="text-xs text-agri-muted">Frequency distribution of verified fungal/bacterial leaf infections</p>
            </div>
          </div>

          <div className="h-56 w-full">
            {diseaseDistribution?.breakdown && diseaseDistribution.breakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diseaseDistribution.breakdown} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <XAxis type="number" stroke="#8E9E94" fontSize={10} />
                  <YAxis dataKey="name" type="category" stroke="#8E9E94" fontSize={10} width={130} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F291E', border: '1px solid #275E47', borderRadius: '12px', fontSize: '11px' }}
                  />
                  <Bar dataKey="count" name="Identified Scans" fill="#84CC16" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-agri-muted">
                No disease distributions to display.
              </div>
            )}
          </div>
        </div>

        {/* Health vs Disease Ratio Card */}
        <div className="lg:col-span-4 agri-card p-5 rounded-2xl space-y-4">
          <div className="border-b border-agri-border/40 pb-3">
            <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-agri-lime" />
              <span>Overall Foliage Health</span>
            </h3>
            <p className="text-xs text-agri-muted">Healthy vs infected observations</p>
          </div>

          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-agri-darkest border border-agri-border text-center space-y-1">
              <span className="text-xs text-agri-muted block">Field Health Rate</span>
              <span className="text-3xl font-extrabold font-mono text-agri-lime">
                {diseaseDistribution?.health_rate_percent ?? 100}%
              </span>
              <p className="text-[11px] text-agri-muted">Based on {diseaseDistribution?.total_scans ?? 0} optical assessments</p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30">
                <span className="text-emerald-300 font-medium">Healthy Canopy Scans</span>
                <span className="font-mono font-bold text-emerald-400">
                  {diseaseDistribution?.healthy_count ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-amber-950/40 border border-amber-500/30">
                <span className="text-amber-300 font-medium">Pathogen Infestations</span>
                <span className="font-mono font-bold text-amber-400">
                  {diseaseDistribution?.diseased_count ?? 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
