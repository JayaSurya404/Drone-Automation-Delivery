"use client";

import React from "react";
import { InteractiveMap } from "./interactive-map.js";
import type { MapMarker, MapRoute, MapGeofence, MapViewProps, MapViewport } from "./types.js";

export * from "./types.js";
export * from "./interactive-map.js";
export * from "./svg-radar-map.js";

export function MapView(props: MapViewProps) {
  return <InteractiveMap {...props} />;
}
