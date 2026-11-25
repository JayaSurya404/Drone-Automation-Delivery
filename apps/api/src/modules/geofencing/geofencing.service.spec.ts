import { BadRequestException, NotFoundException } from "@nestjs/common";
import { GeofencingService } from "./geofencing.service";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuditService } from "../audit/audit.service";

const actor = { sub: "officer-1", email: "o@example.com", roles: ["compliance_safety_officer"], permissions: ["geofencing.update"] };

const SQUARE_POINTS = [
  { lat: 44.97, lng: -93.27 },
  { lat: 44.97, lng: -93.26 },
  { lat: 44.98, lng: -93.26 },
  { lat: 44.98, lng: -93.27 },
];

function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "geo-1",
    name: "Test zone",
    type: "NO_FLY",
    description: null,
    isActive: true,
    createdById: "officer-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    wkt: "POLYGON((-93.27 44.97,-93.26 44.97,-93.26 44.98,-93.27 44.98,-93.27 44.97))",
    ...overrides,
  };
}

describe("GeofencingService", () => {
  let prisma: {
    $executeRaw: jest.Mock;
    $queryRaw: jest.Mock;
    $queryRawUnsafe: jest.Mock;
  };
  let auditService: { log: jest.Mock };
  let service: GeofencingService;

  beforeEach(() => {
    prisma = { $executeRaw: jest.fn(), $queryRaw: jest.fn(), $queryRawUnsafe: jest.fn() };
    auditService = { log: jest.fn() };
    service = new GeofencingService(prisma as unknown as PrismaService, auditService as unknown as AuditService);
  });

  describe("create", () => {
    it("rejects an invalid polygon before ever inserting", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ valid: false }]);

      await expect(service.create({ name: "Bad", type: "NO_FLY", points: SQUARE_POINTS }, actor)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it("inserts via raw SQL and audit-logs on success", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ valid: true }]);
      prisma.$executeRaw.mockResolvedValueOnce(1);
      prisma.$queryRawUnsafe.mockResolvedValueOnce([rawRow()]);

      const result = await service.create({ name: "Test zone", type: "NO_FLY", points: SQUARE_POINTS }, actor);

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: "officer-1", action: "geofence.created", targetType: "Geofence" }),
      );
      expect(result.points).toEqual(SQUARE_POINTS);
    });
  });

  describe("getByIdOrThrow", () => {
    it("throws NotFoundException for a missing geofence", async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([]);
      await expect(service.getByIdOrThrow("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("list", () => {
    it("pushes type/isActive filters into the query (Phase 12: SQL-level, not in-memory) and maps the result", async () => {
      // The real WHERE-clause filtering is exercised by the integration
      // suite (against real Postgres); this unit test only verifies the
      // service maps whatever bounded row set the query returns.
      prisma.$queryRaw.mockResolvedValueOnce([rawRow({ id: "a", type: "NO_FLY", isActive: true })]);

      const result = await service.list({ type: "NO_FLY", isActive: true });

      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(result.map((g) => g.id)).toEqual(["a"]);
    });

    it("lists everything with no filter applied", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([rawRow({ id: "a" }), rawRow({ id: "b" })]);
      const result = await service.list({});
      expect(result.map((g) => g.id)).toEqual(["a", "b"]);
    });
  });

  describe("checkServiceArea", () => {
    it("is permissive when no SERVICE_AREA zones exist at all", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(0) }]);

      const result = await service.checkServiceArea({ lat: 44.97, lng: -93.26 });

      expect(result).toEqual({ inServiceArea: true, zoneName: null, hasServiceAreaZones: false });
    });

    it("reports out-of-area when zones exist but none contain the point", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]).mockResolvedValueOnce([]);

      const result = await service.checkServiceArea({ lat: 0, lng: 0 });

      expect(result).toEqual({ inServiceArea: false, zoneName: null, hasServiceAreaZones: true });
    });

    it("reports the matching zone name when the point is contained", async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ count: BigInt(1) }]).mockResolvedValueOnce([{ name: "Metro Service Area" }]);

      const result = await service.checkServiceArea({ lat: 44.975, lng: -93.265 });

      expect(result).toEqual({ inServiceArea: true, zoneName: "Metro Service Area", hasServiceAreaZones: true });
    });
  });

  describe("update", () => {
    it("audit-logs which fields changed", async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([rawRow()]);
      prisma.$executeRaw.mockResolvedValue(1);

      await service.update("geo-1", { isActive: false }, actor);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "geofence.updated", targetId: "geo-1", metadata: { fields: ["isActive"] } }),
      );
    });
  });

  describe("remove", () => {
    it("deletes and audit-logs", async () => {
      prisma.$queryRawUnsafe.mockResolvedValueOnce([rawRow()]);
      prisma.$executeRaw.mockResolvedValueOnce(1);

      await service.remove("geo-1", actor);

      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
      expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: "geofence.deleted", targetId: "geo-1" }));
    });
  });
});
