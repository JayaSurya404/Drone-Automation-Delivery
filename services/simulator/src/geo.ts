import type { GeoCoordinate } from "./types.js";

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculates the great-circle surface distance between two geographic coordinates using the Haversine formula.
 * @returns Distance in meters
 */
export function haversineDistanceMeters(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
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
 * Calculates 3D distance taking both horizontal surface distance and altitude difference into account.
 */
export function distance3DMeters(coord1: GeoCoordinate, coord2: GeoCoordinate): number {
  const horizontalDist = haversineDistanceMeters(coord1, coord2);
  const altitudeDelta = (coord2.altitudeMeters ?? 0) - (coord1.altitudeMeters ?? 0);
  return Math.sqrt(horizontalDist * horizontalDist + altitudeDelta * altitudeDelta);
}

/**
 * Computes the initial forward bearing (azimuth) from coordinate 1 to coordinate 2.
 * @returns Heading in degrees [0, 360) where 0 = North, 90 = East, 180 = South, 270 = West
 */
export function initialBearingDegrees(from: GeoCoordinate, to: GeoCoordinate): number {
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
 * Calculates a new destination coordinate given a starting position, bearing, and distance travelled.
 */
export function projectPosition(
  from: GeoCoordinate,
  bearingDegrees: number,
  distanceMeters: number
): GeoCoordinate {
  if (distanceMeters === 0) {
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
    altitudeMeters: from.altitudeMeters
  };
}

/**
 * Linearly interpolates between two 3D coordinates.
 */
export function interpolateCoordinate(
  from: GeoCoordinate,
  to: GeoCoordinate,
  fraction: number
): GeoCoordinate {
  const clampedFraction = Math.max(0, Math.min(1, fraction));
  const lat = from.latitude + (to.latitude - from.latitude) * clampedFraction;
  const lon = from.longitude + (to.longitude - from.longitude) * clampedFraction;
  const alt = from.altitudeMeters + (to.altitudeMeters - from.altitudeMeters) * clampedFraction;

  return {
    latitude: lat,
    longitude: lon,
    altitudeMeters: alt
  };
}
