"use client";

import React, { useState } from "react";
import {
  MissionCard,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
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
  CheckCircleIcon
} from "@skynav/ui";
import { DEMO_MISSIONS } from "@/lib/demo-data";

export default function AdminMissionsPage() {
  const [missions, setMissions] = useState(DEMO_MISSIONS);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Flight Mission Dispatch Board</h2>
          <p className="text-xs text-slate-400 mt-1">
            Validate corridor geometry, verify weather clearances, and authorize autonomous mission launches.
          </p>
        </div>
        <Button variant="primary" size="md" leftIcon={<PlusIcon size={16} />}>
          Plan New Flight Corridor
        </Button>
      </div>

      {/* Mission Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {missions.map((m) => (
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
            {missions.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-mono font-bold text-cyan-300">{m.code}</TableCell>
                <TableCell className="font-mono font-semibold text-slate-200">{m.droneCallsign}</TableCell>
                <TableCell className="text-slate-300 text-xs">
                  {m.originAddress} → {m.destinationAddress}
                </TableCell>
                <TableCell className="font-mono">{m.waypointsCount} nodes</TableCell>
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
                  <Button variant="ghost" size="sm">
                    Inspect Corridor →
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
