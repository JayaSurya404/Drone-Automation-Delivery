import React, { createContext, useContext, useState } from 'react';

export type SystemStatusLevel = 'OPERATIONAL' | 'DEGRADED' | 'CRITICAL';

export interface ServiceHealth {
  name: string;
  status: 'Operational' | 'Degraded' | 'Offline';
  latencyMs: number;
  uptimePct: number;
}

interface SystemHealthContextType {
  overallStatus: SystemStatusLevel;
  services: ServiceHealth[];
  isHealthDrawerOpen: boolean;
  openHealthDrawer: () => void;
  closeHealthDrawer: () => void;
}

const SystemHealthContext = createContext<SystemHealthContextType | undefined>(undefined);

export const SystemHealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isHealthDrawerOpen, setIsHealthDrawerOpen] = useState(false);

  const [services] = useState<ServiceHealth[]>([
    { name: 'Drone Telemetry WebSockets Mesh', status: 'Operational', latencyMs: 14, uptimePct: 99.98 },
    { name: 'SkyNav API Gateway', status: 'Operational', latencyMs: 22, uptimePct: 99.99 },
    { name: 'PostgreSQL Spatial Cluster', status: 'Operational', latencyMs: 8, uptimePct: 100.0 },
    { name: 'FAA Geofence Vector Engine', status: 'Operational', latencyMs: 18, uptimePct: 99.95 },
    { name: 'Stripe & Banking Payment Bridge', status: 'Operational', latencyMs: 45, uptimePct: 99.90 },
    { name: 'Emergency Broadcast Service', status: 'Operational', latencyMs: 5, uptimePct: 100.0 },
  ]);

  const overallStatus: SystemStatusLevel = services.some((s) => s.status === 'Offline')
    ? 'CRITICAL'
    : services.some((s) => s.status === 'Degraded')
    ? 'DEGRADED'
    : 'OPERATIONAL';

  return (
    <SystemHealthContext.Provider
      value={{
        overallStatus,
        services,
        isHealthDrawerOpen,
        openHealthDrawer: () => setIsHealthDrawerOpen(true),
        closeHealthDrawer: () => setIsHealthDrawerOpen(false),
      }}
    >
      {children}
    </SystemHealthContext.Provider>
  );
};

export const useSystemHealth = () => {
  const ctx = useContext(SystemHealthContext);
  if (!ctx) throw new Error('useSystemHealth must be used within SystemHealthProvider');
  return ctx;
};
