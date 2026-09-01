import React from "react";
import { SignalIcon } from "../icons/index.js";

export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export interface ConnectionStatusProps {
  state: ConnectionState;
  latencyMs?: number;
  showIcon?: boolean;
  className?: string;
}

export function ConnectionStatus({
  state,
  latencyMs,
  showIcon = true,
  className = ""
}: ConnectionStatusProps) {
  const config = {
    connected: {
      label: "Live Telemetry",
      dot: "bg-emerald-400",
      text: "text-emerald-400",
      border: "border-emerald-500/30",
      bg: "bg-emerald-950/20"
    },
    reconnecting: {
      label: "Reconnecting...",
      dot: "bg-amber-400 animate-ping",
      text: "text-amber-400",
      border: "border-amber-500/30",
      bg: "bg-amber-950/20"
    },
    disconnected: {
      label: "Link Offline",
      dot: "bg-red-400",
      text: "text-red-400",
      border: "border-red-500/30",
      bg: "bg-red-950/20"
    }
  }[state];

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full border text-xs font-medium backdrop-blur-md ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      {showIcon && <SignalIcon size={13} className="shrink-0" />}
      <span>{config.label}</span>
      {latencyMs !== undefined && state === "connected" && (
        <span className="text-[10px] font-mono text-slate-400">({latencyMs}ms)</span>
      )}
    </div>
  );
}

export interface SubsystemHealth {
  name: string;
  status: "healthy" | "degraded" | "down";
  metric?: string;
}

export function SystemHealthGrid({
  services,
  className = ""
}: {
  services: SubsystemHealth[];
  className?: string;
}) {
  const statusColor = {
    healthy: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    degraded: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    down: "text-red-400 bg-red-500/10 border-red-500/30"
  };

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 ${className}`}>
      {services.map((s) => (
        <div
          key={s.name}
          className={`p-3 rounded-xl border flex flex-col gap-1 bg-slate-900/60 backdrop-blur-md ${
            statusColor[s.status]
          }`}
        >
          <div className="flex items-center justify-between text-xs font-medium">
            <span className="text-slate-300">{s.name}</span>
            <span className="capitalize text-[11px] font-semibold">{s.status}</span>
          </div>
          {s.metric && <span className="text-[10px] font-mono text-slate-400">{s.metric}</span>}
        </div>
      ))}
    </div>
  );
}
