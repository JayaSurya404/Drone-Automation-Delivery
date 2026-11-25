/**
 * Pure WKT (Well-Known Text) helpers — the only place `GeofencingService`
 * turns a `{ lat, lng }[]` point list into the string PostGIS's
 * `ST_GeomFromText`/`ST_AsText` functions speak, and back. No geo math
 * happens anywhere else in the codebase (`PROJECT_CONTEXT.md` #5) — every
 * actual containment/intersection decision is a `ST_Contains`/`ST_Intersects`
 * query PostGIS evaluates, never hand-rolled distance/bearing arithmetic.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Builds a closed-ring `POLYGON((...))` from an open point list (the caller supplies each vertex once; the ring-closing repeat of the first point is added here). */
export function buildPolygonWkt(points: LatLng[]): string {
  if (points.length < 3) {
    throw new Error("A polygon needs at least 3 points");
  }
  const first = points[0] as LatLng;
  const ring = [...points, first];
  const coords = ring.map((p) => `${p.lng} ${p.lat}`).join(", ");
  return `POLYGON((${coords}))`;
}

export function buildLineStringWkt(points: LatLng[]): string {
  if (points.length < 2) {
    throw new Error("A line needs at least 2 points");
  }
  const coords = points.map((p) => `${p.lng} ${p.lat}`).join(", ");
  return `LINESTRING(${coords})`;
}

/**
 * Approximates a circle as an N-gon polygon around `center` — the seam
 * `GeofencingController`'s admin UI uses to draw an "airport/restricted-area
 * proximity" zone (phase-08 prompt) from a center point + radius, without
 * the schema/queries needing a second geometry kind (see `GeofenceType`'s
 * doc comment in `schema.prisma`). Equirectangular approximation, accurate
 * enough for the radii (hundreds of meters to a few km) this app's zones
 * use — not intended for large-radius or near-pole geometry.
 */
export function buildCircleApproxPolygon(center: LatLng, radiusMeters: number, segments = 24): LatLng[] {
  const METERS_PER_DEGREE_LAT = 111_320;
  const latRadiusDeg = radiusMeters / METERS_PER_DEGREE_LAT;
  const lngRadiusDeg = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((center.lat * Math.PI) / 180));

  const points: LatLng[] = [];
  for (let i = 0; i < segments; i += 1) {
    const angle = (2 * Math.PI * i) / segments;
    points.push({
      lat: center.lat + latRadiusDeg * Math.sin(angle),
      lng: center.lng + lngRadiusDeg * Math.cos(angle),
    });
  }
  return points;
}

/** Parses `ST_AsText`'s `POLYGON((lng lat, lng lat, ...))` output back into an open point list (the ring-closing repeated point is dropped, mirroring `buildPolygonWkt`'s input shape). */
export function parsePolygonWkt(wkt: string): LatLng[] {
  const match = /POLYGON\(\(([^)]+)\)\)/i.exec(wkt);
  if (!match?.[1]) {
    throw new Error(`Unrecognized polygon WKT: ${wkt}`);
  }
  const points = match[1].split(",").map((pair) => {
    const [lng, lat] = pair.trim().split(/\s+/).map(Number);
    return { lat: lat as number, lng: lng as number };
  });
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length > 1 && first && last && first.lat === last.lat && first.lng === last.lng) {
    points.pop();
  }
  return points;
}
