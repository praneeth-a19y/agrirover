import React, { useState } from 'react';
import { OctagonAlert, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface EmergencyStopButtonProps {
  onStopIssued?: () => void;
  roverOnline?: boolean;
}

export const EmergencyStopButton: React.FC<EmergencyStopButtonProps> = ({ onStopIssued, roverOnline = false }) => {
  const [isTriggering, setIsTriggering] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);

  const handleEmergencyStop = async () => {
    setIsTriggering(true);
    setFeedback(null);
    try {
      const res = await api.sendRoverCommand('EMERGENCY_STOP', 100);
      if (roverOnline) {
        setFeedback({
          type: 'success',
          message: `E-STOP dispatched (ID #${res.id}). Pending rover motor cut-off.`
        });
      } else {
        setFeedback({
          type: 'warning',
          message: `E-STOP recorded in queue (ID #${res.id}), but rover is OFFLINE. Cannot confirm physical motor stop!`
        });
      }
      onStopIssued?.();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to issue E-STOP: ${(err as Error).message}`
      });
    } finally {
      setIsTriggering(false);
      setTimeout(() => setFeedback(null), 6000);
    }
  };

  return (
    <div className="space-y-2">
      <button
        onClick={handleEmergencyStop}
        disabled={isTriggering}
        className="w-full relative group overflow-hidden py-3.5 px-6 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-sm tracking-wider uppercase border border-red-500/50 shadow-lg shadow-red-900/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isTriggering ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <OctagonAlert className="w-5 h-5 text-red-200 animate-pulse" />
        )}
        <span>EMERGENCY STOP (E-STOP)</span>
      </button>

      {feedback && (
        <div
          className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
              : feedback.type === 'warning'
              ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              : 'bg-red-950/60 border-red-500/40 text-red-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
