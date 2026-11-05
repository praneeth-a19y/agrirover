import React from 'react';
import {
  LayoutDashboard,
  Radio,
  ScanEye,
  MapPin,
  Gamepad2,
  LineChart,
  Bell,
  History,
  Settings,
  Bot,
  Wifi,
  WifiOff,
  BatteryCharging,
  X
} from 'lucide-react';
import { RoverStatus } from '../types';

export type PageId =
  | 'overview'
  | 'live'
  | 'disease'
  | 'farms'
  | 'control'
  | 'analytics'
  | 'alerts'
  | 'scans'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  roverStatus?: RoverStatus;
  isDemoMode: boolean;
  activeAlertsCount: number;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  roverStatus,
  isDemoMode,
  activeAlertsCount,
  isOpenMobile,
  onCloseMobile,
}) => {
  const navItems = [
    { id: 'overview' as PageId, label: 'Overview', icon: LayoutDashboard },
    { id: 'live' as PageId, label: 'Live Monitoring', icon: Radio },
    { id: 'disease' as PageId, label: 'AI Disease Detection', icon: ScanEye },
    { id: 'farms' as PageId, label: 'Farm & Plots', icon: MapPin },
    { id: 'control' as PageId, label: 'Rover Control', icon: Gamepad2 },
    { id: 'analytics' as PageId, label: 'Sensor Analytics', icon: LineChart },
    {
      id: 'alerts' as PageId,
      label: 'Alerts & Actions',
      icon: Bell,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
    },
    { id: 'scans' as PageId, label: 'Scan History', icon: History },
    { id: 'settings' as PageId, label: 'Settings', icon: Settings },
  ];

  const isOnline = roverStatus?.is_online && !roverStatus?.is_stale;

  const content = (
    <div className="flex flex-col h-full bg-agri-darkest border-r border-agri-border/40 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-agri-border/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-agri-forest to-agri-card border border-agri-border flex items-center justify-center text-agri-lime shadow-lg shadow-agri-darkest">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-wide text-agri-offwhite">AGRI-ROVER</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-agri-card border border-agri-border text-agri-lime">
                EPICS
              </span>
            </div>
            <p className="text-xs text-agri-muted">AI Crop & Soil Monitor</p>
          </div>
        </div>
        {isOpenMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-agri-muted hover:text-agri-offwhite rounded-lg hover:bg-agri-card"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onSelectPage(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-agri-lime text-agri-darkest font-semibold shadow-md shadow-agri-lime/20'
                  : 'text-agri-offwhite/80 hover:text-agri-offwhite hover:bg-agri-card/70'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-agri-darkest' : 'text-agri-muted'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive
                      ? 'bg-agri-darkest text-agri-lime'
                      : 'bg-agri-red text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Rover Hardware Connection Card */}
      <div className="p-4 border-t border-agri-border/40 bg-agri-dark/40">
        <div className="p-3 rounded-xl bg-agri-card/80 border border-agri-border/60">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-agri-muted">
              Rover Hardware
            </span>
            <div
              className={`flex items-center gap-1.5 text-xs font-mono font-medium px-2 py-0.5 rounded-full ${
                isOnline
                  ? 'bg-agri-emerald/20 text-agri-emerald border border-agri-emerald/30'
                  : 'bg-agri-red/20 text-agri-red border border-agri-red/30'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-agri-emerald animate-pulse' : 'bg-agri-red'}`} />
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>

          <div className="space-y-1.5 text-xs text-agri-offwhite/70">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-agri-muted">
                {isOnline ? <Wifi className="w-3.5 h-3.5 text-agri-emerald" /> : <WifiOff className="w-3.5 h-3.5 text-agri-red" />}
                Link
              </span>
              <span className="font-mono text-agri-offwhite">
                {isOnline ? `${roverStatus?.signal_rssi ?? -62} dBm` : 'No Signal'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-agri-muted">
                <BatteryCharging className="w-3.5 h-3.5 text-agri-lime" />
                Battery
              </span>
              <span className="font-mono text-agri-offwhite">
                {roverStatus?.battery_percent ? `${roverStatus.battery_percent.toFixed(0)}%` : '--'}
              </span>
            </div>
          </div>

          {isDemoMode && (
            <div className="mt-2.5 pt-2 border-t border-agri-border/40 text-[11px] text-agri-lime flex items-center justify-between">
              <span>Simulation active</span>
              <span className="text-agri-muted text-[10px] font-mono">DEMO</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-64 h-screen fixed left-0 top-0 z-30">
        {content}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[80vw] h-full z-10">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
