import { createHash } from "node:crypto";

/**
 * Naive straight-line route generation — the roadmap's own words for Phase
 * 7-v1 ("waypoint queue, straight-line") pulled forward here since a mission
 * needs *some* route to fly. AI-optimized routing (wind/geofence/battery-aware)
 * is Phase 9's `RouteOptimizer`, not this.
 */
export interface RoutePoint {
  lat: number;
  lng: number;
  altitudeMeters: number;
}

const CRUISE_ALTITUDE_METERS = 60;

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
 * Deterministic placeholder "geocode": no real address-to-coordinate
 * resolution exists until a future phase (this app has never stored
 * lat/lng on an address — see `docs/ARCHITECTURE.md`), so the destination is
 * a small, stable offset from the assigned hub, seeded by the delivery id so
 * the same delivery always resolves to the same point.
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
