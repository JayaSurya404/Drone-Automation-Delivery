import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "../primitives/card.js";
import { DroneStatusBadge, type DroneStatus } from "../primitives/status-badge.js";
import { BatteryIndicator } from "./battery-indicator.js";
import { DroneIcon, CompassIcon } from "../icons/index.js";
import { Button } from "../primitives/button.js";

export interface DroneCardProps {
  id: string;
  callsign: string;
  model: string;
  status: DroneStatus | string;
  batteryPercent: number;
  altitudeMeters: number;
  speedMetersPerSecond: number;
  headingDegrees: number;
  latitude: number;
  longitude: number;
  currentMissionId?: string;
  onSelect?: () => void;
  onRTH?: () => void;
  onEmergency?: () => void;
  className?: string;
}

export function DroneCard({
  id,
  callsign,
  model,
  status,
  batteryPercent,
  altitudeMeters,
  speedMetersPerSecond,
  headingDegrees,
  latitude,
  longitude,
  currentMissionId,
  onSelect,
  onRTH,
  onEmergency,
  className = ""
}: DroneCardProps) {
  return (
    <Card variant="glass" hoverable onClick={onSelect} className={`flex flex-col justify-between ${className}`}>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-cyan-400 border border-cyan-500/30">
            <DroneIcon size={20} />
          </div>
          <div>
            <CardTitle>{callsign}</CardTitle>
            <span className="text-xs text-slate-400 font-mono">{model}</span>
          </div>
        </div>
        <DroneStatusBadge status={status} size="sm" />
      </CardHeader>

      <CardContent className="space-y-4 py-4">
        {/* Telemetry Key Gauges */}
        <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-center font-mono">
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Altitude</div>
            <div className="text-sm font-bold text-slate-100">{altitudeMeters.toFixed(0)} m</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Speed</div>
            <div className="text-sm font-bold text-cyan-400">{speedMetersPerSecond.toFixed(1)} m/s</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400 uppercase">Heading</div>
            <div className="text-sm font-bold text-slate-100 flex items-center justify-center gap-1">
              <CompassIcon size={12} className="text-slate-400" />
              {headingDegrees.toFixed(0)}°
            </div>
          </div>
        </div>

        {/* Battery & Coordinates */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Power Level</span>
          <BatteryIndicator percent={batteryPercent} size="sm" />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>GPS</span>
          <span>{latitude.toFixed(4)}, {longitude.toFixed(4)}</span>
        </div>
      </CardContent>

      <CardFooter className="pt-3">
        {currentMissionId ? (
          <span className="text-[11px] font-mono text-blue-400">Mission: {currentMissionId.slice(0, 8)}...</span>
        ) : (
          <span className="text-[11px] text-slate-500">Standby at depot</span>
        )}

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {onRTH && status !== "IDLE" && status !== "LANDED" && (
            <Button size="sm" variant="outline" onClick={onRTH} className="text-[11px] py-0.5">
              RTH
            </Button>
          )}
          {onEmergency && status !== "IDLE" && status !== "LANDED" && (
            <Button size="sm" variant="destructive" onClick={onEmergency} className="text-[11px] py-0.5">
              Abort
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
