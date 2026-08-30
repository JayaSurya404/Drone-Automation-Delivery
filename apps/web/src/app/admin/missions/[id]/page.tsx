"use client";

import React, { useState, use } from "react";
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
  ChevronLeftIcon,
  MapView,
  ShieldIcon,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell
} from "@skynav/ui";
import { DEMO_MISSIONS, DEMO_ORDERS, DEMO_DRONES, DEMO_WAREHOUSE, DEMO_GEOFENCES, DemoMission } from "@/lib/demo-data";
import { CancelMissionModal } from "@/features/admin/cancel-mission-modal";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MissionDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const missionId = resolvedParams.id;

  const [mission, setMission] = useState<DemoMission | null>(() => {
    return DEMO_MISSIONS.find((m) => m.id === missionId) || DEMO_MISSIONS[0];
  });

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  if (!mission) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Mission Not Found</h2>
        <p className="text-slate-400 text-sm">Mission with ID '{missionId}' was not located.</p>
        <Link href="/admin/missions">
          <Button variant="outline" size="sm">
            Back to Missions List
          </Button>
        </Link>
      </div>
    );
  }

  const linkedOrder = DEMO_ORDERS.find((o) => o.id === mission.orderId);
  const assignedDrone = DEMO_DRONES.find((d) => d.id === mission.droneId || d.callsign === mission.droneCallsign);

  const waypoints = [
    {
      id: "wp-0",
      seq: 0,
      name: "Depot Alpha Climb Out",
      lat: mission.originCoords.latitude,
      lng: mission.originCoords.longitude,
      alt: 60,
      speed: 15,
      status: "COMPLETED"
    },
    {
      id: "wp-1",
      seq: 1,
      name: "Corridor Midway Bravo",
      lat: (mission.originCoords.latitude + mission.destinationCoords.latitude) / 2,
      lng: (mission.originCoords.longitude + mission.destinationCoords.longitude) / 2,
      alt: 60,
      speed: 18,
      status: mission.status === "IN_PROGRESS" ? "ACTIVE" : "COMPLETED"
    },
    {
      id: "wp-2",
      seq: 2,
      name: "Descent & Touchdown Pad",
      lat: mission.destinationCoords.latitude,
      lng: mission.destinationCoords.longitude,
      alt: 2,
      speed: 2,
      status: "PENDING"
    }
  ];

  const mapMarkers = [
    {
      id: "origin",
      type: "warehouse" as const,
      latitude: mission.originCoords.latitude,
      longitude: mission.originCoords.longitude,
      title: mission.originAddress
    },
    {
      id: "dest",
      type: "destination" as const,
      latitude: mission.destinationCoords.latitude,
      longitude: mission.destinationCoords.longitude,
      title: mission.destinationAddress
    },
    ...(assignedDrone
      ? [
          {
            id: assignedDrone.id,
            type: "drone" as const,
            latitude: assignedDrone.latitude,
            longitude: assignedDrone.longitude,
            headingDegrees: assignedDrone.headingDegrees,
            altitudeMeters: assignedDrone.altitudeMeters,
            batteryPercent: assignedDrone.batteryPercent,
            title: assignedDrone.callsign,
            status: assignedDrone.status
          }
        ]
      : [])
  ];

  const mapRoutes = [
    {
      id: mission.id,
      coordinates: [
        { latitude: mission.originCoords.latitude, longitude: mission.originCoords.longitude },
        ...(assignedDrone ? [{ latitude: assignedDrone.latitude, longitude: assignedDrone.longitude }] : []),
        { latitude: mission.destinationCoords.latitude, longitude: mission.destinationCoords.longitude }
      ],
      color: mission.status === "ABORTED" ? "#ef4444" : "#00f0ff"
    }
  ];

  const handleConfirmCancel = (reason: string) => {
    setMission((prev) => (prev ? { ...prev, status: "ABORTED", progressPercent: 0 } : null));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin/missions">
            <Button variant="ghost" size="sm" leftIcon={<ChevronLeftIcon size={16} />}>
              Missions List
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-mono text-white tracking-tight">{mission.code}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                mission.status === "IN_PROGRESS"
                  ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                  : mission.status === "DELIVERED"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : mission.status === "ABORTED"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-slate-800 text-slate-300"
              }`}>
                {mission.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Flight Plan & Corridor Execution Cockpit
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mission.status !== "COMPLETED" && mission.status !== "ABORTED" && (
            <Button
              variant="destructive"
              size="md"
              onClick={() => setIsCancelModalOpen(true)}
            >
              Cancel Mission
            </Button>
          )}
        </div>
      </div>

      {/* Progress & Corridor Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="glass" className="p-4">
          <span className="text-xs text-slate-400 block font-medium">Flight Corridor Progress</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-cyan-400">{mission.progressPercent}%</span>
            <span className="text-xs text-slate-400">ETA: {mission.etaMinutes} mins</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400 rounded-full transition-all" style={{ width: `${mission.progressPercent}%` }} />
          </div>
        </Card>

        <Card variant="glass" className="p-4">
          <span className="text-xs text-slate-400 block font-medium">Assigned UAV</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white">{mission.droneCallsign}</span>
            {assignedDrone && <DroneStatusBadge status={assignedDrone.status} size="sm" />}
          </div>
          {assignedDrone && (
            <Link href={`/admin/fleet/${assignedDrone.id}`} className="text-xs text-cyan-400 hover:underline mt-1 block">
              Open UAV Cockpit →
            </Link>
          )}
        </Card>

        <Card variant="glass" className="p-4">
          <span className="text-xs text-slate-400 block font-medium">Corridor Safety Score</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-emerald-400">Optimal</span>
            <span className="text-xs text-slate-400">Score {mission.riskScore}/100</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Weather: {mission.weatherStatus}</span>
        </Card>

        <Card variant="glass" className="p-4">
          <span className="text-xs text-slate-400 block font-medium">Flight Plan Waypoints</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-mono text-2xl font-bold text-white">{waypoints.length} Fixes</span>
            <span className="text-xs text-emerald-400">Corridor Active</span>
          </div>
          <span className="text-xs text-slate-400 mt-1 block">Cruising Alt: 60m MSL</span>
        </Card>
      </div>

      {/* Main Grid: Radar Map + Flight Plan */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card variant="glass" className="overflow-hidden">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle>Flight Corridor Map Viewport</CardTitle>
              <span className="text-xs font-mono text-slate-400">{mission.originAddress} → {mission.destinationAddress}</span>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-96 w-full">
                <MapView
                  markers={mapMarkers}
                  routes={mapRoutes}
                  geofences={DEMO_GEOFENCES}
                  center={{ latitude: mission.originCoords.latitude, longitude: mission.originCoords.longitude }}
                  title={`Mission Flight Plan — ${mission.code}`}
                />
              </div>
            </CardContent>
          </Card>

          {/* Waypoints Table */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>3D Flight Plan Waypoints Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Seq</TableHead>
                    <TableHead>Fix Name</TableHead>
                    <TableHead>Coordinates</TableHead>
                    <TableHead>Altitude</TableHead>
                    <TableHead>Target Speed</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {waypoints.map((wp) => (
                    <TableRow key={wp.id}>
                      <TableCell className="font-mono text-slate-400">{wp.seq}</TableCell>
                      <TableCell className="font-medium text-white">{wp.name}</TableCell>
                      <TableCell className="font-mono text-xs text-cyan-300">{wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}</TableCell>
                      <TableCell className="font-mono text-slate-300">{wp.alt} m</TableCell>
                      <TableCell className="font-mono text-slate-300">{wp.speed} m/s</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          wp.status === "COMPLETED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : wp.status === "ACTIVE"
                            ? "bg-cyan-500/20 text-cyan-400 animate-pulse"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {wp.status}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Order & Cargo details */}
        <div className="space-y-4">
          {linkedOrder && (
            <Card variant="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <ShieldIcon size={16} className="text-cyan-400" />
                  Order & Dropzone Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Order Number:</span>
                  <span className="font-mono font-bold text-white">{linkedOrder.orderNumber}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="text-slate-200">{linkedOrder.recipientName}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Delivery Address:</span>
                  <span className="text-slate-200 text-right">{linkedOrder.deliveryAddress}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Cargo Weight:</span>
                  <span className="font-mono text-slate-200">{linkedOrder.weightKg} kg</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">OTP Release Code:</span>
                  <span className="font-mono font-bold text-cyan-400">{linkedOrder.proofOfDeliveryCode}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {assignedDrone && (
            <Card variant="glass">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <DroneIcon size={16} className="text-cyan-400" />
                  Assigned UAV Telemetry
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Callsign:</span>
                  <span className="font-mono font-bold text-cyan-400">{assignedDrone.callsign}</span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Battery:</span>
                  <BatteryIndicator percent={assignedDrone.batteryPercent} size="sm" showLabel />
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Current Speed:</span>
                  <span className="font-mono text-white">{assignedDrone.speedMetersPerSecond.toFixed(1)} m/s</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Current Altitude:</span>
                  <span className="font-mono text-white">{assignedDrone.altitudeMeters.toFixed(0)} m</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Cancel Mission Modal */}
      <CancelMissionModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        missionCode={mission.code}
        missionId={mission.id}
        droneCallsign={mission.droneCallsign}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
