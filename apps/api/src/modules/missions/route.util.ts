import { createHash } from "node:crypto";
import { corridorRoutePlanner } from "./corridor-route-planner.util";

export interface RoutePoint {
  lat: number;
  lng: number;
  altitudeMeters: number;
}

export const CRUISE_ALTITUDE_METERS = 45;
export const RETURN_ALTITUDE_METERS = 40;

/**
 * Builds a route respecting the Kurumbapalayam flight corridor and 45m cruising altitude.
 */
export function buildCorridorRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  isReturn = false,
): RoutePoint[] {
  const result = corridorRoutePlanner.planRoute(origin.lat, origin.lng, destination.lat, destination.lng, isReturn);
  const altitude = isReturn ? RETURN_ALTITUDE_METERS : CRUISE_ALTITUDE_METERS;
  return result.waypoints.slice(1).map(([lat, lng]) => ({
    lat,
    lng,
    altitudeMeters: altitude,
  }));
}

/**
 * Straight-line fallback route generation at 45m altitude.
 */
export function buildStraightLineRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): RoutePoint[] {
  const fractions = [0.4, 0.75, 1];
  return fractions.map((fraction) => ({
    lat: origin.lat + (destination.lat - origin.lat) * fraction,
    lng: origin.lng + (destination.lng - origin.lng) * fraction,
    altitudeMeters: CRUISE_ALTITUDE_METERS,
  }));
}

/**
 * Deterministic placeholder "geocode": seeded by delivery id for stable coordinates.
 */
export function resolveDeterministicDestination(
  deliveryId: string,
  origin: { lat: number; lng: number },
): { lat: number; lng: number } {
  const latOffset = seededUnitOffset(`${deliveryId}:lat`) * 0.02;
  const lngOffset = seededUnitOffset(`${deliveryId}:lng`) * 0.02;
  return { lat: origin.lat + latOffset, lng: origin.lng + lngOffset };
}

/** Hashes the input to a deterministic value in [-1, 1]. */
function seededUnitOffset(seed: string): number {
  const hash = createHash("sha256").update(seed).digest();
  const value = hash.readUInt32BE(0);
  return (value / 0xffffffff) * 2 - 1;
}
