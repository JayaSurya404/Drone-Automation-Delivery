"use client";

import React, { useState } from "react";
import {
  MapView,
  TelemetrySummary,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  DroneStatusBadge,
  BatteryIndicator,
  DroneIcon,
  ShieldIcon,
  AlertTriangleIcon
} from "@skynav/ui";
import {
  DEMO_DRONES,
  DEMO_MISSIONS,
  DEMO_WAREHOUSE,
  DEMO_GEOFENCES
} from "@/lib/demo-data";

export default function AdminLiveTrackingPage() {
  const [selectedDroneId, setSelectedDroneId] = useState(DEMO_DRONES[0].id);
  const [drones, setDrones] = useState(DEMO_DRONES);

  const selectedDrone = drones.find((d) => d.id === selectedDroneId) || drones[0];
  const linkedMission = DEMO_MISSIONS.find((m) => m.droneId === selectedDrone.id);

  const handleRTH = () => {
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDrone.id ? { ...d, status: "RETURNING" as const } : d))
    );
  };

  const handleEmergency = () => {
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDrone.id ? { ...d, status: "EMERGENCY" as const } : d))
    );
  };

  const mapMarkers = [
    {
      id: "depot-alpha",
      type: "warehouse" as const,
      latitude: DEMO_WAREHOUSE.latitude,
      longitude: DEMO_WAREHOUSE.longitude,
      title: "Depot Alpha"
    },
    ...drones.map((d) => ({
      id: d.id,
      type: "drone" as const,
      latitude: d.latitude,
      longitude: d.longitude,
      headingDegrees: d.headingDegrees,
      altitudeMeters: d.altitudeMeters,
      batteryPercent: d.batteryPercent,
      title: d.callsign,
      status: d.status
    }))
  ];

  const mapRoutes = DEMO_MISSIONS.map((m) => ({
    id: m.id,
    coordinates: [
      { latitude: m.originCoords.latitude, longitude: m.originCoords.longitude },
      { latitude: m.destinationCoords.latitude, longitude: m.destinationCoords.longitude }
    ],
    color: m.droneCallsign === selectedDrone.callsign ? "#00f0ff" : "#475569",
    dashed: m.droneCallsign !== selectedDrone.callsign
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Tactical Radar & Telemetry HUD</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time geospatial tracking, 3D kinematic telemetry, and human-in-the-loop flight control overrides.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedDrone.status !== "IDLE" && selectedDrone.status !== "LANDED" && (
            <>
              <Button variant="outline" size="sm" onClick={handleRTH}>
                Issue Command: RTH
              </Button>
              <Button variant="destructive" size="sm" onClick={handleEmergency}>
                Emergency Halt
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Radar Viewport */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-[520px] w-full rounded-2xl overflow-hidden border border-slate-750">
            <MapView
              markers={mapMarkers}
              routes={mapRoutes}
              geofences={DEMO_GEOFENCES}
              selectedMarkerId={selectedDrone.id}
              title={`Airspace Tactical Sector // Selected: ${selectedDrone.callsign}`}
              onMarkerClick={(m) => {
                if (m.type === "drone") {
                  setSelectedDroneId(m.id);
                }
              }}
            />
          </div>

          {/* Quick Drone Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {drones.map((d) => (
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
              <CardTitle>Selected UAV Specs</CardTitle>
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
    </div>
  );
}
