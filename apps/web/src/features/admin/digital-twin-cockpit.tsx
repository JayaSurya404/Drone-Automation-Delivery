"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  ActivityIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  ShieldIcon,
  RefreshIcon
} from "@skynav/ui";
import type { FleetTwin, DroneTwin, TwinHealthReport } from "@skynav/contracts";

export interface DigitalTwinCockpitProps {
  fleet?: FleetTwin;
  drones?: DroneTwin[];
  health?: TwinHealthReport;
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function DigitalTwinCockpit({
  fleet = {
    organizationId: "00000000-0000-0000-0000-000000000001",
    totalDrones: 6,
    availableDrones: 3,
    activeDrones: 2,
    returningDrones: 1,
    emergencyDrones: 0,
    offlineDrones: 0,
    maintenanceDrones: 0,
    activeMissionsCount: 3,
    batteryHealthSummary: {
      averagePercent: 84.5,
      lowBatteryCount: 1,
      criticalBatteryCount: 0
    },
    telemetryFreshnessSummary: {
      liveCount: 5,
      degradedCount: 1,
      staleCount: 0,
      offlineCount: 0
    },
    maintenanceRiskSummary: {
      healthyCount: 5,
      warningCount: 1,
      urgentCount: 0
    },
    reconciliationDiscrepanciesCount: 0,
    lastSyncTimestamp: new Date().toISOString()
  },
  drones = [
    {
      droneId: "d1",
      organizationId: "00000000-0000-0000-0000-000000000001",
      callSign: "SKY-001",
      model: "SkyNav Pelican Heavy",
      operationalState: "EN_ROUTE",
      position: { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 65.0 },
      headingDegrees: 92.0,
      groundSpeedMps: 15.2,
      verticalSpeedMps: 0.0,
      battery: { percent: 86, isLow: false, isCritical: false, healthStatus: "NORMAL" },
      payload: { weightGrams: 1500, maxCapacityGrams: 5000, isLoaded: true },
      telemetryFreshness: "LIVE",
      lastSyncTimestamp: new Date().toISOString(),
      health: "HEALTHY",
      reconciliationWarnings: [],
      revision: 142
    },
    {
      droneId: "d2",
      organizationId: "00000000-0000-0000-0000-000000000001",
      callSign: "SKY-002",
      model: "SkyNav Pelican Heavy",
      operationalState: "DELIVERING",
      position: { latitude: 37.7845, longitude: -122.4082, altitudeMeters: 4.8 },
      headingDegrees: 180.0,
      groundSpeedMps: 0.2,
      verticalSpeedMps: -0.4,
      battery: { percent: 72, isLow: false, isCritical: false, healthStatus: "NORMAL" },
      payload: { weightGrams: 2200, maxCapacityGrams: 5000, isLoaded: true },
      telemetryFreshness: "LIVE",
      lastSyncTimestamp: new Date().toISOString(),
      health: "HEALTHY",
      reconciliationWarnings: [],
      revision: 98
    },
    {
      droneId: "d3",
      organizationId: "00000000-0000-0000-0000-000000000001",
      callSign: "SKY-003",
      model: "SkyNav Eagle Eye",
      operationalState: "RETURNING",
      position: { latitude: 37.7710, longitude: -122.4250, altitudeMeters: 55.0 },
      headingDegrees: 270.0,
      groundSpeedMps: 14.0,
      verticalSpeedMps: 0.1,
      battery: { percent: 24, isLow: true, isCritical: false, healthStatus: "DEGRADED" },
      payload: { weightGrams: 0, maxCapacityGrams: 3000, isLoaded: false },
      telemetryFreshness: "DEGRADED",
      lastSyncTimestamp: new Date().toISOString(),
      health: "DEGRADED",
      reconciliationWarnings: ["Battery reserve warning: 24% (Low threshold reached)"],
      revision: 210
    }
  ],
  health = {
    organizationId: "00000000-0000-0000-0000-000000000001",
    overallStatus: "HEALTHY",
    totalDronesTracked: 3,
    totalMissionsTracked: 3,
    activeDiscrepanciesCount: 1,
    issues: [
      {
        code: "BATTERY_RESERVE_LOW",
        message: "[SKY-003] Battery reserve below 25% during return transit.",
        severity: "WARNING",
        timestamp: new Date().toISOString()
      }
    ],
    evaluatedAt: new Date().toISOString()
  },
  onRefresh,
  isLoading = false
}: DigitalTwinCockpitProps) {
  const [selectedDroneId, setSelectedDroneId] = useState<string | null>(null);

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return "success";
      case "DEGRADED":
        return "warning";
      case "CRITICAL":
      case "INCONSISTENT":
        return "danger";
      case "OFFLINE":
      default:
        return "neutral";
    }
  };

  const getFreshnessBadgeVariant = (freshness: string) => {
    switch (freshness) {
      case "LIVE":
        return "success";
      case "DEGRADED":
        return "warning";
      case "STALE":
      case "OFFLINE":
        return "danger";
      default:
        return "neutral";
    }
  };

  const selectedDrone = drones.find((d) => d.droneId === selectedDroneId) || drones[0];

  return (
    <Card variant="glass" className="overflow-hidden border border-emerald-500/30">
      <CardHeader className="bg-slate-900/80 border-b border-slate-800 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-emerald-400 font-bold">
                Digital Twin Synchronized Operations Hub
              </CardTitle>
              <Badge variant="info" className="text-[10px] bg-emerald-950/60 border-emerald-500/40 text-emerald-300">
                SYNCHRONIZED TWIN
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live software twin reconciling authoritative database domains, kinematics, battery telemetry, and CV perception.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={getHealthBadgeVariant(health.overallStatus)} className="text-xs">
              TWIN: {health.overallStatus}
            </Badge>
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={isLoading}
                leftIcon={<RefreshIcon size={12} className={isLoading ? "animate-spin" : ""} />}
                className="text-xs text-slate-400 hover:text-emerald-300"
              >
                Sync
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="p-4 space-y-4">
        {/* Observational Notice */}
        <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/40 flex items-start gap-2.5 text-xs text-emerald-200">
          <ShieldIcon size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-emerald-300">DIGITAL TWIN OBSERVATION:</strong> The twin observes and reconciles state from flight simulations and real-time telemetry. Deterministic safety rules and human operator authorization remain authoritative.
          </span>
        </div>

        {/* Fleet Twin Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-400">Total Drones</span>
            <span className="text-xl font-bold text-white">{fleet.totalDrones}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{fleet.availableDrones} Available</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-400">In-Flight / Active</span>
            <span className="text-xl font-bold text-cyan-400">{fleet.activeDrones}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{fleet.returningDrones} Returning</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-400">Active Missions</span>
            <span className="text-xl font-bold text-emerald-400">{fleet.activeMissionsCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Assigned & Tracked</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-400">Avg Battery</span>
            <span className="text-xl font-bold text-emerald-400">{fleet.batteryHealthSummary.averagePercent}%</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{fleet.batteryHealthSummary.lowBatteryCount} Low</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-400">Telemetry Live</span>
            <span className="text-xl font-bold text-emerald-400">{fleet.telemetryFreshnessSummary.liveCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{fleet.telemetryFreshnessSummary.degradedCount} Degraded</span>
          </div>

          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <span className="block text-[10px] text-slate-400">Reconciliation Alerts</span>
            <span className={`text-xl font-bold ${fleet.reconciliationDiscrepanciesCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>
              {fleet.reconciliationDiscrepanciesCount}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Discrepancies</span>
          </div>
        </div>

        {/* Active Discrepancies & Diagnostic Issues */}
        {health.issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangleIcon size={14} />
              Reconciliation & Diagnostic Inconsistencies ({health.issues.length})
            </h4>
            <div className="space-y-1.5">
              {health.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant={issue.severity === "CRITICAL" ? "danger" : "warning"} className="text-[9px]">
                      {issue.severity}
                    </Badge>
                    <span className="text-slate-200">{issue.message}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {new Date(issue.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Synchronized Drones Twin Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Synchronized UAV State Twins ({drones.length})
          </h4>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Call Sign</TableHead>
                  <TableHead>Operational State</TableHead>
                  <TableHead>Coordinates & Altitude</TableHead>
                  <TableHead>Speed & Heading</TableHead>
                  <TableHead>Battery</TableHead>
                  <TableHead>Signal Freshness</TableHead>
                  <TableHead>Twin Health</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drones.map((d) => (
                  <TableRow key={d.droneId} className={selectedDroneId === d.droneId ? "bg-emerald-950/20" : ""}>
                    <TableCell className="font-semibold text-white">
                      <div>
                        <span>{d.callSign}</span>
                        <span className="block text-[10px] text-slate-500">{d.model}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info" className="text-[10px]">
                        {d.operationalState}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300 font-mono">
                      <div>
                        <span>{d.position.latitude.toFixed(4)}, {d.position.longitude.toFixed(4)}</span>
                        <span className="block text-[10px] text-cyan-400">{d.position.altitudeMeters.toFixed(1)}m alt</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-300 font-mono">
                      <span>{d.groundSpeedMps.toFixed(1)} m/s @ {d.headingDegrees.toFixed(0)}°</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-bold ${d.battery.isCritical ? "text-rose-400" : d.battery.isLow ? "text-amber-400" : "text-emerald-400"}`}>
                          {d.battery.percent.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getFreshnessBadgeVariant(d.telemetryFreshness)} className="text-[10px]">
                        {d.telemetryFreshness}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getHealthBadgeVariant(d.health)} className="text-[10px]">
                        {d.health}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDroneId(d.droneId)}
                        className="text-xs text-emerald-400 hover:text-emerald-300"
                      >
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Selected Drone Twin Detail Inspector */}
        {selectedDrone && (
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">
                Drone Twin Detail Inspector: {selectedDrone.callSign}
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Revision #{selectedDrone.revision} • Synced: {new Date(selectedDrone.lastSyncTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="block text-[10px] text-slate-500">Payload Status</span>
                <span className="font-semibold text-white">
                  {selectedDrone.payload.isLoaded ? `${selectedDrone.payload.weightGrams}g Loaded` : "Empty"}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="block text-[10px] text-slate-500">Battery Voltage / Temp</span>
                <span className="font-semibold text-white">
                  {selectedDrone.battery.voltageVolts?.toFixed(1) || "24.0"}V • {selectedDrone.battery.temperatureCelsius?.toFixed(0) || "28"}°C
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="block text-[10px] text-slate-500">CV Perception State</span>
                <span className="font-semibold text-white">
                  {selectedDrone.perceptionState?.landingSuitability || "STANDBY"}
                </span>
              </div>
              <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                <span className="block text-[10px] text-slate-500">Discrepancy Count</span>
                <span className="font-semibold text-white">
                  {selectedDrone.reconciliationWarnings.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
