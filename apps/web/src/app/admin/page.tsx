"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  StatCard,
  DroneCard,
  MissionCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  Button,
  DroneIcon,
  RouteIcon,
  PackageIcon,
  AlertTriangleIcon,
  ShieldIcon,
  MapView,
  SystemHealthGrid,
  ActivityTimeline,
  ChevronRightIcon
} from "@skynav/ui";
import {
  DEMO_DRONES,
  DEMO_ORDERS,
  DEMO_MISSIONS,
  DEMO_ALERTS,
  DEMO_AUDIT_LOGS,
  DEMO_WAREHOUSE,
  DEMO_GEOFENCES
} from "@/lib/demo-data";

export default function AdminOperationsCenter() {
  const activeDronesCount = DEMO_DRONES.filter(
    (d) => d.status === "EN_ROUTE" || d.status === "DELIVERING" || d.status === "RETURNING"
  ).length;

  const mapMarkers = [
    {
      id: "depot-alpha",
      type: "warehouse" as const,
      latitude: DEMO_WAREHOUSE.latitude,
      longitude: DEMO_WAREHOUSE.longitude,
      title: "Depot Alpha"
    },
    ...DEMO_DRONES.map((d) => ({
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
    color: m.droneCallsign === "SKY-001" ? "#00f0ff" : m.droneCallsign === "SKY-002" ? "#a855f7" : "#10b981"
  }));

  const systemServices = [
    { name: "Fastify API Gateway", status: "healthy" as const, metric: "12ms p99" },
    { name: "Deterministic Simulator", status: "healthy" as const, metric: "10 Hz Lockstep" },
    { name: "Telemetry Ingestion (Redis)", status: "healthy" as const, metric: "0 dropped frames" },
    { name: "PostgreSQL Database", status: "healthy" as const, metric: "Pool 10/20" }
  ];

  const recentTimelineEvents = DEMO_AUDIT_LOGS.map((a) => ({
    id: a.id,
    title: a.action.replace(/_/g, " "),
    description: `Resource: ${a.resource}`,
    timestamp: a.timestamp.slice(11, 19) + " UTC",
    actor: a.actor
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Mission Control Operations Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time fleet distribution, flight corridor authorization, and system telemetry monitoring.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/missions">
            <Button variant="primary" size="md" leftIcon={<RouteIcon size={16} />}>
              Dispatch Mission
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active UAVs In-Flight"
          value={activeDronesCount}
          delta="+2 this hour"
          deltaType="positive"
          subtitle="Total fleet size: 5 units"
          icon={<DroneIcon size={18} />}
        />
        <StatCard
          title="Deliveries Completed"
          value="48"
          delta="100% on-time"
          deltaType="positive"
          subtitle="Average drop duration: 14.2 min"
          icon={<PackageIcon size={18} />}
        />
        <StatCard
          title="Corridor Safety Rating"
          value="99.4%"
          delta="Optimal"
          deltaType="positive"
          subtitle="Zero geofence incursions"
          icon={<ShieldIcon size={18} />}
        />
        <StatCard
          title="Active System Incidents"
          value={DEMO_ALERTS.filter((a) => !a.acknowledged).length}
          delta="1 Advisory"
          deltaType="neutral"
          subtitle="Airspace density caution"
          icon={<AlertTriangleIcon size={18} />}
        />
      </div>

      {/* Main Grid: Tactical Radar Viewport + Live Drones */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tactical Fleet Radar */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="glass" className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle>Regional Fleet Radar Overview</CardTitle>
                <span className="text-xs text-slate-400 font-mono">({DEMO_DRONES.length} UAVs tracked)</span>
              </div>
              <Link href="/admin/tracking">
                <Button variant="ghost" size="sm" rightIcon={<ChevronRightIcon size={14} />}>
                  Fullscreen Radar
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 w-full">
                <MapView
                  markers={mapMarkers}
                  routes={mapRoutes}
                  geofences={DEMO_GEOFENCES}
                  title="Multi-Drone Airspace Sector SFO-North"
                />
              </div>
            </CardContent>
          </Card>

          {/* Subsystem Health Grid */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>System & Subsystem Infrastructure Health</CardTitle>
            </CardHeader>
            <CardContent>
              <SystemHealthGrid services={systemServices} />
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Drones & Recent Activity */}
        <div className="space-y-6">
          <Card variant="glass">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Active Flight Missions</CardTitle>
              <Link href="/admin/missions" className="text-xs text-cyan-400 hover:underline">
                View Board
              </Link>
            </CardHeader>
            <CardContent className="space-y-3 p-3">
              {DEMO_MISSIONS.slice(0, 2).map((m) => (
                <MissionCard
                  key={m.id}
                  id={m.id}
                  code={m.code}
                  status={m.status}
                  droneCallsign={m.droneCallsign}
                  originAddress={m.originAddress}
                  destinationAddress={m.destinationAddress}
                  progressPercent={m.progressPercent}
                  etaMinutes={m.etaMinutes}
                  waypointsCount={m.waypointsCount}
                />
              ))}
            </CardContent>
          </Card>

          <Card variant="glass">
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle>Flight Event Audit Trail</CardTitle>
              <Link href="/admin/audit" className="text-xs text-cyan-400 hover:underline">
                All Logs
              </Link>
            </CardHeader>
            <CardContent className="p-4">
              <ActivityTimeline events={recentTimelineEvents.slice(0, 3)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
