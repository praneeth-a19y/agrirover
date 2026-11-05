import React from 'react';
import {
  Menu,
  Sparkles,
  Zap,
  Radio,
  FileCode2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { RoverStatus } from '../types';

interface NavbarProps {
  title: string;
  subtitle?: string;
  isDemoMode: boolean;
  onToggleDemoMode: () => void;
  onSimulateTick: () => void;
  onRefresh: () => void;
  roverStatus?: RoverStatus;
  isRefreshing?: boolean;
  onOpenMobileMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  title,
  subtitle,
  isDemoMode,
  onToggleDemoMode,
  onSimulateTick,
  onRefresh,
  roverStatus,
  isRefreshing,
  onOpenMobileMenu,
}) => {
  const isOnline = roverStatus?.is_online && !roverStatus?.is_stale;

  return (
    <header className="sticky top-0 z-20 bg-agri-darkest/90 backdrop-blur-md border-b border-agri-border/40 px-4 md:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-agri-muted hover:text-agri-offwhite rounded-lg bg-agri-card/60 border border-agri-border/60"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg md:text-xl font-bold text-agri-offwhite tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-agri-muted hidden sm:block">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right: Controls & Badges */}
        <div className="flex items-center gap-2.5">
          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh telemetry and status"
            className="p-2 rounded-xl bg-agri-card/60 hover:bg-agri-card border border-agri-border/60 text-agri-offwhite transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-agri-lime' : ''}`} />
          </button>

          {/* Quick Demo Tick Button (Visible in Demo Mode) */}
          {isDemoMode && (
            <button
              onClick={onSimulateTick}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-agri-card hover:bg-agri-cardHover border border-agri-lime/40 text-xs font-medium text-agri-lime transition-all shadow-sm"
              title="Inject a realistic simulated telemetry reading into the database"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Reading</span>
            </button>
          )}

          {/* Demo Mode Toggle Switch */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-agri-card/70 border border-agri-border/60">
            <span className="text-[11px] font-medium text-agri-muted hidden sm:inline">
              Mode:
            </span>
            <button
              onClick={onToggleDemoMode}
              className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-all ${
                isDemoMode
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm shadow-amber-500/10'
                  : 'bg-agri-emerald/20 text-agri-emerald border border-agri-emerald/40'
              }`}
            >
              {isDemoMode ? (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>DEMO MODE</span>
                </>
              ) : (
                <>
                  <Radio className="w-3.5 h-3.5" />
                  <span>HARDWARE LIVE</span>
                </>
              )}
            </button>
          </div>

          {/* System Hardware Status Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-agri-card/40 border border-agri-border/50 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline
                  ? 'bg-agri-emerald animate-ping'
                  : isDemoMode
                  ? 'bg-amber-400'
                  : 'bg-agri-red'
              }`}
            />
            <span className="font-mono text-[11px] text-agri-offwhite/90">
              {isOnline
                ? 'ROVER CONNECTED'
                : isDemoMode
                ? 'SIMULATION'
                : 'ROVER OFFLINE'}
            </span>
          </div>

          {/* API Docs Button */}
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-agri-card/60 hover:bg-agri-card border border-agri-border/60 text-xs font-mono text-agri-muted hover:text-agri-offwhite transition-all"
            title="FastAPI Swagger Documentation"
          >
            <FileCode2 className="w-3.5 h-3.5 text-agri-lime" />
            <span>API Docs</span>
          </a>
        </div>
      </div>

      {/* Demo Mode Notice Banner if Active */}
      {isDemoMode && (
        <div className="mt-2 py-1 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Demonstration Mode Active:</strong> Charts and values reflect simulated testbed data for evaluation. Physical rover readings are safely segregated.
            </span>
          </div>
          <button
            onClick={onToggleDemoMode}
            className="underline hover:text-white font-medium ml-2"
          >
            Switch to Hardware
          </button>
        </div>
      )}
    </header>
  );
};
