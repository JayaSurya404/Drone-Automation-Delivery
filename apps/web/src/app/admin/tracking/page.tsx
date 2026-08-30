"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  MapView,
  TelemetrySummary,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  DroneStatusBadge,
  BatteryIndicator,
  DroneIcon,
  RotateCcwIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  EyeIcon
} from "@skynav/ui";
import {
  DEMO_DRONES,
  DEMO_MISSIONS,
  DEMO_WAREHOUSE,
  DEMO_GEOFENCES,
  DemoDrone
} from "@/lib/demo-data";
import { useRealtimeTelemetry } from "@/lib/realtime";
import { ReturnToHomeModal } from "@/features/admin/rth-modal";
import { EmergencyHaltModal } from "@/features/admin/emergency-modal";
import { EmergencyClearModal } from "@/features/admin/emergency-clear-modal";
import { EmergencyBanner } from "@/features/admin/emergency-banner";
import { calculateTelemetryFreshness, formatDistance } from "@skynav/contracts";

export default function AdminLiveTrackingPage() {
  const [selectedDroneId, setSelectedDroneId] = useState(DEMO_DRONES[0].id);
  const [drones, setDrones] = useState<DemoDrone[]>(DEMO_DRONES);

  // Modals state
  const [isRthOpen, setIsRthOpen] = useState(false);
  const [isEmergencyOpen, setIsEmergencyOpen] = useState(false);
  const [isClearOpen, setIsClearOpen] = useState(false);

  const { status: wsStatus, telemetryMap, trailsMap } = useRealtimeTelemetry({
    channel: "telemetry:organization",
    autoConnect: true,
    maxTrailPoints: 30
  });

  // Apply live telemetry and bounded trails to drones
  const liveDrones = useMemo(() => {
    return drones.map((d) => {
      const live = telemetryMap.get(d.id);
      const trail = trailsMap.get(d.id) || d.trail || [];
      if (!live) return { ...d, trail };
      return {
        ...d,
        latitude: live.position.latitude,
        longitude: live.position.longitude,
        altitudeMeters: live.position.altitudeMeters ?? d.altitudeMeters,
        headingDegrees: live.headingDegrees ?? d.headingDegrees,
        speedMetersPerSecond: live.speedMetersPerSecond ?? d.speedMetersPerSecond,
        batteryPercent: live.batteryPercent ?? d.batteryPercent,
        status: (live.state as any) ?? d.status,
        trail
      };
    });
  }, [drones, telemetryMap, trailsMap]);

  const selectedDrone = liveDrones.find((d) => d.id === selectedDroneId) || liveDrones[0];
  const linkedMission = DEMO_MISSIONS.find((m) => m.droneId === selectedDrone.id || m.droneCallsign === selectedDrone.callsign);
  const emergencyDrones = liveDrones.filter((d) => d.status === "EMERGENCY");

  const handleConfirmRTH = async (reason: string) => {
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDrone.id ? { ...d, status: "RETURNING" as const } : d))
    );
  };

  const handleConfirmEmergency = async (reason: string) => {
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDrone.id ? { ...d, status: "EMERGENCY" as const, altitudeMeters: 0, speedMetersPerSecond: 0 } : d))
    );
  };

  const handleConfirmClear = async (reason: string) => {
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDrone.id ? { ...d, status: "IDLE" as const, altitudeMeters: 0, speedMetersPerSecond: 0 } : d))
    );
  };

  const mapMarkers = useMemo(() => {
    return [
      {
        id: "depot-alpha",
        type: "warehouse" as const,
        latitude: DEMO_WAREHOUSE.latitude,
        longitude: DEMO_WAREHOUSE.longitude,
        title: "Depot Alpha"
      },
      ...liveDrones.map((d) => {
        const live = telemetryMap.get(d.id);
        const freshness = live ? calculateTelemetryFreshness(live.observedAt) : "LIVE";
        return {
          id: d.id,
          type: "drone" as const,
          latitude: d.latitude,
          longitude: d.longitude,
          headingDegrees: d.headingDegrees,
          altitudeMeters: d.altitudeMeters,
          speedMetersPerSecond: d.speedMetersPerSecond,
          batteryPercent: d.batteryPercent,
          title: d.callsign,
          status: d.status,
          freshness,
          trail: d.trail
        };
      })
    ];
  }, [liveDrones, telemetryMap]);

  const mapRoutes = useMemo(() => {
    return DEMO_MISSIONS.map((m) => ({
      id: m.id,
      coordinates: [
        { latitude: m.originCoords.latitude, longitude: m.originCoords.longitude },
        { latitude: (m.originCoords.latitude + m.destinationCoords.latitude) / 2, longitude: (m.originCoords.longitude + m.destinationCoords.longitude) / 2 },
        { latitude: m.destinationCoords.latitude, longitude: m.destinationCoords.longitude }
      ],
      color: m.droneCallsign === selectedDrone.callsign ? "#00f0ff" : "#475569",
      dashed: m.droneCallsign !== selectedDrone.callsign
    }));
  }, [selectedDrone.callsign]);

  return (
    <div className="space-y-6 animate-fade-in">
      <EmergencyBanner emergencyDrones={emergencyDrones} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Tactical Radar & Fleet Geospatial HUD</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-UAV cartographic tracking, 3D kinematic telemetry, and human-in-the-loop operational overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedDrone.status === "EMERGENCY" ? (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<CheckCircleIcon size={14} />}
              onClick={() => setIsClearOpen(true)}
              className="text-emerald-400 border-emerald-500/50 hover:bg-emerald-950/40"
            >
              Clear Emergency
            </Button>
          ) : (
            <>
              {selectedDrone.status !== "IDLE" && selectedDrone.status !== "LANDED" && selectedDrone.status !== "OFFLINE" && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<RotateCcwIcon size={14} />}
                  onClick={() => setIsRthOpen(true)}
                >
                  Command RTH
                </Button>
              )}
              {selectedDrone.status !== "OFFLINE" && (
                <Button
                  variant="destructive"
                  size="sm"
                  leftIcon={<AlertTriangleIcon size={14} />}
                  onClick={() => setIsEmergencyOpen(true)}
                >
                  Emergency Halt
                </Button>
              )}
            </>
          )}

          <Link href={`/admin/fleet/${selectedDrone.id}`}>
            <Button variant="primary" size="sm" leftIcon={<EyeIcon size={14} />}>
              Open Cockpit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Geospatial Map Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[540px] w-full rounded-2xl overflow-hidden border border-slate-750 shadow-2xl">
            <MapView
              markers={mapMarkers}
              routes={mapRoutes}
              geofences={DEMO_GEOFENCES}
              selectedMarkerId={selectedDrone.id}
              center={{ latitude: selectedDrone.latitude, longitude: selectedDrone.longitude }}
              zoom={14}
              title={`Airspace Tactical Sector // Selected: ${selectedDrone.callsign}`}
              mapProvider="osm"
              showControls={true}
              showLayerToggles={true}
              showCoordinatesHud={true}
              onMarkerClick={(m) => {
                if (m.type === "drone") {
                  setSelectedDroneId(m.id);
                }
              }}
            />
          </div>

          {/* Quick Drone Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {liveDrones.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDroneId(d.id)}
                className={`p-3 rounded-xl border flex items-center gap-3 transition-all shrink-0 ${
                  d.id === selectedDrone.id
                    ? "bg-blue-950/60 border-cyan-500/50 shadow-lg shadow-cyan-950/40"
                    : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="p-2 rounded-lg bg-slate-800 text-cyan-400">
                  <DroneIcon size={16} />
                </div>
                <div className="text-left font-mono">
                  <div className="text-xs font-bold text-white">{d.callsign}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <span>{d.status}</span>
                    <span>•</span>
                    <span className="text-emerald-400">{d.batteryPercent}%</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* HUD Gauges & Active Drone Telemetry Card */}
        <div className="space-y-6">
          <TelemetrySummary
            droneCallsign={selectedDrone.callsign}
            speedMps={selectedDrone.speedMetersPerSecond}
            altitudeM={selectedDrone.altitudeMeters}
            headingDeg={selectedDrone.headingDegrees}
            batteryPct={selectedDrone.batteryPercent}
            lat={selectedDrone.latitude}
            lon={selectedDrone.longitude}
            flightTimeSec={840}
          />

          <Card variant="glass">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Selected UAV Status</CardTitle>
              <DroneStatusBadge status={selectedDrone.status} size="sm" />
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Model</span>
                <span className="text-white font-sans">{selectedDrone.model}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Total Flight Hours</span>
                <span className="text-white">{selectedDrone.flightHours.toFixed(1)} hrs</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Payload Capacity</span>
                <span className="text-white">{selectedDrone.payloadCapacityKg.toFixed(1)} kg</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Assigned Mission</span>
                <span className="text-cyan-300 font-bold">{linkedMission?.code || "None (Standby)"}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Power Reserves</span>
                <BatteryIndicator percent={selectedDrone.batteryPercent} size="sm" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Operational Action Modals */}
      <ReturnToHomeModal
        isOpen={isRthOpen}
        onClose={() => setIsRthOpen(false)}
        droneCallsign={selectedDrone.callsign}
        droneId={selectedDrone.id}
        currentAltitude={selectedDrone.altitudeMeters}
        batteryPercent={selectedDrone.batteryPercent}
        onConfirm={handleConfirmRTH}
      />

      <EmergencyHaltModal
        isOpen={isEmergencyOpen}
        onClose={() => setIsEmergencyOpen(false)}
        droneCallsign={selectedDrone.callsign}
        droneId={selectedDrone.id}
        currentAltitude={selectedDrone.altitudeMeters}
        onConfirm={handleConfirmEmergency}
      />

      <EmergencyClearModal
        isOpen={isClearOpen}
        onClose={() => setIsClearOpen(false)}
        droneCallsign={selectedDrone.callsign}
        droneId={selectedDrone.id}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}
