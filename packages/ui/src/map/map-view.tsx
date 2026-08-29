"use client";

import React, { useState } from "react";
import { SvgRadarMap } from "./svg-radar-map.js";

export interface MapMarker {
  id: string;
  type: "drone" | "warehouse" | "destination" | "waypoint";
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  headingDegrees?: number;
  title: string;
  subtitle?: string;
  status?: string;
  batteryPercent?: number;
  isDraggable?: boolean;
}

export interface MapRoute {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number; altitudeMeters?: number }>;
  color?: string;
  dashed?: boolean;
  activeWaypointIndex?: number;
}

export interface MapGeofence {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  type: "NO_FLY" | "ALTITUDE_RESTRICTION" | "PRIORITY_CORRIDOR";
}

export interface MapProviderAdapterProps {
  markers: MapMarker[];
  routes?: MapRoute[];
  geofences?: MapGeofence[];
  selectedMarkerId?: string;
  center?: { latitude: number; longitude: number };
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
}

export type MapProviderAdapter = React.ComponentType<MapProviderAdapterProps>;

export interface MapViewProps {
  markers: MapMarker[];
  routes?: MapRoute[];
  geofences?: MapGeofence[];
  selectedMarkerId?: string;
  center?: { latitude: number; longitude: number };
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  adapter?: MapProviderAdapter;
  title?: string;
  showControls?: boolean;
  className?: string;
}

export function MapView({
  markers,
  routes = [],
  geofences = [],
  selectedMarkerId,
  center,
  zoom = 14,
  onMarkerClick,
  adapter: CustomAdapter,
  title = "Flight Radar Tactical Map",
  showControls = true,
  className = ""
}: MapViewProps) {
  const [currentZoom, setCurrentZoom] = useState(zoom);

  // If a custom vendor adapter (e.g. MapLibre / Mapbox) is passed, use it; otherwise use native SVG Radar
  const Adapter = CustomAdapter || SvgRadarMap;

  return (
    <div className={`relative w-full h-full min-h-[360px] rounded-2xl overflow-hidden border border-slate-750 bg-slate-950 flex flex-col ${className}`}>
      {/* Header Overlay */}
      {title && (
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 shadow-lg text-xs font-semibold text-slate-100">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>{title}</span>
        </div>
      )}

      {/* Map Content Viewport */}
      <div className="flex-1 w-full h-full relative">
        <Adapter
          markers={markers}
          routes={routes}
          geofences={geofences}
          selectedMarkerId={selectedMarkerId}
          center={center}
          zoom={currentZoom}
          onMarkerClick={onMarkerClick}
        />
      </div>

      {/* Floating Tactical Zoom Controls */}
      {showControls && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-750 p-1 shadow-xl">
          <button
            onClick={() => setCurrentZoom((z) => Math.min(20, z + 1))}
            className="w-7 h-7 flex items-center justify-center text-slate-200 hover:bg-slate-800 rounded font-bold text-sm transition-colors"
            title="Zoom in"
          >
            +
          </button>
          <div className="h-px bg-slate-800" />
          <button
            onClick={() => setCurrentZoom((z) => Math.max(5, z - 1))}
            className="w-7 h-7 flex items-center justify-center text-slate-200 hover:bg-slate-800 rounded font-bold text-sm transition-colors"
            title="Zoom out"
          >
            -
          </button>
        </div>
      )}
    </div>
  );
}
