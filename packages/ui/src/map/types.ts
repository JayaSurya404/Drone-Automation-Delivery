import type { TelemetryFreshness, GeoPoint, DroneStatus } from "@skynav/contracts";

export interface MapMarker {
  id: string;
  type: "drone" | "warehouse" | "destination" | "waypoint";
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
  headingDegrees?: number;
  speedMetersPerSecond?: number;
  title: string;
  subtitle?: string;
  status?: string;
  batteryPercent?: number;
  freshness?: TelemetryFreshness;
  isDraggable?: boolean;
  trail?: Array<{ latitude: number; longitude: number; altitudeMeters?: number }>;
}

export interface MapRoute {
  id: string;
  coordinates: Array<{ latitude: number; longitude: number; altitudeMeters?: number }>;
  color?: string;
  dashed?: boolean;
  activeWaypointIndex?: number;
  name?: string;
}

export interface MapGeofence {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
  type: "NO_FLY" | "ALTITUDE_RESTRICTION" | "PRIORITY_CORRIDOR";
  maxAltitudeMeters?: number;
  minAltitudeMeters?: number;
}

export interface MapViewport {
  center: { latitude: number; longitude: number };
  zoom: number;
}

export interface MapViewProps {
  markers: MapMarker[];
  routes?: MapRoute[];
  geofences?: MapGeofence[];
  selectedMarkerId?: string;
  selectedRouteId?: string;
  center?: { latitude: number; longitude: number };
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  onRouteClick?: (route: MapRoute) => void;
  onViewportChange?: (viewport: MapViewport) => void;
  title?: string;
  showControls?: boolean;
  showLayerToggles?: boolean;
  showLegend?: boolean;
  showCoordinatesHud?: boolean;
  mapProvider?: "osm" | "radar" | "custom";
  tileUrl?: string;
  maxTrailPoints?: number;
  className?: string;
}
