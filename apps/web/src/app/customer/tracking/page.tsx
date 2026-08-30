"use client";

import React, { useState, useMemo } from "react";
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
  ClockIcon,
  ShieldIcon
} from "@skynav/ui";
import { DEMO_DRONES, DEMO_ORDERS, DEMO_WAREHOUSE, DEMO_GEOFENCES } from "@/lib/demo-data";
import { useRealtimeTelemetry } from "@/lib/realtime";
import {
  haversineDistanceMeters,
  computeRemainingRouteDistanceMeters,
  calculateDynamicEtaSeconds,
  formatDistance,
  formatDuration,
  calculateTelemetryFreshness,
  isValidCoordinate
} from "@skynav/contracts";

export default function CustomerLiveTrackingPage() {
  const [selectedDroneId] = useState(DEMO_DRONES[0].id);
  const baseDrone = DEMO_DRONES.find((d) => d.id === selectedDroneId) || DEMO_DRONES[0];

  const { status: wsStatus, telemetryMap, trailsMap, lastMessageAt } = useRealtimeTelemetry({
    channel: "telemetry:drone",
    targetId: baseDrone.id,
    autoConnect: true,
    maxTrailPoints: 30
  });

  const liveTelemetry = telemetryMap.get(baseDrone.id);
  const liveTrail = trailsMap.get(baseDrone.id) || baseDrone.trail || [];

  const activeDrone = useMemo(() => {
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

  const linkedOrder = DEMO_ORDERS.find((o) => o.assignedDroneId === activeDrone.id) || DEMO_ORDERS[0];

  const destLat = 37.7952;
  const destLon = -122.4028;

  // Waypoints along authorized customer corridor
  const flightWaypoints = useMemo(() => {
    return [
      { latitude: DEMO_WAREHOUSE.latitude, longitude: DEMO_WAREHOUSE.longitude, altitudeMeters: 0 },
      { latitude: (DEMO_WAREHOUSE.latitude * 2 + destLat) / 3, longitude: (DEMO_WAREHOUSE.longitude * 2 + destLon) / 3, altitudeMeters: 55 },
      { latitude: (DEMO_WAREHOUSE.latitude + destLat * 2) / 3, longitude: (DEMO_WAREHOUSE.longitude + destLon * 2) / 3, altitudeMeters: 55 },
      { latitude: destLat, longitude: destLon, altitudeMeters: 2 }
    ];
  }, [destLat, destLon]);

  // Dynamic kinematic calculations
  const remainingDistanceMeters = useMemo(() => {
    return computeRemainingRouteDistanceMeters(
      { latitude: activeDrone.latitude, longitude: activeDrone.longitude, altitudeMeters: activeDrone.altitudeMeters },
      flightWaypoints,
      activeDrone.status === "TAKEOFF" ? 1 : activeDrone.status === "DELIVERING" ? 3 : 2
    );
  }, [activeDrone, flightWaypoints]);

  const etaSeconds = useMemo(() => {
    return calculateDynamicEtaSeconds(remainingDistanceMeters, activeDrone.speedMetersPerSecond, 15);
  }, [remainingDistanceMeters, activeDrone.speedMetersPerSecond]);

  const freshness = useMemo(() => {
    if (!liveTelemetry) return "LIVE";
    return calculateTelemetryFreshness(liveTelemetry.observedAt);
  }, [liveTelemetry]);

  const etaDisplay = useMemo(() => {
    if (activeDrone.status === "DELIVERING") return "Touchdown in progress";
    if (activeDrone.status === "RETURNING") return "Package Dropped • Returning to Depot";
    if (activeDrone.status === "LANDED" || activeDrone.status === "IDLE") return "Completed";
    if (activeDrone.status === "EMERGENCY") return "Failsafe Halt";
    return formatDuration(etaSeconds);
  }, [activeDrone.status, etaSeconds]);

  const mapMarkers = useMemo(() => {
    return [
      {
        id: "depot",
        type: "warehouse" as const,
        latitude: DEMO_WAREHOUSE.latitude,
        longitude: DEMO_WAREHOUSE.longitude,
        title: "Fulfillment Depot Alpha"
      },
      {
        id: "destination-pad",
        type: "destination" as const,
        latitude: destLat,
        longitude: destLon,
        title: "Your Landing Pad"
      },
      {
        id: activeDrone.id,
        type: "drone" as const,
        latitude: activeDrone.latitude,
        longitude: activeDrone.longitude,
        headingDegrees: activeDrone.headingDegrees,
        altitudeMeters: activeDrone.altitudeMeters,
        speedMetersPerSecond: activeDrone.speedMetersPerSecond,
        batteryPercent: activeDrone.batteryPercent,
        freshness,
        title: activeDrone.callsign,
        status: activeDrone.status,
        trail: activeDrone.trail
      }
    ];
  }, [activeDrone, destLat, destLon, freshness]);

  const mapRoutes = useMemo(() => {
    return [
      {
        id: "customer-corridor",
        coordinates: flightWaypoints,
        color: activeDrone.status === "EMERGENCY" ? "#ef4444" : "#00f0ff",
        activeWaypointIndex: activeDrone.status === "DELIVERING" ? 3 : 2
      }
    ];
  }, [flightWaypoints, activeDrone.status]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Aerial Shipment Live Tracking</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time geospatial position, flight corridor progress, and kinematic delivery ETA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
            <span
              className={`w-2 h-2 rounded-full ${
                freshness === "LIVE"
                  ? "bg-emerald-400 animate-pulse"
                  : freshness === "DEGRADED"
                  ? "bg-amber-400"
                  : "bg-rose-400"
              }`}
            />
            <span className="text-slate-200">
              {wsStatus === "CONNECTED" ? `TELEMETRY ${freshness}` : "TELEMETRY SYNCHRONIZED"}
            </span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production Interactive Geospatial Map */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[520px] w-full rounded-2xl overflow-hidden border border-slate-750 shadow-2xl">
            <MapView
              markers={mapMarkers}
              routes={mapRoutes}
              geofences={DEMO_GEOFENCES}
              center={{ latitude: activeDrone.latitude, longitude: activeDrone.longitude }}
              zoom={15}
              title={`Shipment Radar // Order ${linkedOrder.orderNumber} • ${activeDrone.callsign}`}
              mapProvider="osm"
              showControls={true}
              showLayerToggles={true}
              showCoordinatesHud={true}
            />
          </div>
        </div>

        {/* Real-time Telemetry HUD & Order Info */}
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
              <CardTitle>Delivery Manifest</CardTitle>
              <DroneStatusBadge status={activeDrone.status} size="sm" />
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300 font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Order Number</span>
                <span className="text-cyan-300 font-bold">{linkedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Recipient</span>
                <span className="text-white font-sans">{linkedOrder.recipientName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Remaining Distance</span>
                <span className="text-cyan-300 font-bold">{formatDistance(remainingDistanceMeters)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Estimated Arrival (ETA)</span>
                <span className="text-emerald-400 font-bold">{etaDisplay}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Drop Address</span>
                <span className="text-slate-200 text-right font-sans truncate max-w-[170px]">{linkedOrder.deliveryAddress}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Secure Release OTP</span>
                <span className="text-cyan-400 font-bold tracking-widest text-sm">{linkedOrder.proofOfDeliveryCode}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
