import React from "react";
import { Card } from "../primitives/card.js";

export interface StatCardProps {
  title: string;
  value: string | number;
  delta?: string | number;
  deltaType?: "positive" | "negative" | "neutral";
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: "default" | "glass" | "hud";
  className?: string;
}

export function StatCard({
  title,
  value,
  delta,
  deltaType = "neutral",
  subtitle,
  icon,
  variant = "glass",
  className = ""
}: StatCardProps) {
  const deltaColor = {
    positive: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    negative: "text-red-400 bg-red-500/10 border-red-500/20",
    neutral: "text-slate-400 bg-slate-800 border-slate-700"
  }[deltaType];

  return (
    <Card variant={variant} className={`p-5 flex flex-col justify-between gap-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
        {icon && <div className="p-2 rounded-lg bg-slate-800/80 text-cyan-400 border border-slate-700/60">{icon}</div>}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-100 font-mono">{value}</span>
          {delta && (
            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${deltaColor}`}>
              {delta}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </Card>
  );
}
