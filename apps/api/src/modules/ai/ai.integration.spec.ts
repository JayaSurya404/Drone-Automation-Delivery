import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { resolveDeterministicDestination } from "../missions/route.util";
import { LocalWeatherProvider } from "../weather/providers/local-weather.provider";
import { buildOffsetDetour } from "./route-geo.util";

const DETOUR_OFFSETS_DEGREES = [0.01, -0.01, 0.02, -0.02];

function pointToSegmentDistance(p: { lat: number; lng: number }, a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const abLat = b.lat - a.lat;
  const abLng = b.lng - a.lng;
  const lenSq = abLat * abLat + abLng * abLng;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.lat - a.lat) * abLat + (p.lng - a.lng) * abLng) / lenSq));
  const closest = { lat: a.lat + abLat * t, lng: a.lng + abLng * t };
  return Math.hypot(p.lat - closest.lat, p.lng - closest.lng);
}

/**
 * Phase 9 — AI route optimization, ETA prediction, risk scoring, and the
 * risk-approval gate against real Postgres/PostGIS (geofence intersection is
 * the point of the route-optimization tests; unit tests only mock
 * `GeofencingService`). Uses a dedicated hub, offset just enough from the
 * real "HUB-DOWNTOWN" to get its own weather zone key (see
 * `geofencing.integration.spec.ts`'s `weatherHubId` for why a shared hub
 * would race against concurrently-running Jest workers) while staying
 * inside the seeded "Metro Service Area" so the destination service-area
 * check still passes. Run via `pnpm test:integration`.
 */
