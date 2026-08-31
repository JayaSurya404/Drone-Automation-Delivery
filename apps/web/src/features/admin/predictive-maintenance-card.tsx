"use client";

import React from "react";
import { Card, CardHeader, CardTitle, Badge } from "@skynav/ui";
import type { AiMaintenancePredictionResponse } from "@skynav/contracts";

export interface PredictiveMaintenanceCardProps {
  prediction?: AiMaintenancePredictionResponse;
}

export function PredictiveMaintenanceCard({
  prediction = {
    modelVersion: "maintenance-prognostics-v1.1.0",
    assessedAt: new Date().toISOString(),
    droneId: "drone-default",
    overallRiskScore: 18.5,
    overallRiskLevel: "NORMAL",
    maintenancePriority: "LOW",
    estimatedHoursToNextService: 74.5,
    recommendedAction: "UAV is in optimal operational health. Cleared for all flight profiles.",
    components: [
      {
        component: "BATTERY",
        riskScore: 12.0,
        healthPercent: 98.0,
        status: "HEALTHY",
        findings: ["Nominal battery pack voltage and cell balance."]
      },
      {
        component: "MOTORS",
        riskScore: 22.0,
        healthPercent: 88.0,
        status: "HEALTHY",
        findings: ["Smooth motor telemetry and balanced rotor vibrations."]
      },
      {
        component: "AIRFRAME",
        riskScore: 10.0,
        healthPercent: 95.0,
        status: "HEALTHY",
        findings: ["Airframe structural rigidity within design tolerances."]
      },
      {
        component: "AVIONICS",
        riskScore: 8.0,
        healthPercent: 99.0,
        status: "HEALTHY",
        findings: ["IMU, Barometer, and GNSS RTK lock operating nominally."]
      }
    ],
    riskFactors: [],
    recommendedInspections: ["Standard pre-flight visual airframe and propeller check."]
  }
}: PredictiveMaintenanceCardProps) {
  const getBadgeVariant = (level: string) => {
    switch (level) {
      case "NORMAL":
      case "LOW":
      case "HEALTHY":
        return "success";
      case "MODERATE":
      case "MEDIUM":
      case "MONITOR":
        return "warning";
      case "HIGH":
      case "SERVICE_RECOMMENDED":
        return "warning";
      case "CRITICAL":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <Card variant="glass" className="overflow-hidden border border-slate-800">
      <CardHeader className="bg-slate-900/80 border-b border-slate-800 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-white font-bold">
                Predictive UAV Health & Prognostic Maintenance
              </CardTitle>
              <Badge variant="neutral" className="text-[10px] bg-slate-900 border-slate-700 text-slate-300">
                AI DIAGNOSTICS
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Proactive failure prevention using telemetry vibration, thermal telemetry, and flight cycles.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Risk Score:</span>
            <span className="text-sm font-bold text-cyan-400">{prediction.overallRiskScore}/100</span>
            <Badge variant={getBadgeVariant(prediction.overallRiskLevel)} className="text-xs">
              {prediction.overallRiskLevel}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <div className="p-4 space-y-4">
        {/* Recommended Action Box */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Recommended Maintenance Action:</span>
            <p className="text-white font-medium mt-0.5">{prediction.recommendedAction}</p>
          </div>
          <div className="sm:text-right shrink-0">
            <span className="text-slate-400 block text-[11px]">Service Countdown:</span>
            <span className="text-cyan-400 font-bold text-sm">~{prediction.estimatedHoursToNextService} hrs</span>
          </div>
        </div>

        {/* Component Health Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {prediction.components.map((comp) => (
            <div key={comp.component} className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white">{comp.component}</span>
                <Badge variant={getBadgeVariant(comp.status)} className="text-[10px]">
                  {comp.status}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Health</span>
                  <span className="font-medium text-slate-200">{comp.healthPercent}%</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      comp.healthPercent > 80 ? "bg-emerald-500" : comp.healthPercent > 50 ? "bg-amber-500" : "bg-rose-500"
                    }`}
                    style={{ width: `${comp.healthPercent}%` }}
                  />
                </div>
              </div>

              {comp.findings.length > 0 && (
                <p className="text-[10px] text-slate-400 truncate" title={comp.findings[0]}>
                  {comp.findings[0]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Recommended Inspections Checklist */}
        {prediction.recommendedInspections.length > 0 && (
          <div className="text-xs space-y-1.5">
            <span className="font-semibold text-slate-300 text-[11px]">Recommended Pre-Flight Inspections:</span>
            <ul className="list-disc list-inside text-slate-400 space-y-0.5 text-[11px]">
              {prediction.recommendedInspections.map((insp, idx) => (
                <li key={idx}>{insp}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
