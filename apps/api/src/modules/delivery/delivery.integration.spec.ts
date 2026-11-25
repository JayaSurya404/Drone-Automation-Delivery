import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { RbacService } from "../rbac/rbac.service";

/**
 * Full Phase 5 round trip against real Postgres/Redis: order confirmation
 * creates a Delivery (via the `order.confirmed` event, not a direct call),
 * hub assignment + manual status advance through to verification, correct
 * and incorrect OTP submission (including attempt-exhaustion and
 * redelivery), ownership protection, admin RBAC, and the order-cancellation
 * cascade. Run via `pnpm test:integration`.
 */
describe("Delivery management (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const suffix = Date.now();
  let customerAId: string;
  let customerBId: string;
  let staffId: string;
  let customerAToken: string;
  let customerBToken: string;
  let staffToken: string;
  let addressId: string;
  let hubId: string;
  const createdProductIds: string[] = [];

  async function createVariant(sku: string, stock: number, price: number) {
    const product = await prisma.product.create({
      data: { name: `Delivery Test ${sku}`, slug: `delivery-test-${sku}-${suffix}`.toLowerCase(), basePrice: price },
    });
    createdProductIds.push(product.id);
    const variant = await prisma.productVariant.create({ data: { productId: product.id, sku, name: "Default" } });
    await prisma.inventoryItem.create({ data: { variantId: variant.id, hubId, quantityOnHand: stock, lowStockThreshold: 1 } });
    return variant.id;
  }

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function placeConfirmedOrder(token: string, sku: string): Promise<string> {
    const variantId = await createVariant(sku, 10, 9.99);
    await request(app.getHttpServer()).post("/api/v1/cart/items").set(auth(token)).send({ variantId, quantity: 1 }).expect(201);
    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(token))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    expect(res.body.data.status).toBe("CONFIRMED");
    return res.body.data.id as string;
  }

  async function getDeliveryIdForOrder(orderId: string, token: string): Promise<string> {
    const res = await request(app.getHttpServer()).get(`/api/v1/deliveries/by-order/${orderId}`).set(auth(token));
    expect(res.status).toBe(200);
    return res.body.data.id as string;
  }

  async function advanceToVerification(deliveryId: string): Promise<void> {
    await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/assign-hub`).set(auth(staffToken)).send({ hubId }).expect(201);
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/advance`).set(auth(staffToken)).send({}).expect(201);
    }
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
      jwtService.signAsync({
        sub: id,
        email: `${id}@example.com`,
        roles: [roleName],
        permissions: await rbacService.resolvePermissions([roleName]),
      });

    const customerA = await prisma.user.create({ data: { email: `deliv-a-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const customerB = await prisma.user.create({ data: { email: `deliv-b-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    // A real User row, not just a minted claim — DeliveryService writes
    // AuditLog rows keyed on the actor's id, and audit_logs.actor_id has a
    // real FK to users.id (SetNull on delete, but insert still requires the
    // row to exist).
    const staff = await prisma.user.create({ data: { email: `deliv-staff-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true } });
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    const coordinatorRole = await prisma.role.findUniqueOrThrow({ where: { name: "delivery_coordinator" } });
    await prisma.userRole.createMany({
      data: [
        { userId: customerA.id, roleId: customerRole.id },
        { userId: customerB.id, roleId: customerRole.id },
        { userId: staff.id, roleId: coordinatorRole.id },
      ],
    });
    customerAId = customerA.id;
    customerBId = customerB.id;
    staffId = staff.id;
    customerAToken = await mint(customerA.id, "customer");
    customerBToken = await mint(customerB.id, "customer");
    staffToken = await mint(staff.id, "delivery_coordinator");

    const hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    hubId = hub.id;

    const address = await prisma.customerAddress.create({
      data: { userId: customerA.id, recipientName: "Delivery Tester", line1: "1 Test Ave", city: "Springfield", postalCode: "22222" },
    });
    addressId = address.id;
  });

  afterAll(async () => {
    await prisma.proofOfDelivery.deleteMany({ where: { delivery: { order: { userId: { in: [customerAId, customerBId] } } } } });
    await prisma.deliveryEvent.deleteMany({ where: { delivery: { order: { userId: { in: [customerAId, customerBId] } } } } });
    await prisma.delivery.deleteMany({ where: { order: { userId: { in: [customerAId, customerBId] } } } });
    await prisma.paymentEvent.deleteMany({ where: { payment: { order: { userId: { in: [customerAId, customerBId] } } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: [customerAId, customerBId] } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [customerAId, customerBId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [customerAId, customerBId] } } });
    await prisma.customerAddress.deleteMany({ where: { userId: { in: [customerAId, customerBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerAId, customerBId, staffId] } } });
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await app.close();
  });

  it("rejects unauthenticated access", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/deliveries");
    expect(res.status).toBe(401);
  });

  it("creates a Delivery reactively from order.confirmed, in PENDING_ASSIGNMENT, with a snapshot address", async () => {
    const orderId = await placeConfirmedOrder(customerAToken, `CREATE-${suffix}`);
    const res = await request(app.getHttpServer()).get(`/api/v1/deliveries/by-order/${orderId}`).set(auth(customerAToken));

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING_ASSIGNMENT");
    expect(res.body.data.deliveryAddress.recipientName).toBe("Delivery Tester");
  });

  it("hides a delivery from a customer who doesn't own the order (404, not 403)", async () => {
    const orderId = await placeConfirmedOrder(customerAToken, `OWNERSHIP-${suffix}`);
    const deliveryId = await getDeliveryIdForOrder(orderId, customerAToken);

    const res = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerBToken));
    expect(res.status).toBe(404);
  });

  it("rejects a plain customer from admin delivery endpoints", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/deliveries/admin").set(auth(customerAToken));
    expect(res.status).toBe(403);
  });

  it("assigns a hub, advances through the full manual chain, and completes via correct OTP", async () => {
    const orderId = await placeConfirmedOrder(customerAToken, `HAPPY-${suffix}`);
    const deliveryId = await getDeliveryIdForOrder(orderId, customerAToken);

    const assignRes = await request(app.getHttpServer())
      .post(`/api/v1/deliveries/${deliveryId}/assign-hub`)
      .set(auth(staffToken))
      .send({ hubId, priority: "EXPRESS" });
    expect(assignRes.status).toBe(201);
    expect(assignRes.body.data.status).toBe("HUB_ASSIGNED");
    expect(assignRes.body.data.estimatedDeliveryAt).toBeTruthy();

    const expectedChain = ["MISSION_PLANNED", "DRONE_DISPATCHED", "IN_TRANSIT", "ARRIVED_AT_DESTINATION", "DELIVERED_PENDING_VERIFICATION"];
    for (const expected of expectedChain) {
      const res = await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/advance`).set(auth(staffToken)).send({});
      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(expected);
    }

    // The raw code is never present in the general delivery-detail response.
    const detailRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerAToken));
    expect(JSON.stringify(detailRes.body)).not.toMatch(/verificationCodeHash/);

    const codeRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}/verification-code`).set(auth(customerAToken));
    expect(codeRes.status).toBe(200);
    expect(codeRes.body.data.code).toMatch(/^\d{6}$/);

    // A staff member (not the owning customer) cannot read the code.
    const staffCodeRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}/verification-code`).set(auth(staffToken));
    expect(staffCodeRes.status).toBe(404);

    const wrongRes = await request(app.getHttpServer())
      .post(`/api/v1/deliveries/${deliveryId}/verify`)
      .set(auth(customerAToken))
      .send({ code: "000000", method: "OTP" });
    expect(wrongRes.status).toBe(409);

    const verifyRes = await request(app.getHttpServer())
      .post(`/api/v1/deliveries/${deliveryId}/verify`)
      .set(auth(customerAToken))
      .send({ code: codeRes.body.data.code, method: "OTP" });
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.data.status).toBe("COMPLETED");
    expect(verifyRes.body.data.proofOfDelivery.method).toBe("OTP");

    const events = verifyRes.body.data.events as Array<{ toStatus: string }>;
    expect(events.map((e) => e.toStatus)).toEqual([
      "PENDING_ASSIGNMENT",
      "HUB_ASSIGNED",
      ...expectedChain,
      "COMPLETED",
    ]);

    const auditRows = await prisma.auditLog.findMany({ where: { targetType: "Delivery", targetId: deliveryId, action: "delivery.verified" } });
    expect(auditRows.length).toBe(1);
  });

  describe("proof-of-delivery photo (Phase 12 security fixes)", () => {
    const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");

    async function completedDeliveryId(tag: string): Promise<string> {
      const orderId = await placeConfirmedOrder(customerAToken, `${tag}-${suffix}`);
      const deliveryId = await getDeliveryIdForOrder(orderId, customerAToken);
      await advanceToVerification(deliveryId);
      const codeRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}/verification-code`).set(auth(customerAToken));
      await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/verify`).set(auth(customerAToken)).send({ code: codeRes.body.data.code, method: "OTP" });
      return deliveryId;
    }

    it("rejects a non-image upload — magic-number detection, not the client-supplied Content-Type", async () => {
      const deliveryId = await completedDeliveryId("POD-REJECT");
      const res = await request(app.getHttpServer())
        .post(`/api/v1/deliveries/${deliveryId}/proof-of-delivery`)
        .set(auth(staffToken))
        .attach("file", Buffer.from("not actually an image"), { filename: "photo.jpg", contentType: "image/jpeg" });
      expect(res.status).toBe(400);
    });

    it("accepts a real image, never routes it through the public media proxy, and enforces ownership on read", async () => {
      const deliveryId = await completedDeliveryId("POD-ACCEPT");
      const upload = await request(app.getHttpServer())
        .post(`/api/v1/deliveries/${deliveryId}/proof-of-delivery`)
        .set(auth(staffToken))
        .attach("file", tinyPng, "photo.png");
      expect(upload.status).toBe(201);
      const imageUrl = upload.body.data.proofOfDelivery.imageUrl as string;
      expect(imageUrl).toBe(`/api/v1/deliveries/${deliveryId}/proof-of-delivery/image`);
      expect(imageUrl).not.toContain("/api/v1/media/");

      // Public media proxy refuses any deliveries/* key outright, even a real one.
      const rawKeyRow = await prisma.proofOfDelivery.findUnique({ where: { deliveryId } });
      const publicAttempt = await request(app.getHttpServer()).get(`/api/v1/media/${rawKeyRow!.imageStorageKey}`);
      expect(publicAttempt.status).toBe(404);

      // Unauthenticated read of the authenticated route is refused.
      expect((await request(app.getHttpServer()).get(imageUrl)).status).toBe(401);

      // A different customer cannot view another customer's delivery photo.
      const otherCustomerRes = await request(app.getHttpServer()).get(imageUrl).set(auth(customerBToken));
      expect(otherCustomerRes.status).toBe(404);

      // The owning customer can.
      const ownerRes = await request(app.getHttpServer()).get(imageUrl).set(auth(customerAToken));
      expect(ownerRes.status).toBe(200);
      expect(ownerRes.headers["content-type"]).toBe("image/png");

      // Staff (delivery.read) can too.
      const staffRes = await request(app.getHttpServer()).get(imageUrl).set(auth(staffToken));
      expect(staffRes.status).toBe(200);
    });
  });

  it("exhausts attempts into VERIFICATION_FAILED, then completes after a scheduled redelivery with a fresh code", async () => {
    const orderId = await placeConfirmedOrder(customerAToken, `RETRY-${suffix}`);
    const deliveryId = await getDeliveryIdForOrder(orderId, customerAToken);
    await advanceToVerification(deliveryId);

    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer())
        .post(`/api/v1/deliveries/${deliveryId}/verify`)
        .set(auth(customerAToken))
        .send({ code: "999999", method: "OTP" });
    }

    const failedRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerAToken));
    expect(failedRes.body.data.status).toBe("VERIFICATION_FAILED");

    const redeliverRes = await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/redeliver`).set(auth(staffToken)).send({});
    expect(redeliverRes.status).toBe(201);
    expect(redeliverRes.body.data.status).toBe("REDELIVERY_SCHEDULED");

    const advanceRes = await request(app.getHttpServer()).post(`/api/v1/deliveries/${deliveryId}/advance`).set(auth(staffToken)).send({});
    expect(advanceRes.body.data.status).toBe("DELIVERED_PENDING_VERIFICATION");

    const codeRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}/verification-code`).set(auth(customerAToken));
    const verifyRes = await request(app.getHttpServer())
      .post(`/api/v1/deliveries/${deliveryId}/verify`)
      .set(auth(customerAToken))
      .send({ code: codeRes.body.data.code, method: "QR" });
    expect(verifyRes.status).toBe(201);
    expect(verifyRes.body.data.status).toBe("COMPLETED");
  });

  it("cascades order cancellation to a cancellable, still-unfulfilled Delivery", async () => {
    const orderId = await placeConfirmedOrder(customerAToken, `CASCADE-${suffix}`);
    const deliveryId = await getDeliveryIdForOrder(orderId, customerAToken);

    const cancelRes = await request(app.getHttpServer()).post(`/api/v1/orders/${orderId}/cancel`).set(auth(customerAToken)).send({});
    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.data.status).toBe("CANCELLED");

    const deliveryRes = await request(app.getHttpServer()).get(`/api/v1/deliveries/${deliveryId}`).set(auth(customerAToken));
    expect(deliveryRes.body.data.status).toBe("CANCELLED");
  });

  it("lets staff list all deliveries and filter by status", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/deliveries/admin?status=COMPLETED").set(auth(staffToken));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.deliveries)).toBe(true);
    expect(res.body.data.deliveries.every((d: { status: string }) => d.status === "COMPLETED")).toBe(true);
  });
});
