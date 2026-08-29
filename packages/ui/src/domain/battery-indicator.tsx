import React from "react";
import { BatteryIcon, ZapIcon } from "../icons/index.js";

export interface BatteryIndicatorProps {
  percent: number;
  voltage?: number;
  isCharging?: boolean;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function BatteryIndicator({
  percent,
  voltage,
  isCharging = false,
  size = "md",
  showLabel = true,
  className = ""
}: BatteryIndicatorProps) {
  const clampedPercent = Math.max(0, Math.min(100, percent));

  const colorClass =
    clampedPercent > 50
      ? "bg-emerald-400 text-emerald-400"
      : clampedPercent > 25
      ? "bg-amber-400 text-amber-400"
      : "bg-red-500 text-red-500 animate-pulse";

  const sizeStyles = {
    sm: { barH: "h-1.5", width: "w-8", text: "text-[11px]" },
    md: { barH: "h-2", width: "w-12", text: "text-xs" },
    lg: { barH: "h-3", width: "w-20", text: "text-sm font-semibold" }
  }[size];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Battery Graphical Cell */}
      <div className={`relative flex items-center bg-slate-800/80 border border-slate-700/80 rounded-sm p-0.5 ${sizeStyles.width} ${sizeStyles.barH}`}>
        <div
          className={`h-full rounded-[1px] transition-all duration-300 ${colorClass.split(" ")[0]}`}
          style={{ width: `${clampedPercent}%` }}
        />
        {isCharging && (
          <ZapIcon size={12} className="absolute inset-0 m-auto text-amber-300 drop-shadow" />
        )}
      </div>

      {/* Numerical Label */}
      {showLabel && (
        <span className={`font-mono font-medium ${sizeStyles.text} ${colorClass.split(" ")[1]}`}>
          {clampedPercent.toFixed(0)}%
          {voltage !== undefined && (
            <span className="text-slate-400 font-normal text-[10px] ml-1">({voltage.toFixed(1)}V)</span>
          )}
        </span>
      )}
    </div>
  );
}
