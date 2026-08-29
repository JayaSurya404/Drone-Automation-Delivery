"use client";

import React, { useState } from "react";
import {
  DroneCard,
  Card,
  Button,
  DroneStatusBadge,
  BatteryIndicator,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  DroneIcon,
  PlusIcon
} from "@skynav/ui";
import { DEMO_DRONES } from "@/lib/demo-data";

export default function AdminFleetPage() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [drones, setDrones] = useState(DEMO_DRONES);

  const handleRTH = (id: string) => {
    setDrones((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "RETURNING" as const } : d))
    );
  };

  const handleEmergency = (id: string) => {
    setDrones((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: "EMERGENCY" as const } : d))
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">UAV Fleet & Asset Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor drone health, battery reserve capacity, flight hours, and issue manual flight overrides.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === "grid" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                viewMode === "table" ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Table
            </button>
          </div>
          <Button variant="primary" size="md" leftIcon={<PlusIcon size={16} />}>
            Register New UAV
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {drones.map((drone) => (
            <DroneCard
              key={drone.id}
              id={drone.id}
              callsign={drone.callsign}
              model={drone.model}
              status={drone.status}
              batteryPercent={drone.batteryPercent}
              altitudeMeters={drone.altitudeMeters}
              speedMetersPerSecond={drone.speedMetersPerSecond}
              headingDegrees={drone.headingDegrees}
              latitude={drone.latitude}
              longitude={drone.longitude}
              currentMissionId={drone.currentMissionId}
              onRTH={() => handleRTH(drone.id)}
              onEmergency={() => handleEmergency(drone.id)}
            />
          ))}
        </div>
      ) : (
        <Card variant="glass" className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Callsign</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Battery Level</TableHead>
                <TableHead>Altitude</TableHead>
                <TableHead>Speed</TableHead>
                <TableHead>Flight Hours</TableHead>
                <TableHead className="text-right">Controls</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drones.map((drone) => (
                <TableRow key={drone.id}>
                  <TableCell className="font-mono font-bold text-cyan-300">
                    {drone.callsign}
                  </TableCell>
                  <TableCell className="text-slate-300">{drone.model}</TableCell>
                  <TableCell>
                    <DroneStatusBadge status={drone.status} size="sm" />
                  </TableCell>
                  <TableCell>
                    <BatteryIndicator percent={drone.batteryPercent} size="sm" />
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {drone.altitudeMeters.toFixed(0)} m
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {drone.speedMetersPerSecond.toFixed(1)} m/s
                  </TableCell>
                  <TableCell className="font-mono text-slate-400">
                    {drone.flightHours.toFixed(1)} hrs
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {drone.status !== "IDLE" && drone.status !== "LANDED" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRTH(drone.id)}
                          className="text-[11px] py-0.5"
                        >
                          RTH
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleEmergency(drone.id)}
                          className="text-[11px] py-0.5"
                        >
                          Abort
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
