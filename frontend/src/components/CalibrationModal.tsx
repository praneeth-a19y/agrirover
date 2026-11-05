import React, { useState, useEffect } from 'react';
import { X, Sliders, Check, HelpCircle, Calculator } from 'lucide-react';
import { api } from '../services/api';
import { CalibrationStatus } from '../types';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({ isOpen, onClose, onUpdated }) => {
  const [calibration, setCalibration] = useState<CalibrationStatus | null>(null);
  const [dryAdc, setDryAdc] = useState<number>(3200);
  const [wetAdc, setWetAdc] = useState<number>(1400);
  const [ph4Voltage, setPh4Voltage] = useState<number>(3.05);
  const [ph7Voltage, setPh7Voltage] = useState<number>(2.50);
  
  // Test inputs
  const [testAdc, setTestAdc] = useState<number>(2300);
  const [testVoltage, setTestVoltage] = useState<number>(2.50);
  const [testResult, setTestResult] = useState<{ moisture?: number; ph?: number }>({});
  
  const [isLoading, setIsLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCalibration();
    }
  }, [isOpen]);

  const loadCalibration = async () => {
    try {
      const data = await api.getCalibration();
      setCalibration(data);
      setDryAdc(data.soil_moisture.dry_adc);
      setWetAdc(data.soil_moisture.wet_adc);
      setPh4Voltage(data.soil_ph.ph4_voltage);
      setPh7Voltage(data.soil_ph.ph7_voltage);
      calculateLive(data.soil_moisture.dry_adc, data.soil_moisture.wet_adc, data.soil_ph.ph4_voltage, data.soil_ph.ph7_voltage, 2300, 2.50);
    } catch (err) {
      console.error('Error fetching calibration:', err);
    }
  };

  const calculateLive = (d: number, w: number, v4: number, v7: number, adc: number, volt: number) => {
    // Moisture % = (dry - adc) / (dry - wet) * 100
    const m = d !== w ? Math.max(0, Math.min(100, Math.round(((d - adc) / (d - w)) * 1000) / 10)) : 50;
    // Slope = (v7 - v4) / (7.0 - 4.01)
    const slope = (v7 - v4) / 2.99;
    const ph = slope !== 0 ? Math.max(0, Math.min(14, Math.round((7.0 + (volt - v7) / slope) * 100) / 100)) : 7.0;
    setTestResult({ moisture: m, ph });
  };

  const handleSave = async () => {
    setIsLoading(true);
    setSaveSuccess(false);
    try {
      await api.updateMoistureCalibration({
        dry_adc: Number(dryAdc),
        wet_adc: Number(wetAdc),
        notes: 'Updated via dashboard calibration wizard'
      });
      await api.updatePHCalibration({
        ph4_voltage: Number(ph4Voltage),
        ph7_voltage: Number(ph7Voltage),
        notes: 'Updated via dashboard calibration wizard'
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onUpdated?.();
    } catch (err) {
      alert('Failed to save calibration: ' + (err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-agri-darkest border border-agri-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-agri-border/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-agri-card border border-agri-border text-agri-lime">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-agri-offwhite">Hardware Sensor Calibration</h2>
              <p className="text-xs text-agri-muted">Convert raw ADC voltages to verified soil metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-agri-muted hover:text-agri-offwhite rounded-lg hover:bg-agri-card"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Hardware Calibration Principles Notice */}
          <div className="p-3.5 rounded-xl bg-agri-card/60 border border-agri-border/60 text-xs text-agri-offwhite/80 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-agri-lime">
              <HelpCircle className="w-4 h-4" />
              <span>College Project Calibration Principle</span>
            </div>
            <p>
              Raw ADC counts (0–4095 on ESP32 12-bit ADC) depend on soil texture and salinity. Raw voltages from analog pH probes shift with temperature. True agronomic measurements require two-point calibration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. Capacitive Soil Moisture Sensor */}
            <div className="p-4 rounded-xl bg-agri-card/40 border border-agri-border/50 space-y-3">
              <h3 className="text-sm font-semibold text-agri-offwhite flex items-center justify-between">
                <span>Soil Moisture (Capacitive)</span>
                <span className="text-[11px] font-mono text-agri-lime">12-bit ADC</span>
              </h3>
              
              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-agri-muted mb-1">Dry Air Reading (0% Moisture):</label>
                  <input
                    type="number"
                    value={dryAdc}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setDryAdc(v);
                      calculateLive(v, wetAdc, ph4Voltage, ph7Voltage, testAdc, testVoltage);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-agri-darkest border border-agri-border text-agri-offwhite font-mono focus:border-agri-lime outline-none"
                    placeholder="3200"
                  />
                  <p className="text-[10px] text-agri-muted mt-0.5">Place probe in open air.</p>
                </div>

                <div>
                  <label className="block text-agri-muted mb-1">Water Submerged (100% Saturation):</label>
                  <input
                    type="number"
                    value={wetAdc}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setWetAdc(v);
                      calculateLive(dryAdc, v, ph4Voltage, ph7Voltage, testAdc, testVoltage);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-agri-darkest border border-agri-border text-agri-offwhite font-mono focus:border-agri-lime outline-none"
                    placeholder="1400"
                  />
                  <p className="text-[10px] text-agri-muted mt-0.5">Dip probe up to red line in water cup.</p>
                </div>
              </div>
            </div>

            {/* 2. Analog Soil pH Probe */}
            <div className="p-4 rounded-xl bg-agri-card/40 border border-agri-border/50 space-y-3">
              <h3 className="text-sm font-semibold text-agri-offwhite flex items-center justify-between">
                <span>Soil pH Sensor Probe</span>
                <span className="text-[11px] font-mono text-agri-lime">Volts (V)</span>
              </h3>
              
              <div className="space-y-2 text-xs">
                <div>
                  <label className="block text-agri-muted mb-1">Buffer 7.00 Output Voltage:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ph7Voltage}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPh7Voltage(v);
                      calculateLive(dryAdc, wetAdc, ph4Voltage, v, testAdc, testVoltage);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-agri-darkest border border-agri-border text-agri-offwhite font-mono focus:border-agri-lime outline-none"
                    placeholder="2.50"
                  />
                  <p className="text-[10px] text-agri-muted mt-0.5">Neutral buffer calibration.</p>
                </div>

                <div>
                  <label className="block text-agri-muted mb-1">Buffer 4.01 Output Voltage:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={ph4Voltage}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPh4Voltage(v);
                      calculateLive(dryAdc, wetAdc, v, ph7Voltage, testAdc, testVoltage);
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-agri-darkest border border-agri-border text-agri-offwhite font-mono focus:border-agri-lime outline-none"
                    placeholder="3.05"
                  />
                  <p className="text-[10px] text-agri-muted mt-0.5">Acidic buffer calibration.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Calibration Calculator */}
          <div className="p-4 rounded-xl bg-agri-darkest border border-agri-border/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-agri-offwhite">
              <Calculator className="w-4 h-4 text-agri-lime" />
              <span>Real-Time Two-Point Test Calculator</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-agri-muted">Test Raw ADC (Moisture):</label>
                <input
                  type="number"
                  value={testAdc}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTestAdc(v);
                    calculateLive(dryAdc, wetAdc, ph4Voltage, ph7Voltage, v, testVoltage);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                />
                <div className="text-xs pt-1">
                  Computed Moisture: <span className="font-mono font-bold text-agri-lime text-sm">{testResult.moisture}%</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-agri-muted">Test Raw Voltage (pH):</label>
                <input
                  type="number"
                  step="0.01"
                  value={testVoltage}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setTestVoltage(v);
                    calculateLive(dryAdc, wetAdc, ph4Voltage, ph7Voltage, testAdc, v);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-agri-card border border-agri-border font-mono text-agri-offwhite"
                />
                <div className="text-xs pt-1">
                  Computed Soil pH: <span className="font-mono font-bold text-agri-lime text-sm">{testResult.ph} pH</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-agri-border/60 flex items-center justify-between">
          <div className="text-xs text-agri-muted">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-agri-emerald font-medium">
                <Check className="w-4 h-4" /> Calibration constants persisted!
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-agri-muted hover:text-agri-offwhite hover:bg-agri-card transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="px-5 py-2 rounded-xl bg-agri-lime hover:bg-agri-limeBright text-agri-darkest font-semibold text-xs transition-all shadow-md shadow-agri-lime/20 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Apply Calibration'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
