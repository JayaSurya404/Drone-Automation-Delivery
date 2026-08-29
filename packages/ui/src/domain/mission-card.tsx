import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../primitives/card.js";
import { MissionStatusBadge } from "../primitives/status-badge.js";
import { RouteIcon, ClockIcon, WarehouseIcon, MapPinIcon } from "../icons/index.js";
import type { MissionStatus } from "@skynav/contracts";

export interface MissionCardProps {
  id: string;
  code: string;
  status: MissionStatus | string;
  droneCallsign?: string;
  originAddress: string;
  destinationAddress: string;
  progressPercent: number;
  etaMinutes?: number;
  waypointsCount: number;
  onSelect?: () => void;
  className?: string;
}

export function MissionCard({
  id,
  code,
  status,
  droneCallsign,
  originAddress,
  destinationAddress,
  progressPercent,
  etaMinutes,
  waypointsCount,
  onSelect,
  className = ""
}: MissionCardProps) {
  return (
    <Card variant="glass" hoverable onClick={onSelect} className={`flex flex-col justify-between ${className}`}>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <RouteIcon size={18} />
          </div>
          <div>
            <CardTitle>{code}</CardTitle>
            <span className="text-[11px] text-slate-400 font-mono">ID: {id.slice(0, 8)}...</span>
          </div>
        </div>
        <MissionStatusBadge status={status} size="sm" />
      </CardHeader>

      <CardContent className="space-y-3 py-3">
        {/* Origin & Destination Nodes */}
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <WarehouseIcon size={14} className="text-slate-400 shrink-0" />
            <span className="truncate">{originAddress}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <MapPinIcon size={14} className="text-cyan-400 shrink-0" />
            <span className="truncate">{destinationAddress}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] font-mono text-slate-400">
            <span>Flight Progress</span>
            <span className="text-cyan-400 font-semibold">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {droneCallsign && <span className="font-semibold text-slate-200">UAV: {droneCallsign}</span>}
          <span>{waypointsCount} waypoints</span>
        </div>
        {etaMinutes !== undefined && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
            <ClockIcon size={12} />
            <span>ETA {etaMinutes}m</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

export interface OrderCardProps {
  id: string;
  orderNumber: string;
  status: string;
  recipientName: string;
  deliveryAddress: string;
  packageDescription: string;
  weightKg: number;
  assignedDrone?: string;
  etaTime?: string;
  onTrack?: () => void;
  className?: string;
}

export function OrderCard({
  id,
  orderNumber,
  status,
  recipientName,
  deliveryAddress,
  packageDescription,
  weightKg,
  assignedDrone,
  etaTime,
  onTrack,
  className = ""
}: OrderCardProps) {
  return (
    <Card variant="glass" hoverable onClick={onTrack} className={`flex flex-col justify-between ${className}`}>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div>
          <CardTitle>{orderNumber}</CardTitle>
          <span className="text-xs text-slate-400">Recipient: {recipientName}</span>
        </div>
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
          {status}
        </span>
      </CardHeader>

      <CardContent className="space-y-2 py-3 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <MapPinIcon size={14} className="text-cyan-400 shrink-0" />
          <span className="truncate">{deliveryAddress}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
          <span>{packageDescription}</span>
          <span>{weightKg.toFixed(1)} kg</span>
        </div>
      </CardContent>

      <CardFooter className="pt-2">
        {assignedDrone ? (
          <span className="text-[11px] text-slate-300">Assigned: <strong className="text-cyan-400">{assignedDrone}</strong></span>
        ) : (
          <span className="text-[11px] text-slate-500">Awaiting dispatch</span>
        )}
        {etaTime && <span className="text-[11px] font-mono text-emerald-400 font-semibold">{etaTime}</span>}
      </CardFooter>
    </Card>
  );
}

export interface AlertCardProps {
  id: string;
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  message: string;
  timestamp: string;
  droneId?: string;
  missionId?: string;
  onAcknowledge?: () => void;
  className?: string;
}

export function AlertCard({
  id,
  severity,
  title,
  message,
  timestamp,
  droneId,
  missionId,
  onAcknowledge,
  className = ""
}: AlertCardProps) {
  const severityStyles = {
    CRITICAL: "border-red-500/40 bg-red-950/20 text-red-200",
    WARNING: "border-amber-500/40 bg-amber-950/20 text-amber-200",
    INFO: "border-cyan-500/40 bg-cyan-950/20 text-cyan-200"
  }[severity];

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-md flex flex-col gap-2.5 ${severityStyles} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            severity === "CRITICAL" ? "bg-red-500 text-white" : severity === "WARNING" ? "bg-amber-500 text-slate-950" : "bg-cyan-500 text-slate-950"
          }`}>
            {severity}
          </span>
          <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
        </div>
        <span className="text-[10px] font-mono text-slate-400">{timestamp}</span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{message}</p>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex gap-3">
          {droneId && <span>UAV: {droneId}</span>}
          {missionId && <span>Mission: {missionId.slice(0, 8)}</span>}
        </div>
        {onAcknowledge && (
          <button
            onClick={onAcknowledge}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium underline"
          >
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}

export interface ActivityEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category?: string;
  actor?: string;
}

export function ActivityTimeline({ events, className = "" }: { events: ActivityEvent[]; className?: string }) {
  return (
    <div className={`relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800 ${className}`}>
      {events.map((e) => (
        <div key={e.id} className="relative group">
          <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-slate-900" />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-200">{e.title}</span>
              <span className="text-[10px] font-mono text-slate-400">{e.timestamp}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{e.description}</p>
            {e.actor && <span className="text-[10px] text-slate-500 font-mono">Actor: {e.actor}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface TelemetrySummaryProps {
  droneCallsign: string;
  speedMps: number;
  altitudeM: number;
  headingDeg: number;
  batteryPct: number;
  lat: number;
  lon: number;
  flightTimeSec: number;
  className?: string;
}

export function TelemetrySummary({
  droneCallsign,
  speedMps,
  altitudeM,
  headingDeg,
  batteryPct,
  lat,
  lon,
  flightTimeSec,
  className = ""
}: TelemetrySummaryProps) {
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}m ${s < 10 ? "0" : ""}${s}s`;
  };

  return (
    <Card variant="hud" className={`p-4 font-mono ${className}`}>
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-3">
        <span className="text-xs uppercase text-cyan-400 font-bold tracking-wider">HUD TELEMETRY // {droneCallsign}</span>
        <span className="text-[10px] text-slate-400">FLIGHT TIME: {formatTime(flightTimeSec)}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">GROUND SPEED</div>
          <div className="text-lg font-bold text-cyan-300">{speedMps.toFixed(1)} <span className="text-xs">m/s</span></div>
        </div>
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">ALTITUDE AGL</div>
          <div className="text-lg font-bold text-slate-100">{altitudeM.toFixed(0)} <span className="text-xs">m</span></div>
        </div>
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">HEADING</div>
          <div className="text-lg font-bold text-slate-100">{headingDeg.toFixed(0)}°</div>
        </div>
        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
          <div className="text-[10px] text-slate-400">BATTERY</div>
          <div className="text-lg font-bold text-emerald-400">{batteryPct.toFixed(0)}%</div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-cyan-500/20 flex justify-between text-[10px] text-slate-400">
        <span>GPS POS: {lat.toFixed(5)}, {lon.toFixed(5)}</span>
        <span className="text-emerald-400">LINK: 100% QUALITY</span>
      </div>
    </Card>
  );
}
