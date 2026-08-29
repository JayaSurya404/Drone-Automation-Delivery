"use client";

import React, { useState } from "react";
import type { MapProviderAdapterProps, MapMarker } from "./map-view.js";

export function SvgRadarMap({
  markers,
  routes = [],
  geofences = [],
  selectedMarkerId,
  center,
  zoom = 14,
  onMarkerClick,
  className = ""
}: MapProviderAdapterProps) {
  const [hoveredMarker, setHoveredMarker] = useState<MapMarker | null>(null);

  // Compute map bounding center or fallback
  const mapCenterLat = center?.latitude ?? (markers[0]?.latitude || 37.7749);
  const mapCenterLon = center?.longitude ?? (markers[0]?.longitude || -122.4194);

  // Canvas size and Mercator-like local projection
  const width = 800;
  const height = 500;
  const scale = 25000 * Math.pow(1.2, zoom - 14);

  function project(lat: number, lon: number): { x: number; y: number } {
    const x = width / 2 + (lon - mapCenterLon) * scale * Math.cos((mapCenterLat * Math.PI) / 180);
    const y = height / 2 - (lat - mapCenterLat) * scale;
    return { x, y };
  }

  return (
    <div className={`relative w-full h-full bg-[#070b14] overflow-hidden select-none ${className}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        {/* Radar Background Grid & Concentric Rings */}
        <defs>
          <radialGradient id="radarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.08" />
            <stop offset="60%" stopColor="#00f0ff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
          </radialGradient>
          <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(0, 240, 255, 0.04)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={width} height={height} fill="url(#tacticalGrid)" />
        <rect width={width} height={height} fill="url(#radarGlow)" />

        {/* Concentric Radar Range Rings */}
        <circle cx={width / 2} cy={height / 2} r="100" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeDasharray="3 3" />
        <circle cx={width / 2} cy={height / 2} r="200" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeDasharray="3 3" />
        <circle cx={width / 2} cy={height / 2} r="300" fill="none" stroke="rgba(0, 240, 255, 0.05)" />

        {/* Crosshair Center Lines */}
        <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke="rgba(0, 240, 255, 0.06)" />
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="rgba(0, 240, 255, 0.06)" />

        {/* Geofence Polygons */}
        {geofences.map((gf) => {
          if (gf.coordinates.length < 3) return null;
          const pointsStr = gf.coordinates
            .map((c) => {
              const pt = project(c.latitude, c.longitude);
              return `${pt.x},${pt.y}`;
            })
            .join(" ");

          const isNoFly = gf.type === "NO_FLY";
          return (
            <g key={gf.id}>
              <polygon
                points={pointsStr}
                fill={isNoFly ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.12)"}
                stroke={isNoFly ? "rgba(239, 68, 68, 0.6)" : "rgba(245, 158, 11, 0.5)"}
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </g>
          );
        })}

        {/* Flight Route Polylines */}
        {routes.map((route) => {
          if (route.coordinates.length < 2) return null;
          const pathD = route.coordinates.reduce((acc, coord, idx) => {
            const pt = project(coord.latitude, coord.longitude);
            return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`;
          }, "");

          return (
            <g key={route.id}>
              <path
                d={pathD}
                fill="none"
                stroke={route.color || "#00f0ff"}
                strokeWidth="2"
                strokeDasharray={route.dashed ? "6 4" : undefined}
                opacity="0.75"
              />
              {/* Waypoint intermediate nodes */}
              {route.coordinates.map((coord, idx) => {
                const pt = project(coord.latitude, coord.longitude);
                return (
                  <circle
                    key={`${route.id}-node-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill="#0f172a"
                    stroke={route.color || "#00f0ff"}
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
          );
        })}

        {/* Markers (Warehouses, Destinations, Drones) */}
        {markers.map((marker) => {
          const pt = project(marker.latitude, marker.longitude);
          const isSelected = marker.id === selectedMarkerId;

          if (marker.type === "warehouse") {
            return (
              <g
                key={marker.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="cursor-pointer"
                onClick={() => onMarkerClick?.(marker)}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
                <circle r="14" fill="rgba(56, 168, 248, 0.15)" stroke="rgba(56, 168, 248, 0.5)" strokeWidth="1" />
                <rect x="-6" y="-6" width="12" height="12" rx="2" fill="#38a8f8" />
                <text y="18" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace">
                  {marker.title}
                </text>
              </g>
            );
          }

          if (marker.type === "destination") {
            return (
              <g
                key={marker.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="cursor-pointer"
                onClick={() => onMarkerClick?.(marker)}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
                <circle r="12" fill="rgba(168, 85, 247, 0.2)" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="3 2" />
                <circle r="4" fill="#a855f7" />
                <text y="18" textAnchor="middle" fill="#c084fc" fontSize="10" fontFamily="monospace">
                  {marker.title}
                </text>
              </g>
            );
          }

          // Drone Marker
          const heading = marker.headingDegrees || 0;
          return (
            <g
              key={marker.id}
              transform={`translate(${pt.x}, ${pt.y})`}
              className="cursor-pointer transition-transform duration-300"
              onClick={() => onMarkerClick?.(marker)}
              onMouseEnter={() => setHoveredMarker(marker)}
              onMouseLeave={() => setHoveredMarker(null)}
            >
              {/* Selection Halo */}
              {isSelected && (
                <circle r="22" fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeDasharray="4 2" className="animate-spin" />
              )}

              {/* Pulsing Beacon */}
              <circle r="10" fill="rgba(0, 240, 255, 0.2)" stroke="#00f0ff" strokeWidth="1.5" />

              {/* Rotated Orientation Arrow */}
              <g transform={`rotate(${heading})`}>
                <polygon points="0,-12 5,6 0,3 -5,6" fill="#00f0ff" />
              </g>

              {/* Drone Callsign Label */}
              <text y="20" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                {marker.title}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredMarker && (
        <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur-md border border-slate-750 p-3 rounded-xl shadow-2xl text-xs max-w-xs pointer-events-none z-30 font-mono animate-fade-in">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5 mb-1.5">
            <span className="font-bold text-cyan-300">{hoveredMarker.title}</span>
            {hoveredMarker.status && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                {hoveredMarker.status}
              </span>
            )}
          </div>
          <div className="space-y-1 text-slate-300 text-[11px]">
            {hoveredMarker.altitudeMeters !== undefined && (
              <div>Alt: <strong className="text-white">{hoveredMarker.altitudeMeters.toFixed(0)}m</strong></div>
            )}
            {hoveredMarker.batteryPercent !== undefined && (
              <div>Battery: <strong className="text-emerald-400">{hoveredMarker.batteryPercent.toFixed(0)}%</strong></div>
            )}
            <div className="text-slate-400 text-[10px]">
              GPS: {hoveredMarker.latitude.toFixed(4)}, {hoveredMarker.longitude.toFixed(4)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
