import React, { useState, useEffect } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Bot,
  BatteryCharging,
  Wifi,
  WifiOff,
  AlertTriangle,
  History,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  Clock,
  Loader2,
  Lightbulb,
  Radio,
  Zap,
  Camera,
  Gauge,
} from 'lucide-react';
import { api } from '../services/api';
import { socketService } from '../services/socketService';
import { RoverStatus, RoverCommand } from '../types';
import { EmergencyStopButton } from '../components/EmergencyStopButton';

interface RoverControlPageProps {
  roverStatus?: RoverStatus;
  isDemoMode: boolean;
  onRefresh: () => void;
}

export const RoverControlPage: React.FC<RoverControlPageProps> = ({
  roverStatus,
  isDemoMode,
  onRefresh,
}) => {
  const [commands, setCommands] = useState<RoverCommand[]>([]);
  const [durationMs, setDurationMs] = useState<number>(1000);
  const [activeMode, setActiveMode] = useState<'MANUAL' | 'AUTOMATIC'>('MANUAL');
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastAckMessage, setLastAckMessage] = useState<string | null>(null);
  const [ledActive, setLedActive] = useState<boolean>(false);
  const [motorSpeed, setMotorSpeed] = useState<number>(220);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  const isOnline = roverStatus?.is_online && !roverStatus?.is_stale;

  useEffect(() => {
    loadCommandHistory();
    const interval = setInterval(loadCommandHistory, 6000);

    // Real-Time Socket.IO Subscriptions
    const unsubIssued = socketService.onCommandIssued((cmd) => {
      setCommands((prev) => {
        const filtered = prev.filter((c) => c.id !== cmd.id);
        return [cmd, ...filtered].slice(0, 20);
      });
    });

    const unsubAck = socketService.onCommandAck((ack) => {
      setCommands((prev) =>
        prev.map((c) => (c.id === ack.id || c.command_id === ack.command_id ? { ...c, ...ack, status: 'ACKNOWLEDGED' } : c))
      );
      setLastAckMessage(`Command #${ack.id || ack.commandId} executed: ${ack.response_message || 'Hardware actuated'}`);
      setIsExecuting(false);
    });

    const unsubStatus = socketService.onRoverStatus(() => {
      onRefresh();
    });

    return () => {
      clearInterval(interval);
      unsubIssued();
      unsubAck();
      unsubStatus();
    };
  }, []);

  const loadCommandHistory = async () => {
    try {
      const data = await api.getRoverCommandHistory(15);
      setCommands(data);
    } catch (err) {
      console.error('Error fetching command history:', err);
    }
  };

  const handleCommand = async (cmd: 'FORWARD' | 'BACKWARD' | 'LEFT' | 'RIGHT' | 'STOP') => {
    setIsExecuting(true);
    setLastAckMessage(null);
    try {
      const response = await api.sendRoverCommand(cmd, durationMs);
      if (isOnline) {
        setLastAckMessage(`Command ${cmd} queued (ID #${response.id}). Waiting for motor actuation.`);
      } else {
        setLastAckMessage(`Command ${cmd} logged to queue, but rover is OFFLINE. Motors will not move.`);
      }
      loadCommandHistory();
      onRefresh();
    } catch (err) {
      alert('Command dispatch failed: ' + (err as Error).message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleModeChange = (mode: 'MANUAL' | 'AUTOMATIC') => {
    if (mode === 'AUTOMATIC') {
      alert(
        'Automatic navigation is locked for safety: Ground localization sensors (RTK-GPS / LiDAR / Ultrasonic array) must be active and confirmed before autonomous row-following is engaged.'
      );
      return;
    }
    setActiveMode(mode);
  };

  const handleToggleLed = async () => {
    const nextState = !ledActive;
    setLedActive(nextState);
    try {
      await api.sendRoverCommand('LED_SET', nextState ? 1 : 0);
      setLastAckMessage(`LED set to ${nextState ? 'ON' : 'OFF'} via MQTT`);
      loadCommandHistory();
    } catch (err) {
      alert('LED command dispatch failed: ' + (err as Error).message);
    }
  };

  const handleSpeedChange = async (newSpeed: number) => {
    setMotorSpeed(newSpeed);
    try {
      await api.sendRoverCommand('SPEED_SET', 1000, newSpeed);
      setLastAckMessage(`Motor Speed PWM set to ${newSpeed}/255 via MQTT`);
      loadCommandHistory();
    } catch (err) {
      console.error('Speed update error:', err);
    }
  };

  const handleCameraCapture = async () => {
    setIsCapturing(true);
    try {
      const res = await api.sendRoverCommand('CAPTURE', 1000);
      setLastAckMessage(`Camera snapshot command queued (ID #${res.id}) via MQTT`);
      loadCommandHistory();
    } catch (err) {
      alert('Camera capture trigger failed: ' + (err as Error).message);
    } finally {
      setTimeout(() => setIsCapturing(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-agri-darkest border border-agri-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-agri-offwhite flex items-center gap-2">
            <Bot className="w-5 h-5 text-agri-lime" />
            <span>Four-Wheel Mobile Rover Teleoperation</span>
          </h2>
          <p className="text-xs text-agri-muted">
            Motor controller interface for L298N dual H-bridge driver with safety duration watchdog.
          </p>
        </div>

        {/* Offline Warning Banner if Disconnected */}
        {!isOnline && !isDemoMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 animate-pulse" />
            <span>ROVER OFFLINE: Physical motor execution unavailable</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 Cols): Virtual D-Pad Teleoperation Controller */}
        <div className="lg:col-span-7 space-y-5">
          <div className="agri-card p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-agri-border/40 pb-3">
              <h3 className="text-sm font-bold text-agri-offwhite">Teleoperation Joystick D-Pad</h3>
              
              {/* Mode Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-agri-darkest border border-agri-border text-xs font-mono">
                <button
                  onClick={() => handleModeChange('MANUAL')}
                  className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                    activeMode === 'MANUAL'
                      ? 'bg-agri-lime text-agri-darkest'
                      : 'text-agri-muted hover:text-white'
                  }`}
                >
                  MANUAL
                </button>
                <button
                  onClick={() => handleModeChange('AUTOMATIC')}
                  className="px-3 py-1 rounded-lg text-agri-muted hover:text-white transition-all flex items-center gap-1 opacity-70"
                  title="Automatic row following requires localization"
                >
                  <span>AUTO</span>
                  <span className="text-[9px] px-1 rounded bg-agri-card text-amber-300">LOCKED</span>
                </button>
              </div>
            </div>

            {/* Configurable Pulse Duration */}
            <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-agri-muted">
                <Sliders className="w-4 h-4 text-agri-lime" />
                <span>Motion Pulse Duration:</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                {[500, 1000, 2000, 3000].map((ms) => (
                  <button
                    key={ms}
                    onClick={() => setDurationMs(ms)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      durationMs === ms
                        ? 'bg-agri-card border border-agri-lime text-agri-lime'
                        : 'bg-agri-card/40 text-agri-muted hover:text-white'
                    }`}
                  >
                    {ms}ms
                  </button>
                ))}
              </div>
            </div>

            {/* Directional Keypad / D-Pad */}
            <div className="py-4 flex flex-col items-center justify-center gap-3 select-none">
              {/* Forward */}
              <button
                onClick={() => handleCommand('FORWARD')}
                disabled={isExecuting}
                className="w-20 h-20 rounded-2xl bg-gradient-to-b from-agri-card to-agri-dark hover:from-agri-cardHover hover:to-agri-card active:scale-95 border border-agri-border/80 text-agri-offwhite flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all group"
              >
                <ArrowUp className="w-7 h-7 text-agri-lime group-hover:-translate-y-1 transition-transform" />
                <span className="text-[10px] font-mono tracking-wider font-bold">FWD</span>
              </button>

              {/* Middle Row: Left, Stop, Right */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleCommand('LEFT')}
                  disabled={isExecuting}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-b from-agri-card to-agri-dark hover:from-agri-cardHover hover:to-agri-card active:scale-95 border border-agri-border/80 text-agri-offwhite flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all group"
                >
                  <ArrowLeft className="w-7 h-7 text-agri-lime group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-mono tracking-wider font-bold">LEFT</span>
                </button>

                <button
                  onClick={() => handleCommand('STOP')}
                  disabled={isExecuting}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-b from-agri-charcoal to-agri-darkest hover:bg-agri-card active:scale-95 border border-amber-500/40 text-amber-400 flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all"
                >
                  <Square className="w-6 h-6 fill-current" />
                  <span className="text-[10px] font-mono tracking-wider font-bold">STOP</span>
                </button>

                <button
                  onClick={() => handleCommand('RIGHT')}
                  disabled={isExecuting}
                  className="w-20 h-20 rounded-2xl bg-gradient-to-b from-agri-card to-agri-dark hover:from-agri-cardHover hover:to-agri-card active:scale-95 border border-agri-border/80 text-agri-offwhite flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all group"
                >
                  <ArrowRight className="w-7 h-7 text-agri-lime group-hover:translate-x-1 transition-transform" />
                  <span className="text-[10px] font-mono tracking-wider font-bold">RIGHT</span>
                </button>
              </div>

              {/* Backward */}
              <button
                onClick={() => handleCommand('BACKWARD')}
                disabled={isExecuting}
                className="w-20 h-20 rounded-2xl bg-gradient-to-b from-agri-card to-agri-dark hover:from-agri-cardHover hover:to-agri-card active:scale-95 border border-agri-border/80 text-agri-offwhite flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all group"
              >
                <ArrowDown className="w-7 h-7 text-agri-lime group-hover:translate-y-1 transition-transform" />
                <span className="text-[10px] font-mono tracking-wider font-bold">REV</span>
              </button>
            </div>

            {/* Emergency Stop Component */}
            <div className="pt-2 border-t border-agri-border/40 space-y-4">
              <EmergencyStopButton
                roverOnline={isOnline}
                onStopIssued={() => {
                  loadCommandHistory();
                  onRefresh();
                }}
              />

              {/* Motor Speed PWM Control */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-agri-offwhite font-medium">
                    <Gauge className="w-4 h-4 text-agri-lime" />
                    <span>L298N Motor PWM Speed</span>
                  </div>
                  <span className="font-mono text-agri-lime font-bold">{motorSpeed} / 255</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono text-agri-muted">80 (Min)</span>
                  <input
                    type="range"
                    min="80"
                    max="255"
                    step="5"
                    value={motorSpeed}
                    onChange={(e) => setMotorSpeed(Number(e.target.value))}
                    onMouseUp={() => handleSpeedChange(motorSpeed)}
                    onTouchEnd={() => handleSpeedChange(motorSpeed)}
                    className="flex-1 accent-agri-lime cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-agri-muted">255 (Max)</span>
                </div>
              </div>

              {/* Camera Trigger Command */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Camera className="w-4 h-4 text-agri-lime" />
                  <div>
                    <span className="text-xs font-semibold text-agri-offwhite block">ESP32-S3-CAM Snapshot</span>
                    <span className="text-[10px] text-agri-muted">Triggers MQTT capture & AI detection</span>
                  </div>
                </div>

                <button
                  onClick={handleCameraCapture}
                  disabled={isCapturing}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 bg-agri-lime text-agri-darkest hover:bg-agri-lime/90 disabled:opacity-50 shadow-md shadow-lime-500/10 active:scale-95"
                >
                  {isCapturing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span>{isCapturing ? 'Snapping...' : 'Snap Photo'}</span>
                </button>
              </div>

              {/* Auxiliary Hardware Controls (Phase 5 requirement) */}
              <div className="p-3.5 rounded-xl bg-agri-darkest/70 border border-agri-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lightbulb className={`w-4 h-4 ${ledActive ? 'text-amber-400' : 'text-agri-muted'}`} />
                  <div>
                    <span className="text-xs font-semibold text-agri-offwhite block">Onboard Auxiliary LED</span>
                    <span className="text-[10px] text-agri-muted">ESP32 GPIO 2 Indicator</span>
                  </div>
                </div>

                <button
                  onClick={handleToggleLed}
                  disabled={!isOnline && !isDemoMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 ${
                    ledActive
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-agri-card border border-agri-border text-agri-muted hover:text-white'
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>{ledActive ? 'LED ON' : 'LED OFF'}</span>
                </button>
              </div>

              {/* Real-Time MQTT / WebSocket Transport Badge */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-agri-card/20 border border-agri-border/40 text-[10px] font-mono">
                <span className="flex items-center gap-1.5 text-agri-muted">
                  <Radio className="w-3 h-3 text-agri-lime animate-pulse" />
                  <span>MQTT Broker & Socket.IO</span>
                </span>
                <span className="text-emerald-400 font-bold">REAL-TIME SYNCED</span>
              </div>
            </div>

            {/* Acknowledgement Status Bar */}
            {lastAckMessage && (
              <div className="p-3 rounded-xl bg-agri-darkest border border-agri-border/60 text-xs font-mono text-agri-offwhite flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-agri-lime flex-shrink-0" />
                <span>{lastAckMessage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Telemetry State & Command History */}
        <div className="lg:col-span-5 space-y-5">
          {/* Hardware Diagnostics Card */}
          <div className="agri-card p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-agri-offwhite border-b border-agri-border/40 pb-2.5">
              Rover Hardware Diagnostics
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-agri-darkest/70 border border-agri-border/60">
                <span className="text-agri-muted flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-agri-lime" /> Device ID
                </span>
                <span className="font-mono text-agri-offwhite font-bold">
                  {roverStatus?.device_id || 'rover-001'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-agri-darkest/70 border border-agri-border/60">
                <span className="text-agri-muted flex items-center gap-1.5">
                  <BatteryCharging className="w-3.5 h-3.5 text-agri-lime" /> Battery Charge
                </span>
                <span className="font-mono text-agri-offwhite font-bold">
                  {roverStatus?.battery_percent !== null && roverStatus?.battery_percent !== undefined
                    ? `${roverStatus.battery_percent.toFixed(0)}%`
                    : 'N/A'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-agri-darkest/70 border border-agri-border/60">
                <span className="text-agri-muted flex items-center gap-1.5">
                  {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-red-400" />}
                  Wi-Fi Signal (RSSI)
                </span>
                <span className="font-mono text-agri-offwhite font-bold">
                  {isOnline ? `${roverStatus?.signal_rssi ?? -62} dBm` : 'Disconnected'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-agri-darkest/70 border border-agri-border/60">
                <span className="text-agri-muted">Local IP Address</span>
                <span className="font-mono text-agri-offwhite">
                  {roverStatus?.ip_address || '192.168.1.120'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-agri-darkest/70 border border-agri-border/60">
                <span className="text-agri-muted">Last Command Issued</span>
                <span className="font-mono text-agri-lime font-bold">
                  {roverStatus?.last_command || 'STOP'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-agri-card/30 border border-agri-border/50 text-[10px] text-agri-muted">
              Safety rule: Motor commands time out automatically after 15s if connection is interrupted.
            </div>
          </div>

          {/* Command Audit Log */}
          <div className="agri-card p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-agri-border/40 pb-2.5">
              <h3 className="text-sm font-bold text-agri-offwhite flex items-center gap-2">
                <History className="w-4 h-4 text-agri-lime" />
                <span>Command Execution Queue</span>
              </h3>
              <span className="text-[10px] text-agri-muted font-mono">Live Poll</span>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {commands.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-xl bg-agri-darkest/80 border border-agri-border/60 flex items-center justify-between text-xs font-mono"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-agri-offwhite">{c.command}</span>
                      <span className="text-[10px] text-agri-muted">{c.duration_ms}ms</span>
                    </div>
                    <p className="text-[10px] text-agri-muted truncate max-w-[180px]">
                      {c.response_message || 'Dispatched'}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      c.status === 'ACKNOWLEDGED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : c.status === 'PENDING'
                        ? 'bg-blue-500/20 text-blue-300 animate-pulse'
                        : c.status === 'TIMED_OUT' || c.status === 'CANCELED'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
              ))}

              {commands.length === 0 && (
                <p className="text-xs text-agri-muted text-center py-6">
                  No commands in history.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
