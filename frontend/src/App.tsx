import React, { useState, useEffect } from 'react';
import { Sidebar, PageId } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { LiveMonitoringPage } from './pages/LiveMonitoringPage';
import { AIDiseaseDetectionPage } from './pages/AIDiseaseDetectionPage';
import { FarmManagementPage } from './pages/FarmManagementPage';
import { RoverControlPage } from './pages/RoverControlPage';
import { SensorAnalyticsPage } from './pages/SensorAnalyticsPage';
import { AlertsPage } from './pages/AlertsPage';
import { ScanHistoryPage } from './pages/ScanHistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { CalibrationModal } from './components/CalibrationModal';
import { OverviewSummary } from './types';
import { api } from './services/api';
import { socketService } from './services/socketService';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageId>('overview');
  const [overviewData, setOverviewData] = useState<OverviewSummary | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isOpenMobile, setIsOpenMobile] = useState<boolean>(false);

  useEffect(() => {
    loadOverview();
    const timer = setInterval(loadOverview, 10000);

    // Real-time Socket.IO subscriptions for instant UI sync
    const unsubStatus = socketService.onRoverStatus((status) => {
      setOverviewData((prev) => (prev ? { ...prev, rover_status: status } : prev));
    });

    const unsubTelemetry = socketService.onTelemetry((telemetry) => {
      setOverviewData((prev) => (prev ? { ...prev, latest_telemetry: telemetry } : prev));
    });

    const unsubAlert = socketService.onAlert((alert) => {
      setOverviewData((prev) =>
        prev
          ? {
              ...prev,
              active_alerts_count: prev.active_alerts_count + 1,
              recent_alerts: [alert, ...prev.recent_alerts].slice(0, 10),
            }
          : prev
      );
    });

    return () => {
      clearInterval(timer);
      unsubStatus();
      unsubTelemetry();
      unsubAlert();
    };
  }, []);

  const loadOverview = async () => {
    try {
      setIsRefreshing(true);
      const data = await api.getOverview();
      setOverviewData(data);
      setIsDemoMode(data.is_demo_mode);
    } catch (err) {
      console.error('Failed to load overview data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleDemoMode = async () => {
    const nextState = !isDemoMode;
    setIsDemoMode(nextState);
    try {
      await api.toggleDemoMode(nextState, true);
      loadOverview();
    } catch (err) {
      console.error('Failed to toggle demo mode on backend:', err);
    }
  };

  const handleSimulateTick = async () => {
    try {
      await api.telemetryTick();
      loadOverview();
    } catch (err) {
      alert('Error generating simulated reading: ' + (err as Error).message);
    }
  };

  const handleAcknowledgeAlert = async (id: number) => {
    try {
      await api.acknowledgeAlert(id);
      loadOverview();
    } catch (err) {
      console.error('Error acknowledging alert:', err);
    }
  };

  const pageTitles: Record<PageId, { title: string; subtitle: string }> = {
    overview: {
      title: 'Agricultural Mission Control',
      subtitle: 'Autonomous Rover Telemetry, Crop Pathology & Soil Chemistry Dashboard',
    },
    live: {
      title: 'Live Sensor Telemetry',
      subtitle: 'Real-time DHT22, capacitive moisture, and analog pH electrode metrics',
    },
    disease: {
      title: 'AI Crop Disease Classifier',
      subtitle: 'Computer vision leaf lesion analysis and verified treatment protocols',
    },
    farms: {
      title: 'Farm & Plot Sector Grid',
      subtitle: 'Spatial acreage management, crop varieties, and rover surveillance assignments',
    },
    control: {
      title: 'Rover Teleoperation Interface',
      subtitle: '4-Wheel mobile drive controls, safety timeouts, and emergency stop',
    },
    analytics: {
      title: 'Historical Trends & Analytics',
      subtitle: 'Time-series sensor regression, disease epidemiology, and CSV data export',
    },
    alerts: {
      title: 'Alerts & Agronomic Warnings',
      subtitle: 'Configurable environmental violation triggers and action items',
    },
    scans: {
      title: 'Pathology Scan History',
      subtitle: 'Complete visual archive of leaf inspection frames and diagnoses',
    },
    settings: {
      title: 'Hardware & ML Configuration',
      subtitle: 'ESP32 IoT endpoints, offline TFLite models, and demo calibration constants',
    },
  };

  const currentMeta = pageTitles[currentPage];

  return (
    <div className="flex min-h-screen bg-agri-darkest text-agri-offwhite">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        roverStatus={overviewData?.rover_status}
        isDemoMode={isDemoMode}
        activeAlertsCount={overviewData?.active_alerts_count ?? 0}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        <Navbar
          title={currentMeta.title}
          subtitle={currentMeta.subtitle}
          isDemoMode={isDemoMode}
          onToggleDemoMode={handleToggleDemoMode}
          onSimulateTick={handleSimulateTick}
          onRefresh={loadOverview}
          roverStatus={overviewData?.rover_status}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
        />

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto pb-16">
          {currentPage === 'overview' && (
            <OverviewPage
              overviewData={overviewData}
              onNavigate={setCurrentPage}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
              onAcknowledgeAlert={handleAcknowledgeAlert}
            />
          )}

          {currentPage === 'live' && (
            <LiveMonitoringPage
              latestTelemetry={overviewData?.latest_telemetry ?? null}
              isDemoMode={isDemoMode}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
              onRefresh={loadOverview}
            />
          )}

          {currentPage === 'disease' && (
            <AIDiseaseDetectionPage
              isDemoMode={isDemoMode}
              onRefreshScans={loadOverview}
            />
          )}

          {currentPage === 'farms' && <FarmManagementPage />}

          {currentPage === 'control' && (
            <RoverControlPage
              roverStatus={overviewData?.rover_status}
              isDemoMode={isDemoMode}
              onRefresh={loadOverview}
            />
          )}

          {currentPage === 'analytics' && <SensorAnalyticsPage />}

          {currentPage === 'alerts' && <AlertsPage />}

          {currentPage === 'scans' && <ScanHistoryPage />}

          {currentPage === 'settings' && (
            <SettingsPage
              isDemoMode={isDemoMode}
              onToggleDemoMode={handleToggleDemoMode}
              onOpenCalibration={() => setIsCalibrationOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Sensor Calibration Modal */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        onUpdated={loadOverview}
      />
    </div>
  );
};
