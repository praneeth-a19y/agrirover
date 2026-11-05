import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Plus,
  Layers,
  Sprout,
  Bot,
  Activity,
  Check,
  X,
  Droplets,
  Thermometer,
  Gauge
} from 'lucide-react';
import { api } from '../services/api';
import { Farm, Plot, Telemetry, DiseaseScanHistoryItem } from '../types';

export const FarmManagementPage: React.FC = () => {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [plotSummary, setPlotSummary] = useState<{
    plot: Plot;
    latest_telemetry: Telemetry | null;
    recent_scans: DiseaseScanHistoryItem[];
  } | null>(null);

  // Modals
  const [showAddFarmModal, setShowAddFarmModal] = useState(false);
  const [showAddPlotModal, setShowAddPlotModal] = useState(false);
  
  // New Farm form
  const [farmId, setFarmId] = useState('');
  const [farmName, setFarmName] = useState('');
  const [farmLocation, setFarmLocation] = useState('');
  const [farmAcres, setFarmAcres] = useState(2.0);

  // New Plot form
  const [plotIdInput, setPlotIdInput] = useState('');
  const [plotFarmId, setPlotFarmId] = useState('');
  const [plotName, setPlotName] = useState('');
  const [plotCrop, setPlotCrop] = useState('Tomato');
  const [plotGridRow, setPlotGridRow] = useState(0);
  const [plotGridCol, setPlotGridCol] = useState(0);
  const [plotDims, setPlotDims] = useState('30m x 20m');
  const [plotRows, setPlotRows] = useState('Rows A1-A6');

  useEffect(() => {
    loadFarms();
  }, []);

  const loadFarms = async () => {
    try {
      const data = await api.getFarms();
      setFarms(data);
      if (data.length > 0 && data[0].plots.length > 0 && !selectedPlot) {
        selectPlot(data[0].plots[0]);
      }
    } catch (err) {
      console.error('Error fetching farms:', err);
    }
  };

  const selectPlot = async (plot: Plot) => {
    setSelectedPlot(plot);
    try {
      const summary = await api.getPlotSummary(plot.id);
      setPlotSummary(summary);
    } catch (err) {
      console.error('Error loading plot summary:', err);
    }
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !farmName || !farmLocation) return;
    try {
      await api.createFarm({
        id: farmId,
        name: farmName,
        location: farmLocation,
        area_acres: Number(farmAcres)
      });
      setShowAddFarmModal(false);
      setFarmId('');
      setFarmName('');
      setFarmLocation('');
      loadFarms();
    } catch (err) {
      alert('Error creating farm: ' + (err as Error).message);
    }
  };

  const handleCreatePlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plotIdInput || !plotFarmId || !plotName) return;
    try {
      await api.createPlot({
        id: plotIdInput,
        farm_id: plotFarmId,
        name: plotName,
        crop_type: plotCrop,
        grid_row: Number(plotGridRow),
        grid_col: Number(plotGridCol),
        dimensions_meters: plotDims,
        row_identifiers: plotRows,
        assigned_rover_id: 'rover-001'
      });
      setShowAddPlotModal(false);
      setPlotIdInput('');
      setPlotName('');
      loadFarms();
    } catch (err) {
      alert('Error creating plot: ' + (err as Error).message);
    }
  };

  const allPlots: Plot[] = farms.flatMap((f) => f.plots || []);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <Layers className="w-5 h-5 text-agri-lime" />
            <span>Farm & Spatial Plot Layout</span>
          </h2>
          <p className="text-xs text-agri-muted">
            Manage agricultural zones, crop rows, dimensions, and assigned rover surveillance routes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddFarmModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-xs font-medium text-agri-offwhite transition-all"
          >
            <Plus className="w-4 h-4 text-agri-lime" />
            <span>Register Farm</span>
          </button>
          <button
            onClick={() => {
              if (farms.length > 0) setPlotFarmId(farms[0].id);
              setShowAddPlotModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-agri-lime hover:bg-agri-limeBright text-agri-darkest font-semibold text-xs transition-all shadow-md shadow-agri-lime/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Plot Zone</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): Visual Grid Map of Plots */}
        <div className="lg:col-span-7 space-y-4">
          <div className="agri-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-agri-offwhite">Interactive Plot Grid Layout</h3>
                <p className="text-xs text-agri-muted">Spatial zone coordinate matrix</p>
              </div>
              <span className="text-[11px] font-mono text-agri-lime px-2 py-0.5 rounded bg-agri-card border border-agri-border">
                {allPlots.length} Monitored Sectors
              </span>
            </div>

            {/* Visual 2D Sector Grid */}
            <div className="grid grid-cols-2 gap-4">
              {allPlots.map((plot) => {
                const isSelected = selectedPlot?.id === plot.id;
                return (
                  <div
                    key={plot.id}
                    onClick={() => selectPlot(plot)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-agri-card border-agri-lime shadow-lg shadow-agri-lime/10'
                        : 'bg-agri-darkest/70 border-agri-border/60 hover:border-agri-border hover:bg-agri-card/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-agri-darkest border border-agri-border text-agri-lime">
                          {plot.crop_type}
                        </span>
                        <h4 className="text-sm font-bold text-agri-offwhite mt-1.5">{plot.name}</h4>
                        <p className="text-xs text-agri-muted">{plot.dimensions_meters} | {plot.row_identifiers}</p>
                      </div>

                      <div className="p-2 rounded-lg bg-agri-darkest border border-agri-border text-agri-lime">
                        <Sprout className="w-4 h-4" />
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-agri-border/40 flex items-center justify-between text-[11px] text-agri-muted">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <Bot className="w-3 h-3 text-agri-lime" />
                        {plot.assigned_rover_id || 'rover-001'}
                      </span>
                      <span className="font-mono text-[10px] text-agri-offwhite">
                        Grid [{plot.grid_row},{plot.grid_col}]
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-0 right-0 w-2 h-2 bg-agri-lime rounded-bl" />
                    )}
                  </div>
                );
              })}

              {allPlots.length === 0 && (
                <div className="col-span-2 py-12 text-center text-xs text-agri-muted">
                  No plots registered yet. Click "Add Plot Zone" above.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (5 Cols): Selected Plot Inspector */}
        <div className="lg:col-span-5 space-y-4">
          <div className="agri-card p-5 rounded-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
                <MapPin className="w-4 h-4 text-agri-lime" />
                <span>Sector Telemetry Inspector</span>
              </h3>
              {selectedPlot && (
                <span className="text-xs font-mono text-agri-lime font-bold">
                  {selectedPlot.id}
                </span>
              )}
            </div>

            {selectedPlot ? (
              <div className="space-y-4">
                {/* Sector Details */}
                <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-agri-muted">Sector Name:</span>
                    <span className="font-bold text-agri-offwhite">{selectedPlot.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-agri-muted">Planted Crop:</span>
                    <span className="text-agri-lime font-medium">{selectedPlot.crop_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-agri-muted">Row Identifiers:</span>
                    <span className="font-mono text-agri-offwhite">{selectedPlot.row_identifiers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-agri-muted">Survey Dimensions:</span>
                    <span className="font-mono text-agri-offwhite">{selectedPlot.dimensions_meters}</span>
                  </div>
                </div>

                {/* Latest Sensor Metrics for this plot */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-agri-offwhite">Latest Plot Telemetry</h4>
                  {plotSummary?.latest_telemetry ? (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-lg bg-agri-darkest border border-agri-border">
                        <span className="text-[10px] text-agri-muted block flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-blue-400" /> Moisture
                        </span>
                        <span className="text-base font-bold text-agri-offwhite">
                          {plotSummary.latest_telemetry.soil_moisture_percent?.toFixed(1) ?? '--'}%
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-agri-darkest border border-agri-border">
                        <span className="text-[10px] text-agri-muted block flex items-center gap-1">
                          <Gauge className="w-3 h-3 text-purple-400" /> Soil pH
                        </span>
                        <span className="text-base font-bold text-agri-offwhite">
                          {plotSummary.latest_telemetry.soil_ph?.toFixed(2) ?? '--'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-agri-darkest border border-agri-border">
                        <span className="text-[10px] text-agri-muted block flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-amber-400" /> Temp
                        </span>
                        <span className="text-base font-bold text-agri-offwhite">
                          {plotSummary.latest_telemetry.temperature_c?.toFixed(1) ?? '--'}°C
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-agri-darkest border border-agri-border">
                        <span className="text-[10px] text-agri-muted block flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-emerald-400" /> Humidity
                        </span>
                        <span className="text-base font-bold text-agri-offwhite">
                          {plotSummary.latest_telemetry.humidity_percent?.toFixed(1) ?? '--'}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-agri-muted p-3 rounded-lg bg-agri-darkest/60 border border-agri-border">
                      No sensor telemetry registered for this sector yet.
                    </p>
                  )}
                </div>

                {/* Recent Disease Scans for this plot */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-agri-offwhite">Recent Plant Disease Scans</h4>
                  {plotSummary?.recent_scans && plotSummary.recent_scans.length > 0 ? (
                    <div className="space-y-1.5">
                      {plotSummary.recent_scans.slice(0, 3).map((s) => (
                        <div
                          key={s.id}
                          className="p-2 rounded-lg bg-agri-darkest border border-agri-border flex items-center justify-between text-xs"
                        >
                          <div className="truncate pr-2">
                            <span className="font-medium text-agri-offwhite block truncate">
                              {s.predicted_class}
                            </span>
                            <span className="text-[10px] text-agri-muted">{s.row_id || 'Row 1'}</span>
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                              s.is_healthy ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {Math.round(s.confidence * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-agri-muted p-3 rounded-lg bg-agri-darkest/60 border border-agri-border">
                      No foliage scans recorded for this sector yet.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-agri-muted">
                Select a plot from the layout grid to inspect real-time observations.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Register Farm Modal */}
      {showAddFarmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-agri-darkest border border-agri-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-agri-border/60 pb-3">
              <h3 className="text-base font-bold text-agri-offwhite">Register Agricultural Facility</h3>
              <button onClick={() => setShowAddFarmModal(false)} className="text-agri-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateFarm} className="space-y-3 text-xs">
              <div>
                <label className="block text-agri-muted mb-1">Farm ID:</label>
                <input
                  type="text"
                  required
                  value={farmId}
                  onChange={(e) => setFarmId(e.target.value)}
                  placeholder="e.g. farm-002"
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                />
              </div>
              <div>
                <label className="block text-agri-muted mb-1">Facility Name:</label>
                <input
                  type="text"
                  required
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  placeholder="e.g. South Agritech Experimental Farm"
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border text-agri-offwhite"
                />
              </div>
              <div>
                <label className="block text-agri-muted mb-1">Physical Location:</label>
                <input
                  type="text"
                  required
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  placeholder="e.g. University Campus Sector 4"
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border text-agri-offwhite"
                />
              </div>
              <div>
                <label className="block text-agri-muted mb-1">Total Acreage:</label>
                <input
                  type="number"
                  step="0.1"
                  value={farmAcres}
                  onChange={(e) => setFarmAcres(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddFarmModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-agri-muted hover:text-agri-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-agri-lime text-agri-darkest font-semibold text-xs shadow-md"
                >
                  Register Farm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Plot Modal */}
      {showAddPlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-agri-darkest border border-agri-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-agri-border/60 pb-3">
              <h3 className="text-base font-bold text-agri-offwhite">Create Plot Sector</h3>
              <button onClick={() => setShowAddPlotModal(false)} className="text-agri-muted hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreatePlot} className="space-y-3 text-xs">
              <div>
                <label className="block text-agri-muted mb-1">Plot ID:</label>
                <input
                  type="text"
                  required
                  value={plotIdInput}
                  onChange={(e) => setPlotIdInput(e.target.value)}
                  placeholder="e.g. plot-005"
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                />
              </div>
              <div>
                <label className="block text-agri-muted mb-1">Associate with Farm:</label>
                <select
                  value={plotFarmId}
                  onChange={(e) => setPlotFarmId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border text-agri-offwhite"
                >
                  {farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.id})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-agri-muted mb-1">Plot Name:</label>
                <input
                  type="text"
                  required
                  value={plotName}
                  onChange={(e) => setPlotName(e.target.value)}
                  placeholder="e.g. West Tomato Greenhouse"
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border text-agri-offwhite"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-agri-muted mb-1">Crop Type:</label>
                  <input
                    type="text"
                    required
                    value={plotCrop}
                    onChange={(e) => setPlotCrop(e.target.value)}
                    placeholder="e.g. Tomato"
                    className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border text-agri-offwhite"
                  />
                </div>
                <div>
                  <label className="block text-agri-muted mb-1">Dimensions:</label>
                  <input
                    type="text"
                    value={plotDims}
                    onChange={(e) => setPlotDims(e.target.value)}
                    placeholder="e.g. 30m x 20m"
                    className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                  />
                </div>
              </div>
              <div>
                <label className="block text-agri-muted mb-1">Row Identifiers:</label>
                <input
                  type="text"
                  value={plotRows}
                  onChange={(e) => setPlotRows(e.target.value)}
                  placeholder="e.g. Rows A1-A8"
                  className="w-full px-3 py-2 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlotModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-agri-muted hover:text-agri-offwhite"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-agri-lime text-agri-darkest font-semibold text-xs shadow-md"
                >
                  Create Plot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
