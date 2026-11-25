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

/**
 * Phase 8 — geofencing + weather safety against real Postgres/PostGIS (the
 * spatial predicates themselves are the point of this suite; unit tests
 * only mock Prisma). Covers RBAC, polygon validation, real `ST_Contains`/
 * `ST_Intersects` behavior, and the two places safety is actually enforced
 * server-side: mission creation (geofence) and mission start (weather +
 * geofence, re-checked fresh on every call so it can't be bypassed).
 */
describe("Weather, geofencing & mission safety (integration)", () => {
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
  let hubId: string;
  let hubCoords: { lat: number; lng: number };
  /**
   * A second, dedicated hub for the weather-hold test only, at a
   * suffix-unique synthetic coordinate no other integration spec file ever
   * touches. `WeatherService`'s cache is a real, TTL-bound row in the
   * shared Postgres database keyed by rounded coordinates — using the same
   * "HUB-DOWNTOWN" every other suite also dispatches missions from would
   * let a concurrently-running Jest worker (a separate process, with its
   * own `LocalWeatherProvider` instance that never received this suite's
   * override) win the race to populate that shared cache row first,
   * silently defeating the override. A private hub/zone key sidesteps the
   * race entirely rather than trying to out-time it.
   */
  let weatherHubId: string;
  let weatherHubCoords: { lat: number; lng: number };
  /**
   * A THIRD dedicated hub, for the "Blocking Zone" NO_FLY test only —
   * Phase 12 fix for the documented cross-suite flake. `weatherHubCoords`
   * above is only offset ±0.015° from the real "HUB-DOWNTOWN", which is
   * enough to give it a distinct weather-cache zone key (a discrete lookup,
   * not a spatial concern) but NOT enough to avoid spatial overlap: its own
   * ±0.02° `resolveDeterministicDestination()` spread still substantially
   * overlaps `hubCoords`'s own ±0.02° spread (0.015 offset < 0.02+0.02
   * combined spread) — confirmed live: moving the "Blocking Zone" test to
   * `weatherHubCoords` in an earlier version of this fix still reproduced
   * the flake. A temporary NO_FLY zone needs genuine distance (degrees, not
   * hundredths of a degree) from every other suite's shared-hub-based
   * mission destination. This hub sits 5° away (~550km) — no realistic
   * overlap with anything — with its own dedicated `SERVICE_AREA` zone
   * (inserted alongside it below) so it isn't rejected by the real,
   * seeded "Metro Service Area" check that only covers the real hub's
   * ±0.05° vicinity.
   */
  let geofenceBlockHubId: string;
  let geofenceBlockHubCoords: { lat: number; lng: number };
  const geofenceBlockServiceAreaId = randomUUID();
  const createdProductIds: string[] = [];
  const createdDroneIds: string[] = [];
  const createdGeofenceIds: string[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createVariant(sku: string, stock: number, price: number, targetHubId: string = hubId) {
    const product = await prisma.product.create({
      data: { name: `Safety Test ${sku}`, slug: `safety-test-${sku}-${suffix}`.toLowerCase(), basePrice: price },
    });
    createdProductIds.push(product.id);
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku, name: "Default" } });
    await prisma.inventoryItem.create({ data: { variantId: variant.id, hubId: targetHubId, quantityOnHand: stock, lowStockThreshold: 1 } });
    return variant.id;
  }

  async function createDrone(serialSuffix: string, targetHubId: string = hubId) {
    const res = await request(app.getHttpServer())
      .post("/api/v1/drones")
      .set(auth(fleetManagerToken))
      .send({ serialNumber: `SAFETY-TEST-${serialSuffix}-${suffix}`, name: `Safety Drone ${serialSuffix}`, model: "SkyNav X1", homeHubId: targetHubId });
    expect(res.status).toBe(201);
    createdDroneIds.push(res.body.data.id);
    return res.body.data.id as string;
  }

  async function createDeliveryAtHubAssigned(sku: string, targetHubId: string = hubId): Promise<string> {
    const variantId = await createVariant(sku, 10, 9.99, targetHubId);
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
      .send({ hubId: targetHubId })
      .expect(201);
    return deliveryId;
  }

  async function createGeofence(name: string, type: "NO_FLY" | "RESTRICTED" | "SERVICE_AREA", points: Array<{ lat: number; lng: number }>) {
    const res = await request(app.getHttpServer()).post("/api/v1/geofences").set(auth(officerToken)).send({ name, type, points });
    expect(res.status).toBe(201);
    createdGeofenceIds.push(res.body.data.id);
    return res.body.data.id as string;
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
    localWeatherProvider = app.get(LocalWeatherProvider);

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({ sub: id, email: `${id}@example.com`, roles: [roleName], permissions: await rbacService.resolvePermissions([roleName]) });

    const customer = await prisma.user.create({ data: { email: `safety-cust-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const coordinator = await prisma.user.create({ data: { email: `safety-coord-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fleetManager = await prisma.user.create({ data: { email: `safety-fleet-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const officer = await prisma.user.create({ data: { email: `safety-officer-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });

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

    const hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    hubId = hub.id;
    const [coords] = await prisma.$queryRaw<Array<{ lat: number; lng: number }>>`
      SELECT ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM fulfillment_hubs WHERE id = ${hub.id}
    `;
    hubCoords = coords as { lat: number; lng: number };

    // Offset just enough from the real hub to get this suite's own zone key
    // (see `weatherHubId`'s doc comment) while staying safely inside the
    // seeded "Metro Service Area" geofence (±0.05 degrees) even after
    // `resolveDeterministicDestination`'s own up-to-±0.02 pseudo-random
    // offset is applied on top — a synthetic far-away coordinate would fail
    // that real service-area check instead.
    weatherHubCoords = { lat: hubCoords.lat - 0.015, lng: hubCoords.lng - 0.015 };
    const weatherHubCode = `SAFETY-TEST-HUB-${suffix}`;
    await prisma.$executeRaw`
      INSERT INTO fulfillment_hubs (id, name, code, address, location, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Weather Test Hub', ${weatherHubCode}, '1 Isolated Way',
        ST_SetSRID(ST_MakePoint(${weatherHubCoords.lng}, ${weatherHubCoords.lat}), 4326)::geography,
        true, now(), now()
      )
    `;
    const weatherHub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: weatherHubCode } });
    weatherHubId = weatherHub.id;

    geofenceBlockHubCoords = { lat: hubCoords.lat + 5, lng: hubCoords.lng + 5 };
    const geofenceBlockHubCode = `GEOBLOCK-TEST-HUB-${suffix}`;
    await prisma.$executeRaw`
      INSERT INTO fulfillment_hubs (id, name, code, address, location, is_active, created_at, updated_at)
      VALUES (
        ${randomUUID()}, 'Geofence Block Test Hub', ${geofenceBlockHubCode}, '1 Isolated Way',
        ST_SetSRID(ST_MakePoint(${geofenceBlockHubCoords.lng}, ${geofenceBlockHubCoords.lat}), 4326)::geography,
        true, now(), now()
      )
    `;
    const geofenceBlockHub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: geofenceBlockHubCode } });
    geofenceBlockHubId = geofenceBlockHub.id;

    // A dedicated SERVICE_AREA covering this hub's own remote vicinity —
    // without it, mission creation would reject every destination here as
    // "out of service area" against the real seeded "Metro Service Area"
    // zone, which only covers the real hub's ±0.05° neighborhood.
    const serviceAreaHalfWidth = 0.05;
    const c = geofenceBlockHubCoords;
    const serviceAreaWkt = `POLYGON((${c.lng - serviceAreaHalfWidth} ${c.lat - serviceAreaHalfWidth}, ${c.lng + serviceAreaHalfWidth} ${c.lat - serviceAreaHalfWidth}, ${c.lng + serviceAreaHalfWidth} ${c.lat + serviceAreaHalfWidth}, ${c.lng - serviceAreaHalfWidth} ${c.lat + serviceAreaHalfWidth}, ${c.lng - serviceAreaHalfWidth} ${c.lat - serviceAreaHalfWidth}))`;
    await prisma.$executeRaw`
      INSERT INTO geofences (id, name, type, polygon, is_active, created_at, updated_at)
      VALUES (${geofenceBlockServiceAreaId}, ${`Geofence Block Test Service Area ${suffix}`}, 'SERVICE_AREA', ST_GeomFromText(${serviceAreaWkt}, 4326), true, now(), now())
    `;

    const address = await prisma.customerAddress.create({
      data: { userId: customer.id, recipientName: "Safety Tester", line1: "1 Safety Way", city: "Springfield", postalCode: "33333" },
    });
    addressId = address.id;
  });

  afterEach(async () => {
    const zoneKey = `geo:${weatherHubCoords.lat.toFixed(2)}:${weatherHubCoords.lng.toFixed(2)}`;
    localWeatherProvider.clearOverride(zoneKey);
    // Backstop in case a test fails before reaching its own explicit
    // cleanup.
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
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } }); // cascades to variants/inventory items
    await prisma.fulfillmentHub.delete({ where: { id: weatherHubId } });
    await prisma.geofence.delete({ where: { id: geofenceBlockServiceAreaId } });
    await prisma.fulfillmentHub.delete({ where: { id: geofenceBlockHubId } });
    await app.close();
  });

  describe("RBAC", () => {
    it("rejects unauthenticated and customer access to geofence mutation", async () => {
      const points = squareAround(hubCoords, 0.001);
      expect((await request(app.getHttpServer()).post("/api/v1/geofences").send({ name: "x", type: "NO_FLY", points })).status).toBe(401);
      expect(
        (await request(app.getHttpServer()).post("/api/v1/geofences").set(auth(customerToken)).send({ name: "x", type: "NO_FLY", points })).status,
      ).toBe(403);
    });

    it("rejects a fleet manager from mutating geofences (compliance/safety officer only)", async () => {
      const points = squareAround(hubCoords, 0.001);
      const res = await request(app.getHttpServer()).post("/api/v1/geofences").set(auth(fleetManagerToken)).send({ name: "x", type: "NO_FLY", points });
      expect(res.status).toBe(403);
    });
  });

  describe("polygon validation", () => {
    it("rejects a self-intersecting polygon", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/geofences")
        .set(auth(officerToken))
        .send({
          name: "Bowtie",
          type: "NO_FLY",
          points: [
            { lat: 0, lng: 0 },
            { lat: 0, lng: 1 },
            { lat: 1, lng: 0 },
            { lat: 1, lng: 1 },
          ],
        });
      expect(res.status).toBe(400);
    });

    it("rejects fewer than 3 points at the DTO layer", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/v1/geofences")
        .set(auth(officerToken))
        .send({ name: "Line", type: "NO_FLY", points: [{ lat: 0, lng: 0 }, { lat: 1, lng: 1 }] });
      expect(res.status).toBe(400);
    });
  });

  describe("real spatial predicates", () => {
    it("ST_Contains correctly reports a point inside vs outside a created polygon", async () => {
      const center = { lat: hubCoords.lat + 0.2, lng: hubCoords.lng + 0.2 };
      await createGeofence(`Spatial Test Zone ${suffix}`, "NO_FLY", squareAround(center, 0.01));

      const inside = await request(app.getHttpServer()).post("/api/v1/geofences/check-point").set(auth(officerToken)).send(center);
      expect(inside.body.data.restrictedViolations.length).toBeGreaterThan(0);

      const outside = await request(app.getHttpServer())
        .post("/api/v1/geofences/check-point")
        .set(auth(officerToken))
        .send({ lat: center.lat + 5, lng: center.lng + 5 });
      expect(outside.body.data.restrictedViolations).toHaveLength(0);
    });
  });

  describe("mission creation is blocked by a real geofence", () => {
    it("blocks mission creation when the deterministic destination falls inside a NO_FLY zone", async () => {
      // Phase 12 fix for the documented pre-existing cross-suite flake
      // (see docs/CURRENT_STATUS.md's "Known limitations" history): this
      // used to dispatch from the shared "HUB-DOWNTOWN" hub, so its
      // temporary NO_FLY zone sat inside the exact same ±0.02° destination
      // box every other suite's HUB-DOWNTOWN-origin missions also land in —
      // deleting the zone immediately (still done below) only protects
      // against a *later* test in *this* suite, not a different suite
      // running concurrently in another Jest worker at the same instant.
      // Uses `geofenceBlockHubId`/`geofenceBlockHubCoords` — a hub 5° away
      // from every other suite's coordinate space, with its own dedicated
      // SERVICE_AREA zone (see its declaration above for why a smaller
      // offset like `weatherHubCoords` was tried and confirmed insufficient).
      const deliveryId = await createDeliveryAtHubAssigned(`GEOBLOCK-${suffix}`, geofenceBlockHubId);
      const destination = resolveDeterministicDestination(deliveryId, geofenceBlockHubCoords);
      const zoneId = await createGeofence(`Blocking Zone ${suffix}`, "NO_FLY", squareAround(destination, 0.005));

      try {
        const res = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
        expect(res.status).toBe(409);

        const missions = await prisma.mission.findMany({ where: { deliveryId } });
        expect(missions).toHaveLength(0);
      } finally {
        // Deleted immediately (rather than waiting for afterAll) so it
        // can never spuriously intersect a later delivery in this suite.
        await request(app.getHttpServer()).delete(`/api/v1/geofences/${zoneId}`).set(auth(officerToken));
      }
    });
  });

  describe("weather hold blocks dispatch and can be cleared", () => {
    it("creates the mission on WEATHER_HOLD when weather is unsafe, blocks start(), then dispatches once conditions clear", async () => {
      const zoneKey = `geo:${weatherHubCoords.lat.toFixed(2)}:${weatherHubCoords.lng.toFixed(2)}`;
      // Left in as a backstop even though `weatherHubId` is already a
      // dedicated, suffix-unique hub no other suite touches — see its
      // declaration for why a shared hub's zone key would otherwise race
      // against concurrently-running Jest worker processes.
      await prisma.weatherSnapshot.deleteMany({ where: { zoneKey } });
      localWeatherProvider.setOverride(zoneKey, { windSpeedMps: 25, condition: "STORM" });

      const droneId = await createDrone("WEATHER", weatherHubId);
      const deliveryId = await createDeliveryAtHubAssigned(`WEATHERHOLD-${suffix}`, weatherHubId);

      const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
      expect(missionRes.status).toBe(201);
      expect(missionRes.body.data.safetyState).toBe("WEATHER_HOLD");
      const missionId = missionRes.body.data.id as string;

      await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/assign-drone`).set(auth(coordinatorToken)).send({ droneId }).expect(201);

      // The safety gate is inside start() itself — no client-side bypass is possible.
      const blockedStart = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});
      expect(blockedStart.status).toBe(409);

      const safety = await request(app.getHttpServer()).get(`/api/v1/missions/${missionId}/safety`).set(auth(coordinatorToken));
      expect(safety.status).toBe(200);
      expect(safety.body.data.weatherSafety.level).toBe("UNSAFE");

      localWeatherProvider.clearOverride(zoneKey);

      const recheck = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/safety/recheck`).set(auth(coordinatorToken)).send({});
      expect(recheck.status).toBe(201);
      expect(recheck.body.data.safetyState).toBe("NOMINAL");

      const startRes = await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({});
      expect(startRes.status).toBe(201);
      expect(startRes.body.data.status).toBe("DISPATCHED");
    });
  });

  describe("safety events feed", () => {
    it("surfaces weather/geofence events through GET /missions/safety-events, gated on incidents.read", async () => {
      const forbidden = await request(app.getHttpServer()).get("/api/v1/missions/safety-events").set(auth(coordinatorToken));
      expect(forbidden.status).toBe(403);

      const allowed = await request(app.getHttpServer()).get("/api/v1/missions/safety-events").set(auth(officerToken));
      expect(allowed.status).toBe(200);
      expect(Array.isArray(allowed.body.data)).toBe(true);
    });
  });
});
