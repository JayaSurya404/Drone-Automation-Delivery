import type { Coordinate } from "./index.js";

/**
 * Standard WGS-84 Mean Earth Radius in meters.
 */
export const EARTH_RADIUS_METERS = 6371000;

export interface GeoPoint {
  latitude: number;
  longitude: number;
  altitudeMeters?: number | null;
}

export type TelemetryFreshness = "LIVE" | "DEGRADED" | "STALE" | "OFFLINE";

/**
 * Validates whether geographic coordinates are strictly within real-world boundaries.
 * Latitude: [-90, 90], Longitude: [-180, 180]
 */
export function isValidCoordinate(coord: { latitude: number; longitude: number } | null | undefined): boolean {
  if (!coord) return false;
  if (typeof coord.latitude !== "number" || typeof coord.longitude !== "number") return false;
  if (Number.isNaN(coord.latitude) || Number.isNaN(coord.longitude)) return false;
  if (coord.latitude < -90 || coord.latitude > 90) return false;
  if (coord.longitude < -180 || coord.longitude > 180) return false;
  return true;
}

/**
 * Clamps coordinates to valid geographic bounds if slight numeric overflow occurs.
 */
export function sanitizeCoordinate(coord: GeoPoint): GeoPoint {
  const lat = Math.max(-90, Math.min(90, Number.isNaN(coord.latitude) ? 0 : coord.latitude));
  const lon = Math.max(-180, Math.min(180, Number.isNaN(coord.longitude) ? 0 : coord.longitude));
  const alt = coord.altitudeMeters != null ? Math.max(0, Number.isNaN(coord.altitudeMeters) ? 0 : coord.altitudeMeters) : 0;
  return {
    latitude: lat,
    longitude: lon,
    altitudeMeters: alt
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates the great-circle surface distance between two coordinates using the Haversine formula.
 * @returns Distance in meters
 */
export function haversineDistanceMeters(
  coord1: { latitude: number; longitude: number },
  coord2: { latitude: number; longitude: number }
): number {
  if (!isValidCoordinate(coord1) || !isValidCoordinate(coord2)) {
    return 0;
  }

  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLatRad = toRadians(coord2.latitude - coord1.latitude);
  const deltaLonRad = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLonRad / 2) * Math.sin(deltaLonRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates 3D distance taking both horizontal surface distance and vertical altitude delta into account.
 */
export function distance3DMeters(coord1: GeoPoint, coord2: GeoPoint): number {
  const horizontalDist = haversineDistanceMeters(coord1, coord2);
  const alt1 = coord1.altitudeMeters ?? 0;
  const alt2 = coord2.altitudeMeters ?? 0;
  const altitudeDelta = (alt2 ?? 0) - (alt1 ?? 0);
  return Math.sqrt(horizontalDist * horizontalDist + altitudeDelta * altitudeDelta);
}

/**
 * Computes the initial forward bearing (azimuth) from coordinate 1 to coordinate 2.
 * @returns Heading in degrees [0, 360) where 0 = North, 90 = East, 180 = South, 270 = West
 */
export function initialBearingDegrees(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  if (!isValidCoordinate(from) || !isValidCoordinate(to)) {
    return 0;
  }

  const lat1Rad = toRadians(from.latitude);
  const lat2Rad = toRadians(to.latitude);
  const deltaLonRad = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLonRad) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(deltaLonRad);

  const bearingRad = Math.atan2(y, x);
  const bearingDeg = toDegrees(bearingRad);
  return (bearingDeg + 360) % 360;
}

/**
 * Calculates a new projected destination coordinate given a starting position, bearing, and distance travelled.
 */
export function projectPosition(
  from: GeoPoint,
  bearingDegrees: number,
  distanceMeters: number
): GeoPoint {
  if (distanceMeters === 0 || !isValidCoordinate(from)) {
    return { ...from };
  }

  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRad = toRadians(bearingDegrees);
  const lat1Rad = toRadians(from.latitude);
  const lon1Rad = toRadians(from.longitude);

  const lat2Rad = Math.asin(
    Math.sin(lat1Rad) * Math.cos(angularDistance) +
      Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const lon2Rad =
    lon1Rad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
      Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
    );

  return {
    latitude: toDegrees(lat2Rad),
    longitude: ((toDegrees(lon2Rad) + 540) % 360) - 180, // Normalize to [-180, 180]
    altitudeMeters: from.altitudeMeters ?? 0
  };
}

/**
 * Linearly interpolates between two 3D coordinates.
 */
export function interpolateCoordinate(
  from: GeoPoint,
  to: GeoPoint,
  fraction: number
): GeoPoint {
  const clampedFraction = Math.max(0, Math.min(1, Number.isNaN(fraction) ? 0 : fraction));
  const lat = from.latitude + (to.latitude - from.latitude) * clampedFraction;
  const lon = from.longitude + (to.longitude - from.longitude) * clampedFraction;
  const fromAlt = from.altitudeMeters ?? 0;
  const toAlt = to.altitudeMeters ?? 0;
  const alt = fromAlt + (toAlt - fromAlt) * clampedFraction;

  return {
    latitude: lat,
    longitude: lon,
    altitudeMeters: alt
  };
}

/**
 * Calculates cumulative surface distance across a polyline route of coordinates.
 */
export function computeRouteDistanceMeters(coordinates: GeoPoint[]): number {
  if (!coordinates || coordinates.length < 2) {
    return 0;
  }
  let totalMeters = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalMeters += haversineDistanceMeters(coordinates[i], coordinates[i + 1]);
  }
  return totalMeters;
}

/**
 * Computes remaining distance from a drone's current position to the mission destination
 * via remaining waypoints.
 */
export function computeRemainingRouteDistanceMeters(
  currentPos: GeoPoint,
  waypoints: GeoPoint[],
  currentWaypointIndex: number = 0
): number {
  if (!waypoints || waypoints.length === 0) {
    return 0;
  }
  if (!isValidCoordinate(currentPos)) {
    return computeRouteDistanceMeters(waypoints.slice(currentWaypointIndex));
  }

  const validIndex = Math.max(0, Math.min(waypoints.length - 1, currentWaypointIndex));
  const nextWaypoint = waypoints[validIndex];
  let remainingMeters = haversineDistanceMeters(currentPos, nextWaypoint);

  for (let i = validIndex; i < waypoints.length - 1; i++) {
    remainingMeters += haversineDistanceMeters(waypoints[i], waypoints[i + 1]);
  }

  return remainingMeters;
}

/**
 * Calculates dynamic Estimated Time of Arrival (ETA) in seconds based on remaining distance and current speed.
 * Uses default cruise speed (e.g. 15 m/s) if drone is currently hovering or starting takeoff.
 */
export function calculateDynamicEtaSeconds(
  remainingDistanceMeters: number,
  currentSpeedMps: number,
  defaultCruiseSpeedMps: number = 15
): number {
  if (remainingDistanceMeters <= 0) {
    return 0;
  }
  const effectiveSpeed = currentSpeedMps > 1.0 ? currentSpeedMps : defaultCruiseSpeedMps;
  return Math.round(remainingDistanceMeters / effectiveSpeed);
}

/**
 * Formats a metric distance into human-readable text (e.g., '350 m' or '4.2 km').
 */
export function formatDistance(meters: number): string {
  if (meters < 0) return "0 m";
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats duration in seconds into human-readable text (e.g., '45s', '8m 20s', '1h 14m').
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const mins = Math.floor(seconds / 60);
  const remainingSecs = Math.round(seconds % 60);
  if (mins < 1) {
    return `${remainingSecs}s`;
  }
  if (mins < 60) {
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins}m`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  center: { latitude: number; longitude: number };
  span: { latSpan: number; lonSpan: number };
}

/**
 * Computes bounding box and center coordinate for an array of points.
 */
export function computeBoundingBox(coordinates: Array<{ latitude: number; longitude: number }>): BoundingBox | null {
  const validCoords = coordinates.filter(isValidCoordinate);
  if (validCoords.length === 0) {
    return null;
  }

  let minLat = validCoords[0].latitude;
  let maxLat = validCoords[0].latitude;
  let minLon = validCoords[0].longitude;
  let maxLon = validCoords[0].longitude;

  for (const c of validCoords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLon) minLon = c.longitude;
    if (c.longitude > maxLon) maxLon = c.longitude;
  }

  return {
    minLat,
    maxLat,
    minLon,
    maxLon,
    center: {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2
    },
    span: {
      latSpan: Math.max(0.005, maxLat - minLat),
      lonSpan: Math.max(0.005, maxLon - minLon)
    }
  };
}

/**
 * Evaluates telemetry stream freshness based on packet observation timestamp.
 */
export function calculateTelemetryFreshness(
  observedAt: string | Date | null | undefined,
  now: Date = new Date()
): TelemetryFreshness {
  if (!observedAt) {
    return "OFFLINE";
  }
  const observedTime = typeof observedAt === "string" ? new Date(observedAt).getTime() : observedAt.getTime();
  if (Number.isNaN(observedTime)) {
    return "OFFLINE";
  }
  const ageMs = now.getTime() - observedTime;
  if (ageMs < 0) {
    // Clock drift or slightly future timestamp
    return "LIVE";
  }
  if (ageMs <= 3000) {
    return "LIVE";
  }
  if (ageMs <= 10000) {
    return "DEGRADED";
  }
  if (ageMs <= 30000) {
    return "STALE";
  }
  return "OFFLINE";
}
