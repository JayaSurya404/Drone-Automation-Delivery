import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { haversineMeters } from "../ai/route-geo.util";

/**
 * Phase 11 Part 8 — shared route intelligence, derived live from real
 * `Mission`/`MissionEvent`/`BatteryLog` rows (no new table). Fixtures use
 * *recent* timestamps (not the fixed-2020 window `analytics.integration.spec.ts`
 * uses) because `RouteIntelligenceService`'s lookback window is a rolling
 * "last N days from now," not a caller-supplied date range — isolation from
 * other concurrently-running suites instead comes from a dedicated
 * synthetic corridor coordinate no other suite/seed data ever touches.
 */
describe("Shared route intelligence (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const ORIGIN = { lat: -33.5, lng: 151.5 }; // dedicated synthetic corridor
  const DESTINATION = { lat: -33.51, lng: 151.51 };
  const FAR_AWAY = { lat: 60, lng: 20 };
  let fleetManagerToken: string;
  let customerToken: string;
  let droneId: string;
  const createdMissionIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({ sub: id, email: `${id}@example.com`, roles: [roleName], permissions: await rbacService.resolvePermissions([roleName]) });

    const fleetManager = await prisma.user.create({ data: { email: `routeintel-fm-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const customer = await prisma.user.create({ data: { email: `routeintel-customer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fmRole = await prisma.role.findUniqueOrThrow({ where: { name: "fleet_manager" } });
    const custRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    await prisma.userRole.createMany({
      data: [
        { userId: fleetManager.id, roleId: fmRole.id },
        { userId: customer.id, roleId: custRole.id },
      ],
    });
    fleetManagerToken = await mint(fleetManager.id, "fleet_manager");
    customerToken = await mint(customer.id, "customer");

    const orderOwner = await prisma.user.create({ data: { email: `routeintel-owner-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });

    const drone = await prisma.drone.create({
      data: { serialNumber: `ROUTEINTEL-${suffix}`, name: "Route Intel Test Drone", model: "SkyNav X1", status: "IDLE" },
    });
    droneId = drone.id;

    const now = Date.now();
    const at = (offsetSeconds: number) => new Date(now + offsetSeconds * 1000);

    // Mission 1: COMPLETED, 200s duration.
    const m1 = await prisma.mission.create({
      data: {
        deliveryId: (await prisma.delivery.create({ data: { order: { create: { orderNumber: `RI-1-${suffix}`, userId: orderOwner.id, shippingAddress: {}, subtotal: 10, totalAmount: 10 } }, deliveryAddress: {}, status: "COMPLETED" } })).id,
        droneId,
        status: "COMPLETED",
        originLat: ORIGIN.lat,
        originLng: ORIGIN.lng,
        destinationLat: DESTINATION.lat,
        destinationLng: DESTINATION.lng,
        startedAt: at(-1000),
        completedAt: at(-800), // 200s duration
      },
    });
    createdMissionIds.push(m1.id);
    await prisma.batteryLog.createMany({
      data: [
        { droneId, batteryPercent: 100, recordedAt: at(-1000) },
        { droneId, batteryPercent: 85, recordedAt: at(-800) },
      ],
    });

    // Mission 2: COMPLETED, 300s duration.
    const m2 = await prisma.mission.create({
      data: {
        deliveryId: (await prisma.delivery.create({ data: { order: { create: { orderNumber: `RI-2-${suffix}`, userId: orderOwner.id, shippingAddress: {}, subtotal: 10, totalAmount: 10 } }, deliveryAddress: {}, status: "COMPLETED" } })).id,
        droneId,
        status: "COMPLETED",
        originLat: ORIGIN.lat + 0.0001,
        originLng: ORIGIN.lng + 0.0001,
        destinationLat: DESTINATION.lat + 0.0001,
        destinationLng: DESTINATION.lng + 0.0001,
        startedAt: at(-600),
        completedAt: at(-300), // 300s duration
      },
    });
    createdMissionIds.push(m2.id);

    // Mission 3: ABORTED, with a hazard event.
    const m3 = await prisma.mission.create({
      data: {
        deliveryId: (await prisma.delivery.create({ data: { order: { create: { orderNumber: `RI-3-${suffix}`, userId: orderOwner.id, shippingAddress: {}, subtotal: 10, totalAmount: 10 } }, deliveryAddress: {}, status: "RETURNED_TO_HUB" } })).id,
        droneId,
        status: "ABORTED",
        originLat: ORIGIN.lat - 0.0001,
        originLng: ORIGIN.lng - 0.0001,
        destinationLat: DESTINATION.lat - 0.0001,
        destinationLng: DESTINATION.lng - 0.0001,
        startedAt: at(-200),
        abortedAt: at(-100),
      },
    });
    createdMissionIds.push(m3.id);
    await prisma.missionEvent.create({ data: { missionId: m3.id, type: "geofence_violation", createdAt: at(-150) } });
  });

  afterAll(async () => {
    await prisma.missionEvent.deleteMany({ where: { missionId: { in: createdMissionIds } } });
    await prisma.batteryLog.deleteMany({ where: { droneId } });
    const missions = await prisma.mission.findMany({ where: { id: { in: createdMissionIds } }, select: { deliveryId: true } });
    await prisma.mission.deleteMany({ where: { id: { in: createdMissionIds } } });
    await prisma.delivery.deleteMany({ where: { id: { in: missions.map((m) => m.deliveryId) } } });
    await prisma.order.deleteMany({ where: { orderNumber: { contains: `-${suffix}` } } });
    await prisma.drone.delete({ where: { id: droneId } });
    await prisma.user.deleteMany({ where: { email: { contains: `${suffix}@example.com` } } });
    await app.close();
  });

  function query(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }) {
    return `originLat=${origin.lat}&originLng=${origin.lng}&destinationLat=${destination.lat}&destinationLng=${destination.lng}`;
  }

  describe("RBAC", () => {
    it("rejects an unauthenticated request", async () => {
      expect((await request(app.getHttpServer()).get(`/api/v1/route-intelligence?${query(ORIGIN, DESTINATION)}`)).status).toBe(401);
    });

    it("rejects a customer (no route_intel.read permission)", async () => {
      expect((await request(app.getHttpServer()).get(`/api/v1/route-intelligence?${query(ORIGIN, DESTINATION)}`).set(auth(customerToken))).status).toBe(403);
    });
  });

  describe("observations", () => {
    it("aggregates real historical missions near the requested corridor", async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/route-intelligence?${query(ORIGIN, DESTINATION)}`).set(auth(fleetManagerToken));
      expect(res.status).toBe(200);
      expect(res.body.data.sampleSize).toBe(3);
      expect(res.body.data.abortCount).toBe(1);
      expect(res.body.data.abortRate).toBeCloseTo(33.33, 1);
      expect(res.body.data.averageDurationSeconds).toBe(250); // (200 + 300) / 2, aborted mission excluded
      expect(res.body.data.averageBatteryDropPercent).toBe(15); // only mission 1 has battery logs: 100 -> 85
      expect(res.body.data.averageDistanceMeters).toBeCloseTo(haversineMeters(ORIGIN, DESTINATION), -1);
      expect(res.body.data.hazardBreakdown.geofence_violation).toBe(1);
    });

    it("returns null averages and zero sample size for a corridor with no history", async () => {
      const res = await request(app.getHttpServer()).get(`/api/v1/route-intelligence?${query(FAR_AWAY, { lat: FAR_AWAY.lat + 0.01, lng: FAR_AWAY.lng + 0.01 })}`).set(auth(fleetManagerToken));
      expect(res.status).toBe(200);
      expect(res.body.data.sampleSize).toBe(0);
      expect(res.body.data.averageDistanceMeters).toBeNull();
      expect(res.body.data.averageDurationSeconds).toBeNull();
      expect(res.body.data.averageBatteryDropPercent).toBeNull();
      expect(res.body.data.abortRate).toBeNull();
      expect(res.body.data.hazardBreakdown).toEqual({});
    });

    it("rejects a request missing required coordinates", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/route-intelligence?originLat=1").set(auth(fleetManagerToken));
      expect(res.status).toBe(400);
    });
  });
});
