"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  MissionCard,
  Card,
  CardHeader,
  CardTitle,
  Button,
  MissionStatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  RouteIcon,
  PlusIcon,
  CheckCircleIcon,
  Input,
  EyeIcon
} from "@skynav/ui";
import { DEMO_MISSIONS, DemoMission } from "@/lib/demo-data";

export default function AdminMissionsPage() {
  const [missions, setMissions] = useState<DemoMission[]>(DEMO_MISSIONS);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMissions = useMemo(() => {
    return missions.filter((m) => {
      if (searchQuery && !m.code.toLowerCase().includes(searchQuery.toLowerCase()) && !m.droneCallsign.toLowerCase().includes(searchQuery.toLowerCase()) && !m.destinationAddress.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (statusFilter === "IN_PROGRESS") {
        return m.status === "IN_PROGRESS" || m.status === "DISPATCHED";
      }
      if (statusFilter === "RETURNING") {
        return m.status === "RETURNING";
      }
      if (statusFilter === "COMPLETED") {
        return m.status === "COMPLETED" || m.status === "DELIVERED";
      }
      if (statusFilter === "ABORTED") {
        return m.status === "ABORTED";
      }
      return true;
    });
  }, [missions, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Flight Mission Dispatch Board</h2>
          <p className="text-xs text-slate-400 mt-1">
            Validate corridor geometry, verify weather clearances, authorize flights, and monitor real-time execution.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin/tracking">
            <Button variant="outline" size="md">
              Tactical Radar
            </Button>
          </Link>
          <Button variant="primary" size="md" leftIcon={<PlusIcon size={16} />}>
            Plan New Flight Corridor
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 flex-wrap">
          {["ALL", "IN_PROGRESS", "RETURNING", "COMPLETED", "ABORTED"].map((filterKey) => (
            <button
              key={filterKey}
              onClick={() => setStatusFilter(filterKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === filterKey
                  ? "bg-cyan-500 text-black shadow-sm shadow-cyan-500/50"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80"
              }`}
            >
              {filterKey === "ALL" && `All Missions (${missions.length})`}
              {filterKey === "IN_PROGRESS" && "In Flight"}
              {filterKey === "RETURNING" && "Returning"}
              {filterKey === "COMPLETED" && "Delivered / Done"}
              {filterKey === "ABORTED" && "Aborted / Cancelled"}
            </button>
          ))}
        </div>

        <div className="w-full md:w-64">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by code, UAV, or address..."
            className="w-full text-xs"
          />
        </div>
      </div>

      {/* Mission Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMissions.map((m) => (
          <div key={m.id} className="relative group">
            <MissionCard
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
            <div className="mt-2 flex justify-end">
              <Link href={`/admin/missions/${m.id}`}>
                <Button variant="ghost" size="sm" rightIcon={<EyeIcon size={14} />} className="text-xs text-cyan-400 hover:text-cyan-300">
                  Inspect Mission Cockpit →
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Mission Validation Table */}
      <Card variant="glass" className="overflow-hidden">
        <CardHeader>
          <CardTitle>Airspace Risk & Safety Review</CardTitle>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mission Code</TableHead>
              <TableHead>UAV Assigned</TableHead>
              <TableHead>Corridor Segment</TableHead>
              <TableHead>Waypoints</TableHead>
              <TableHead>AI Risk Score</TableHead>
              <TableHead>Weather Check</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMissions.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono font-bold text-cyan-300">
                  <Link href={`/admin/missions/${m.id}`} className="hover:underline">
                    {m.code}
                  </Link>
                </TableCell>
                <TableCell className="font-mono font-semibold text-slate-200">
                  <Link href={`/admin/fleet/${m.droneId}`} className="hover:underline text-slate-300 hover:text-cyan-300">
                    {m.droneCallsign}
                  </Link>
                </TableCell>
                <TableCell className="text-slate-300 text-xs">
                  {m.originAddress} → {m.destinationAddress}
                </TableCell>
                <TableCell className="font-mono text-xs text-slate-400">{m.waypointsCount} nodes</TableCell>
                <TableCell className="font-mono">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    m.riskScore < 15 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {m.riskScore}/100
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-emerald-400 font-mono font-semibold text-xs flex items-center gap-1">
                    <CheckCircleIcon size={14} />
                    {m.weatherStatus}
                  </span>
                </TableCell>
                <TableCell>
                  <MissionStatusBadge status={m.status} size="sm" />
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/missions/${m.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs">
                      Inspect →
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
