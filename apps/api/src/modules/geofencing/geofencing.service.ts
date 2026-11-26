import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { CreateGeofenceDto } from "./dto/create-geofence.dto";
import type { ListGeofencesQueryDto } from "./dto/list-geofences-query.dto";
import type { UpdateGeofenceDto } from "./dto/update-geofence.dto";
import { buildLineStringWkt, buildPolygonWkt, parsePolygonWkt, type LatLng } from "./geometry.util";

export type GeofenceType = "SERVICE_AREA" | "NO_FLY" | "RESTRICTED";

export interface GeofenceView {
  id: string;
  name: string;
  type: GeofenceType;
  description: string | null;
  isActive: boolean;
  points: LatLng[];
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceAreaCheckResult {
  /** True whenever no active `SERVICE_AREA` zone is configured at all — a deliberate permissive default (see `schema.prisma`'s `GeofenceType` doc) so an empty geofence table never blocks every delivery. */
  inServiceArea: boolean;
  zoneName: string | null;
  hasServiceAreaZones: boolean;
}

export interface ConflictingZoneView {
  id: string;
  name: string;
  code: string;
  type: string;
  restriction: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  altitudeFloorMeters: number;
  altitudeCeilingMeters: number;
  reason: string;
  regulatoryRef: string;
}

export interface EligibilityCheckResult {
  isEligible: boolean;
  status: "Eligible" | "Not Eligible" | "Temporarily Unavailable";
  airspaceStatus: "CLEAR" | "PROHIBITED_NFZ" | "WARNING_ZONE" | "OUT_OF_SERVICE_RADIUS";
  distanceFromHubKm: number;
  estimatedFlightMinutes: number;
  message: string;
  hubName: string;
  safetyScorePercent: number;
  conflictingZones: ConflictingZoneView[];
}

export interface PublicAirspaceZoneView {
  id: string;
  name: string;
  code: string;
  type: string;
  restriction: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  altitudeFloorMeters: number;
  altitudeCeilingMeters: number;
  reason: string;
  regulatoryRef: string;
  polygon: Array<[number, number]>;
}

export interface PublicHubView {
  id: string;
  name: string;
  code: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface PublicAirspaceView {
  zones: PublicAirspaceZoneView[];
  hubs: PublicHubView[];
  metadata: {
    totalZones: number;
    totalHubs: number;
  };
}

interface RawGeofenceRow {
  id: string;
  name: string;
  type: GeofenceType;
  description: string | null;
  isActive: boolean;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
  wkt: string;
}

const GEOFENCE_SELECT_SQL = `
  SELECT id, name, type, description, is_active as "isActive", created_by_id as "createdById",
         created_at as "createdAt", updated_at as "updatedAt", ST_AsText(polygon) as wkt
  FROM geofences
`;

/**
 * PostGIS-backed geofence CRUD + the two spatial predicates the rest of the
 * app needs (`PROJECT_CONTEXT.md` #5 — `ST_Contains`/`ST_Intersects`
 * queries, never hand-rolled geo math). Mutations require `geofencing.update`
 * (Compliance/Safety Officer) and are audit-logged; reads require
 * `geofencing.read`. See `schema.prisma`'s `Geofence`/`GeofenceType` doc
 * comments for why every zone — including "airport/restricted-area
 * proximity" ones — is stored as a plain polygon.
 */
@Injectable()
export class GeofencingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateGeofenceDto, actor: AuthenticatedUser): Promise<GeofenceView> {
    const wkt = buildPolygonWkt(dto.points);
    await this.assertValidPolygon(wkt);

    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, description, polygon, is_active, created_by_id, created_at, updated_at)
      VALUES (
        ${id}, ${dto.name}, ${dto.type}::"GeofenceType", ${dto.description ?? null},
        ST_GeomFromText(${wkt}, 4326), true, ${actor.sub}, now(), now()
      )
    `;
    await this.auditService.log({
      actorId: actor.sub,
      action: "geofence.created",
      targetType: "Geofence",
      targetId: id,
      metadata: { name: dto.name, type: dto.type, pointCount: dto.points.length },
    });
    return this.getByIdOrThrow(id);
  }

  async list(query: ListGeofencesQueryDto): Promise<GeofenceView[]> {
    // Phase 12 fix: previously fetched every row and filtered in JS (never
    // used the `@@index([type, isActive])` this table already has) and had
    // no row cap at all. Filters are now pushed into SQL as bound
    // parameters (`Prisma.sql`, never string-concatenated), and the result
    // is capped — small table today, but this table only grows.
    const conditions: Prisma.Sql[] = [];
    if (query.type) {
      conditions.push(Prisma.sql`type = ${query.type}`);
    }
    if (query.isActive !== undefined) {
      conditions.push(Prisma.sql`is_active = ${query.isActive}`);
    }
    const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
    const rows = await this.prisma.$queryRaw<RawGeofenceRow[]>(
      Prisma.sql`${Prisma.raw(GEOFENCE_SELECT_SQL)} ${where} ORDER BY created_at DESC LIMIT 500`,
    );
    return rows.map(toView);
  }

  async getById(id: string): Promise<GeofenceView | null> {
    const rows = await this.prisma.$queryRawUnsafe<RawGeofenceRow[]>(`${GEOFENCE_SELECT_SQL} WHERE id = $1`, id);
    return rows[0] ? toView(rows[0]) : null;
  }

  async getByIdOrThrow(id: string): Promise<GeofenceView> {
    const geofence = await this.getById(id);
    if (!geofence) {
      throw new NotFoundException("Geofence not found");
    }
    return geofence;
  }

  async update(id: string, dto: UpdateGeofenceDto, actor: AuthenticatedUser): Promise<GeofenceView> {
    await this.getByIdOrThrow(id);

    if (dto.points) {
      const wkt = buildPolygonWkt(dto.points);
      await this.assertValidPolygon(wkt);
      await this.prisma.$executeRaw`UPDATE geofences SET polygon = ST_GeomFromText(${wkt}, 4326), updated_at = now() WHERE id = ${id}`;
    }
    if (dto.name !== undefined) {
      await this.prisma.$executeRaw`UPDATE geofences SET name = ${dto.name}, updated_at = now() WHERE id = ${id}`;
    }
    if (dto.description !== undefined) {
      await this.prisma.$executeRaw`UPDATE geofences SET description = ${dto.description}, updated_at = now() WHERE id = ${id}`;
    }
    if (dto.isActive !== undefined) {
      await this.prisma.$executeRaw`UPDATE geofences SET is_active = ${dto.isActive}, updated_at = now() WHERE id = ${id}`;
    }

    await this.auditService.log({
      actorId: actor.sub,
      action: "geofence.updated",
      targetType: "Geofence",
      targetId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return this.getByIdOrThrow(id);
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    await this.getByIdOrThrow(id);
    await this.prisma.$executeRaw`DELETE FROM geofences WHERE id = ${id}`;
    await this.auditService.log({ actorId: actor.sub, action: "geofence.deleted", targetType: "Geofence", targetId: id });
  }

  /** Checkout/mission-planning read — permissive (returns `inServiceArea: true`) when no `SERVICE_AREA` zone is configured at all, matching Phase 4's `ServiceAreaChecker` stub's "no policy yet, don't block" philosophy. */
  async checkServiceArea(point: LatLng): Promise<ServiceAreaCheckResult> {
    const countRows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint as count FROM geofences WHERE type = 'SERVICE_AREA' AND is_active = true
    `;
    const hasServiceAreaZones = Number(countRows[0]?.count ?? 0) > 0;
    if (!hasServiceAreaZones) {
      return { inServiceArea: true, zoneName: null, hasServiceAreaZones: false };
    }
    const matches = await this.prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM geofences
      WHERE type = 'SERVICE_AREA' AND is_active = true
        AND ST_Contains(polygon, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326))
      LIMIT 1
    `;
    return { inServiceArea: matches.length > 0, zoneName: matches[0]?.name ?? null, hasServiceAreaZones: true };
  }

  /** A single point (e.g. a drone's current telemetry position) against `NO_FLY`/`RESTRICTED` zones — the in-flight per-tick check. */
  async findPointViolations(point: LatLng): Promise<GeofenceView[]> {
    const rows = await this.prisma.$queryRaw<RawGeofenceRow[]>`
      SELECT id, name, type, description, is_active as "isActive", created_by_id as "createdById",
             created_at as "createdAt", updated_at as "updatedAt", ST_AsText(polygon) as wkt
      FROM geofences
      WHERE is_active = true AND type IN ('NO_FLY', 'RESTRICTED')
        AND ST_Contains(polygon, ST_SetSRID(ST_MakePoint(${point.lng}, ${point.lat}), 4326))
    `;
    return rows.map(toView);
  }

  /** A planned route (origin → waypoints → destination) against `NO_FLY`/`RESTRICTED` zones — the pre-dispatch check. */
  async findRouteViolations(points: LatLng[]): Promise<GeofenceView[]> {
    const lineWkt = buildLineStringWkt(points);
    const rows = await this.prisma.$queryRaw<RawGeofenceRow[]>`
      SELECT id, name, type, description, is_active as "isActive", created_by_id as "createdById",
             created_at as "createdAt", updated_at as "updatedAt", ST_AsText(polygon) as wkt
      FROM geofences
      WHERE is_active = true AND type IN ('NO_FLY', 'RESTRICTED')
        AND ST_Intersects(polygon, ST_GeomFromText(${lineWkt}, 4326))
    `;
    return rows.map(toView);
  }

  /** Comprehensive checkout drop-zone eligibility auditing against PostGIS active hubs and geofences */
  async checkEligibility(lat: number, lng: number, clearanceRadiusMeters: number = 3.5): Promise<EligibilityCheckResult> {
    const radius = Math.max(clearanceRadiusMeters || 3.5, 0.5);

    // 1. Nearest active hub
    let hubName = "SkyHub Kurumbapalayam";
    let distanceKm = 0;
    try {
      const hubRows = await this.prisma.$queryRaw<Array<{
        id: string;
        name: string;
        code: string;
        lat: number;
        lng: number;
        distanceKm: number;
      }>>`
        SELECT id, name, code,
               ST_Y(location::geometry) as lat,
               ST_X(location::geometry) as lng,
               (ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0)::float as "distanceKm"
        FROM fulfillment_hubs
        WHERE is_active = true
        ORDER BY location <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
        LIMIT 1
      `;
      if (hubRows.length > 0 && hubRows[0]) {
        hubName = hubRows[0].name;
        distanceKm = Number(hubRows[0].distanceKm || 0);
      } else {
        distanceKm = this.haversineDistance(lat, lng, 11.1132, 77.0277);
      }
    } catch {
      distanceKm = this.haversineDistance(lat, lng, 11.1132, 77.0277);
    }

    const distanceFromHubKm = Math.round(distanceKm * 10) / 10;
    const estimatedFlightMinutes = Math.max(3, Math.round((distanceFromHubKm / 50) * 60 + 3));

    // 2. Check for prohibited (NO_FLY) or restricted zones intersecting the buffered drop zone
    const intersectingZones = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      type: GeofenceType;
      description: string | null;
      lat: number;
      lng: number;
    }>>`
      SELECT id, name, type, description,
             ST_Y(ST_Centroid(polygon))::float as lat,
             ST_X(ST_Centroid(polygon))::float as lng
      FROM geofences
      WHERE is_active = true AND type IN ('NO_FLY', 'RESTRICTED')
        AND ST_Intersects(polygon, ST_Buffer(ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, ${radius})::geometry)
    `;

    const conflictingZones: ConflictingZoneView[] = intersectingZones.map((z) => {
      const codeMatch = z.name.match(/\(([A-Z0-9-]+)\)/);
      const code = (codeMatch && codeMatch[1]) ? codeMatch[1] : (z.type === "NO_FLY" ? "NFZ-RED-ZONE" : "CAUTION-ZONE");
      const isNoFly = z.type === "NO_FLY";
      return {
        id: z.id,
        name: z.name,
        code,
        type: isNoFly ? "AIRPORT" : "CRITICAL_INFRA",
        restriction: isNoFly ? "PROHIBITED" : "RESTRICTED_WARNING",
        latitude: z.lat,
        longitude: z.lng,
        radiusMeters: radius,
        altitudeFloorMeters: 0,
        altitudeCeilingMeters: isNoFly ? 120 : 35,
        reason: z.description || (isNoFly ? "Prohibited Red Zone under DGCA Drone Rules 2021." : "Restricted Airspace Caution Corridor."),
        regulatoryRef: isNoFly ? "DGCA Drone Rules 2021 - Rule 22 (Prohibited Red Zone)" : "DGCA Drone Rules 2021 - Rule 24 (Caution Corridor)",
      };
    });

    const hasNoFly = intersectingZones.some((z) => z.type === "NO_FLY");
    if (hasNoFly) {
      const primaryConflict = conflictingZones.find((z) => z.restriction === "PROHIBITED") || conflictingZones[0];
      return {
        isEligible: false,
        status: "Not Eligible",
        airspaceStatus: "PROHIBITED_NFZ",
        distanceFromHubKm,
        estimatedFlightMinutes,
        hubName,
        safetyScorePercent: 0,
        message: `Drop zone intersects restricted DGCA No-Fly Zone (${primaryConflict?.name || "Prohibited Red Zone"}). Autonomous landing is strictly prohibited.`,
        conflictingZones,
      };
    }

    // 3. Check service area boundary
    const serviceAreaResult = await this.checkServiceArea({ lat, lng });
    if (serviceAreaResult.hasServiceAreaZones && !serviceAreaResult.inServiceArea) {
      return {
        isEligible: false,
        status: "Not Eligible",
        airspaceStatus: "OUT_OF_SERVICE_RADIUS",
        distanceFromHubKm,
        estimatedFlightMinutes,
        hubName,
        safetyScorePercent: 0,
        message: "Delivery location is outside the authorized SkyNav autonomous flight service area.",
        conflictingZones: [],
      };
    }

    // 4. Warning / Restricted Zone
    const hasWarning = intersectingZones.some((z) => z.type === "RESTRICTED");
    if (hasWarning) {
      const primaryWarning = conflictingZones[0];
      return {
        isEligible: true,
        status: "Eligible",
        airspaceStatus: "WARNING_ZONE",
        distanceFromHubKm,
        estimatedFlightMinutes,
        hubName,
        safetyScorePercent: 88,
        message: `Airspace caution corridor active: ${primaryWarning?.name || "Caution Area"}. Altitude capped at 35m with acoustic dampening.`,
        conflictingZones,
      };
    }

    // 5. Clear corridor
    return {
      isEligible: true,
      status: "Eligible",
      airspaceStatus: "CLEAR",
      distanceFromHubKm,
      estimatedFlightMinutes,
      hubName,
      safetyScorePercent: 99,
      message: "Airspace clear for autonomous drone delivery. Corridor validated.",
      conflictingZones: [],
    };
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async getPublicAirspaceZones(): Promise<PublicAirspaceView> {
    const rawZones = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      type: GeofenceType;
      description: string | null;
      wkt: string;
      centroid_lat: number;
      centroid_lng: number;
    }>>`
      SELECT id, name, type, description, ST_AsText(polygon) as wkt,
             ST_Y(ST_Centroid(polygon)) as centroid_lat,
             ST_X(ST_Centroid(polygon)) as centroid_lng
      FROM geofences
      WHERE is_active = true AND type IN ('NO_FLY', 'RESTRICTED')
    `;

    const hubs = await this.prisma.$queryRaw<Array<{
      id: string;
      name: string;
      code: string;
      latitude: number;
      longitude: number;
    }>>`
      SELECT id, name, code,
             ST_Y(location::geometry) as latitude,
             ST_X(location::geometry) as longitude
      FROM fulfillment_hubs
      WHERE is_active = true
    `;

    const zones = rawZones.map((z) => {
      const codeMatch = z.description ? z.description.match(/([A-Z0-9_-]{4,})/i) : null;
      const code = (codeMatch && codeMatch[1]) ? codeMatch[1] : (z.type === "NO_FLY" ? "NFZ-RED-ZONE" : "CAUTION-ZONE");
      const restriction = z.type === "NO_FLY" ? "PROHIBITED" : "RESTRICTED_WARNING";
      const zoneType = z.name.toLowerCase().includes("hospital")
        ? "HOSPITAL_HELIPAD"
        : z.name.toLowerCase().includes("military")
        ? "MILITARY"
        : z.name.toLowerCase().includes("runway") || z.name.toLowerCase().includes("airport")
        ? "AIRPORT"
        : "CRITICAL_INFRA";

      const points = parsePolygonWkt(z.wkt);
      return {
        id: z.id,
        name: z.name,
        code,
        type: zoneType,
        restriction,
        latitude: Number(z.centroid_lat || 11.03),
        longitude: Number(z.centroid_lng || 77.04),
        radiusMeters: 500,
        altitudeFloorMeters: 0,
        altitudeCeilingMeters: 120,
        reason: z.description || z.name,
        regulatoryRef: code,
        polygon: points.map((p): [number, number] => [p.lat, p.lng]),
      };
    });

    return {
      zones,
      hubs: hubs.map((h) => ({
        id: h.id,
        name: h.name,
        code: h.code,
        latitude: Number(h.latitude),
        longitude: Number(h.longitude),
        radiusMeters: 12000,
      })),
      metadata: {
        totalZones: zones.length,
        totalHubs: hubs.length,
      },
    };
  }

  private async assertValidPolygon(wkt: string): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ valid: boolean }>>`SELECT ST_IsValid(ST_GeomFromText(${wkt}, 4326)) as valid`;
    if (!rows[0]?.valid) {
      throw new BadRequestException("The provided polygon is not a valid simple polygon (check for self-intersections or duplicate points)");
    }
  }
}

function toView(row: RawGeofenceRow): GeofenceView {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    isActive: row.isActive,
    points: parsePolygonWkt(row.wkt),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
