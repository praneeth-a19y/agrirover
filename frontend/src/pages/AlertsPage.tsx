import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  OctagonAlert,
  Info,
  CheckCircle2,
  Clock,
  Filter,
  Sliders,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { Alert, AlertConfig } from '../types';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('');
  const [filterAck, setFilterAck] = useState<string>('unacked');
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAlerts();
    loadConfig();
  }, [filterSeverity, filterAck]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const ackParam = filterAck === 'all' ? undefined : filterAck === 'unacked' ? false : true;
      const data = await api.getAlerts(ackParam, filterSeverity || undefined);
      setAlerts(data);
    } catch (err) {
      console.error('Error loading alerts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const data = await api.getAlertConfig();
      setConfig(data);
    } catch (err) {
      console.error('Error loading alert config:', err);
    }
  };

  const handleAcknowledge = async (alertId: number) => {
    try {
      await api.acknowledgeAlert(alertId);
      loadAlerts();
    } catch (err) {
      alert('Failed to acknowledge alert: ' + (err as Error).message);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config) return;
    try {
      await api.updateAlertConfig(config);
      setShowConfig(false);
      alert('Alert thresholds updated successfully.');
    } catch (err) {
      alert('Failed to update thresholds: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <Bell className="w-5 h-5 text-agri-lime" />
            <span>Agronomic Alerts & Decision Engine</span>
          </h2>
          <p className="text-xs text-agri-muted">
            Intelligent threshold monitoring with anti-flooding cooldown protection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-agri-card border border-agri-border text-xs font-mono">
            {[
              { id: 'unacked', label: 'Active' },
              { id: 'acked', label: 'Acknowledged' },
              { id: 'all', label: 'All' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilterAck(f.id)}
                className={`px-3 py-1 rounded-lg transition-all ${
                  filterAck === f.id
                    ? 'bg-agri-lime text-agri-darkest font-bold'
                    : 'text-agri-muted hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 rounded-xl bg-agri-card border border-agri-border text-agri-offwhite text-xs outline-none focus:border-agri-lime"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="WARNING">Warning</option>
            <option value="INFO">Informational</option>
          </select>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border text-xs font-semibold text-agri-lime transition-all"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Threshold Rules</span>
          </button>
        </div>
      </div>

      {/* Threshold Rules Drawer */}
      {showConfig && config && (
        <div className="p-5 rounded-2xl bg-agri-dark/90 border border-agri-border space-y-4 shadow-xl">
          <div className="border-b border-agri-border/60 pb-3">
            <h3 className="text-sm font-bold text-agri-offwhite">Configurable Alert Rules Engine</h3>
            <p className="text-xs text-agri-muted">Thresholds preventing environmental damage & pathogen spread</p>
          </div>

          <form onSubmit={handleSaveConfig} className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block text-agri-muted mb-1">Min Soil Moisture (%):</label>
              <input
                type="number"
                value={config.moisture_min}
                onChange={(e) => setConfig({ ...config, moisture_min: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
              />
            </div>
            <div>
              <label className="block text-agri-muted mb-1">Max Soil Moisture (%):</label>
              <input
                type="number"
                value={config.moisture_max}
                onChange={(e) => setConfig({ ...config, moisture_max: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
              />
            </div>
            <div>
              <label className="block text-agri-muted mb-1">Min Soil pH:</label>
              <input
                type="number"
                step="0.1"
                value={config.ph_min}
                onChange={(e) => setConfig({ ...config, ph_min: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
              />
            </div>
            <div>
              <label className="block text-agri-muted mb-1">Max Soil pH:</label>
              <input
                type="number"
                step="0.1"
                value={config.ph_max}
                onChange={(e) => setConfig({ ...config, ph_max: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
              />
            </div>
            <div>
              <label className="block text-agri-muted mb-1">Max Canopy Temp (°C):</label>
              <input
                type="number"
                value={config.temp_max}
                onChange={(e) => setConfig({ ...config, temp_max: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
              />
            </div>
            <div>
              <label className="block text-agri-muted mb-1">Disease Conf. Threshold:</label>
              <input
                type="number"
                step="0.05"
                value={config.disease_confidence_threshold}
                onChange={(e) => setConfig({ ...config, disease_confidence_threshold: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 rounded-lg bg-agri-darkest border border-agri-border font-mono text-agri-offwhite"
              />
            </div>
            <div className="sm:col-span-2 flex items-end justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfig(false)}
                className="px-3 py-1.5 rounded-xl text-xs text-agri-muted hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-agri-lime text-agri-darkest font-semibold text-xs shadow-md"
              >
                Update Rules
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alerts Feed */}
      <div className="space-y-3">
        {alerts.map((alert) => {
          const isCritical = alert.severity === 'CRITICAL';
          const isWarning = alert.severity === 'WARNING';
          return (
            <div
              key={alert.id}
              className={`agri-card p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                alert.acknowledged
                  ? 'opacity-60 bg-agri-darkest/40'
                  : isCritical
                  ? 'border-red-500/50 bg-red-950/20 shadow-lg shadow-red-950/20'
                  : 'border-amber-500/40 bg-amber-950/20'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`p-2.5 rounded-xl border mt-0.5 flex-shrink-0 ${
                    isCritical
                      ? 'bg-red-500/20 text-red-400 border-red-500/30'
                      : isWarning
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }`}
                >
                  {isCritical ? (
                    <OctagonAlert className="w-5 h-5 animate-pulse" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-agri-offwhite">{alert.title}</h4>
                    <span
                      className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-full ${
                        isCritical
                          ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-agri-muted">
                      Sector: {alert.plot_id || 'Campus General'}
                    </span>
                  </div>

                  <p className="text-xs text-agri-offwhite/80 max-w-3xl leading-relaxed">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-3 text-[11px] text-agri-muted pt-1">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                    {alert.reading_value !== null && alert.reading_value !== undefined && (
                      <span className="font-mono">
                        Observed: <strong className="text-agri-offwhite">{alert.reading_value}</strong>
                        {alert.threshold_value && ` (Threshold: ${alert.threshold_value})`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-center">
                {alert.acknowledged ? (
                  <span className="text-xs text-agri-muted font-mono flex items-center gap-1 px-3 py-1.5 rounded-xl bg-agri-darkest border border-agri-border">
                    <Check className="w-3.5 h-3.5 text-agri-emerald" />
                    <span>Acknowledged</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-4 py-2 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-border hover:border-agri-lime text-xs font-semibold text-agri-offwhite transition-all shadow-sm"
                  >
                    Acknowledge Action
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {alerts.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-agri-emerald mx-auto opacity-70" />
            <p className="text-sm font-semibold text-agri-offwhite">All Clear</p>
            <p className="text-xs text-agri-muted">
              No alerts match the active filter criteria.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
