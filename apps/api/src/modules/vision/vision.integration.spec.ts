import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { bestLandingZoneCandidate, frameSeed, synthesizeDetections, synthesizeLandingZoneCandidates, isObstructed, hasHumanDetection } from "./vision.util";

/**
 * Phase 11 Part 1/2 — computer vision + landing-zone intelligence against
 * real Postgres/PostGIS. Uses a dedicated synthetic coordinate far from any
 * shared hub (same isolation strategy `geofencing.integration.spec.ts`
 * pioneered for its own temporary zones) so this suite's NO_FLY geofence
 * can never interact with a concurrently-running suite's mission/delivery
 * destinations. Detection content is verified by importing the exact same
 * deterministic pure functions the adapter uses (`vision.util.ts`) and
 * computing the expected output directly, the same "hand-verify via the
 * real pure function" technique `analytics.integration.spec.ts` uses for
 * `pathLengthMeters`.
 */
describe("Computer vision & landing-zone intelligence (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const CENTER = { lat: 9.5, lng: 12.5 }; // dedicated synthetic point, far from any seeded/shared hub
  let fleetManagerToken: string;
  let customerToken: string;
  let droneId: string;
  const createdGeofenceIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function squareAround(center: { lat: number; lng: number }, halfWidth: number) {
    return [
      { lat: center.lat - halfWidth, lng: center.lng - halfWidth },
      { lat: center.lat - halfWidth, lng: center.lng + halfWidth },
      { lat: center.lat + halfWidth, lng: center.lng + halfWidth },
      { lat: center.lat + halfWidth, lng: center.lng - halfWidth },
    ];
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

    const fleetManager = await prisma.user.create({ data: { email: `vision-fm-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const customer = await prisma.user.create({ data: { email: `vision-customer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fleetManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: "fleet_manager" } });
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    await prisma.userRole.createMany({
      data: [
        { userId: fleetManager.id, roleId: fleetManagerRole.id },
        { userId: customer.id, roleId: customerRole.id },
      ],
    });
    fleetManagerToken = await mint(fleetManager.id, "fleet_manager");
    customerToken = await mint(customer.id, "customer");

    const drone = await prisma.drone.create({
      data: { serialNumber: `VISION-TEST-${suffix}`, name: "Vision Test Drone", model: "SkyNav X1", status: "IDLE" },
    });
    droneId = drone.id;
  });

  afterAll(async () => {
    await prisma.landingZoneEvaluation.deleteMany({ where: { visionAnalysis: { droneId } } });
    await prisma.visionAnalysis.deleteMany({ where: { droneId } });
    await prisma.geofence.deleteMany({ where: { id: { in: createdGeofenceIds } } });
    await prisma.drone.delete({ where: { id: droneId } });
    await prisma.user.deleteMany({ where: { email: { contains: `${suffix}@example.com` } } });
    await app.close();
  });

  describe("RBAC", () => {
    it("rejects an unauthenticated request", async () => {
      const res = await request(app.getHttpServer()).post("/api/v1/vision/analyze").send({ lat: CENTER.lat, lng: CENTER.lng });
      expect(res.status).toBe(401);
    });

    it("rejects a customer (no vision.analyze permission)", async () => {
      const res = await request(app.getHttpServer()).post("/api/v1/vision/analyze").set(auth(customerToken)).send({ lat: CENTER.lat, lng: CENTER.lng });
      expect(res.status).toBe(403);
    });
  });

  describe("vision analysis", () => {
    it("analyzes a frame deterministically, matching the pure synthesizer exactly", async () => {
      const lat = CENTER.lat + 0.001;
      const lng = CENTER.lng + 0.001;
      const altitudeMeters = 30;
      const seed = frameSeed(droneId, lat, lng, altitudeMeters);
      const expectedObjects = synthesizeDetections(seed);
      const expectedCandidates = synthesizeLandingZoneCandidates(seed, lat, lng);

      const res = await request(app.getHttpServer()).post("/api/v1/vision/analyze").set(auth(fleetManagerToken)).send({ droneId, lat, lng, altitudeMeters });
      expect(res.status).toBe(201);
      expect(res.body.data.objects).toEqual(expectedObjects);
      expect(res.body.data.landingZoneCandidates).toEqual(expectedCandidates);
      expect(res.body.data.obstructed).toBe(isObstructed(expectedObjects));
      expect(res.body.data.humanDetected).toBe(hasHumanDetection(expectedObjects));
      expect(res.body.data.modelProvider).toBe("SIMULATED");

      const dbRow = await prisma.visionAnalysis.findUnique({ where: { id: res.body.data.id } });
      expect(dbRow).not.toBeNull();
      expect(dbRow?.landingZoneCandidateCount).toBe(expectedCandidates.length);
    });

    it("returns the same detections for a repeated identical request (no wall-clock/random dependency)", async () => {
      const lat = CENTER.lat + 0.002;
      const lng = CENTER.lng + 0.002;
      const first = await request(app.getHttpServer()).post("/api/v1/vision/analyze").set(auth(fleetManagerToken)).send({ droneId, lat, lng, altitudeMeters: 30 });
      const second = await request(app.getHttpServer()).post("/api/v1/vision/analyze").set(auth(fleetManagerToken)).send({ droneId, lat, lng, altitudeMeters: 30 });
      expect(first.body.data.objects).toEqual(second.body.data.objects);
      expect(first.body.data.obstructed).toBe(second.body.data.obstructed);
    });

    it("lists recent analyses", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/vision/analyses?limit=50").set(auth(fleetManagerToken));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe("landing-zone evaluation", () => {
    it("scores an open zone with no geofence conflict as fully safe (safetyScore 100)", async () => {
      const lat = CENTER.lat + 0.01;
      const lng = CENTER.lng + 0.01;
      const seed = frameSeed(droneId, lat, lng, 30);
      const expectedCandidate = bestLandingZoneCandidate(synthesizeLandingZoneCandidates(seed, lat, lng));

      const res = await request(app.getHttpServer()).post("/api/v1/vision/landing-zones/evaluate").set(auth(fleetManagerToken)).send({ droneId, lat, lng });
      expect(res.status).toBe(201);
      expect(res.body.data.safetyScore).toBe(100);
      expect(res.body.data.radiusMeters).toBe(expectedCandidate?.radiusMeters ?? 0);
      expect(["SUITABLE", "MARGINAL", "UNSUITABLE"]).toContain(res.body.data.verdict);
      expect(res.body.data.navigationHint.recommendation).toMatch(/PROCEED|HOLD|ABORT_LANDING/);
    });

    it("never bypasses geofencing — a NO_FLY zone forces UNSUITABLE regardless of clearance", async () => {
      const zoneCenter = { lat: CENTER.lat + 0.05, lng: CENTER.lng + 0.05 };
      const geofenceRes = await request(app.getHttpServer())
        .post("/api/v1/geofences")
        .set(auth(fleetManagerToken))
        .send({ name: `Vision Test NO_FLY ${suffix}`, type: "NO_FLY", points: squareAround(zoneCenter, 0.01) });
      // Fleet Manager doesn't have geofencing.update in the seeded matrix — expect 403 there instead, and use a role that does.
      if (geofenceRes.status === 403) {
        const officer = await prisma.user.create({ data: { email: `vision-officer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
        const officerRole = await prisma.role.findUniqueOrThrow({ where: { name: "compliance_safety_officer" } });
        await prisma.userRole.create({ data: { userId: officer.id, roleId: officerRole.id } });
        const rbacService = app.get(RbacService);
        const officerToken = await jwtService.signAsync({
          sub: officer.id,
          email: officer.email,
          roles: ["compliance_safety_officer"],
          permissions: await rbacService.resolvePermissions(["compliance_safety_officer"]),
        });
        const retry = await request(app.getHttpServer())
          .post("/api/v1/geofences")
          .set(auth(officerToken))
          .send({ name: `Vision Test NO_FLY ${suffix}`, type: "NO_FLY", points: squareAround(zoneCenter, 0.01) });
        expect(retry.status).toBe(201);
        createdGeofenceIds.push(retry.body.data.id);
      } else {
        expect(geofenceRes.status).toBe(201);
        createdGeofenceIds.push(geofenceRes.body.data.id);
      }

      const res = await request(app.getHttpServer())
        .post("/api/v1/vision/landing-zones/evaluate")
        .set(auth(fleetManagerToken))
        .send({ droneId, lat: zoneCenter.lat, lng: zoneCenter.lng });
      expect(res.status).toBe(201);
      expect(res.body.data.safetyScore).toBe(0);
      expect(res.body.data.verdict).toBe("UNSUITABLE");
      expect(res.body.data.navigationHint.recommendation).toBe("ABORT_LANDING");
    });

    it("computes proximity score relative to an explicit target point", async () => {
      const lat = CENTER.lat + 0.02;
      const lng = CENTER.lng + 0.02;
      const res = await request(app.getHttpServer())
        .post("/api/v1/vision/landing-zones/evaluate")
        .set(auth(fleetManagerToken))
        .send({ droneId, lat, lng, targetLat: lat, targetLng: lng });
      expect(res.status).toBe(201);
      expect(res.body.data.proximityScore).toBe(100);
    });

    it("lists recent landing-zone evaluations", async () => {
      const res = await request(app.getHttpServer()).get("/api/v1/vision/landing-zones?limit=50").set(auth(fleetManagerToken));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });
  });
});
