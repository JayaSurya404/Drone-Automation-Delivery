"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, Badge, Button } from "@skynav/ui";
import type { VisionFrameAnalysisResponse, CameraSource } from "@skynav/contracts";

export interface VisionPerceptionCockpitProps {
  perception?: VisionFrameAnalysisResponse;
  onRefreshPerception?: () => void;
  isLoading?: boolean;
}

export function VisionPerceptionCockpit({
  perception = {
    frameId: "frame-live-001",
    droneId: "SKY-001",
    timestamp: new Date().toISOString(),
    processedAt: new Date().toISOString(),
    modelVersion: "vision-dev-baseline-v1.0.0",
    inferenceLatencyMs: 14.8,
    cameraSource: "DOWNWARD_NAV_CAM",
    sceneClassification: {
      sceneType: "SUBURBAN",
      confidence: 0.94,
      secondaryScenes: ["OPEN_FIELD"],
      description: "Suburban residential driveway with paved landing apron and clear line-of-sight."
    },
    detections: [
      {
        id: "det-pad-01",
        label: "SkyNav Landing Target Pad",
        category: "LANDING_PAD",
        confidence: 0.97,
        boundingBox: { xMin: 0.40, yMin: 0.40, xMax: 0.60, yMax: 0.60 },
        severity: "LOW",
        approximateDistanceMeters: 8.5,
        details: "Concentric optical fiducial aligned with target delivery coordinates."
      },
      {
        id: "det-veh-01",
        label: "Parked Sedan",
        category: "VEHICLE",
        confidence: 0.91,
        boundingBox: { xMin: 0.10, yMin: 0.15, xMax: 0.35, yMax: 0.45 },
        severity: "MEDIUM",
        approximateDistanceMeters: 12.0,
        details: "Vehicle parked at edge of perimeter boundary."
      }
    ],
    landingZoneAssessment: {
      suitability: "SAFE",
      confidence: 0.93,
      usableAreaSquareMeters: 18.0,
      surfaceType: "CONCRETE",
      obstructionsDetected: [],
      peopleDetectedCount: 0,
      vehiclesDetectedCount: 1,
      slopeDegrees: 0.8,
      reasons: ["Clear concrete landing pad detected with zero dynamic hazards in drop radius."],
      recommendations: ["Cleared for standard autonomous delivery descent."]
    },
    destinationVerification: {
      status: "VERIFIED",
      isTargetVisible: true,
      targetPadDetected: true,
      confidence: 0.96,
      offsetMeters: { dxMeters: 0.08, dyMeters: -0.12 },
      reasons: ["Visual landing marker verified and centered within 0.15m tolerance."]
    },
    advisorySafetyStatus: "CLEAR",
    advisoryDisclaimer: "Perception data is advisory. Deterministic safety rules remain authoritative."
  },
  onRefreshPerception,
  isLoading = false
}: VisionPerceptionCockpitProps) {
  const [activeCam, setActiveCam] = useState<CameraSource>(perception.cameraSource);

  const getSuitabilityVariant = (suitability: string) => {
    switch (suitability) {
      case "SAFE":
        return "success";
      case "CAUTION":
        return "warning";
      case "UNSAFE":
        return "danger";
      default:
        return "neutral";
    }
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "LOW":
        return "success";
      case "MEDIUM":
        return "warning";
      case "HIGH":
      case "CRITICAL":
        return "danger";
      default:
        return "neutral";
    }
  };

  return (
    <Card variant="glass" className="overflow-hidden border border-cyan-500/30">
      <CardHeader className="bg-slate-900/80 border-b border-slate-800 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base text-cyan-400 font-bold">
                Computer Vision & Perception Cockpit
              </CardTitle>
              <Badge variant="info" className="text-[10px] bg-cyan-950/60 border-cyan-500/40 text-cyan-300">
                PERCEPTION ADVISORY
              </Badge>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Optical hazard detection, landing-zone safety verification, and scene classification.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getSuitabilityVariant(perception.landingZoneAssessment.suitability)} className="text-xs">
              ZONE: {perception.landingZoneAssessment.suitability}
            </Badge>
            <Badge variant="neutral" className="text-[10px] text-slate-400">
              {perception.inferenceLatencyMs}ms latency
            </Badge>
          </div>
        </div>
      </CardHeader>

      <div className="p-4 space-y-4">
        {/* Safety Boundary Banner */}
        <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/40 flex items-start gap-2.5 text-xs text-amber-200">
          <span className="text-amber-400 font-bold">SAFETY INVARIANT:</span>
          <span>
            Visual perception is advisory only. Autonomous descent and landing require authorization by the authoritative Deterministic Safety Gate and mission dispatch policy.
          </span>
        </div>

        {/* Camera Feed HUD & Alignment Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Simulated HUD Optical Viewport */}
          <div className="lg:col-span-2 relative aspect-video bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex flex-col justify-between p-3">
            {/* Top HUD Row */}
            <div className="flex items-center justify-between z-10 text-[11px] text-cyan-400 font-mono">
              <div className="flex items-center gap-2 bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/30">
                <span>CAM: {activeCam}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="bg-slate-900/80 px-2 py-0.5 rounded border border-cyan-500/30">
                SCENE: {perception.sceneClassification.sceneType} ({(perception.sceneClassification.confidence * 100).toFixed(0)}%)
              </div>
            </div>

            {/* Center Crosshair & Target Overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-36 h-36 border border-cyan-500/40 rounded-full flex items-center justify-center">
                <div className="w-20 h-20 border border-cyan-400/80 rounded-lg flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                </div>
                {/* Crosshairs */}
                <div className="absolute top-0 bottom-0 w-[1px] bg-cyan-500/30" />
                <div className="absolute left-0 right-0 h-[1px] bg-cyan-500/30" />
              </div>
            </div>

            {/* Bottom HUD Row */}
            <div className="flex items-center justify-between z-10 text-[11px] text-slate-300 font-mono">
              <div className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                TARGET OFFSET: dx: {perception.destinationVerification.offsetMeters?.dxMeters || 0}m, dy: {perception.destinationVerification.offsetMeters?.dyMeters || 0}m
              </div>
              <div className="bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
                SURFACE: {perception.landingZoneAssessment.surfaceType}
              </div>
            </div>
          </div>

          {/* Landing Zone Safety Breakdown Card */}
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Landing Zone Assessment</span>
                <Badge variant={getSuitabilityVariant(perception.landingZoneAssessment.suitability)} className="text-[10px]">
                  {perception.landingZoneAssessment.suitability}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span className="block text-[10px] text-slate-500">Usable Area</span>
                  <span className="font-semibold text-white">{perception.landingZoneAssessment.usableAreaSquareMeters} m²</span>
                </div>
                <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                  <span className="block text-[10px] text-slate-500">Ground Slope</span>
                  <span className="font-semibold text-white">{perception.landingZoneAssessment.slopeDegrees}°</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-300">
                <span className="text-cyan-400 font-medium">Evaluation:</span> {perception.landingZoneAssessment.reasons[0]}
              </div>
            </div>

            {/* Destination Verification */}
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Target Fiducial Lock</span>
                <Badge
                  variant={perception.destinationVerification.status === "VERIFIED" ? "success" : "warning"}
                  className="text-[10px]"
                >
                  {perception.destinationVerification.status}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-300">
                {perception.destinationVerification.reasons[0]}
              </p>
            </div>
          </div>
        </div>

        {/* Detected Objects & Environmental Hazards List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Detected Visual Features & Hazards ({perception.detections.length})
            </h4>
            <span className="text-[11px] text-slate-400">
              Confidence threshold: &ge; 50%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {perception.detections.map((det) => (
              <div
                key={det.id}
                className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 flex items-start justify-between gap-2 text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">{det.label}</span>
                    <Badge variant={getSeverityVariant(det.severity)} className="text-[9px] py-0 px-1.5">
                      {det.severity}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{det.details || det.category}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="block text-[10px] text-slate-500">Confidence</span>
                  <span className="font-bold text-cyan-400">{(det.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
