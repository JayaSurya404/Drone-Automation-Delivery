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
