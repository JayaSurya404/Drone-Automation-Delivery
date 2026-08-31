"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
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
  PlusIcon,
  AlertTriangleIcon,
  RotateCcwIcon,
  EyeIcon,
  Input
} from "@skynav/ui";
import { DEMO_DRONES, DemoDrone } from "@/lib/demo-data";
import { ReturnToHomeModal } from "@/features/admin/rth-modal";
import { EmergencyHaltModal } from "@/features/admin/emergency-modal";
import { EmergencyClearModal } from "@/features/admin/emergency-clear-modal";
import { EmergencyBanner } from "@/features/admin/emergency-banner";
import { PredictiveMaintenanceCard } from "@/features/admin/predictive-maintenance-card";

export default function AdminFleetPage() {
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [drones, setDrones] = useState<DemoDrone[]>(DEMO_DRONES);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [selectedDroneForRTH, setSelectedDroneForRTH] = useState<DemoDrone | null>(null);
  const [selectedDroneForEmergency, setSelectedDroneForEmergency] = useState<DemoDrone | null>(null);
  const [selectedDroneForClear, setSelectedDroneForClear] = useState<DemoDrone | null>(null);

  const filteredDrones = useMemo(() => {
    return drones.filter((d) => {
      if (searchQuery && !d.callsign.toLowerCase().includes(searchQuery.toLowerCase()) && !d.model.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter === "IN_FLIGHT") {
        return ["TAKEOFF", "EN_ROUTE", "DELIVERING", "RETURNING"].includes(d.status);
      }
      if (statusFilter === "IDLE") {
        return ["IDLE", "LANDED"].includes(d.status);
      }
      if (statusFilter === "EMERGENCY") {
        return d.status === "EMERGENCY";
      }
      if (statusFilter === "LOW_BATTERY") {
        return d.batteryPercent < 30;
      }
      return true;
    });
  }, [drones, statusFilter, searchQuery]);

  const emergencyDrones = drones.filter((d) => d.status === "EMERGENCY");

  const handleConfirmRTH = async (reason: string) => {
    if (!selectedDroneForRTH) return;
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDroneForRTH.id ? { ...d, status: "RETURNING" as const } : d))
    );
  };

  const handleConfirmEmergency = async (reason: string) => {
    if (!selectedDroneForEmergency) return;
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDroneForEmergency.id ? { ...d, status: "EMERGENCY" as const, altitudeMeters: 0, speedMetersPerSecond: 0 } : d))
    );
  };

  const handleConfirmClear = async (reason: string) => {
    if (!selectedDroneForClear) return;
    setDrones((prev) =>
      prev.map((d) => (d.id === selectedDroneForClear.id ? { ...d, status: "IDLE" as const, altitudeMeters: 0, speedMetersPerSecond: 0 } : d))
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <EmergencyBanner emergencyDrones={emergencyDrones} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">UAV Fleet Operations & Cockpit</h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time fleet monitoring, battery status, manual flight controls, and emergency protocols.
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
          <Link href="/admin/tracking">
            <Button variant="outline" size="md">
              Tactical Radar
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          {["ALL", "IN_FLIGHT", "IDLE", "EMERGENCY", "LOW_BATTERY"].map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === filterKey
                  ? filterKey === "EMERGENCY"
                    ? "bg-rose-500 text-white shadow-sm shadow-rose-500/50"
                    : "bg-cyan-500 text-black shadow-sm shadow-cyan-500/50"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
              }`}
            >
              {filterKey === "ALL" && `All Drones (${drones.length})`}
              {filterKey === "IN_FLIGHT" && "In Flight"}
              {filterKey === "IDLE" && "Idle / Landed"}
              {filterKey === "EMERGENCY" && `Emergency (${emergencyDrones.length})`}
              {filterKey === "LOW_BATTERY" && "Low Battery (<30%)"}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by callsign or model..."
            className="w-full text-xs"
          />
        </div>
      </div>

      {/* Drones Display */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrones.map((drone) => (
            <Card key={drone.id} variant="glass" className="overflow-hidden border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col justify-between">
              <div>
                <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-800 text-cyan-400 rounded-lg">
                      <DroneIcon size={18} />
                    </div>
                    <div>
                      <h3 className="font-mono font-bold text-white text-sm tracking-wide">{drone.callsign}</h3>
                      <p className="text-[11px] text-slate-400">{drone.model}</p>
                    </div>
                  </div>
                  <DroneStatusBadge status={drone.status} size="sm" />
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Battery Level</span>
                    <BatteryIndicator percent={drone.batteryPercent} size="sm" showLabel />
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/60 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Altitude</span>
                      <span className="font-mono text-xs font-bold text-white">{drone.altitudeMeters.toFixed(0)} m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Speed</span>
                      <span className="font-mono text-xs font-bold text-white">{drone.speedMetersPerSecond.toFixed(1)} m/s</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Heading</span>
                      <span className="font-mono text-xs font-bold text-white">{drone.headingDegrees}°</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>GPS Coordinates:</span>
                    <span className="font-mono text-cyan-300">{drone.latitude.toFixed(4)}, {drone.longitude.toFixed(4)}</span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-900/40 border-t border-slate-800/80 flex items-center justify-between gap-2">
                <Link href={`/admin/fleet/${drone.id}`}>
                  <Button variant="ghost" size="sm" leftIcon={<EyeIcon size={14} />} className="text-xs">
                    Inspect Cockpit
                  </Button>
                </Link>

                <div className="flex items-center gap-1.5">
                  {drone.status === "EMERGENCY" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDroneForClear(drone)}
                      className="text-emerald-400 border-emerald-500/50 hover:bg-emerald-950/40 text-xs"
                    >
                      Clear Emergency
                    </Button>
                  ) : (
                    <>
                      {drone.status !== "IDLE" && drone.status !== "LANDED" && drone.status !== "OFFLINE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDroneForRTH(drone)}
                          leftIcon={<RotateCcwIcon size={12} />}
                          className="text-xs py-1"
                        >
                          RTH
                        </Button>
                      )}
                      {drone.status !== "OFFLINE" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setSelectedDroneForEmergency(drone)}
                          leftIcon={<AlertTriangleIcon size={12} />}
                          className="text-xs py-1"
                        >
                          Emergency
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </Card>
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
                <TableHead>Coordinates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDrones.map((drone) => (
                <TableRow key={drone.id}>
                  <TableCell className="font-mono font-bold text-cyan-300">
                    <Link href={`/admin/fleet/${drone.id}`} className="hover:underline">
                      {drone.callsign}
                    </Link>
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
                  <TableCell className="font-mono text-xs text-slate-400">
                    {drone.latitude.toFixed(4)}, {drone.longitude.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Link href={`/admin/fleet/${drone.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs py-0.5">
                        Inspect
                      </Button>
                    </Link>
                    {drone.status === "EMERGENCY" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedDroneForClear(drone)}
                        className="text-emerald-400 border-emerald-500/40 text-xs py-0.5"
                      >
                        Reset
                      </Button>
                    ) : (
                      <>
                        {drone.status !== "IDLE" && drone.status !== "LANDED" && drone.status !== "OFFLINE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDroneForRTH(drone)}
                            className="text-xs py-0.5"
                          >
                            RTH
                          </Button>
                        )}
                        {drone.status !== "OFFLINE" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setSelectedDroneForEmergency(drone)}
                            className="text-xs py-0.5"
                          >
                            Emergency
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Predictive Fleet Maintenance & Diagnostics */}
      <PredictiveMaintenanceCard />

      {/* Operational Modals */}
      {selectedDroneForRTH && (
        <ReturnToHomeModal
          isOpen={Boolean(selectedDroneForRTH)}
          onClose={() => setSelectedDroneForRTH(null)}
          droneCallsign={selectedDroneForRTH.callsign}
          droneId={selectedDroneForRTH.id}
          currentAltitude={selectedDroneForRTH.altitudeMeters}
          batteryPercent={selectedDroneForRTH.batteryPercent}
          onConfirm={handleConfirmRTH}
        />
      )}

      {selectedDroneForEmergency && (
        <EmergencyHaltModal
          isOpen={Boolean(selectedDroneForEmergency)}
          onClose={() => setSelectedDroneForEmergency(null)}
          droneCallsign={selectedDroneForEmergency.callsign}
          droneId={selectedDroneForEmergency.id}
          currentAltitude={selectedDroneForEmergency.altitudeMeters}
          onConfirm={handleConfirmEmergency}
        />
      )}

      {selectedDroneForClear && (
        <EmergencyClearModal
          isOpen={Boolean(selectedDroneForClear)}
          onClose={() => setSelectedDroneForClear(null)}
          droneCallsign={selectedDroneForClear.callsign}
          droneId={selectedDroneForClear.id}
          onConfirm={handleConfirmClear}
        />
      )}
    </div>
  );
}
