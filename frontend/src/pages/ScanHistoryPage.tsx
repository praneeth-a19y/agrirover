import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  X,
  ExternalLink,
  ShieldAlert,
  Info,
  Clock,
  Sprout,
  Download
} from 'lucide-react';
import { api } from '../services/api';
import { DiseaseScanHistoryItem, DiseasePrediction, Plot } from '../types';

export const ScanHistoryPage: React.FC = () => {
  const [scans, setScans] = useState<DiseaseScanHistoryItem[]>([]);
  const [filterHealth, setFilterHealth] = useState<string>('all');
  const [selectedPlot, setSelectedPlot] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [plots, setPlots] = useState<Plot[]>([]);
  const [activeScanDetail, setActiveScanDetail] = useState<DiseasePrediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadPlots();
  }, []);

  useEffect(() => {
    loadScans();
  }, [filterHealth, selectedPlot]);

  const loadPlots = async () => {
    try {
      const data = await api.getPlots();
      setPlots(data);
    } catch (err) {
      console.error('Error fetching plots:', err);
    }
  };

  const loadScans = async () => {
    setIsLoading(true);
    try {
      const isHealthyParam = filterHealth === 'all' ? undefined : filterHealth === 'healthy' ? true : false;
      const data = await api.getDiseaseScans(selectedPlot || undefined, isHealthyParam, 100);
      setScans(data);
    } catch (err) {
      console.error('Error loading scans:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openScanDetail = async (id: string) => {
    try {
      const detail = await api.getDiseaseScanDetail(id);
      setActiveScanDetail(detail);
    } catch (err) {
      alert('Error fetching scan detail: ' + (err as Error).message);
    }
  };

  const filteredScans = scans.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.predicted_class.toLowerCase().includes(q) ||
      (s.plot_id && s.plot_id.toLowerCase().includes(q)) ||
      (s.row_id && s.row_id.toLowerCase().includes(q)) ||
      s.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <History className="w-5 h-5 text-agri-lime" />
            <span>Pathological Scan History & Image Repository</span>
          </h2>
          <p className="text-xs text-agri-muted">
            Searchable historical catalog of high-resolution crop observations and AI classifications.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-agri-muted absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search diagnosis, sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-xl bg-agri-card border border-agri-border text-xs text-agri-offwhite placeholder:text-agri-muted outline-none focus:border-agri-lime w-48 sm:w-56"
            />
          </div>

          {/* Health Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-agri-card border border-agri-border text-xs font-mono">
            {[
              { id: 'all', label: 'All' },
              { id: 'healthy', label: 'Healthy' },
              { id: 'diseased', label: 'Diseased' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterHealth(f.id)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterHealth === f.id
                    ? 'bg-agri-lime text-agri-darkest font-bold'
                    : 'text-agri-muted hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Plot Sector Filter */}
          <select
            value={selectedPlot}
            onChange={(e) => setSelectedPlot(e.target.value)}
            className="px-3 py-2 rounded-xl bg-agri-card border border-agri-border text-agri-offwhite text-xs outline-none focus:border-agri-lime"
          >
            <option value="">All Plots</option>
            {plots.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Scans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredScans.map((scan) => (
          <div
            key={scan.id}
            onClick={() => openScanDetail(scan.id)}
            className="agri-card agri-card-hover p-3.5 rounded-2xl border border-agri-border/60 cursor-pointer space-y-3 group"
          >
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-agri-border">
              <img
                src={scan.image_url}
                alt={scan.predicted_class}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute top-2 right-2">
                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md ${
                    scan.is_healthy
                      ? 'bg-emerald-600/90 text-white'
                      : 'bg-amber-600/90 text-white'
                  }`}
                >
                  {scan.is_healthy ? 'HEALTHY' : 'DISEASED'}
                </span>
              </div>
              <div className="absolute bottom-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-agri-offwhite">
                {Math.round(scan.confidence * 100)}% Conf
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-agri-offwhite truncate" title={scan.predicted_class}>
                {scan.predicted_class.replace(/___/g, ' - ').replace(/_/g, ' ')}
              </h4>
              <div className="flex items-center justify-between text-[11px] text-agri-muted">
                <span>{scan.plot_id || 'North Tomato Field'}</span>
                <span className="font-mono text-[10px]">{scan.row_id || 'Row 1'}</span>
              </div>
              <div className="pt-2 border-t border-agri-border/40 flex items-center justify-between text-[10px] text-agri-muted">
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  {new Date(scan.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                </span>
                <span className="text-agri-lime font-medium group-hover:underline flex items-center gap-1">
                  Inspect <ExternalLink className="w-2.5 h-2.5" />
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredScans.length === 0 && (
          <div className="col-span-full py-16 text-center space-y-2">
            <Sprout className="w-10 h-10 text-agri-muted mx-auto opacity-50" />
            <p className="text-sm font-semibold text-agri-offwhite">No Scans Found</p>
            <p className="text-xs text-agri-muted">
              Try adjusting your search query or filters.
            </p>
          </div>
        )}
      </div>

      {/* Detailed Modal Inspection */}
      {activeScanDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-agri-darkest border border-agri-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-agri-border/60 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase text-agri-lime">
                  Diagnostic Case #{activeScanDetail.scan_id}
                </span>
                <h3 className="text-lg font-bold text-agri-offwhite">
                  {activeScanDetail.predicted_class}
                </h3>
              </div>
              <button
                onClick={() => setActiveScanDetail(null)}
                className="p-1.5 text-agri-muted hover:text-white rounded-lg hover:bg-agri-card"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* High-res Photo Preview */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-agri-border">
              <img
                src={activeScanDetail.image_url}
                alt={activeScanDetail.predicted_class}
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 right-3 flex gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-black/70 text-agri-lime border border-agri-lime/40">
                  {(activeScanDetail.confidence * 100).toFixed(1)}% Confidence
                </span>
              </div>
            </div>

            {/* Pathological Findings */}
            <div className="space-y-3 text-xs">
              <div className="p-3.5 rounded-xl bg-agri-card/40 border border-agri-border/60 space-y-1">
                <span className="font-semibold text-agri-offwhite flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-agri-lime" />
                  <span>Symptomatic Observations:</span>
                </span>
                <p className="text-agri-muted leading-relaxed pl-5">
                  {activeScanDetail.symptoms || 'Visual symptoms observed on foliar leaf blade.'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-agri-card/40 border border-agri-border/60 space-y-1">
                <span className="font-semibold text-agri-offwhite flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-agri-lime" />
                  <span>Agronomic Action Plan & Spray Schedule:</span>
                </span>
                <p className="text-agri-offwhite/90 leading-relaxed pl-5 font-sans">
                  {activeScanDetail.recommendations || 'Continue standard field scout surveillance.'}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px] pt-1">
                <div className="p-2 rounded-lg bg-agri-darkest border border-agri-border">
                  <span className="text-agri-muted block text-[10px]">Sector:</span>
                  <span className="text-agri-offwhite font-bold">{activeScanDetail.plot_id || 'General'}</span>
                </div>
                <div className="p-2 rounded-lg bg-agri-darkest border border-agri-border">
                  <span className="text-agri-muted block text-[10px]">Row:</span>
                  <span className="text-agri-offwhite font-bold">{activeScanDetail.row_id || 'Row 1'}</span>
                </div>
                <div className="p-2 rounded-lg bg-agri-darkest border border-agri-border">
                  <span className="text-agri-muted block text-[10px]">Inference Mode:</span>
                  <span className="text-agri-lime font-bold">{activeScanDetail.inference_mode}</span>
                </div>
                <div className="p-2 rounded-lg bg-agri-darkest border border-agri-border">
                  <span className="text-agri-muted block text-[10px]">Captured:</span>
                  <span className="text-agri-offwhite font-bold">
                    {new Date(activeScanDetail.timestamp).toISOString().replace('T', ' ').substring(0, 19)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-agri-border/60">
              <a
                href={activeScanDetail.image_url}
                download={`agrirover-scan-${activeScanDetail.scan_id}.jpg`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-agri-lime text-agri-darkest text-xs font-semibold shadow-md hover:bg-agri-lime/90 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Photo</span>
              </a>
              <button
                onClick={() => setActiveScanDetail(null)}
                className="px-5 py-2 rounded-xl bg-agri-card hover:bg-agri-cardHover text-agri-offwhite text-xs font-semibold"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
