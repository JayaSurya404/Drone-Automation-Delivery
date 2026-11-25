import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";
import { SimulatedDroneAdapter } from "../drones/adapters/simulated-drone.adapter";

/**
 * Full Phase 6 round trip against real Postgres/Redis: hub-assigned delivery
 * -> mission creation -> drone assignment -> dispatch -> simulated flight
 * (deterministic ticks via `POST /missions/:id/progress`) -> arrival ->
 * reactive delivery transition to DELIVERED_PENDING_VERIFICATION -> OTP
 * verification -> COMPLETED; plus RBAC, drone-availability validation,
 * low-battery-triggered RTH, operator override, and the telemetry-ingest
 * service-auth endpoint. Run via `pnpm test:integration`.
 */
describe("Drone & fleet management (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let simulatedAdapter: SimulatedDroneAdapter;

  const suffix = Date.now();
  let customerId: string;
  let coordinatorId: string;
  let fleetManagerId: string;
  let operatorId: string;
  let customerToken: string;
  let coordinatorToken: string;
  let fleetManagerToken: string;
  let operatorToken: string;
  let addressId: string;
  let hubId: string;
  const createdProductIds: string[] = [];
  const createdDroneIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createVariant(sku: string, stock: number, price: number) {
    const product = await prisma.product.create({
      data: { name: `Mission Test ${sku}`, slug: `mission-test-${sku}-${suffix}`.toLowerCase(), basePrice: price },
    });
    createdProductIds.push(product.id);
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku, name: "Default" } });
    await prisma.inventoryItem.create({ data: { variantId: variant.id, hubId, quantityOnHand: stock, lowStockThreshold: 1 } });
    return variant.id;
  }

  async function createDrone(serialSuffix: string) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/drones")
      .set(auth(fleetManagerToken))
      .send({ serialNumber: `MISSION-TEST-${serialSuffix}-${suffix}`, name: `Test Drone ${serialSuffix}`, model: "SkyNav X1", homeHubId: hubId });
    expect(res.status).toBe(201);
    createdDroneIds.push(res.body.data.id);
    return res.body.data.id as string;
  }

  async function createDeliveryAtHubAssigned(sku: string): Promise<string> {
    const variantId = await createVariant(sku, 10, 9.99);
    await request(app.getHttpServer()).post("/api/v1/cart/items").set(auth(customerToken)).send({ variantId, quantity: 1 }).expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    const orderId = checkoutRes.body.data.id as string;

    const deliveryRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/by-order/${orderId}`).set(auth(customerToken));
    const deliveryId = deliveryRes.body.data.id as string;

    await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/assign-hub`).set(auth(coordinatorToken)).send({ hubId }).expect(201);
    return deliveryId;
  }

  async function progressUntil(missionId: string, predicate: (status: string) => boolean, maxTicks = 20): Promise<string> {
    for (let i = 0; i < maxTicks; i += 1) {
      const res = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/progress`).set(auth(coordinatorToken)).send({});
      expect(res.status).toBe(201);
      if (predicate(res.body.data.status)) {
        return res.body.data.status as string;
      }
    }
    throw new Error(`Mission did not reach the expected status within ${maxTicks} ticks`);
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    simulatedAdapter = app.get(SimulatedDroneAdapter);

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({
        sub: id,
        email: `${id}@example.com`,
        roles: [roleName],
        permissions: await rbacService.resolvePermissions([roleName]),
      });

    const customer = await prisma.user.create({ data: { email: `mission-cust-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const coordinator = await prisma.user.create({ data: { email: `mission-coord-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fleetManager = await prisma.user.create({ data: { email: `mission-fleet-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const operator = await prisma.user.create({ data: { email: `mission-operator-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });

    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    const coordinatorRole = await prisma.role.findUniqueOrThrow({ where: { name: "delivery_coordinator" } });
    const fleetManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: "fleet_manager" } });
    const operatorRole = await prisma.role.findUniqueOrThrow({ where: { name: "drone_operator" } });
    await prisma.userRole.createMany({
      data: [
        { userId: customer.id, roleId: customerRole.id },
        { userId: coordinator.id, roleId: coordinatorRole.id },
        { userId: fleetManager.id, roleId: fleetManagerRole.id },
        { userId: operator.id, roleId: operatorRole.id },
      ],
    });

    customerId = customer.id;
    coordinatorId = coordinator.id;
    fleetManagerId = fleetManager.id;
    operatorId = operator.id;
    customerToken = await mint(customer.id, "customer");
    coordinatorToken = await mint(coordinator.id, "delivery_coordinator");
    fleetManagerToken = await mint(fleetManager.id, "fleet_manager");
    operatorToken = await mint(operator.id, "drone_operator");

    const hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    hubId = hub.id;

    const address = await prisma.customerAddress.create({
      data: { userId: customer.id, recipientName: "Mission Tester", line1: "1 Test Ave", city: "Springfield", postalCode: "22222" },
    });
    addressId = address.id;
  });

  afterAll(async () => {
    await prisma.telemetrySample.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.missionEvent.deleteMany({ where: { mission: { delivery: { order: { userId: customerId } } } } });
    await prisma.waypoint.deleteMany({ where: { mission: { delivery: { order: { userId: customerId } } } } });
    await prisma.mission.deleteMany({ where: { delivery: { order: { userId: customerId } } } });
    await prisma.proofOfDelivery.deleteMany({ where: { delivery: { order: { userId: customerId } } } });
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
    await prisma.user.deleteMany({ where: { id: { in: [customerId, coordinatorId, fleetManagerId, operatorId] } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await app.close();
  });

  it("rejects unauthenticated access to fleet/mission endpoints", async () => {
    expect((await request(app.getHttpServer()).get("/api/v1/drones")).status).toBe(401);
    expect((await request(app.getHttpServer()).get("/api/v1/missions")).status).toBe(401);
  });

  it("rejects a plain customer from drone/mission admin endpoints", async () => {
    expect((await request(app.getHttpServer()).get("/api/v1/drones").set(auth(customerToken))).status).toBe(403);
    expect((await request(app.getHttpServer()).get("/api/v1/missions").set(auth(customerToken))).status).toBe(403);
  });

  it("registers a drone via the fleet-manager-only endpoint", async () => {
    const droneId = await createDrone("REG");
    const res = await request(app.getHttpServer()).get(`/api/v1/drones/${droneId}`).set(auth(fleetManagerToken));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("IDLE");
    expect(res.body.data.batteryPercent).toBe(100);
  });

  it("requires a hub-assigned delivery before a mission can be created", async () => {
    const variantId = await createVariant(`NOHUB-${suffix}`, 5, 5.99);
    await request(app.getHttpServer()).post("/api/v1/cart/items").set(auth(customerToken)).send({ variantId, quantity: 1 }).expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    const deliveryRes = await request(app.getHttpServer())
      .get(`/api/v1/deliveries/by-order/${checkoutRes.body.data.id}`)
      .set(auth(customerToken));

    const res = await request(app.getHttpServer())
      .post("/api/v1/missions")
      .set(auth(coordinatorToken))
      .send({ deliveryId: deliveryRes.body.data.id });
    expect(res.status).toBe(409);
  });

  it("refuses to assign a drone that is not IDLE", async () => {
    const busyDroneId = await createDrone("BUSY");
    await prisma.drone.update({ where: { id: busyDroneId }, data: { status: "IN_FLIGHT" } });

    const deliveryId = await createDeliveryAtHubAssigned(`BUSY-${suffix}`);
    const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
    expect(missionRes.status).toBe(201);

    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/missions/${missionRes.body.data.id}/assign-drone`)
      .set(auth(coordinatorToken))
      .send({ droneId: busyDroneId });
    expect(assignRes.status).toBe(400);
  });

  it("flies the full happy path: create -> assign -> start -> progress to completion -> delivery auto-transitions -> OTP verification completes it", async () => {
    const droneId = await createDrone("HAPPY");
    const deliveryId = await createDeliveryAtHubAssigned(`HAPPY-${suffix}`);

    const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
    expect(missionRes.status).toBe(201);
    expect(missionRes.body.data.status).toBe("PLANNED");
    expect(missionRes.body.data.waypoints).toHaveLength(3);
    const missionId = missionRes.body.data.id as string;

    // Once a mission exists, the Phase 5 manual "advance" endpoint is
    // deliberately blocked — the delivery is now mission-driven.
    const blockedRes = await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/advance`).set(auth(coordinatorToken)).send({});
    expect(blockedRes.status).toBe(409);

    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/missions/${missionId}/assign-drone`)
      .set(auth(coordinatorToken))
      .send({ droneId });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.data.droneId).toBe(droneId);

    const droneAfterAssign = await request(app.getHttpServer()).get(`/api/v1/drones/${droneId}`).set(auth(fleetManagerToken));
    expect(droneAfterAssign.body.data.status).toBe("ASSIGNED");

    const startRes = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});
    expect(startRes.status).toBe(201);
    expect(startRes.body.data.status).toBe("DISPATCHED");

    const deliveryAfterStart = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerToken));
    expect(deliveryAfterStart.body.data.status).toBe("DRONE_DISPATCHED");

    const finalStatus = await progressUntil(missionId, (status) => status === "COMPLETED");
    expect(finalStatus).toBe("COMPLETED");

    const droneAfterCompletion = await request(app.getHttpServer()).get(`/api/v1/drones/${droneId}`).set(auth(fleetManagerToken));
    expect(droneAfterCompletion.body.data.status).toBe("IDLE");
    expect(droneAfterCompletion.body.data.totalMissionsCompleted).toBe(1);

    const deliveryAfterArrival = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerToken));
    expect(deliveryAfterArrival.body.data.status).toBe("DELIVERED_PENDING_VERIFICATION");
    expect(deliveryAfterArrival.body.data.missionStatus).toBe("COMPLETED");

    const codeRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}/verification-code`).set(auth(customerToken));
    expect(codeRes.status).toBe(200);
    const verifyRes = await request(app.getHttpServer())
      .post(`/api/v1/deliveries/${deliveryId}/verify`)
      .set(auth(customerToken))
      .send({ code: codeRes.body.data.code, method: "OTP" });
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.data.status).toBe("COMPLETED");

    // TelemetrySample rows were written for every progress tick.
    const sampleCount = await prisma.telemetrySample.count({ where: { missionId } });
    expect(sampleCount).toBeGreaterThan(0);
  });

  it("triggers automatic return-to-home on a simulated low-battery fault, aborting the mission and returning the delivery to the hub", async () => {
    const droneId = await createDrone("LOWBATT");
    const deliveryId = await createDeliveryAtHubAssigned(`LOWBATT-${suffix}`);

    const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
    const missionId = missionRes.body.data.id as string;
    await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/assign-drone`).set(auth(coordinatorToken)).send({ droneId });
    await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});

    simulatedAdapter.injectFault(droneId, "LOW_BATTERY");
    const finalStatus = await progressUntil(missionId, (status) => status === "ABORTED", 30);
    expect(finalStatus).toBe("ABORTED");

    const missionDetail = await request(app.getHttpServer()).get(`/api/v1/missions/${missionId}`).set(auth(coordinatorToken));
    expect(missionDetail.body.data.rthTriggered).toBe(true);
    expect(missionDetail.body.data.abortReason).toMatch(/battery/i);

    const deliveryRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerToken));
    expect(deliveryRes.body.data.status).toBe("RETURNED_TO_HUB");

    const droneRes = await request(app.getHttpServer()).get(`/api/v1/drones/${droneId}`).set(auth(fleetManagerToken));
    expect(droneRes.body.data.status).toBe("IDLE");
  });

  it("requires a reason for an operator override and audits the action", async () => {
    const droneId = await createDrone("OVERRIDE");
    const deliveryId = await createDeliveryAtHubAssigned(`OVERRIDE-${suffix}`);
    const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
    const missionId = missionRes.body.data.id as string;
    await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/assign-drone`).set(auth(coordinatorToken)).send({ droneId });
    await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});

    // Override requires missions.override — the coordinator role doesn't have it.
    const forbiddenRes = await request(app.getHttpServer())
      .post(`/api/v1/missions/${missionId}/override`)
      .set(auth(coordinatorToken))
      .send({ action: "ABORT", reason: "Testing" });
    expect(forbiddenRes.status).toBe(403);

    // A drone operator has missions.override, but a missing/too-short reason still fails DTO validation.
    const missingReasonRes = await request(app.getHttpServer())
      .post(`/api/v1/missions/${missionId}/override`)
      .set(auth(operatorToken))
      .send({ action: "ABORT" });
    expect(missingReasonRes.status).toBe(400);

    const auditRows = await prisma.auditLog.findMany({ where: { targetType: "Mission", targetId: missionId, action: "mission.operator_override" } });
    expect(auditRows.length).toBe(0);

    const overrideRes = await request(app.getHttpServer())
      .post(`/api/v1/missions/${missionId}/override`)
      .set(auth(operatorToken))
      .send({ action: "ABORT", reason: "Operator judgment call during test" });
    expect(overrideRes.status).toBe(201);
    expect(overrideRes.body.data.status).toBe("ABORTED");

    const auditRowsAfter = await prisma.auditLog.findMany({ where: { targetType: "Mission", targetId: missionId, action: "mission.operator_override" } });
    expect(auditRowsAfter.length).toBe(1);
    expect(auditRowsAfter[0]?.actorId).toBe(operatorId);
  });

  it("authenticates the internal telemetry-ingest endpoint by service API key, not a user JWT", async () => {
    const droneId = await createDrone("TELEMETRY");

    const noKeyRes = await request(app.getHttpServer()).post("/api/v1/internal/telemetry").send({ droneId, lat: 1, lng: 1, batteryPercent: 90 });
    expect(noKeyRes.status).toBe(401);

    const wrongKeyRes = await request(app.getHttpServer())
      .post("/api/v1/internal/telemetry")
      .set("X-Service-Api-Key", "wrong-key")
      .send({ droneId, lat: 1, lng: 1, batteryPercent: 90 });
    expect(wrongKeyRes.status).toBe(401);

    const jwtRes = await request(app.getHttpServer())
      .post("/api/v1/internal/telemetry")
      .set(auth(fleetManagerToken))
      .send({ droneId, lat: 1, lng: 1, batteryPercent: 90 });
    expect(jwtRes.status).toBe(401);

    const okRes = await request(app.getHttpServer())
      .post("/api/v1/internal/telemetry")
      .set("X-Service-Api-Key", "local-dev-only-telemetry-key-change-me")
      .send({ droneId, lat: 44.98, lng: -93.26, altitudeMeters: 60, batteryPercent: 91, signalStrengthPercent: 90 });
    expect(okRes.status).toBe(201);

    const droneRes = await request(app.getHttpServer()).get(`/api/v1/drones/${droneId}`).set(auth(fleetManagerToken));
    expect(droneRes.body.data.batteryPercent).toBe(91);
    expect(droneRes.body.data.currentLat).toBe(44.98);

    const batteryLogRows = await prisma.batteryLog.findMany({ where: { droneId } });
    expect(batteryLogRows.length).toBeGreaterThan(0);
  });

  it("Phase 12 regression: telemetry ingestion has its own rate limit well above the global 100/min user-facing default", async () => {
    // A load test this phase found a real bug: this endpoint previously
    // inherited the app's global 100-req/min-per-IP throttle (meant for
    // brute-force protection on login/etc.), so a realistic fleet's
    // telemetry rate (well above 100/min once more than ~7 drones tick
    // every 4s) got silently 429-rejected. `TelemetryController.ingest()`
    // now carries its own, much higher, still-bounded `@Throttle` override
    // — this sends more requests than the OLD global limit would have
    // allowed and asserts none of them are rejected.
    const droneId = await createDrone("RATE-LIMIT-REGRESSION");
    const REQUEST_COUNT = 120; // > the global 100/min default this used to inherit

    const results = await Promise.all(
      Array.from({ length: REQUEST_COUNT }, () =>
        request(app.getHttpServer())
          .post("/api/v1/internal/telemetry")
          .set("X-Service-Api-Key", "local-dev-only-telemetry-key-change-me")
          .send({ droneId, lat: 44.98, lng: -93.26, batteryPercent: 90 }),
      ),
    );

    const statuses = results.map((r) => r.status);
    const rateLimited = statuses.filter((s) => s === 429);
    expect(rateLimited).toHaveLength(0);
    expect(statuses.every((s) => s === 201)).toBe(true);
  });
});
