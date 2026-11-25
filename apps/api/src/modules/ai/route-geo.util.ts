import type { LatLng } from "../geofencing/geometry.util";

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance between two points — the one place this app computes real-world distance from lat/lng, reused by every AI heuristic below rather than each reimplementing it. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total length of a multi-point path (sum of consecutive-segment great-circle distances). */
export function pathLengthMeters(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev && curr) {
      total += haversineMeters(prev, curr);
    }
  }
  return total;
}

/**
 * Builds a 3-point path (origin → offset midpoint → destination) shifted
 * perpendicular to the direct origin→destination line by `offsetDegrees` —
 * the deterministic "detour" candidate `HeuristicRouteOptimizer` generates
 * to route around a geofence the direct line crosses. A positive offset
 * shifts one way, negative the other (there is no inherent "north"/"south"
 * meaning — it's whichever side of the direct line the perpendicular
 * vector points to for that origin/destination pair).
 */
export function buildOffsetDetour(origin: LatLng, destination: LatLng, offsetDegrees: number): LatLng[] {
  const dLat = destination.lat - origin.lat;
  const dLng = destination.lng - origin.lng;
  const length = Math.hypot(dLat, dLng) || 1;
  // Rotate the direct-line vector 90 degrees to get a perpendicular unit vector.
  const perpLat = -dLng / length;
  const perpLng = dLat / length;

  const midpoint: LatLng = {
    lat: (origin.lat + destination.lat) / 2 + perpLat * offsetDegrees,
    lng: (origin.lng + destination.lng) / 2 + perpLng * offsetDegrees,
  };
  return [origin, midpoint, destination];
}