describe("AI route optimization, ETA, and risk (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let localWeatherProvider: LocalWeatherProvider;

  const suffix = Date.now();
  let customerId: string;
  let coordinatorId: string;
  let fleetManagerId: string;
  let officerId: string;
  let customerToken: string;
  let coordinatorToken: string;
  let fleetManagerToken: string;
  let officerToken: string;
  let addressId: string;
  let aiHubId: string;
  let aiHubCoords: { lat: number; lng: number };
  const createdProductIds: string[] = [];
  const createdDroneIds: string[] = [];
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

  async function createVariant(sku: string, stock: number, price: number) {
    const product = await prisma.product.create({
      data: { name: `AI Test ${sku}`, slug: `ai-test-${sku}-${suffix}`.toLowerCase(), basePrice: price },
    });
    createdProductIds.push(product.id);
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku, name: "Default" } });
    await prisma.inventoryItem.create({ data: { variantId: variant.id, hubId: aiHubId, quantityOnHand: stock, lowStockThreshold: 1 } });
    return variant.id;
  }

  async function createDrone(serialSuffix: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/drones")
      .set(auth(fleetManagerToken))
      .send({ serialNumber: `AI-TEST-${serialSuffix}-${suffix}`, name: `AI Test Drone ${serialSuffix}`, model: "SkyNav X1", homeHubId: aiHubId });
    expect(res.status).toBe(201);
    createdDroneIds.push(res.body.data.id);
    return res.body.data.id as string;
  }

  async function createDeliveryAtHubAssigned(sku: string, priority: "STANDARD" | "EXPRESS" = "STANDARD"): Promise<string> {
    const variantId = await createVariant(sku, 10, 9.99);
    await request(app.getHttpServer()).post("/api/v1/cart/items").set(auth(customerToken)).send({ variantId, quantity: 1 }).expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    const orderId = checkoutRes.body.data.id as string;
    const deliveryRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/by-order/${orderId}`).set(auth(customerToken));
    const deliveryId = deliveryRes.body.data.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/deliveries/${deliveryId}/assign-hub`)
      .set(auth(coordinatorToken))
      .send({ hubId: aiHubId, priority })
      .expect(201);
    return deliveryId;
  }

  async function createGeofence(name: string, type: "NO_FLY" | "RESTRICTED" | "SERVICE_AREA", points: Array<{ lat: number; lng: number }>) {
    const res = await request(app.getHttpServer()).post("/api/v1/geofences").set(auth(officerToken)).send({ name, type, points });
    expect(res.status).toBe(201);
    createdGeofenceIds.push(res.body.data.id);
    return res.body.data.id as string;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    localWeatherProvider = app.get(LocalWeatherProvider);

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({ sub: id, email: `${id}@example.com`, roles: [roleName], permissions: await rbacService.resolvePermissions([roleName]) });

    const customer = await prisma.user.create({ data: { email: `ai-cust-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const coordinator = await prisma.user.create({ data: { email: `ai-coord-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fleetManager = await prisma.user.create({ data: { email: `ai-fleet-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const officer = await prisma.user.create({ data: { email: `ai-officer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });

    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    const coordinatorRole = await prisma.role.findUniqueOrThrow({ where: { name: "delivery_coordinator" } });
    const fleetManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: "fleet_manager" } });
    const officerRole = await prisma.role.findUniqueOrThrow({ where: { name: "compliance_safety_officer" } });
    await prisma.userRole.createMany({
      data: [
        { userId: customer.id, roleId: customerRole.id },
        { userId: coordinator.id, roleId: coordinatorRole.id },
        { userId: fleetManager.id, roleId: fleetManagerRole.id },
        { userId: officer.id, roleId: officerRole.id },
      ],
    });

    customerId = customer.id;
    coordinatorId = coordinator.id;
    fleetManagerId = fleetManager.id;
    officerId = officer.id;
    customerToken = await mint(customer.id, "customer");
    coordinatorToken = await mint(coordinator.id, "delivery_coordinator");
    fleetManagerToken = await mint(fleetManager.id, "fleet_manager");
    officerToken = await mint(officer.id, "compliance_safety_officer");

    const downtownHub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    const [downtownCoords] = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM fulfillment_hubs WHERE id = ${downtownHub.id}
    `;

    // Offset from the real hub (own weather zone key, own geofence testing
    // area) while staying inside the seeded "Metro Service Area" (±0.05
    // degrees) even after `resolveDeterministicDestination`'s own up to
    // ±0.02 offset — same reasoning as `geofencing.integration.spec.ts`'s
    // `weatherHubCoords`, offset in the opposite direction so the two
    // suites' dedicated hubs never overlap.
    aiHubCoords = { lat: downtownCoords!.lat + 0.015, lng: downtownCoords!.lng + 0.015 };
    const aiHubCode = `AI-TEST-HUB-${suffix}`;
    await prisma.$executeRaw`
      INSERT INTO fulfillment_hubs (id, name, code, address, location, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'AI Test Hub', ${aiHubCode}, '1 AI Test Way',
        ST_SetSRID(ST_MakePoint(${aiHubCoords.lng}, ${aiHubCoords.lat}), 4326)::geography,
        true, now(), now()
      )
    `;
    const aiHub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: aiHubCode } });
    aiHubId = aiHub.id;

    const address = await prisma.customerAddress.create({
      data: { userId: customer.id, recipientName: "AI Tester", line1: "1 AI Test Ave", city: "Springfield", postalCode: "44444" },
    });
    addressId = address.id;
  });

  afterEach(async () => {
    const zoneKey = `geo:${aiHubCoords.lat.toFixed(2)}:${aiHubCoords.lng.toFixed(2)}`;
    localWeatherProvider.clearOverride(zoneKey);
    await prisma.weatherSnapshot.deleteMany({ where: { zoneKey } });
  });

  afterAll(async () => {
    for (const id of createdGeofenceIds) {
      await request(app.getHttpServer()).delete(`/api/v1/geofences/${id}`).set(auth(officerToken));
    }
    await prisma.telemetrySample.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.missionEvent.deleteMany({ where: { mission: { delivery: { order: { userId: customerId } } } } });
    await prisma.waypoint.deleteMany({ where: { mission: { delivery: { order: { userId: customerId } } } } });
    await prisma.mission.deleteMany({ where: { delivery: { order: { userId: customerId } } } });
    await prisma.deliveryEvent.deleteMany({ where: { delivery: { order: { userId: customerId } } } });
    await prisma.delivery.deleteMany({ where: { order: { userId: customerId } } });
    await prisma.paymentEvent.deleteMany({ where: { payment: { order: { userId: customerId } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: customerId } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: customerId } } });
    await prisma.order.deleteMany({ where: { userId: customerId } });
    await prisma.customerAddress.deleteMany({ where: { userId: customerId } });
    await prisma.batteryLog.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.droneHealthLog.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.drone.deleteMany({ where: { id: { in: createdDroneIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, coordinatorId, fleetManagerId, officerId] } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await prisma.fulfillmentHub.delete({ where: { id: aiHubId } });
    await app.close();
  });

  describe("route optimization routes around a geofence that blocks only the direct line", () => {
    it("selects a non-direct detour candidate and logs a ROUTE_OPTIMIZATION decision", async () => {
      const deliveryId = await createDeliveryAtHubAssigned(`DETOUR-${suffix}`);
      const destination = resolveDeterministicDestination(deliveryId, aiHubCoords);
      // The direct route's own fraction-0.4 waypoint sits exactly on the
      // straight line, so a box centered there always blocks the direct
      // candidate. Size the box's half-width from this specific delivery's
      // *actual* detour geometry (computed with the same `buildOffsetDetour`
      // production code the optimizer itself uses) rather than a hardcoded
      // guess, so it's provably smaller than every detour candidate's
      // closest approach — never dependent on `resolveDeterministicDestination`'s
      // pseudo-random direction happening to match a value precomputed by hand.
      const directFraction04 = { lat: aiHubCoords.lat + (destination.lat - aiHubCoords.lat) * 0.4, lng: aiHubCoords.lng + (destination.lng - aiHubCoords.lng) * 0.4 };
      const minDetourDistance = Math.min(
        ...DETOUR_OFFSETS_DEGREES.map((offset) => {
          const [detourOrigin, detourMidpoint, detourDestination] = buildOffsetDetour(aiHubCoords, destination, offset);
          return Math.min(
            pointToSegmentDistance(directFraction04, detourOrigin!, detourMidpoint!),
            pointToSegmentDistance(directFraction04, detourMidpoint!, detourDestination!),
          );
        }),
      );
      // Half the closest detour's minimum approach distance, divided again
      // by sqrt(2) so the square box's corners (not just its center) never
      // reach that closest point either.
      const halfWidth = minDetourDistance / 2 / Math.SQRT2;
      // Sanity check the geometry assumption still holds before trusting the
      // box — but only against near-zero/degenerate output (a real bug, e.g.
      // detour candidates collinear with the direct line), not a fixed
      // magnitude: `destination` is hashed from this test's own randomly
      // generated `deliveryId`, so `minDetourDistance` legitimately varies
      // run to run and occasionally undershot a hardcoded 0.0005 floor here,
      // which was a Phase 12 cross-suite-flake-hunt discovery — a flaky
      // sanity check, not a flaky product.
      expect(halfWidth).toBeGreaterThan(0.00001);
      const zoneId = await createGeofence(`Direct Blocker ${suffix}`, "NO_FLY", squareAround(directFraction04, halfWidth));

      try {
        const res = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
        expect(res.status).toBe(201);
        // The direct candidate has 3 waypoints (fractions 0.4/0.75/1.0); every detour candidate has exactly 1.
        expect(res.body.data.waypoints).toHaveLength(1);
        const missionId = res.body.data.id as string;

        const decisions = await request(app.getHttpServer()).get(`/api/v1/missions/${missionId}/ai`).set(auth(coordinatorToken));
        expect(decisions.status).toBe(200);
        const routeDecision = decisions.body.data.find((d: { type: string }) => d.type === "ROUTE_OPTIMIZATION");
        expect(routeDecision).toBeDefined();
        expect(routeDecision.outputs.selected.isDirect).toBe(false);
        expect(routeDecision.outputs.selected.geofenceCleared).toBe(true);

        const etaDecision = decisions.body.data.find((d: { type: string }) => d.type === "ETA_PREDICTION");
        expect(etaDecision).toBeDefined();
      } finally {
        await request(app.getHttpServer()).delete(`/api/v1/geofences/${zoneId}`).set(auth(officerToken));
      }
    });
  });

  describe("no feasible route", () => {
    it("blocks mission creation and emits no mission when the entire delivery area is a NO_FLY zone", async () => {
      const deliveryId = await createDeliveryAtHubAssigned(`NOROUTE-${suffix}`);
      // Containing the origin itself blocks every candidate route outright
      // (ST_Intersects only needs the route's start point inside the
      // polygon), so the zone only needs a small buffer around aiHubCoords —
      // NOT the wide 0.05deg half-width this used previously, which reached
      // all the way into the shared hub's and `weatherHubCoords`'s own
      // +/-0.02deg destination ranges (see geofencing.integration.spec.ts's
      // `weatherHubCoords`) and was a source of cross-suite Jest-worker
      // flakiness: this test's transient NO_FLY zone could spuriously block
      // an unrelated concurrently-running suite's mission creation.
      const zoneId = await createGeofence(`Total Blocker ${suffix}`, "NO_FLY", squareAround(aiHubCoords, 0.0005));

      try {
        const res = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
        expect(res.status).toBe(409);
        expect(res.body.error.message).toMatch(/no feasible route|restricted\/no-fly zone/i);

        const missions = await prisma.mission.findMany({ where: { deliveryId } });
        expect(missions).toHaveLength(0);
      } finally {
        await request(app.getHttpServer()).delete(`/api/v1/geofences/${zoneId}`).set(auth(officerToken));
      }
    });
  });

  describe("risk-approval gate", () => {
    it("requires operator approval before a high-risk mission can dispatch, then allows it once approved", async () => {
      const zoneKey = `geo:${aiHubCoords.lat.toFixed(2)}:${aiHubCoords.lng.toFixed(2)}`;
      // CAUTION-level weather (20/40 risk points) — a real condition the
      // deterministic local provider reports, not a fabricated risk score.
      localWeatherProvider.setOverride(zoneKey, { windSpeedMps: 2, condition: "FOG" });

      const droneId = await createDrone("RISKY");
      // Zero battery health (15/15 risk points) — a real degraded-drone
      // scenario, set the same way `missions.integration.spec.ts` sets a
      // drone's status directly for its own test setup.
      await prisma.drone.update({ where: { id: droneId }, data: { batteryHealthPercent: 0, batteryPercent: 15 } });

      const deliveryId = await createDeliveryAtHubAssigned(`RISKY-${suffix}`, "EXPRESS"); // +5 risk points
      const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
      expect(missionRes.status).toBe(201);
      const missionId = missionRes.body.data.id as string;

      const assignRes = await request(app.getHttpServer())
        .post(`/api/v1/missions/${missionId}/assign-drone`)
        .set(auth(coordinatorToken))
        .send({ droneId });
      expect(assignRes.status).toBe(201);
      // Weather CAUTION (20) + battery INSUFFICIENT at 15% (30) + battery
      // health 0% (15) + EXPRESS priority (5) = 70, at/above the default
      // HIGH threshold.
      expect(assignRes.body.data.riskLevel).toBe("HIGH");
      expect(assignRes.body.data.requiresApproval).toBe(true);
      expect(assignRes.body.data.riskScore).toBeGreaterThanOrEqual(70);

      const blockedStart = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});
      expect(blockedStart.status).toBe(409);
      expect(blockedStart.body.error.message).toMatch(/requires operator approval/i);

      const decisions = await request(app.getHttpServer()).get(`/api/v1/missions/${missionId}/ai`).set(auth(coordinatorToken));
      const riskDecision = decisions.body.data.find((d: { type: string }) => d.type === "RISK_ASSESSMENT");
      expect(riskDecision).toBeDefined();
      expect(riskDecision.outputs.level).toBe("HIGH");

      const approveRes = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/approve`).set(auth(coordinatorToken)).send({});
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.data.approvedAt).not.toBeNull();
      expect(approveRes.body.data.approvedById).toBe(coordinatorId);

      // Re-approving is rejected — approval is a one-time sign-off.
      const doubleApprove = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/approve`).set(auth(coordinatorToken)).send({});
      expect(doubleApprove.status).toBe(409);

      // Weather is only CAUTION (never UNSAFE), so the risk gate was the
      // only thing blocking dispatch — it now proceeds.
      const startRes = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});
      expect(startRes.status).toBe(201);
      expect(startRes.body.data.status).toBe("DISPATCHED");
    });
  });

  describe("drone recommendations", () => {
    it("ranks the eligible drone and exposes it via GET /missions/:id/ai/drone-recommendations", async () => {
      const droneId = await createDrone("RECOMMEND");
      const deliveryId = await createDeliveryAtHubAssigned(`RECOMMEND-${suffix}`);
      const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
      expect(missionRes.status).toBe(201);
      const missionId = missionRes.body.data.id as string;

      const recRes = await request(app.getHttpServer()).get(`/api/v1/missions/${missionId}/ai/drone-recommendations`).set(auth(coordinatorToken));
      expect(recRes.status).toBe(200);
      const recommended = recRes.body.data.find((r: { droneId: string }) => r.droneId === droneId);
      expect(recommended).toBeDefined();
      expect(recommended.eligible).toBe(true);
      expect(recommended.score).toBeGreaterThan(0);
    });
  });
});
