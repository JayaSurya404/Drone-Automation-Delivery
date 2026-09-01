"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, Badge, Button } from "@skynav/ui";
import type { ScoredRouteCandidate, DeterministicSafetyGateResult } from "@skynav/contracts";

export interface AiRouteScoringCardProps {
  candidates?: ScoredRouteCandidate[];
  safetyGate?: DeterministicSafetyGateResult;
  onSelectRoute?: (candidateId: string) => void;
  selectedRouteId?: string;
  isEvaluating?: boolean;
}

export function AiRouteScoringCard({
  candidates = [
    {
      id: "corridor-alpha-direct",
      name: "Direct Flight Corridor Alpha",
      rank: 1,
      score: 94.5,
      totalDistanceMeters: 2850,
      estimatedFlightTimeSeconds: 190,
      predictedEta: new Date(Date.now() + 190000).toISOString(),
      estimatedBatteryConsumptionPercent: 12.8,
      batteryFeasibility: "SAFE",
      weatherRiskLevel: "NORMAL",
      compositeRiskScore: 5.5,
      isRecommended: true,
      recommendationReason: "Shortest direct corridor with favorable tailwind and safe battery reserve margin.",
      riskFactors: ["Nominal crosswind on final descent"],
      scoreBreakdown: {
        distanceScore: 96,
        timeScore: 92,
        batteryScore: 95,
        weatherScore: 95,
        priorityBonus: 0
      },
      waypoints: [
        { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 60 },
        { latitude: 37.7845, longitude: -122.4082, altitudeMeters: 60 }
      ]
    },
    {
      id: "corridor-bravo-bypass",
      name: "Commercial Airspace Bypass Bravo",
      rank: 2,
      score: 81.0,
      totalDistanceMeters: 3620,
      estimatedFlightTimeSeconds: 245,
      predictedEta: new Date(Date.now() + 245000).toISOString(),
      estimatedBatteryConsumptionPercent: 16.5,
      batteryFeasibility: "SAFE",
      weatherRiskLevel: "NORMAL",
      compositeRiskScore: 19.0,
      isRecommended: false,
      recommendationReason: "Extended bypass route (+770m) avoiding high-density transit corridor.",
      riskFactors: ["Slightly higher battery consumption (+3.7%)"],
      scoreBreakdown: {
        distanceScore: 78,
        timeScore: 79,
        batteryScore: 84,
        weatherScore: 95,
        priorityBonus: 0
      },
      waypoints: [
        { latitude: 37.7749, longitude: -122.4194, altitudeMeters: 60 },
        { latitude: 37.7800, longitude: -122.4280, altitudeMeters: 60 },
        { latitude: 37.7845, longitude: -122.4082, altitudeMeters: 60 }
      ]
    }
  ],
  safetyGate = {
    passed: true,
    geofenceCheck: { passed: true, reason: "No prohibited no-fly zones along flight path." },
    batteryReserveCheck: { passed: true, expectedReservePercent: 82.2, minRequiredReservePercent: 20.0, reason: "Landing reserve exceeds 20% policy." },
    payloadCheck: { passed: true, packageWeightGrams: 1500, maxPayloadGrams: 5000, reason: "Package weight within certified envelope." },
    weatherCheck: { passed: true, windSpeedMps: 4.5, maxAllowedWindMps: 15.0, reason: "Wind speed within safe flight limits." },
    altitudeEnvelopeCheck: { passed: true, cruiseAltitudeMeters: 60, maxAltitudeMeters: 120, reason: "Cruise altitude within designated corridor." },
    rejectionReasons: []
  },
  onSelectRoute,
  selectedRouteId = "corridor-alpha-direct",
  isEvaluating = false
}: AiRouteScoringCardProps) {
  const [activeTab, setActiveTab] = useState<"candidates" | "safety">("candidates");

  return (
    <Card variant="glass" className="overflow-hidden border border-cyan-500/30">
      <CardHeader className="bg-slate-900/80 border-b border-slate-800 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-cyan-400 font-bold">
                AI Advisory Flight Scorer & Predictive Routing
              </CardTitle>
              <Badge variant="info" className="text-[10px] bg-cyan-950/60 border-cyan-500/40 text-cyan-300">
                ADVISORY ONLY
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Explainable multi-factor path ranking with authoritative deterministic safety gate validation.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab("candidates")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === "candidates" ? "bg-cyan-500 text-black font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Candidate Routes ({candidates.length})
            </button>
            <button
              onClick={() => setActiveTab("safety")}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                activeTab === "safety" ? "bg-cyan-500 text-black font-semibold" : "text-slate-400 hover:text-white"
              }`}
            >
              Safety Gate ({safetyGate.passed ? "PASSED" : "FAILED"})
            </button>
          </div>
        </div>
      </CardHeader>

      <div className="p-4 space-y-4">
        {/* Advisory Safety Boundary Banner */}
        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
          <span className="text-amber-400 font-bold">SAFETY RULE:</span>
          <span>
            AI path scores and ETA predictions are advisory. Flight dispatch is strictly blocked unless the authoritative Deterministic Safety Gate passes all geofence, battery reserve, and airspace envelope constraints.
          </span>
        </div>

        {activeTab === "candidates" && (
          <div className="space-y-3">
            {candidates.map((cand) => {
              const isSelected = cand.id === selectedRouteId;
              return (
                <div
                  key={cand.id}
                  onClick={() => onSelectRoute?.(cand.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-cyan-950/30 border-cyan-500 shadow-md shadow-cyan-950/50"
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-cyan-400 border border-slate-700">
                        #{cand.rank}
                      </span>
                      <h4 className="text-sm font-semibold text-white">{cand.name || cand.id}</h4>
                      {cand.isRecommended && (
                        <Badge variant="success" className="text-[10px]">
                          AI RECOMMENDED
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-xs text-slate-400">Advisory Score:</span>
                        <span className="ml-1.5 text-sm font-bold text-cyan-400">{cand.score}/100</span>
                      </div>
                      <Badge
                        variant={
                          cand.batteryFeasibility === "SAFE"
                            ? "success"
                            : cand.batteryFeasibility === "CAUTION"
                            ? "warning"
                            : "danger"
                        }
                        className="text-[10px]"
                      >
                        {cand.batteryFeasibility}
                      </Badge>
                    </div>
                  </div>

                  {/* Recommendation Rationale */}
                  <p className="text-xs text-slate-300 mt-2 bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                    <span className="text-cyan-400 font-medium">Rationale:</span> {cand.recommendationReason}
                  </p>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 text-xs text-slate-400">
                    <div className="bg-slate-950/40 p-2 rounded-md border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500">Distance</span>
                      <span className="font-semibold text-white">{(cand.totalDistanceMeters / 1000).toFixed(2)} km</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded-md border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500">Est. Flight Duration</span>
                      <span className="font-semibold text-white">
                        {Math.floor(cand.estimatedFlightTimeSeconds / 60)}m {Math.round(cand.estimatedFlightTimeSeconds % 60)}s
                      </span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded-md border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500">Est. Battery Draw</span>
                      <span className="font-semibold text-white">{cand.estimatedBatteryConsumptionPercent}%</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded-md border border-slate-800/50">
                      <span className="block text-[10px] text-slate-500">Weather Risk</span>
                      <span className="font-semibold text-emerald-400">{cand.weatherRiskLevel}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "safety" && (
          <div className="space-y-3">
            <div
              className={`p-3 rounded-xl border flex items-center justify-between ${
                safetyGate.passed
                  ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/20 border-rose-500/40 text-rose-300"
              }`}
            >
              <div>
                <h4 className="text-sm font-bold">
                  {safetyGate.passed ? "All Deterministic Safety Checks Passed" : "Safety Gate Rejections Active"}
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  {safetyGate.passed
                    ? "Flight plan is cleared for autonomous execution."
                    : "Mission cannot be dispatched until safety violations are resolved."}
                </p>
              </div>
              <Badge variant={safetyGate.passed ? "success" : "danger"}>
                {safetyGate.passed ? "AUTHORIZATION CLEARED" : "DISPATCH BLOCKED"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Geofence Airspace</span>
                  <Badge variant={safetyGate.geofenceCheck.passed ? "success" : "danger"} className="text-[10px]">
                    {safetyGate.geofenceCheck.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">{safetyGate.geofenceCheck.reason}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Battery Reserve</span>
                  <Badge variant={safetyGate.batteryReserveCheck.passed ? "success" : "danger"} className="text-[10px]">
                    {safetyGate.batteryReserveCheck.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">{safetyGate.batteryReserveCheck.reason}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Payload Weight Limit</span>
                  <Badge variant={safetyGate.payloadCheck.passed ? "success" : "danger"} className="text-[10px]">
                    {safetyGate.payloadCheck.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">{safetyGate.payloadCheck.reason}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Corridor Altitude Envelope</span>
                  <Badge variant={safetyGate.altitudeEnvelopeCheck.passed ? "success" : "danger"} className="text-[10px]">
                    {safetyGate.altitudeEnvelopeCheck.passed ? "PASS" : "FAIL"}
                  </Badge>
                </div>
                <p className="text-slate-400 text-[11px] mt-1">{safetyGate.altitudeEnvelopeCheck.reason}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
