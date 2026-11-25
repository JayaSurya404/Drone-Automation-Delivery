import type { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test, type TestingModule } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp, NEST_APP_OPTIONS } from "../../bootstrap";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentsService } from "../payments/payments.service";
import { RbacService } from "../rbac/rbac.service";

/**
 * Full Phase 4 round trip against real Postgres: successful checkout (stock
 * decrement + CONFIRMED), a declined card (PAYMENT_FAILED + stock release),
 * webhook/event idempotency, insufficient stock, cancellation (+ stock
 * release), order history/detail, admin access, and unauthorized access.
 * Run via `pnpm test:integration`.
 */
describe("Checkout / Orders (integration)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let paymentsService: PaymentsService;

  const suffix = Date.now();
  let customerAId: string;
  let customerBId: string;
  let customerAToken: string;
  let customerBToken: string;
  let staffToken: string;
  let addressId: string;
  let hubId: string;
  const createdProductIds: string[] = [];

  async function createVariant(sku: string, stock: number, price: number) {
    const product = await prisma.product.create({
      data: { name: `Test Product ${sku}`, slug: `test-product-${sku}-${suffix}`.toLowerCase(), basePrice: price },
    });
    createdProductIds.push(product.id);
    const variant = await prisma.productVariant.create({
      data: { productId: product.id, sku, name: "Default" },
    });
    await prisma.inventoryItem.create({
      data: { variantId: variant.id, hubId, quantityOnHand: stock, lowStockThreshold: 1 },
    });
    return { productId: product.id, variantId: variant.id };
  }

  async function stockOf(variantId: string): Promise<number> {
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { variantId } });
    return item.quantityOnHand;
  }

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
    paymentsService = app.get(PaymentsService);

    const rbacService = app.get(RbacService);
    const mint = async (id: string, roleName: string) =>
      jwtService.signAsync({
        sub: id,
        email: `${id}@example.com`,
        roles: [roleName],
        permissions: await rbacService.resolvePermissions([roleName]),
      });

    const customerA = await prisma.user.create({
      data: { email: `checkout-a-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true },
    });
    const customerB = await prisma.user.create({
      data: { email: `checkout-b-${suffix}@example.com`, passwordHash: "x", isEmailVerified: true },
    });
    const customerRole = await prisma.role.findUniqueOrThrow({ where: { name: "customer" } });
    await prisma.userRole.createMany({
      data: [
        { userId: customerA.id, roleId: customerRole.id },
        { userId: customerB.id, roleId: customerRole.id },
      ],
    });
    customerAId = customerA.id;
    customerBId = customerB.id;
    customerAToken = await mint(customerA.id, "customer");
    customerBToken = await mint(customerB.id, "customer");
    staffToken = await mint(`staff-${suffix}`, "order_support_agent");

    const hub = await prisma.fulfillmentHub.findUniqueOrThrow({ where: { code: "HUB-DOWNTOWN" } });
    hubId = hub.id;

    const address = await prisma.customerAddress.create({
      data: {
        userId: customerA.id,
        recipientName: "Test Customer",
        line1: "123 Test St",
        city: "Springfield",
        postalCode: "00000",
      },
    });
    addressId = address.id;
  });

  afterAll(async () => {
    // Phase 5's Delivery is created reactively off order.confirmed (fired
    // synchronously within checkout(), same as this suite predates it) and
    // has onDelete: Restrict back to Order — must be cleared first.
    await prisma.proofOfDelivery.deleteMany({ where: { delivery: { order: { userId: { in: [customerAId, customerBId] } } } } });
    await prisma.deliveryEvent.deleteMany({ where: { delivery: { order: { userId: { in: [customerAId, customerBId] } } } } });
    await prisma.delivery.deleteMany({ where: { order: { userId: { in: [customerAId, customerBId] } } } });
    await prisma.paymentEvent.deleteMany({ where: { payment: { order: { userId: { in: [customerAId, customerBId] } } } } });
    await prisma.payment.deleteMany({ where: { order: { userId: { in: [customerAId, customerBId] } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: [customerAId, customerBId] } } } });
    await prisma.order.deleteMany({ where: { userId: { in: [customerAId, customerBId] } } });
    await prisma.customerAddress.deleteMany({ where: { userId: { in: [customerAId, customerBId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [customerAId, customerBId] } } });
    // Product deletion cascades to its variants and inventory items; must
    // run after orders/order items above, since OrderItem's FK to
    // Product/ProductVariant is onDelete: Restrict.
    await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
    await app.close();
  });

  it("rejects checkout without a token", async () => {
    const res = await request(app.getHttpServer()).post("/api/v1/orders/checkout").send({});
    expect(res.status).toBe(401);
  });

  it("completes a successful checkout: decrements stock and confirms the order", async () => {
    const { variantId } = await createVariant(`SUCC-${suffix}`, 10, 9.99);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set(auth(customerAToken))
      .send({ variantId, quantity: 2 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerAToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("CONFIRMED");
    expect(res.body.data.payment.status).toBe("SUCCEEDED");
    expect(typeof res.body.data.totalAmount).toBe("number");
    expect(await stockOf(variantId)).toBe(8);
  });

  it("declines a payment (test decline card): order goes to PAYMENT_FAILED and stock is released", async () => {
    const { variantId } = await createVariant(`DECL-${suffix}`, 10, 5);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set(auth(customerAToken))
      .send({ variantId, quantity: 3 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerAToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED", testCardNumber: "4000000000000002" } });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe("PAYMENT_FAILED");
    expect(res.body.data.payment.status).toBe("FAILED");
    expect(await stockOf(variantId)).toBe(10);
  });

  it("rejects checkout when requested quantity exceeds available stock", async () => {
    const { variantId } = await createVariant(`LOW-${suffix}`, 1, 5);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set(auth(customerAToken))
      .send({ variantId, quantity: 2 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerAToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(await stockOf(variantId)).toBe(1);
    await prisma.cartItem.deleteMany({ where: { cart: { userId: customerAId } } });
  });

  it("does not double-process a duplicate payment event for the same order", async () => {
    const { variantId } = await createVariant(`IDEMP-${suffix}`, 10, 5);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set(auth(customerAToken))
      .send({ variantId, quantity: 1 })
      .expect(201);

    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerAToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    expect(checkoutRes.body.data.status).toBe("CONFIRMED");
    expect(await stockOf(variantId)).toBe(9);

    const order = await prisma.order.findUniqueOrThrow({
      where: { id: checkoutRes.body.data.id },
      include: { payment: true },
    });
    const result = await paymentsService.applyPaymentEvent({
      provider: "SIMULATED",
      providerEventId: `sim_${order.payment!.id}`,
      type: "payment.succeeded",
      paymentId: order.payment!.id,
    });

    expect(result.applied).toBe(false);
    expect(await stockOf(variantId)).toBe(9);
  });

  it("lets the owning customer cancel a confirmed order and releases stock", async () => {
    const { variantId } = await createVariant(`CANCEL-${suffix}`, 10, 5);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set(auth(customerAToken))
      .send({ variantId, quantity: 4 })
      .expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerAToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    const orderId = checkoutRes.body.data.id;
    expect(await stockOf(variantId)).toBe(6);

    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/cancel`)
      .set(auth(customerAToken))
      .send({ reason: "test cancel" });

    expect(cancelRes.status).toBe(201);
    expect(cancelRes.body.data.status).toBe("CANCELLED");
    expect(await stockOf(variantId)).toBe(10);
  });

  it("shows own order history and hides another customer's order detail", async () => {
    const { variantId } = await createVariant(`HIST-${suffix}`, 10, 5);
    await request(app.getHttpServer())
      .post("/api/v1/cart/items")
      .set(auth(customerAToken))
      .send({ variantId, quantity: 1 })
      .expect(201);
    const checkoutRes = await request(app.getHttpServer())
      .post("/api/v1/orders/checkout")
      .set(auth(customerAToken))
      .send({ addressId, paymentMethod: { type: "SIMULATED" } });
    const orderId = checkoutRes.body.data.id;

    const historyRes = await request(app.getHttpServer()).get("/api/v1/orders").set(auth(customerAToken));
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.orders.some((o: { id: string }) => o.id === orderId)).toBe(true);

    const ownDetailRes = await request(app.getHttpServer()).get(`/api/v1/orders/${orderId}`).set(auth(customerAToken));
    expect(ownDetailRes.status).toBe(200);

    const otherDetailRes = await request(app.getHttpServer()).get(`/api/v1/orders/${orderId}`).set(auth(customerBToken));
    expect(otherDetailRes.status).toBe(404);

    const staffDetailRes = await request(app.getHttpServer()).get(`/api/v1/orders/${orderId}`).set(auth(staffToken));
    expect(staffDetailRes.status).toBe(200);
  });

  it("lets staff list all orders and rejects a plain customer from the admin list", async () => {
    const staffRes = await request(app.getHttpServer()).get("/api/v1/orders/admin").set(auth(staffToken));
    expect(staffRes.status).toBe(200);
    expect(Array.isArray(staffRes.body.data.orders)).toBe(true);

    const customerRes = await request(app.getHttpServer()).get("/api/v1/orders/admin").set(auth(customerAToken));
    expect(customerRes.status).toBe(403);
  });
});
