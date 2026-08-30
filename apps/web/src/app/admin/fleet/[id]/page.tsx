"use client";

import React, { useState, useMemo, use } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  DroneStatusBadge,
  BatteryIndicator,
  DroneIcon,
  RouteIcon,
  AlertTriangleIcon,
  RotateCcwIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  MapView,
  ShieldIcon,
  MapMarker
} from "@skynav/ui";
import { DEMO_DRONES, DEMO_MISSIONS, DEMO_ORDERS, DEMO_WAREHOUSE, DEMO_GEOFENCES, DemoDrone } from "@/lib/demo-data";
import { useRealtimeTelemetry } from "@/lib/realtime";
import { ReturnToHomeModal } from "@/features/admin/rth-modal";
import { EmergencyHaltModal } from "@/features/admin/emergency-modal";
import { EmergencyClearModal } from "@/features/admin/emergency-clear-modal";
import { calculateTelemetryFreshness, formatDistance } from "@skynav/contracts";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function DroneCockpitPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const droneId = resolvedParams.id;

  const [baseDrone, setBaseDrone] = useState<DemoDrone | null>(() => {
    return DEMO_DRONES.find((d) => d.id === droneId) || DEMO_DRONES[0];
  });

  const [isRthModalOpen, setIsRthModalOpen] = useState(false);
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const { status: wsStatus, telemetryMap, trailsMap } = useRealtimeTelemetry({
    channel: "telemetry:drone",
    targetId: droneId,
    autoConnect: true,
    maxTrailPoints: 35
  });

  if (!baseDrone) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">UAV Not Found</h2>
        <p className="text-slate-400 text-sm">Drone with ID '{droneId}' was not located in active inventory.</p>
        <Link href="/admin/fleet">
          <Button variant="outline" size="sm">
            Back to Fleet Inventory
          </Button>
        </Link>
      </div>
    );
  }

  const liveTelemetry = telemetryMap.get(baseDrone.id);
  const liveTrail = trailsMap.get(baseDrone.id) || baseDrone.trail || [];

  const drone = useMemo(() => {
    if (!liveTelemetry) return { ...baseDrone, trail: liveTrail };
    return {
      ...baseDrone,
      latitude: liveTelemetry.position.latitude,
      longitude: liveTelemetry.position.longitude,
      altitudeMeters: liveTelemetry.position.altitudeMeters ?? baseDrone.altitudeMeters,
      headingDegrees: liveTelemetry.headingDegrees ?? baseDrone.headingDegrees,
      speedMetersPerSecond: liveTelemetry.speedMetersPerSecond ?? baseDrone.speedMetersPerSecond,
      batteryPercent: liveTelemetry.batteryPercent ?? baseDrone.batteryPercent,
      status: (liveTelemetry.state as any) ?? baseDrone.status,
      trail: liveTrail
    };
  }, [baseDrone, liveTelemetry, liveTrail]);

  const activeMission = DEMO_MISSIONS.find((m) => m.droneId === drone.id || m.droneCallsign === drone.callsign);
  const activeOrder = activeMission ? DEMO_ORDERS.find((o) => o.id === activeMission.orderId) : null;

  const freshness = useMemo(() => {
    if (!liveTelemetry) return "LIVE";
    return calculateTelemetryFreshness(liveTelemetry.observedAt);
  }, [liveTelemetry]);

  const mapMarkers = useMemo(() => {
    const markersList: MapMarker[] = [
      {
        id: "depot-alpha",
        type: "warehouse" as const,
        latitude: DEMO_WAREHOUSE.latitude,
        longitude: DEMO_WAREHOUSE.longitude,
        title: "Depot Alpha"
      },
      {
        id: drone.id,
        type: "drone" as const,
        latitude: drone.latitude,
        longitude: drone.longitude,
        headingDegrees: drone.headingDegrees,
        altitudeMeters: drone.altitudeMeters,
        speedMetersPerSecond: drone.speedMetersPerSecond,
        batteryPercent: drone.batteryPercent,
        freshness,
        title: drone.callsign,
        status: drone.status,
        trail: drone.trail
      }
    ];

    if (activeMission) {
      markersList.push({
        id: "dest-pad",
        type: "destination" as const,
        latitude: activeMission.destinationCoords.latitude,
        longitude: activeMission.destinationCoords.longitude,
        title: activeMission.destinationAddress,
        headingDegrees: 0,
        altitudeMeters: 2,
        speedMetersPerSecond: 0,
        batteryPercent: 100,
        freshness: "LIVE",
        status: "ACTIVE",
        trail: []
      });
    }

    return markersList;
  }, [drone, activeMission, freshness]);

  const mapRoutes = useMemo(() => {
    if (!activeMission) return [];
    return [
      {
        id: activeMission.id,
        coordinates: [
          { latitude: activeMission.originCoords.latitude, longitude: activeMission.originCoords.longitude },
          { latitude: drone.latitude, longitude: drone.longitude, altitudeMeters: drone.altitudeMeters },
          { latitude: activeMission.destinationCoords.latitude, longitude: activeMission.destinationCoords.longitude }
        ],
        color: drone.status === "EMERGENCY" ? "#ef4444" : "#00f0ff"
      }
    ];
  }, [activeMission, drone]);

  const handleConfirmRTH = (reason: string) => {
    setBaseDrone((prev) => (prev ? { ...prev, status: "RETURNING" } : null));
  };

  const handleConfirmEmergency = (reason: string) => {
    setBaseDrone((prev) => (prev ? { ...prev, status: "EMERGENCY", altitudeMeters: 0, speedMetersPerSecond: 0 } : null));
  };

  const handleConfirmClear = (reason: string) => {
    setBaseDrone((prev) => (prev ? { ...prev, status: "IDLE", altitudeMeters: 0, speedMetersPerSecond: 0 } : null));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Back Navigation & Cockpit Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/fleet">
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeftIcon size={16} />}>
              Fleet List
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-cyan-300 tracking-tight">{drone.callsign}</h2>
              <span className="text-xs text-slate-400 font-sans">({drone.model})</span>
              <DroneStatusBadge status={drone.status} size="sm" />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${freshness === "LIVE" ? "bg-emerald-400" : "bg-amber-400"}`} />
                {freshness}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live Digital Twin & Geospatial Operations Cockpit
            </p>
          </div>
        </div>

        {/* Operational Control Buttons */}
        <div className="flex items-center gap-2">
          {drone.status === "EMERGENCY" ? (
            <Button
              variant="outline"
              size="md"
              leftIcon={<CheckCircleIcon size={16} />}
              onClick={() => setIsClearModalOpen(true)}
              className="text-emerald-400 border-emerald-500/50 hover:bg-emerald-950/40"
            >
              Clear Emergency & Reset
            </Button>
          ) : (
            <>
              {drone.status !== "IDLE" && drone.status !== "LANDED" && drone.status !== "OFFLINE" && (
                <Button
                  variant="outline"
                  size="md"
                  leftIcon={<RotateCcwIcon size={16} />}
                  onClick={() => setIsRthModalOpen(true)}
                >
                  Command RTH
                </Button>
              )}
              {drone.status !== "OFFLINE" && (
                <Button
                  variant="destructive"
                  size="md"
                  leftIcon={<AlertTriangleIcon size={16} />}
                  onClick={() => setIsEmergencyModalOpen(true)}
                >
                  Emergency Halt / Land
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Emergency Alert Banner if in emergency */}
      {drone.status === "EMERGENCY" && (
        <div className="bg-rose-950/80 border-2 border-rose-500 rounded-xl p-4 flex items-center justify-between text-rose-200 text-xs animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangleIcon size={24} className="text-rose-400" />
            <div>
              <p className="font-bold text-rose-100 text-sm">EMERGENCY PROTOCOL ENGAGED ON THIS UAV</p>
              <p className="text-rose-300 mt-0.5">Autonomous waypoint execution halted. Manual operator reset required.</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearModalOpen(true)}
            className="text-white border-rose-400 hover:bg-rose-900/60"
          >
            Reset Failsafe
          </Button>
        </div>
      )}

      {/* 3D Telemetry HUD Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card variant="glass" className="p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Altitude</span>
          <span className="font-mono text-lg font-bold text-cyan-400">{drone.altitudeMeters.toFixed(0)} <span className="text-xs text-slate-400 font-normal">m</span></span>
          <span className="text-[10px] text-emerald-400 block mt-0.5">MSL Reference</span>
        </Card>

        <Card variant="glass" className="p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Ground Speed</span>
          <span className="font-mono text-lg font-bold text-cyan-400">{drone.speedMetersPerSecond.toFixed(1)} <span className="text-xs text-slate-400 font-normal">m/s</span></span>
          <span className="text-[10px] text-slate-400 block mt-0.5">{(drone.speedMetersPerSecond * 1.94384).toFixed(1)} kts</span>
        </Card>

        <Card variant="glass" className="p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Heading</span>
          <span className="font-mono text-lg font-bold text-cyan-400">{drone.headingDegrees}°</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">True North</span>
        </Card>

        <Card variant="glass" className="p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Battery State</span>
          <div className="mt-1 flex justify-center">
            <BatteryIndicator percent={drone.batteryPercent} size="sm" showLabel />
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">~24.2 V Nominal</span>
        </Card>

        <Card variant="glass" className="p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Signal Link</span>
          <span className="font-mono text-xs font-bold text-emerald-400 block mt-1">99.8% {freshness}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">10 Hz Lockstep</span>
        </Card>

        <Card variant="glass" className="p-3 text-center">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">Airframe Hours</span>
          <span className="font-mono text-lg font-bold text-slate-200">{drone.flightHours.toFixed(1)}</span>
          <span className="text-[10px] text-slate-400 block mt-0.5">Total Service</span>
        </Card>
      </div>

      {/* Main View: Production Map + Active Mission Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tactical Radar Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-slate-750 shadow-2xl">
            <MapView
              markers={mapMarkers}
              routes={mapRoutes}
              geofences={DEMO_GEOFENCES}
              selectedMarkerId={drone.id}
              center={{ latitude: drone.latitude, longitude: drone.longitude }}
              zoom={15}
              title={`Cockpit Map Sector // ${drone.callsign}`}
              mapProvider="osm"
              showControls={true}
              showLayerToggles={true}
              showCoordinatesHud={true}
            />
          </div>
        </div>

        {/* Active Mission & Package Manifest */}
        <div className="space-y-4">
          <Card variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <RouteIcon size={16} className="text-cyan-400" />
                Active Mission Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {activeMission ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Mission Code:</span>
                    <Link href={`/admin/missions/${activeMission.id}`} className="font-mono font-bold text-cyan-400 hover:underline">
                      {activeMission.code}
                    </Link>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Origin:</span>
                    <span className="text-slate-200 text-right">{activeMission.originAddress}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Destination Pad:</span>
                    <span className="text-slate-200 text-right font-medium">{activeMission.destinationAddress}</span>
                  </div>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="text-slate-400">Progress:</span>
                    <span className="font-mono text-cyan-300 font-bold">{activeMission.progressPercent}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">ETA to Pad:</span>
                    <span className="font-mono text-emerald-400 font-bold">{activeMission.etaMinutes} mins</span>
                  </div>
                </>
              ) : (
                <div className="py-6 text-center text-slate-400">
                  <p>No active mission assigned to this UAV.</p>
                  <Link href="/admin/missions" className="mt-2 inline-block text-cyan-400 hover:underline">
                    Assign Mission
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {activeOrder && (
            <Card variant="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShieldIcon size={16} className="text-cyan-400" />
                  Cargo & Package Manifest
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Order Number:</span>
                  <span className="font-mono font-bold text-white">{activeOrder.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="text-slate-200">{activeOrder.recipientName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Payload Weight:</span>
                  <span className="font-mono text-slate-200">{activeOrder.weightKg} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Package Contents:</span>
                  <span className="text-slate-300 italic">{activeOrder.packageDescription}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Confirmation Modals */}
      <ReturnToHomeModal
        isOpen={isRthModalOpen}
        onClose={() => setIsRthModalOpen(false)}
        droneCallsign={drone.callsign}
        droneId={drone.id}
        currentAltitude={drone.altitudeMeters}
        batteryPercent={drone.batteryPercent}
        onConfirm={handleConfirmRTH}
      />

      <EmergencyHaltModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        droneCallsign={drone.callsign}
        droneId={drone.id}
        currentAltitude={drone.altitudeMeters}
        onConfirm={handleConfirmEmergency}
      />

      <EmergencyClearModal
        isOpen={isClearModalOpen}
        onClose={() => setIsClearModalOpen(false)}
        droneCallsign={drone.callsign}
        droneId={drone.id}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
}
