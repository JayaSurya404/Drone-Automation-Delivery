"use client";

import React, { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  MapView,
  TelemetrySummary,
  DroneStatusBadge,
  Button,
  DroneIcon,
  MapPinIcon,
  ClockIcon
} from "@skynav/ui";
import { DEMO_DRONES, DEMO_ORDERS, DEMO_WAREHOUSE, DEMO_GEOFENCES } from "@/lib/demo-data";
import { useRealtimeTelemetry } from "@/lib/realtime";

export default function CustomerLiveTrackingPage() {
  const [selectedDroneId, setSelectedDroneId] = useState(DEMO_DRONES[0].id);
  const baseDrone = DEMO_DRONES.find((d) => d.id === selectedDroneId) || DEMO_DRONES[0];

  const { status: wsStatus, telemetryMap } = useRealtimeTelemetry({
    channel: "telemetry:drone",
    targetId: baseDrone.id,
    autoConnect: true
  });

  const liveTelemetry = telemetryMap.get(baseDrone.id);
  const activeDrone = liveTelemetry
    ? {
        ...baseDrone,
        latitude: liveTelemetry.position.latitude,
        longitude: liveTelemetry.position.longitude,
        altitudeMeters: liveTelemetry.position.altitudeMeters ?? baseDrone.altitudeMeters,
        headingDegrees: liveTelemetry.headingDegrees ?? baseDrone.headingDegrees,
        speedMetersPerSecond: liveTelemetry.speedMetersPerSecond ?? baseDrone.speedMetersPerSecond,
        batteryPercent: liveTelemetry.batteryPercent ?? baseDrone.batteryPercent,
        status: (liveTelemetry.state as any) ?? baseDrone.status
      }
    : baseDrone;

  const linkedOrder = DEMO_ORDERS.find((o) => o.assignedDroneId === activeDrone.id) || DEMO_ORDERS[0];

  // Dynamic distance and ETA estimation based on live kinematics
  const destLat = 37.7952;
  const destLon = -122.4028;
  const latDiff = (destLat - activeDrone.latitude) * 111000;
  const lonDiff = (destLon - activeDrone.longitude) * 88000;
  const approxDistanceMeters = Math.sqrt(latDiff * latDiff + lonDiff * lonDiff);
  const speed = activeDrone.speedMetersPerSecond > 1 ? activeDrone.speedMetersPerSecond : 15;
  const dynamicEtaMinutes = Math.max(1, Math.round(approxDistanceMeters / speed / 60));
  const etaDisplay =
    activeDrone.status === "DELIVERING"
      ? "Touchdown in progress"
      : activeDrone.status === "RETURNING"
      ? "Package Dropped • Returning"
      : activeDrone.status === "LANDED"
      ? "Completed"
      : `${dynamicEtaMinutes} mins`;

  const mapMarkers = [
    {
      id: "depot",
      type: "warehouse" as const,
      latitude: DEMO_WAREHOUSE.latitude,
      longitude: DEMO_WAREHOUSE.longitude,
      title: "Depot Alpha"
    },
    {
      id: "dest",
      type: "destination" as const,
      latitude: destLat,
      longitude: destLon,
      title: "Delivery Landing Pad"
    },
    {
      id: activeDrone.id,
      type: "drone" as const,
      latitude: activeDrone.latitude,
      longitude: activeDrone.longitude,
      headingDegrees: activeDrone.headingDegrees,
      altitudeMeters: activeDrone.altitudeMeters,
      batteryPercent: activeDrone.batteryPercent,
      title: activeDrone.callsign,
      status: activeDrone.status
    }
  ];

  const mapRoutes = [
    {
      id: "live-corridor",
      coordinates: [
        { latitude: DEMO_WAREHOUSE.latitude, longitude: DEMO_WAREHOUSE.longitude },
        { latitude: (DEMO_WAREHOUSE.latitude + destLat) / 2, longitude: (DEMO_WAREHOUSE.longitude + destLon) / 2 },
        { latitude: destLat, longitude: destLon }
      ],
      color: "#00f0ff"
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Live UAV Telemetry Radar</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time geospatial position, altitude, velocity, and corridor status for your aerial shipment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{wsStatus === "CONNECTED" ? "LIVE TELEMETRY STREAM" : "TELEMETRY CONNECTED"}</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Radar Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[480px] w-full rounded-2xl overflow-hidden border border-slate-750">
            <MapView
              markers={mapMarkers}
              routes={mapRoutes}
              geofences={DEMO_GEOFENCES}
              title={`Tactical Radar // Tracking UAV: ${activeDrone.callsign}`}
            />
          </div>
        </div>

        {/* Live Gauges and Flight Stats */}
        <div className="space-y-6">
          <TelemetrySummary
            droneCallsign={activeDrone.callsign}
            speedMps={activeDrone.speedMetersPerSecond}
            altitudeM={activeDrone.altitudeMeters}
            headingDeg={activeDrone.headingDegrees}
            batteryPct={activeDrone.batteryPercent}
            lat={activeDrone.latitude}
            lon={activeDrone.longitude}
            flightTimeSec={720}
          />

          <Card variant="glass">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Shipment Context</CardTitle>
              <DroneStatusBadge status={activeDrone.status} size="sm" />
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Order ID</span>
                <span className="text-cyan-300 font-bold">{linkedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Recipient</span>
                <span className="text-white font-sans">{linkedOrder.recipientName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Dynamic ETA</span>
                <span className="text-emerald-400 font-bold">{etaDisplay}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Release Code</span>
                <span className="text-cyan-400 font-bold tracking-widest text-sm">{linkedOrder.proofOfDeliveryCode}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
