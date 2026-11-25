import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { pathLengthMeters } from "../ai/route-geo.util";

/**
 * Phase 10 — analytics KPI correctness against real Postgres, using fixed,
 * hand-computable fixtures (the phase's own "fixed deterministic fixtures"
 * requirement). Every fixture row is inserted directly via Prisma (not
 * through the real checkout/mission-lifecycle HTTP flow the other
 * integration suites use) specifically so every timestamp can be pinned
 * exactly — the real API flow always stamps `createdAt`/`plannedAt` with
 * `now()`, which would make hand-computing an expected average duration
 * impossible. All fixture timestamps live inside a single fixed historical
 * window (`2020-06-01T00:00:00Z` + a couple of minutes) that no seed data,
 * simulator, or any other concurrently-running integration suite ever
 * writes into — every date-range-bound query in this file is therefore
 * exactly deterministic even when the full suite runs in parallel. Only the
 * handful of genuinely global, non-date-bound snapshot fields (fleet-wide
 * drone totals, low-stock item count) are asserted as lower bounds instead
 * of exact equality, since those legitimately reflect the whole shared
 * database, not just this suite's fixtures.
 */
describe("Analytics KPIs (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  const WINDOW_FROM = new Date("2020-06-01T00:00:00.000Z");
  const WINDOW_TO = new Date("2020-06-01T02:00:00.000Z");
  const T0 = WINDOW_FROM.getTime();
  const at = (offsetSeconds: number) => new Date(T0 + offsetSeconds * 1000);

  let analystToken: string;
  let customerToken: string;
  let userId: string;
  let hubId: string;
  let hubCoords: { lat: number; lng: number };
  let droneId: string;
  const createdOrderIds: string[] = [];
  const createdDeliveryIds: string[] = [];
  const createdMissionIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function rangeQuery() {
    return `from=${encodeURIComponent(WINDOW_FROM.toISOString())}&to=${encodeURIComponent(WINDOW_TO.toISOString())}`;
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

    const user = await prisma.user.create({ data: { email: `analytics-user-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const analyst = await prisma.user.create({ data: { email: `analytics-analyst-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const customer = await prisma.user.create({ data: { email: `analytics-customer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    userId = user.id;

    const analystRole = await prisma.role.findUniqueOrThrow({ where: { name: "analyst" } });
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    await prisma.userRole.createMany({
      data: [
        { userId: analyst.id, roleId: analystRole.id },
        { userId: customer.id, roleId: customerRole.id },
      ],
    });
    analystToken = await mint(analyst.id, "analyst");
    customerToken = await mint(customer.id, "customer");

    const hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    hubId = hub.id;
    const [coords] = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM fulfillment_hubs WHERE id = ${hub.id}
    `;
    hubCoords = coords as { lat: number; lng: number };

    const drone = await prisma.drone.create({
      data: {
        serialNumber: `ANALYTICS-TEST-${suffix}`,
        name: "Analytics Test Drone",
        model: "SkyNav X1",
        homeHubId: hubId,
        status: "IDLE",
      },
    });
    droneId = drone.id;

    // --- Order 1 -> Delivery 1 -> Mission 1 (COMPLETED end to end) --------
    const order1 = await prisma.order.create({
      data: {
        orderNumber: `ANALYTICS-1-${suffix}`,
        userId,
        status: "CONFIRMED",
        shippingAddress: {},
        subtotal: 100,
        totalAmount: 100,
        createdAt: at(0),
      },
    });
    createdOrderIds.push(order1.id);
    await prisma.payment.create({ data: { orderId: order1.id, provider: "SIMULATED", status: "SUCCEEDED", amount: 100, createdAt: at(0) } });
    const delivery1 = await prisma.delivery.create({
      data: {
        orderId: order1.id,
        hubId,
        status: "COMPLETED",
        deliveryAddress: {},
        estimatedDeliveryAt: at(300),
        createdAt: at(0),
      },
    });
    createdDeliveryIds.push(delivery1.id);
    await prisma.deliveryEvent.create({ data: { deliveryId: delivery1.id, toStatus: "COMPLETED", createdAt: at(480) } }); // 480s delivery time, 180s late vs the 300s estimate

    const destination1 = { lat: hubCoords.lat + 0.01, lng: hubCoords.lng + 0.008 };
    const waypoint1 = { lat: hubCoords.lat + 0.005, lng: hubCoords.lng + 0.004, altitudeMeters: 60 };
    const mission1 = await prisma.mission.create({
      data: {
        deliveryId: delivery1.id,
        droneId,
        status: "COMPLETED",
        riskScore: 25,
        riskLevel: "LOW",
        requiresApproval: false,
        originLat: hubCoords.lat,
        originLng: hubCoords.lng,
        destinationLat: destination1.lat,
        destinationLng: destination1.lng,
        plannedAt: at(10),
        startedAt: at(40), // dispatch time 30s
        completedAt: at(220), // mission duration 180s
        createdAt: at(10),
      },
    });
    createdMissionIds.push(mission1.id);
    await prisma.waypoint.create({ data: { missionId: mission1.id, sequence: 1, lat: waypoint1.lat, lng: waypoint1.lng, status: "REACHED" } });
    await prisma.batteryLog.createMany({
      data: [
        { droneId, batteryPercent: 100, recordedAt: at(40) },
        { droneId, batteryPercent: 80, recordedAt: at(220) },
      ],
    });
    await prisma.aiDecisionLog.createMany({
      data: [
        { type: "ROUTE_OPTIMIZATION", deliveryId: delivery1.id, missionId: mission1.id, summary: "test", inputs: {}, outputs: {}, score: 1000, createdAt: at(5) },
        { type: "ETA_PREDICTION", deliveryId: delivery1.id, missionId: mission1.id, summary: "test", inputs: {}, outputs: {}, score: 300, createdAt: at(6) },
        { type: "RISK_ASSESSMENT", deliveryId: delivery1.id, missionId: mission1.id, summary: "test", inputs: {}, outputs: { level: "LOW" }, score: 25, createdAt: at(7) },
        { type: "DRONE_RECOMMENDATION", deliveryId: delivery1.id, missionId: mission1.id, summary: "test", inputs: {}, outputs: {}, score: 90, createdAt: at(8) },
      ],
    });

    // --- Order 2 -> Delivery 2 (COMPLETED, no mission) ---------------------
    const order2 = await prisma.order.create({
      data: { orderNumber: `ANALYTICS-2-${suffix}`, userId, status: "CONFIRMED", shippingAddress: {}, subtotal: 50, totalAmount: 50, createdAt: at(60) },
    });
    createdOrderIds.push(order2.id);
    await prisma.payment.create({ data: { orderId: order2.id, provider: "SIMULATED", status: "SUCCEEDED", amount: 50, createdAt: at(60) } });
    const delivery2 = await prisma.delivery.create({
      data: { orderId: order2.id, hubId, status: "COMPLETED", deliveryAddress: {}, estimatedDeliveryAt: at(660), createdAt: at(60) },
    });
    createdDeliveryIds.push(delivery2.id);
    await prisma.deliveryEvent.create({ data: { deliveryId: delivery2.id, toStatus: "COMPLETED", createdAt: at(420) } }); // 360s delivery time, not late

    // --- Order 3 (CANCELLED, no delivery) -----------------------------------
    const order3 = await prisma.order.create({
      data: { orderNumber: `ANALYTICS-3-${suffix}`, userId, status: "CANCELLED", shippingAddress: {}, subtotal: 30, totalAmount: 30, createdAt: at(120) },
    });
    createdOrderIds.push(order3.id);
    await prisma.payment.create({ data: { orderId: order3.id, provider: "SIMULATED", status: "FAILED", amount: 30, createdAt: at(120) } });

    // --- Order 4 -> Delivery 4 -> Mission 4 (ABORTED, EMERGENCY) -----------
    const order4 = await prisma.order.create({
      data: { orderNumber: `ANALYTICS-4-${suffix}`, userId, status: "CONFIRMED", shippingAddress: {}, subtotal: 75, totalAmount: 75, createdAt: at(180) },
    });
    createdOrderIds.push(order4.id);
    await prisma.payment.create({ data: { orderId: order4.id, provider: "SIMULATED", status: "SUCCEEDED", amount: 75, createdAt: at(180) } });
    const delivery4 = await prisma.delivery.create({
      data: { orderId: order4.id, hubId, status: "RETURNED_TO_HUB", deliveryAddress: {}, createdAt: at(180) },
    });
    createdDeliveryIds.push(delivery4.id);
    const mission4 = await prisma.mission.create({
      data: {
        deliveryId: delivery4.id,
        droneId,
        status: "ABORTED",
        safetyState: "EMERGENCY",
        riskScore: 85,
        riskLevel: "HIGH",
        requiresApproval: true,
        originLat: hubCoords.lat,
        originLng: hubCoords.lng,
        destinationLat: hubCoords.lat + 0.01,
        destinationLng: hubCoords.lng + 0.01,
        plannedAt: at(190),
        startedAt: at(200), // dispatch time 10s
        abortedAt: at(260),
        abortReason: "Simulated emergency (crash)",
        createdAt: at(190),
      },
    });
    createdMissionIds.push(mission4.id);
    await prisma.missionEvent.createMany({
      data: [
        { missionId: mission4.id, type: "weather_unsafe", createdAt: at(210) },
        { missionId: mission4.id, type: "geofence_violation", createdAt: at(215) },
        { missionId: mission4.id, type: "rth_triggered", createdAt: at(220) },
        { missionId: mission4.id, type: "aborted", createdAt: at(260) },
      ],
    });
    await prisma.aiDecisionLog.createMany({
      data: [
        { type: "RISK_ASSESSMENT", deliveryId: delivery4.id, missionId: mission4.id, summary: "test", inputs: {}, outputs: { level: "HIGH" }, score: 85, createdAt: at(195) },
        { type: "DRONE_RECOMMENDATION", deliveryId: delivery4.id, missionId: mission4.id, summary: "test", inputs: {}, outputs: {}, score: null, createdAt: at(196) },
        { type: "REROUTE", deliveryId: delivery4.id, missionId: mission4.id, summary: "test", inputs: {}, outputs: {}, score: 500, createdAt: at(216) },
      ],
    });
  });

  afterAll(async () => {
    await prisma.aiDecisionLog.deleteMany({ where: { deliveryId: { in: createdDeliveryIds } } });
    await prisma.missionEvent.deleteMany({ where: { missionId: { in: createdMissionIds } } });
    await prisma.waypoint.deleteMany({ where: { missionId: { in: createdMissionIds } } });
    await prisma.batteryLog.deleteMany({ where: { droneId } });
    await prisma.mission.deleteMany({ where: { id: { in: createdMissionIds } } });
    await prisma.deliveryEvent.deleteMany({ where: { deliveryId: { in: createdDeliveryIds } } });
    await prisma.delivery.deleteMany({ where: { id: { in: createdDeliveryIds } } });
    await prisma.paymentEvent.deleteMany({ where: { payment: { orderId: { in: createdOrderIds } } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
    await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    await prisma.drone.delete({ where: { id: droneId } });
    await prisma.user.deleteMany({ where: { email: { contains: `analytics-`, mode: "insensitive" }, id: { in: [userId] } } });
    await app.close();
  });

  it("rejects an unauthenticated request and a plain customer", async () => {
    expect((await request(app.getHttpServer()).get(`/api/v1/analytics/dashboard`)).status).toBe(401);
    expect((await request(app.getHttpServer()).get(`/api/v1/analytics/dashboard`).set(auth(customerToken))).status).toBe(403);
  });

  it("computes order analytics exactly from the fixed fixtures", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/orders?${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalOrders).toBe(4);
    expect(data.completedOrders).toBe(3);
    expect(data.cancelledOrders).toBe(1);
    expect(data.cancellationRate).toBe(25);
    expect(data.paymentSucceeded).toBe(3);
    expect(data.paymentFailed).toBe(1);
    expect(data.averageOrderValue).toBe(75);
    expect(data.totalRevenue).toBe(225);
  });

  it("computes delivery analytics exactly, including delay detection against the AI-predicted ETA", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/deliveries?${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalDeliveries).toBe(3);
    expect(data.completedDeliveries).toBe(2);
    expect(data.averageDeliveryTimeSeconds).toBe(420); // avg(480, 360)
    expect(data.delayedDeliveries).toBe(1);
    expect(data.averageDelaySeconds).toBe(180);
    const hubRow = data.hubBreakdown.find((row: { hubId: string }) => row.hubId === hubId);
    expect(hubRow?.count).toBe(3); // delivery1, delivery2, delivery4 all carry this hub
  });

  it("computes fleet analytics exactly for the date-bound fields, including real flown distance and battery drop", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/fleet?${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalMissions).toBe(2);
    expect(data.completedMissions).toBe(1);
    expect(data.abortedMissions).toBe(1);
    expect(data.averageDispatchTimeSeconds).toBe(20); // avg(30, 10)
    expect(data.averageMissionDurationSeconds).toBe(180); // only mission1 has completedAt
    expect(data.battery.averageDropPercentPerMission).toBe(20);
    expect(data.battery.sampledMissionCount).toBe(1);

    const expectedDistanceKm =
      pathLengthMeters([
        { lat: hubCoords.lat, lng: hubCoords.lng },
        { lat: hubCoords.lat + 0.005, lng: hubCoords.lng + 0.004 },
        { lat: hubCoords.lat + 0.01, lng: hubCoords.lng + 0.008 },
      ]) / 1000;
    expect(data.distanceFlownKm).toBeCloseTo(expectedDistanceKm, 2);
    expect(data.averageDistancePerMissionKm).toBeCloseTo(expectedDistanceKm, 2);
    expect(data.costPerDeliveryUsd).toBeCloseTo(1.5 + expectedDistanceKm * 0.35, 2);

    // Fleet-wide totals are global (shared DB, other suites' drones count too) — only a lower bound is safe to assert.
    expect(data.droneUtilization.activeDroneCount).toBe(1); // only this suite's drone has a mission in this unique historical window
    expect(data.fleetAvailability.totalDrones).toBeGreaterThanOrEqual(1);
  });

  it("computes safety analytics exactly from the fixed mission-event/mission fixtures", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/safety?${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.weatherRelatedEvents).toBe(1);
    expect(data.geofenceBlocks).toBe(1);
    expect(data.rthEvents).toBe(1);
    expect(data.missionAborts).toBe(1);
    expect(data.emergencyEvents).toBe(1);
    expect(data.safetyStateBreakdown.EMERGENCY).toBe(1);
    expect(data.safetyStateBreakdown.NOMINAL).toBe(1);
  });

  it("computes AI analytics exactly from the fixed AiDecisionLog/Mission fixtures", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/ai?${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.decisionsByType).toEqual({ ROUTE_OPTIMIZATION: 1, ETA_PREDICTION: 1, RISK_ASSESSMENT: 2, DRONE_RECOMMENDATION: 2, REROUTE: 1 });
    expect(data.averageRiskScore).toBe(55); // avg(25, 85)
    expect(data.riskLevelBreakdown).toEqual({ LOW: 1, HIGH: 1 });
    expect(data.missionsRequiringApproval).toBe(1);
    expect(data.missionsApproved).toBe(0);
    expect(data.approvalRate).toBe(0);
    expect(data.rerouteCount).toBe(1);
    expect(data.droneRecommendationsWithEligibleDrone).toBe(1);
    expect(data.droneRecommendationsWithNoEligibleDrone).toBe(1);
  });

  it("buckets the trends endpoint into a single day for this fixture window", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/trends?metric=orders&${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ date: "2020-06-01", count: 4 }]);
  });

  it("returns nulls (not fabricated zeros) for rate/average fields when a narrower sub-window has zero matching records", async () => {
    const emptyFrom = encodeURIComponent(at(1000).toISOString());
    const emptyTo = encodeURIComponent(at(2000).toISOString());
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/orders?from=${emptyFrom}&to=${emptyTo}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalOrders).toBe(0);
    expect(data.cancellationRate).toBeNull();
    expect(data.averageOrderValue).toBeNull();
    expect(data.totalRevenue).toBe(0);
  });

  it("rejects a custom date range wider than the maximum allowed", async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/analytics/orders?from=2000-01-01T00:00:00.000Z&to=2020-01-01T00:00:00.000Z`)
      .set(auth(analystToken));
    expect(res.status).toBe(400);
  });

  it("serves the dashboard summary with the same date-bound figures", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/analytics/dashboard?${rangeQuery()}`).set(auth(analystToken));
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalOrders).toBe(4);
    expect(data.completedOrders).toBe(3);
    expect(data.cancelledOrders).toBe(1);
    expect(data.averageDeliveryTimeSeconds).toBe(420);
  });
});
