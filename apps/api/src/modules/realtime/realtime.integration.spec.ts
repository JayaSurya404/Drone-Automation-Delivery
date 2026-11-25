import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { io, type Socket as ClientSocket } from "socket.io-client";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

/**
 * Phase 7 — the WebSocket layer against a real, listening HTTP server (not
 * just `app.init()` like the other integration specs — a real socket.io
 * client needs an actual bound port to connect to) and real Postgres/Redis.
 * Covers: unauthenticated/unauthorized connection rejection on both
 * namespaces, customer ownership enforcement on `/tracking` subscriptions,
 * staff permission enforcement on `/ops`, room isolation, and end-to-end
 * event delivery for a full mission flight reusing the same happy-path
 * fixtures as `missions.integration.spec.ts`.
 */
describe("Realtime WebSocket gateways (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let baseUrl: string;

  const suffix = Date.now();
  let customerId: string;
  let otherCustomerId: string;
  let coordinatorId: string;
  let fleetManagerId: string;
  let customerToken: string;
  let otherCustomerToken: string;
  let coordinatorToken: string;
  let fleetManagerToken: string;
  let addressId: string;
  let hubId: string;
  const createdProductIds: string[] = [];
  const createdDroneIds: string[] = [];
  const sockets: ClientSocket[] = [];

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function connectSocket(namespace: "/tracking" | "/ops", token?: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}${namespace}`, {
        transports: ["websocket"],
        auth: token ? { token } : {},
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      socket.on("connect", () => resolve(socket));
      socket.on("connect_error", (err) => reject(err));
    });
  }

  /**
   * A valid handshake is always accepted at the transport level — Socket.IO
   * fires `connect` first, and only then does `handleConnection` run our
   * app-level auth check and (on failure) call `socket.disconnect(true)`
   * after emitting a custom `error` event. So "rejected" is observed as a
   * `disconnect`/`error` shortly after connecting, never a `connect_error`.
   */
  function expectRejectedConnection(namespace: "/tracking" | "/ops", token?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}${namespace}`, {
        transports: ["websocket"],
        auth: token ? { token } : {},
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      const timer = setTimeout(() => reject(new Error("expected the socket to be disconnected/refused, but it stayed connected")), 5000);
      socket.on("error", (payload: unknown) => {
        clearTimeout(timer);
        resolve(payload);
      });
      socket.on("disconnect", (reason: string) => {
        clearTimeout(timer);
        resolve(reason);
      });
    });
  }

  /** Every event received on a socket since this was called, in order — collected eagerly (before triggering side effects) rather than raced against a late-attached listener, since a message with no listener at delivery time is lost, not buffered. */
  function collectEvents(socket: ClientSocket): Array<{ type: string; data: Record<string, unknown> }> {
    const events: Array<{ type: string; data: Record<string, unknown> }> = [];
    socket.on("event", (envelope: { type: string; data: Record<string, unknown> }) => events.push(envelope));
    return events;
  }

  function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const check = () => {
        if (predicate()) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for condition"));
          return;
        }
        setTimeout(check, 25);
      };
      check();
    });
  }

  function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => socket.emit(event, payload, (ack: T) => resolve(ack)));
  }

  async function createVariant(sku: string, stock: number, price: number) {
    const product = await prisma.product.create({
      data: { name: `Realtime Test ${sku}`, slug: `realtime-test-${sku}-${suffix}`.toLowerCase(), basePrice: price },
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
      .send({ serialNumber: `RT-TEST-${serialSuffix}-${suffix}`, name: `RT Drone ${serialSuffix}`, model: "SkyNav X1", homeHubId: hubId });
    expect(res.status).toBe(201);
    createdDroneIds.push(res.body.data.id);
    return res.body.data.id as string;
  }

  async function createDeliveryAtHubAssigned(sku: string, token = customerToken): Promise<string> {
    const variantId = await createVariant(sku, 10, 9.99);
    await request(app.getHttpServer()).post("/api/v1/cart/items").set(auth(token)).send({ variantId, quantity: 1 }).expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(token))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    const orderId = checkoutRes.body.data.id as string;
    const deliveryRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/by-order/${orderId}`).set(auth(token));
    const deliveryId = deliveryRes.body.data.id as string;
    await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/assign-hub`).set(auth(coordinatorToken)).send({ hubId }).expect(201);
    return deliveryId;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(NEST_APP_OPTIONS);
    configureApp(app);
    // Unlike the other integration specs (which only need `app.init()` for
    // Supertest), a real socket.io client needs an actual bound TCP port.
    await app.listen(0);
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    const address = app.getHttpServer().address();
    const port = typeof address === "object" && address ? address.port : 0;
    baseUrl = `http://localhost:${port}`;

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({
        sub: id,
        email: `${id}@example.com`,
        roles: [roleName],
        permissions: await rbacService.resolvePermissions([roleName]),
      });

    const customer = await prisma.user.create({ data: { email: `rt-cust-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const otherCustomer = await prisma.user.create({ data: { email: `rt-cust2-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const coordinator = await prisma.user.create({ data: { email: `rt-coord-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const fleetManager = await prisma.user.create({ data: { email: `rt-fleet-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });

    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    const coordinatorRole = await prisma.role.findUniqueOrThrow({ where: { name: "delivery_coordinator" } });
    const fleetManagerRole = await prisma.role.findUniqueOrThrow({ where: { name: "fleet_manager" } });
    await prisma.userRole.createMany({
      data: [
        { userId: customer.id, roleId: customerRole.id },
        { userId: otherCustomer.id, roleId: customerRole.id },
        { userId: coordinator.id, roleId: coordinatorRole.id },
        { userId: fleetManager.id, roleId: fleetManagerRole.id },
      ],
    });

    customerId = customer.id;
    otherCustomerId = otherCustomer.id;
    coordinatorId = coordinator.id;
    fleetManagerId = fleetManager.id;
    customerToken = await mint(customer.id, "customer");
    otherCustomerToken = await mint(otherCustomer.id, "customer");
    coordinatorToken = await mint(coordinator.id, "delivery_coordinator");
    fleetManagerToken = await mint(fleetManager.id, "fleet_manager");

    const hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    hubId = hub.id;

    const address2 = await prisma.customerAddress.create({
      data: { userId: customer.id, recipientName: "Realtime Tester", line1: "1 Test Ave", city: "Springfield", postalCode: "22222" },
    });
    addressId = address2.id;
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  });

  afterAll(async () => {
    await prisma.telemetrySample.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.missionEvent.deleteMany({ where: { mission: { delivery: { order: { userId: { in: [customerId, otherCustomerId] } } } } } });
    await prisma.waypoint.deleteMany({ where: { mission: { delivery: { order: { userId: { in: [customerId, otherCustomerId] } } } } } });
    await prisma.mission.deleteMany({ where: { delivery: { order: { userId: { in: [customerId, otherCustomerId] } } } } });
    await prisma.deliveryEvent.deleteMany({ where: { delivery: { order: { userId: { in: [customerId, otherCustomerId] } } } } });
    await prisma.delivery.deleteMany({ where: { order: { userId: { in: [customerId, otherCustomerId] } } } });
    await prisma.paymentEvent.deleteMany({ where: { payment: { order: { userId: { in: [customerId, otherCustomerId] } } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: [customerId, otherCustomerId] } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [customerId, otherCustomerId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [customerId, otherCustomerId] } } });
    await prisma.customerAddress.deleteMany({ where: { userId: customerId } });
    await prisma.batteryLog.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.droneHealthLog.deleteMany({ where: { droneId: { in: createdDroneIds } } });
    await prisma.drone.deleteMany({ where: { id: { in: createdDroneIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerId, otherCustomerId, coordinatorId, fleetManagerId] } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await app.close();
  });

  it("rejects a /tracking connection with no token", async () => {
    await expect(expectRejectedConnection("/tracking")).resolves.toBeDefined();
  });

  it("rejects a /tracking connection with an invalid token", async () => {
    await expect(expectRejectedConnection("/tracking", "not-a-real-token")).resolves.toBeDefined();
  });

  it("rejects an /ops connection from a plain customer (no fleet/mission/telemetry permission)", async () => {
    await expect(expectRejectedConnection("/ops", customerToken)).resolves.toBeDefined();
  });

  it("accepts an /ops connection from staff with a fleet permission", async () => {
    const socket = await connectSocket("/ops", coordinatorToken);
    expect(socket.connected).toBe(true);
  });

  it("lets a customer subscribe to their own delivery but not another customer's", async () => {
    const deliveryId = await createDeliveryAtHubAssigned(`OWN-${suffix}`);
    const socket = await connectSocket("/tracking", customerToken);

    const ownResult = await emitAck<{ ok: boolean; room?: string }>(socket, "subscribe:delivery", { deliveryId });
    expect(ownResult).toEqual({ ok: true, room: `delivery:${deliveryId}` });

    const otherSocket = await connectSocket("/tracking", otherCustomerToken);
    const forbiddenResult = await emitAck<{ ok: boolean; error?: string }>(otherSocket, "subscribe:delivery", { deliveryId });
    expect(forbiddenResult).toEqual({ ok: false, error: "not_found" });
  });

  it(
    "delivers mission lifecycle and delivery-status events to the owning customer's /tracking room and to the /ops fleet room, " +
      "and never to an unrelated customer's socket (room isolation)",
    async () => {
      const droneId = await createDrone("FLOW");
      const deliveryId = await createDeliveryAtHubAssigned(`FLOW-${suffix}`);

      const trackingSocket = await connectSocket("/tracking", customerToken);
      await emitAck(trackingSocket, "subscribe:delivery", { deliveryId });
      // Collected from the moment of subscription, before any mutating call
      // — a message with no listener attached at delivery time is lost, not
      // buffered, so listeners must exist before the event can fire.
      const trackingEvents = collectEvents(trackingSocket);

      const unrelatedSocket = await connectSocket("/tracking", otherCustomerToken);
      const unrelatedEvents = collectEvents(unrelatedSocket);

      const opsSocket = await connectSocket("/ops", coordinatorToken);
      const opsEvents = collectEvents(opsSocket);

      const missionRes = await request(app.getHttpServer()).post("/api/v1/missions").set(auth(coordinatorToken)).send({ deliveryId });
      expect(missionRes.status).toBe(201);
      const missionId = missionRes.body.data.id as string;

      await waitFor(() => trackingEvents.some((e) => e.type === "mission.created"));
      await waitFor(() => opsEvents.some((e) => e.type === "mission.created"));
      await waitFor(() => trackingEvents.some((e) => e.type === "delivery.status_changed" && e.data.toStatus === "MISSION_PLANNED"));

      await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/assign-drone`).set(auth(coordinatorToken)).send({ droneId }).expect(201);
      await request(app.getHttpServer()).post(`/api/v1/missions/${missionId}/start`).set(auth(coordinatorToken)).send({}).expect(201);

      await waitFor(() => trackingEvents.some((e) => e.type === "mission.started"));
      await waitFor(() => trackingEvents.some((e) => e.type === "delivery.status_changed" && e.data.toStatus === "DRONE_DISPATCHED"));

      // A socket that never subscribed to this delivery must never see its events.
      expect(unrelatedEvents.map((e) => e.type)).not.toContain("mission.created");
      expect(unrelatedEvents.map((e) => e.type)).not.toContain("mission.started");
    },
    15000,
  );

  it("stops delivering events to a room after the client unsubscribes", async () => {
    const deliveryId = await createDeliveryAtHubAssigned(`UNSUB-${suffix}`);
    const socket = await connectSocket("/tracking", customerToken);
    await emitAck(socket, "subscribe:delivery", { deliveryId });
    await emitAck(socket, "unsubscribe:delivery", { deliveryId });

    const received: string[] = [];
    socket.on("event", (envelope: { type: string }) => received.push(envelope.type));

    await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/unassign-hub`).set(auth(coordinatorToken)).send({}).expect(201);

    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(received).toHaveLength(0);
  });

  it("supports reconnecting and re-subscribing after a disconnect", async () => {
    const deliveryId = await createDeliveryAtHubAssigned(`RECONNECT-${suffix}`);
    const first = await connectSocket("/tracking", customerToken);
    await emitAck(first, "subscribe:delivery", { deliveryId });
    first.disconnect();

    const second = await connectSocket("/tracking", customerToken);
    const result = await emitAck<{ ok: boolean; room?: string }>(second, "subscribe:delivery", { deliveryId });
    expect(result).toEqual({ ok: true, room: `delivery:${deliveryId}` });
  });
});
