"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangleIcon, Button } from "@skynav/ui";

export interface EmergencyBannerProps {
  emergencyDrones: Array<{
    id: string;
    callsign: string;
    reason?: string;
  }>;
  onClearEmergency?: (droneId: string) => void;
}

export function EmergencyBanner({ emergencyDrones, onClearEmergency }: EmergencyBannerProps) {
  if (!emergencyDrones || emergencyDrones.length === 0) {
    return null;
  }

  return (
    <div className="bg-rose-950/80 border-2 border-rose-500/80 rounded-xl p-4 shadow-lg shadow-rose-950/50 animate-pulse text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-rose-500 text-black rounded-lg shrink-0 mt-0.5">
            <AlertTriangleIcon size={20} className="stroke-[2.5]" />
          </div>
          <div>
            <h4 className="font-bold text-rose-200 text-sm tracking-wide flex items-center gap-2">
              ACTIVE UAV EMERGENCY INCIDENT DETECTED
              <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                {emergencyDrones.length} UNIT{emergencyDrones.length > 1 ? "S" : ""}
              </span>
            </h4>
            <p className="text-xs text-rose-300 mt-1">
              Emergency failsafe protocol engaged for:{" "}
              {emergencyDrones.map((d, i) => (
                <span key={d.id}>
                  <Link
                    href={`/admin/fleet/${d.id}`}
                    className="font-mono font-bold text-white underline hover:text-rose-100"
                  >
                    {d.callsign}
                  </Link>
                  {i < emergencyDrones.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/admin/fleet/${emergencyDrones[0].id}`}>
            <Button variant="destructive" size="sm">
              Open Cockpit
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
