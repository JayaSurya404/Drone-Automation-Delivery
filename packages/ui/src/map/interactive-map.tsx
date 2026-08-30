"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { MapMarker, MapRoute, MapGeofence, MapViewport, MapViewProps } from "./types.js";
import {
  isValidCoordinate,
  sanitizeCoordinate,
  computeBoundingBox,
  haversineDistanceMeters,
  calculateTelemetryFreshness,
  formatDistance
} from "@skynav/contracts";

export interface InteractiveMapProps extends MapViewProps {
  initialCenter?: { latitude: number; longitude: number };
  initialZoom?: number;
}

export function InteractiveMap({
  markers = [],
  routes = [],
  geofences = [],
  selectedMarkerId,
  selectedRouteId,
  center,
  zoom = 14,
  minZoom = 8,
  maxZoom = 19,
  onMarkerClick,
  onRouteClick,
  onViewportChange,
  title = "Tactical Aerospace Radar & Geospatial Map",
  showControls = true,
  showLayerToggles = true,
  showLegend = true,
  showCoordinatesHud = true,
  mapProvider = "osm",
  tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  maxTrailPoints = 25,
  className = ""
}: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute initial fallback center
  const defaultCenter = useMemo(() => {
    if (center && isValidCoordinate(center)) {
      return center;
    }
    const firstValid = markers.find(isValidCoordinate);
    if (firstValid) {
      return { latitude: firstValid.latitude, longitude: firstValid.longitude };
    }
    return { latitude: 37.7749, longitude: -122.4194 };
  }, [center, markers]);

  const [currentCenter, setCurrentCenter] = useState<{ latitude: number; longitude: number }>(defaultCenter);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredMarker, setHoveredMarker] = useState<MapMarker | null>(null);
  const [mouseCoord, setMouseCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 800, height: 500 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Layer Visibility Toggles
  const [layerTrails, setLayerTrails] = useState(true);
  const [layerGeofences, setLayerGeofences] = useState(true);
  const [layerWaypoints, setLayerWaypoints] = useState(true);
  const [layerBaseTiles, setLayerBaseTiles] = useState(mapProvider === "osm");

  // Sync center & zoom when props change
  useEffect(() => {
    if (center && isValidCoordinate(center)) {
      setCurrentCenter(center);
    }
  }, [center?.latitude, center?.longitude]);

  useEffect(() => {
    if (zoom !== undefined) {
      setCurrentZoom(Math.max(minZoom, Math.min(maxZoom, zoom)));
    }
  }, [zoom, minZoom, maxZoom]);

  // Measure container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        if (clientWidth > 0 && clientHeight > 0) {
          setDimensions({ width: clientWidth, height: clientHeight });
        }
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Web Mercator projection calculations
  const scale = useMemo(() => {
    return 256 * Math.pow(2, currentZoom);
  }, [currentZoom]);

  const project = useCallback(
    (lat: number, lon: number): { x: number; y: number } => {
      const sanitized = sanitizeCoordinate({ latitude: lat, longitude: lon });
      const latRad = (sanitized.latitude * Math.PI) / 180;
      const centerLatRad = (currentCenter.latitude * Math.PI) / 180;

      // Spherical Web Mercator formula
      const worldX = ((sanitized.longitude + 180) / 360) * scale;
      const worldY =
        ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * scale;

      const centerWorldX = ((currentCenter.longitude + 180) / 360) * scale;
      const centerWorldY =
        ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * scale;

      const x = dimensions.width / 2 + (worldX - centerWorldX);
      const y = dimensions.height / 2 + (worldY - centerWorldY);

      return { x, y };
    },
    [currentCenter, scale, dimensions]
  );

  const unproject = useCallback(
    (x: number, y: number): { latitude: number; longitude: number } => {
      const centerLatRad = (currentCenter.latitude * Math.PI) / 180;
      const centerWorldX = ((currentCenter.longitude + 180) / 360) * scale;
      const centerWorldY =
        ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * scale;

      const worldX = centerWorldX + (x - dimensions.width / 2);
      const worldY = centerWorldY + (y - dimensions.height / 2);

      const lon = (worldX / scale) * 360 - 180;
      const n = Math.PI - (2 * Math.PI * worldY) / scale;
      const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));

      return {
        latitude: Math.max(-85, Math.min(85, lat)),
        longitude: Math.max(-180, Math.min(180, lon))
      };
    },
    [currentCenter, scale, dimensions]
  );

  // Pan interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only primary button
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Track cursor coordinates
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const relY = e.clientY - rect.top;
      const coords = unproject(relX, relY);
      setMouseCoord(coords);
    }

    if (!isDragging) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    const newCenter = unproject(dimensions.width / 2 - dx, dimensions.height / 2 - dy);
    setCurrentCenter(newCenter);
    setDragStart({ x: e.clientX, y: e.clientY });
    onViewportChange?.({ center: newCenter, zoom: currentZoom });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Scroll wheel zoom handler
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.25 : -0.25;
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom + zoomDelta));
    if (nextZoom !== currentZoom) {
      setCurrentZoom(nextZoom);
      onViewportChange?.({ center: currentCenter, zoom: nextZoom });
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const panStep = 40;
    if (e.key === "+" || e.key === "=") {
      setCurrentZoom((z) => Math.min(maxZoom, z + 1));
    } else if (e.key === "-" || e.key === "_") {
      setCurrentZoom((z) => Math.max(minZoom, z - 1));
    } else if (e.key === "ArrowUp") {
      setCurrentCenter(unproject(dimensions.width / 2, dimensions.height / 2 + panStep));
    } else if (e.key === "ArrowDown") {
      setCurrentCenter(unproject(dimensions.width / 2, dimensions.height / 2 - panStep));
    } else if (e.key === "ArrowLeft") {
      setCurrentCenter(unproject(dimensions.width / 2 + panStep, dimensions.height / 2));
    } else if (e.key === "ArrowRight") {
      setCurrentCenter(unproject(dimensions.width / 2 - panStep, dimensions.height / 2));
    }
  };

  // Fit to fleet / fit to all active markers
  const handleFitFleet = () => {
    const validCoords = markers.filter(isValidCoordinate);
    if (validCoords.length === 0) return;

    const bbox = computeBoundingBox(validCoords);
    if (!bbox) return;

    setCurrentCenter(bbox.center);
    // Estimate best zoom level to contain span
    const maxSpan = Math.max(bbox.span.latSpan, bbox.span.lonSpan);
    let targetZoom = 14;
    if (maxSpan > 2.0) targetZoom = 8;
    else if (maxSpan > 0.5) targetZoom = 10;
    else if (maxSpan > 0.1) targetZoom = 12;
    else if (maxSpan > 0.03) targetZoom = 14;
    else targetZoom = 16;

    setCurrentZoom(Math.max(minZoom, Math.min(maxZoom, targetZoom)));
  };

  // Fit to selected drone or route
  const handleFitSelected = () => {
    if (selectedMarkerId) {
      const selected = markers.find((m) => m.id === selectedMarkerId);
      if (selected && isValidCoordinate(selected)) {
        setCurrentCenter({ latitude: selected.latitude, longitude: selected.longitude });
        setCurrentZoom(15);
        return;
      }
    }

    if (routes.length > 0) {
      const selectedR = routes.find((r) => r.id === selectedRouteId) || routes[0];
      const bbox = computeBoundingBox(selectedR.coordinates);
      if (bbox) {
        setCurrentCenter(bbox.center);
        setCurrentZoom(14);
      }
    }
  };

  // Compute visible OSM tile grid for current viewport
  const visibleTiles = useMemo(() => {
    if (!layerBaseTiles) return [];

    const intZoom = Math.floor(currentZoom);
    if (intZoom < 0 || intZoom > 19) return [];

    const topLeft = unproject(0, 0);
    const bottomRight = unproject(dimensions.width, dimensions.height);

    const lon2tile = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * Math.pow(2, z));
    const lat2tile = (lat: number, z: number) =>
      Math.floor(
        ((1 -
          Math.log(
            Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
          ) /
            Math.PI) /
          2) *
          Math.pow(2, z)
      );

    const minX = Math.max(0, lon2tile(topLeft.longitude, intZoom));
    const maxX = Math.min(Math.pow(2, intZoom) - 1, lon2tile(bottomRight.longitude, intZoom));
    const minY = Math.max(0, lat2tile(topLeft.latitude, intZoom));
    const maxY = Math.min(Math.pow(2, intZoom) - 1, lat2tile(bottomRight.latitude, intZoom));

    const tiles: Array<{ x: number; y: number; z: number; url: string }> = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const url = tileUrl
          .replace("{z}", intZoom.toString())
          .replace("{x}", x.toString())
          .replace("{y}", y.toString());
        tiles.push({ x, y, z: intZoom, url });
      }
    }
    return tiles;
  }, [layerBaseTiles, currentZoom, dimensions, unproject, tileUrl]);

  // Color helper for drone status
  const getDroneStatusColor = (status?: string) => {
    switch (status) {
      case "EMERGENCY":
        return "#ef4444"; // Crimson
      case "RETURNING":
        return "#a855f7"; // Purple
      case "TAKEOFF":
      case "EN_ROUTE":
      case "IN_FLIGHT":
        return "#00f0ff"; // Cyan
      case "ARRIVED":
      case "DELIVERING":
        return "#f59e0b"; // Amber
      case "ASSIGNED":
        return "#6366f1"; // Indigo
      case "AVAILABLE":
        return "#10b981"; // Emerald
      case "OFFLINE":
        return "#64748b"; // Muted Slate
      case "IDLE":
      case "LANDED":
      default:
        return "#94a3b8"; // Slate
    }
  };

  const getFreshnessDotColor = (freshness?: string) => {
    switch (freshness) {
      case "LIVE":
        return "#10b981";
      case "DEGRADED":
        return "#f59e0b";
      case "STALE":
        return "#f97316";
      case "OFFLINE":
      default:
        return "#64748b";
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      className={`relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden border border-slate-750 bg-[#060912] select-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      } ${isFullscreen ? "fixed inset-0 z-50 rounded-none border-none" : ""} ${className}`}
    >
      {/* 1. Base OpenStreetMap Cartographic Tile Layer */}
      {layerBaseTiles && (
        <div className="absolute inset-0 pointer-events-none opacity-25 filter grayscale invert contrast-125">
          {visibleTiles.map((tile) => {
            const tileCoord = {
              lon: (tile.x / Math.pow(2, tile.z)) * 360 - 180,
              lat:
                (180 / Math.PI) *
                Math.atan(
                  Math.sinh(Math.PI * (1 - (2 * tile.y) / Math.pow(2, tile.z)))
                )
            };
            const pos = project(tileCoord.lat, tileCoord.lon);
            const tileSize = 256 * Math.pow(2, currentZoom - tile.z);

            return (
              <img
                key={`${tile.z}-${tile.x}-${tile.y}`}
                src={tile.url}
                alt=""
                style={{
                  position: "absolute",
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                  width: `${tileSize}px`,
                  height: `${tileSize}px`
                }}
                loading="lazy"
              />
            );
          })}
        </div>
      )}

      {/* 2. Precision Tactical Aerospace SVG Overlay */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="absolute inset-0 w-full h-full pointer-events-none"
      >
        <defs>
          <radialGradient id="tacticalRadarGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.06" />
            <stop offset="60%" stopColor="#00f0ff" stopOpacity="0.01" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.85" />
          </radialGradient>
          <pattern id="tacticalGridPattern" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(0, 240, 255, 0.04)" strokeWidth="1" />
          </pattern>
          <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Tactical Grid & Radar Range Rings */}
        <rect width={dimensions.width} height={dimensions.height} fill="url(#tacticalGridPattern)" />
        <rect width={dimensions.width} height={dimensions.height} fill="url(#tacticalRadarGlow)" />

        {/* Concentric Range Rings centered on view center */}
        <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r="120" fill="none" stroke="rgba(0, 240, 255, 0.08)" strokeDasharray="4 4" />
        <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r="240" fill="none" stroke="rgba(0, 240, 255, 0.06)" strokeDasharray="4 4" />
        <circle cx={dimensions.width / 2} cy={dimensions.height / 2} r="360" fill="none" stroke="rgba(0, 240, 255, 0.04)" />

        {/* Center Crosshair */}
        <line x1={dimensions.width / 2} y1={dimensions.height / 2 - 20} x2={dimensions.width / 2} y2={dimensions.height / 2 + 20} stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" />
        <line x1={dimensions.width / 2 - 20} y1={dimensions.height / 2} x2={dimensions.width / 2 + 20} y2={dimensions.height / 2} stroke="rgba(0, 240, 255, 0.2)" strokeWidth="1" />

        {/* 3. Geofences */}
        {layerGeofences &&
          geofences.map((gf) => {
            if (gf.coordinates.length < 3) return null;
            const pointsStr = gf.coordinates
              .map((c) => {
                const pt = project(c.latitude, c.longitude);
                return `${pt.x},${pt.y}`;
              })
              .join(" ");

            const isNoFly = gf.type === "NO_FLY";
            const isPriority = gf.type === "PRIORITY_CORRIDOR";

            return (
              <g key={gf.id}>
                <polygon
                  points={pointsStr}
                  fill={isNoFly ? "rgba(239, 68, 68, 0.15)" : isPriority ? "rgba(0, 240, 255, 0.12)" : "rgba(245, 158, 11, 0.12)"}
                  stroke={isNoFly ? "#ef4444" : isPriority ? "#00f0ff" : "#f59e0b"}
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                  opacity="0.8"
                />
              </g>
            );
          })}

        {/* 4. Flight Corridors & Mission Routes */}
        {routes.map((route) => {
          if (route.coordinates.length < 2) return null;
          const isSelectedRoute = route.id === selectedRouteId;
          const pathD = route.coordinates.reduce((acc, coord, idx) => {
            const pt = project(coord.latitude, coord.longitude);
            return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`;
          }, "");

          const routeColor = route.color || (isSelectedRoute ? "#00f0ff" : "#38bdf8");

          return (
            <g key={route.id} className="pointer-events-auto cursor-pointer" onClick={() => onRouteClick?.(route)}>
              {/* Outer Corridor Glow */}
              <path
                d={pathD}
                fill="none"
                stroke={routeColor}
                strokeWidth={isSelectedRoute ? "6" : "4"}
                strokeOpacity="0.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Core Flight Path */}
              <path
                d={pathD}
                fill="none"
                stroke={routeColor}
                strokeWidth={isSelectedRoute ? "2.5" : "1.5"}
                strokeDasharray={route.dashed ? "6 4" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
              />

              {/* Waypoint Fix Nodes */}
              {route.coordinates.map((coord, idx) => {
                const pt = project(coord.latitude, coord.longitude);
                const isFixActive = route.activeWaypointIndex === idx;

                return (
                  <g key={`${route.id}-fix-${idx}`}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isFixActive ? "5" : "3.5"}
                      fill={isFixActive ? "#00f0ff" : "#0a1120"}
                      stroke={routeColor}
                      strokeWidth="1.5"
                    />
                    {layerWaypoints && (
                      <text
                        x={pt.x + 8}
                        y={pt.y + 3}
                        fill="#94a3b8"
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="semibold"
                      >
                        WP-{idx} {coord.altitudeMeters ? `(${coord.altitudeMeters}m)` : ""}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* 5. Drone Movement Trails */}
        {layerTrails &&
          markers.map((marker) => {
            if (marker.type !== "drone" || !marker.trail || marker.trail.length < 2) {
              return null;
            }
            const trailPts = marker.trail.slice(-maxTrailPoints);
            const pathD = trailPts.reduce((acc, coord, idx) => {
              const pt = project(coord.latitude, coord.longitude);
              return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`;
            }, "");

            const statusColor = getDroneStatusColor(marker.status);

            return (
              <g key={`trail-${marker.id}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={statusColor}
                  strokeWidth="2"
                  strokeDasharray="2 3"
                  opacity="0.45"
                  strokeLinecap="round"
                />
                {trailPts.map((p, pIdx) => {
                  const pt = project(p.latitude, p.longitude);
                  const isLatest = pIdx === trailPts.length - 1;
                  return (
                    <circle
                      key={`trail-node-${marker.id}-${pIdx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={isLatest ? "2.5" : "1.5"}
                      fill={statusColor}
                      opacity={0.3 + (pIdx / trailPts.length) * 0.7}
                    />
                  );
                })}
              </g>
            );
          })}

        {/* 6. Markers Layer (Warehouse, Destination, Drones) */}
        {markers.map((marker) => {
          if (!isValidCoordinate(marker)) return null;
          const pt = project(marker.latitude, marker.longitude);
          const isSelected = marker.id === selectedMarkerId;

          // Warehouse Marker
          if (marker.type === "warehouse") {
            return (
              <g
                key={marker.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onMarkerClick?.(marker)}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
                <circle r="16" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" strokeWidth="1" strokeDasharray="3 2" />
                <rect x="-7" y="-7" width="14" height="14" rx="2.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                <path d="M -4 2 L 0 -4 L 4 2 Z" fill="#ffffff" />
                <text y="20" textAnchor="middle" fill="#bae6fd" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  {marker.title}
                </text>
              </g>
            );
          }

          // Destination Landing Pad Marker
          if (marker.type === "destination") {
            return (
              <g
                key={marker.id}
                transform={`translate(${pt.x}, ${pt.y})`}
                className="pointer-events-auto cursor-pointer"
                onClick={() => onMarkerClick?.(marker)}
                onMouseEnter={() => setHoveredMarker(marker)}
                onMouseLeave={() => setHoveredMarker(null)}
              >
                <circle r="18" fill="rgba(168, 85, 247, 0.15)" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="4 2" />
                <circle r="10" fill="none" stroke="#c084fc" strokeWidth="1" />
                <circle r="4" fill="#a855f7" />
                <text y="22" textAnchor="middle" fill="#e9d5ff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                  {marker.title}
                </text>
              </g>
            );
          }

          // Drone Marker
          const heading = marker.headingDegrees || 0;
          const statusColor = getDroneStatusColor(marker.status);
          const freshnessColor = getFreshnessDotColor(marker.freshness);

          return (
            <g
              key={marker.id}
              transform={`translate(${pt.x}, ${pt.y})`}
              className="pointer-events-auto cursor-pointer transition-all duration-300"
              onClick={() => onMarkerClick?.(marker)}
              onMouseEnter={() => setHoveredMarker(marker)}
              onMouseLeave={() => setHoveredMarker(null)}
            >
              {/* Selected Target Brackets */}
              {isSelected && (
                <g className="animate-pulse">
                  <circle r="26" fill="none" stroke="#00f0ff" strokeWidth="1.5" strokeDasharray="6 3" />
                  <path d="M -30 -10 L -30 -30 L -10 -30" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <path d="M 30 -10 L 30 -30 L 10 -30" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <path d="M -30 10 L -30 30 L -10 30" fill="none" stroke="#00f0ff" strokeWidth="2" />
                  <path d="M 30 10 L 30 30 L 10 30" fill="none" stroke="#00f0ff" strokeWidth="2" />
                </g>
              )}

              {/* Status Outer Ring / Pulse */}
              <circle
                r="14"
                fill={`${statusColor}22`}
                stroke={statusColor}
                strokeWidth="1.5"
                className={marker.status === "EMERGENCY" ? "animate-ping" : ""}
              />

              {/* Rotated Orientation Aircraft Glyph */}
              <g transform={`rotate(${heading})`}>
                <polygon points="0,-14 6,8 0,4 -6,8" fill={statusColor} stroke="#040711" strokeWidth="1" />
                <line x1="-10" y1="2" x2="10" y2="2" stroke={statusColor} strokeWidth="1.5" strokeLinecap="round" />
              </g>

              {/* Telemetry Freshness Dot */}
              <circle cx="9" cy="-9" r="3.5" fill={freshnessColor} stroke="#040711" strokeWidth="1" />

              {/* Callsign and Altitude Label */}
              <text y="21" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="bold" fontFamily="monospace">
                {marker.title}
              </text>
              {marker.altitudeMeters !== undefined && (
                <text y="30" textAnchor="middle" fill="#38bdf8" fontSize="8" fontFamily="monospace">
                  {marker.altitudeMeters.toFixed(0)}m
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Top Header Overlay Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        {title && (
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-750 shadow-xl text-xs font-semibold text-slate-100 pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-mono tracking-tight">{title}</span>
          </div>
        )}

        {/* Layer Visibility Toggles */}
        {showLayerToggles && (
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-750 shadow-xl pointer-events-auto text-[11px] font-mono">
            <button
              onClick={() => setLayerBaseTiles((v) => !v)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                layerBaseTiles ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle Cartographic Base Tiles"
            >
              Tiles
            </button>
            <button
              onClick={() => setLayerTrails((v) => !v)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                layerTrails ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle Breadcrumb Trails"
            >
              Trails
            </button>
            <button
              onClick={() => setLayerGeofences((v) => !v)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                layerGeofences ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle Geofence Airspace Zones"
            >
              Airspace
            </button>
            <button
              onClick={() => setLayerWaypoints((v) => !v)}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                layerWaypoints ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle Waypoint Fix Labels"
            >
              Waypoints
            </button>
          </div>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      {showControls && (
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 bg-slate-900/90 backdrop-blur-md rounded-xl border border-slate-750 p-1 shadow-2xl">
          <button
            onClick={() => setCurrentZoom((z) => Math.min(maxZoom, z + 1))}
            className="w-8 h-8 flex items-center justify-center text-slate-200 hover:bg-slate-800 rounded-lg font-bold text-base transition-colors"
            title="Zoom In (+)"
          >
            +
          </button>
          <button
            onClick={() => setCurrentZoom((z) => Math.max(minZoom, z - 1))}
            className="w-8 h-8 flex items-center justify-center text-slate-200 hover:bg-slate-800 rounded-lg font-bold text-base transition-colors"
            title="Zoom Out (-)"
          >
            −
          </button>
          <div className="h-px bg-slate-800 my-0.5" />
          <button
            onClick={handleFitFleet}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-800 rounded-lg text-xs font-mono font-bold transition-colors"
            title="Fit Fleet Extent"
          >
            [ ]
          </button>
          <button
            onClick={handleFitSelected}
            className="w-8 h-8 flex items-center justify-center text-cyan-400 hover:bg-slate-800 rounded-lg text-xs font-mono font-bold transition-colors"
            title="Center Focus on Selected UAV / Route"
          >
            ⦿
          </button>
          <button
            onClick={() => setIsFullscreen((f) => !f)}
            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:bg-slate-800 rounded-lg text-xs font-mono transition-colors"
            title="Toggle Fullscreen Viewport"
          >
            {isFullscreen ? "✕" : "⛶"}
          </button>
        </div>
      )}

      {/* Bottom Coordinates & Scale HUD */}
      {showCoordinatesHud && (
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-3 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-750 shadow-xl text-[10px] font-mono text-slate-400">
          <div>
            Center:{" "}
            <span className="text-cyan-300 font-bold">
              {currentCenter.latitude.toFixed(4)}, {currentCenter.longitude.toFixed(4)}
            </span>
          </div>
          {mouseCoord && (
            <div className="hidden md:block border-l border-slate-800 pl-3">
              Cursor:{" "}
              <span className="text-slate-300">
                {mouseCoord.latitude.toFixed(4)}, {mouseCoord.longitude.toFixed(4)}
              </span>
            </div>
          )}
          <div className="border-l border-slate-800 pl-3">
            Zoom: <span className="text-white font-bold">{currentZoom.toFixed(1)}x</span>
          </div>
        </div>
      )}

      {/* Interactive Hover Tooltip */}
      {hoveredMarker && (
        <div className="absolute top-14 right-4 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 p-3.5 rounded-xl shadow-2xl text-xs max-w-xs pointer-events-none z-30 font-mono animate-fade-in">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
            <span className="font-bold text-cyan-300 text-sm">{hoveredMarker.title}</span>
            {hoveredMarker.status && (
              <span
                className="text-[10px] px-2 py-0.5 rounded font-bold"
                style={{
                  backgroundColor: `${getDroneStatusColor(hoveredMarker.status)}22`,
                  color: getDroneStatusColor(hoveredMarker.status)
                }}
              >
                {hoveredMarker.status}
              </span>
            )}
          </div>
          <div className="space-y-1.5 text-slate-300 text-[11px]">
            {hoveredMarker.altitudeMeters !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Altitude MSL:</span>
                <strong className="text-white">{hoveredMarker.altitudeMeters.toFixed(0)} m</strong>
              </div>
            )}
            {hoveredMarker.speedMetersPerSecond !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Ground Speed:</span>
                <strong className="text-white">{hoveredMarker.speedMetersPerSecond.toFixed(1)} m/s</strong>
              </div>
            )}
            {hoveredMarker.headingDegrees !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Heading:</span>
                <strong className="text-white">{hoveredMarker.headingDegrees}°</strong>
              </div>
            )}
            {hoveredMarker.batteryPercent !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Battery:</span>
                <strong className="text-emerald-400">{hoveredMarker.batteryPercent.toFixed(0)}%</strong>
              </div>
            )}
            {hoveredMarker.freshness && (
              <div className="flex justify-between">
                <span className="text-slate-400">Signal Freshness:</span>
                <span className="font-bold" style={{ color: getFreshnessDotColor(hoveredMarker.freshness) }}>
                  ● {hoveredMarker.freshness}
                </span>
              </div>
            )}
            <div className="text-slate-400 text-[10px] pt-1 border-t border-slate-800">
              GPS: {hoveredMarker.latitude.toFixed(5)}, {hoveredMarker.longitude.toFixed(5)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
