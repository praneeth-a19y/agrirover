import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Bot,
  Cpu,
  Database,
  Sliders,
  Sparkles,
  Trash2,
  CheckCircle2,
  HelpCircle,
  FileCode2,
  RefreshCw,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { ModelStatus } from '../types';

interface SettingsPageProps {
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onOpenCalibration: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  isDemoMode,
  onToggleDemoMode,
  onOpenCalibration,
}) => {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState('rover-001');

  useEffect(() => {
    loadModelStatus();
  }, []);

  const loadModelStatus = async () => {
    try {
      const data = await api.getModelStatus();
      setModelStatus(data);
    } catch (err) {
      console.error('Error fetching model status:', err);
    }
  };

  const handleClearSimulated = async () => {
    if (!window.confirm('Clear all simulated demo records? Real hardware telemetry and genuine scans will NOT be deleted.')) {
      return;
    }
    setIsClearing(true);
    setClearMessage(null);
    try {
      const res = await api.clearSimulatedData();
      setClearMessage(`Cleared ${res.deleted_simulated_telemetry} simulated readings and ${res.deleted_demo_scans} demo scans.`);
    } catch (err) {
      alert('Error clearing simulated data: ' + (err as Error).message);
    } finally {
      setIsClearing(false);
      setTimeout(() => setClearMessage(null), 5000);
    }
  };

  const handleSeedDemo = async () => {
    try {
      await api.seedDemoData();
      alert('Sample EPICS agritech dataset seeded successfully.');
    } catch (err) {
      alert('Error seeding demo data: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-agri-lime" />
            <span>System Architecture & Integration Settings</span>
          </h2>
          <p className="text-xs text-agri-muted">
            Configure ESP32 hardware endpoints, offline ML models, and demonstration testing mode.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Hardware & IoT Configuration */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-agri-border/40 pb-3">
            <Bot className="w-4 h-4 text-agri-lime" />
            <h3 className="text-sm font-bold text-agri-offwhite">Rover IoT Gateway Configuration</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-agri-muted mb-1">Rover Device Identifier:</label>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-agri-darkest border border-agri-border font-mono text-agri-offwhite outline-none focus:border-agri-lime"
              />
              <p className="text-[10px] text-agri-muted mt-0.5">
                Must match the <code className="text-agri-lime">DEVICE_ID</code> configured in the ESP32 Arduino sketch.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 space-y-1.5 font-mono text-[11px]">
              <div className="text-agri-muted font-sans font-semibold">Active Hardware REST Endpoints:</div>
              <div className="text-agri-offwhite/90">POST /api/v1/telemetry</div>
              <div className="text-agri-offwhite/90">POST /api/v1/rover/status</div>
              <div className="text-agri-offwhite/90">GET /api/v1/rover/commands/pending</div>
              <div className="text-agri-offwhite/90">POST /api/v1/camera/upload</div>
            </div>

            <div className="pt-1">
              <button
                onClick={onOpenCalibration}
                className="w-full py-2.5 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-xs font-semibold text-agri-lime transition-all flex items-center justify-center gap-2"
              >
                <Sliders className="w-4 h-4" />
                <span>Launch Sensor Two-Point Calibration Wizard</span>
              </button>
            </div>
          </div>
        </div>

        {/* Offline Machine Learning Engine */}
        <div className="agri-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-agri-border/40 pb-3">
            <Cpu className="w-4 h-4 text-agri-lime" />
            <h3 className="text-sm font-bold text-agri-offwhite">Offline AI Inference Engine</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-agri-darkest border border-agri-border space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-agri-muted">Model Path:</span>
                <span className="font-mono text-agri-offwhite text-[11px] truncate max-w-[200px]" title={modelStatus?.model_path || ''}>
                  {modelStatus?.model_path || 'backend/models/crop_disease_model.tflite'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-agri-muted">Model Status:</span>
                <span
                  className={`font-mono font-bold text-[10px] px-2 py-0.5 rounded ${
                    modelStatus?.model_loaded
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {modelStatus?.model_loaded ? 'TFLITE RUNTIME ACTIVE' : 'OFFLINE HEURISTIC ADAPTER'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-agri-muted">Supported Pathogens:</span>
                <span className="font-mono text-agri-lime font-bold">{modelStatus?.classes_count ?? 13} Classes</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-agri-card/30 border border-agri-border/60 text-[11px] text-agri-muted space-y-1">
              <span className="font-semibold text-agri-offwhite block">Connecting Custom Weights:</span>
              <p>
                Place your trained <code className="text-agri-lime font-mono">crop_disease_model.tflite</code> in <code className="text-agri-lime font-mono">backend/models/</code> and restart the server. The engine automatically switches from heuristic fallback to local tensor execution without internet access.
              </p>
            </div>
          </div>
        </div>

        {/* Demo Mode & College EPICS Controls */}
        <div className="agri-card p-5 rounded-2xl space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 border-b border-agri-border/40 pb-3">
            <Sparkles className="w-4 h-4 text-agri-lime" />
            <h3 className="text-sm font-bold text-agri-offwhite">College Demonstration & Sample Data Engine</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-2">
              <span className="text-agri-offwhite font-semibold block">Demonstration Mode Switch</span>
              <p className="text-agri-muted leading-relaxed">
                Toggle between hardware-connected mode and simulated evaluation mode. In Demo Mode, realistic diurnal sensor curves and sample disease scans allow full testing before physical field trials.
              </p>
              <div className="pt-1">
                <button
                  onClick={onToggleDemoMode}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                    isDemoMode
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-agri-card hover:bg-agri-cardHover text-agri-offwhite border border-agri-border'
                  }`}
                >
                  {isDemoMode ? 'Demo Mode Active (Click to Switch to Live Hardware)' : 'Enable Demo Simulation Mode'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-agri-offwhite font-semibold block">Sample Data Management</span>
              <p className="text-agri-muted leading-relaxed">
                Repopulate evaluation farms, plot grids, and scans, or clear simulated readings when presenting real measurements to EPICS project reviewers.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSeedDemo}
                  className="px-3.5 py-2 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-agri-offwhite text-xs font-semibold"
                >
                  Re-seed Demo Data
                </button>
                <button
                  onClick={handleClearSimulated}
                  disabled={isClearing}
                  className="px-3.5 py-2 rounded-xl bg-red-950/60 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isClearing ? 'Purging...' : 'Purge Simulated Data'}</span>
                </button>
              </div>
              {clearMessage && (
                <p className="text-[11px] text-agri-emerald font-mono pt-1">{clearMessage}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
