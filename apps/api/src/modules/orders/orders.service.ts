import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { CustomerAddress, Order, OrderItem, Payment, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { generateOrderNumber } from "../../common/order-number.util";
import { toMoney } from "../../common/money.util";
import type { AuthenticatedUser } from "../../common/types/authenticated-user";
import type { EnvConfig } from "../../config/env.validation";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { CartService } from "../cart/cart.service";
import { InventoryService } from "../inventory/inventory.service";
import { AddressesService } from "../users/addresses.service";
import { PaymentsService } from "../payments/payments.service";
import type { AdminListOrdersQueryDto, ListOrdersQueryDto } from "./dto/list-orders-query.dto";
import type { CheckoutDto } from "./dto/checkout.dto";
import type { OrderLifecycleEvent } from "./order-events";
import { calculateOrderPricing } from "./pricing.util";
import { ServiceAreaChecker } from "./service-area.stub";

export interface OrderItemView {
  id: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderSummaryView {
  id: string;
  orderNumber: string;
  status: Order["status"];
  totalAmount: number;
  currency: string;
  itemCount: number;
  createdAt: string;
}

export interface OrderDetailView extends OrderSummaryView {
  userId: string;
  subtotal: number;
  deliveryFee: number;
  taxAmount: number;
  discountAmount: number;
  shippingAddress: unknown;
  deliverySlot: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  confirmedAt: string | null;
  items: OrderItemView[];
  payment: { provider: Payment["provider"]; status: Payment["status"]; failureReason: string | null } | null;
}

type OrderWithRelations = Order & { items: OrderItem[]; payment: Payment | null };

/** What DeliveryModule's `order.confirmed` listener needs to create a `Delivery` — a cross-module read through this exported method, never a direct table read. */
export interface OrderSnapshotForDelivery {
  orderId: string;
  userId: string;
  orderNumber: string;
  shippingAddress: unknown;
  itemSummary: string;
}

const CANCELLABLE_STATUSES = ["CREATED", "PAYMENT_PENDING", "PAID", "CONFIRMED"] as const;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvConfig, true>,
    private readonly cartService: CartService,
    private readonly inventoryService: InventoryService,
    private readonly paymentsService: PaymentsService,
    private readonly addressesService: AddressesService,
    private readonly auditService: AuditService,
    private readonly serviceAreaChecker: ServiceAreaChecker,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async checkout(userId: string, dto: CheckoutDto): Promise<OrderDetailView> {
    const cart = await this.cartService.getCart(userId);
    if (cart.items.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    const address = await this.addressesService.getOwnedOrThrow(userId, dto.addressId);
    await this.serviceAreaChecker.check(address, dto);

    const pricing = this.calculatePricing(cart.subtotal);
    const orderId = randomUUID();
    const orderNumber = generateOrderNumber();

    const order = await this.prisma.$transaction(async (tx) => {
      await this.inventoryService.reserveStock(
        tx,
        cart.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity, label: item.productName })),
        `order:${orderId}`,
      );

      const created = await tx.order.create({
        data: {
          id: orderId,
          orderNumber,
          userId,
          addressId: address.id,
          status: "PAYMENT_PENDING",
          shippingAddress: this.addressSnapshot(address) as Prisma.InputJsonValue,
          deliverySlot: dto.deliverySlot,
          subtotal: pricing.subtotal,
          deliveryFee: pricing.deliveryFee,
          taxAmount: pricing.taxAmount,
          discountAmount: 0,
          totalAmount: pricing.totalAmount,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
              unitPrice: item.unitPrice,
              quantity: item.quantity,
              lineTotal: item.lineTotal,
            })),
          },
          payment: {
            create: {
              provider: dto.paymentMethod.type,
              status: "PENDING",
              amount: pricing.totalAmount,
            },
          },
        },
        include: { items: true, payment: true },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    await this.auditService.log({
      actorId: userId,
      action: "orders.created",
      targetType: "Order",
      targetId: order.id,
      metadata: { orderNumber: order.orderNumber, totalAmount: pricing.totalAmount, provider: dto.paymentMethod.type },
    });

    await this.initiatePaymentSafely(order, dto);

    const finalOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payment: true },
    });
    return this.toDetailView(finalOrder);
  }

  async listOwnOrders(
    userId: string,
    query: ListOrdersQueryDto,
  ): Promise<{ orders: OrderSummaryView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        include: { items: true, payment: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return { orders: orders.map((order) => this.toSummaryView(order)), total, page, pageSize };
  }

  async listAllOrders(
    query: AdminListOrdersQueryDto,
  ): Promise<{ orders: OrderSummaryView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: { items: true, payment: true },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders: orders.map((order) => this.toSummaryView(order)), total, page, pageSize };
  }

  async getOrderForViewer(orderId: string, viewer: AuthenticatedUser): Promise<OrderDetailView> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { items: true, payment: true } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const isStaff = viewer.permissions.includes("orders.read");
    const isOwner = order.userId === viewer.sub && viewer.permissions.includes("orders.read_own");
    if (!isStaff && !isOwner) {
      throw new NotFoundException("Order not found");
    }

    return this.toDetailView(order);
  }

  async cancelOrder(orderId: string, actor: AuthenticatedUser, reason: string | undefined): Promise<OrderDetailView> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException("Order not found");
    }

    const isStaff = actor.permissions.includes("orders.read");
    if (!isStaff && order.userId !== actor.sub) {
      throw new NotFoundException("Order not found");
    }
    if (!CANCELLABLE_STATUSES.includes(order.status as (typeof CANCELLABLE_STATUSES)[number])) {
      throw new ConflictException(`Order cannot be cancelled from status ${order.status}`);
    }

    // Phase 12 fix: the status flip and the stock release used to be two
    // separate operations — a crash in between left a permanently-CANCELLED
    // order whose reserved stock was never returned to inventory (no retry
    // mechanism, since a CANCELLED order can't be re-cancelled). Both now
    // commit or roll back together.
    const result = await this.prisma.$transaction(async (tx) => {
      const updateResult = await tx.order.updateMany({
        where: { id: orderId, status: { in: [...CANCELLABLE_STATUSES] } },
        data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
      });
      if (updateResult.count > 0) {
        await this.inventoryService.releaseStockWithTx(tx, orderId);
      }
      return updateResult;
    });
    if (result.count === 0) {
      throw new ConflictException("Order status changed concurrently — please retry");
    }

    await this.auditService.log({
      actorId: actor.sub,
      action: "orders.cancelled",
      targetType: "Order",
      targetId: orderId,
      metadata: { reason },
    });

    // DeliveryModule subscribes to this to cancel any linked Delivery that
    // hasn't completed yet — same one-way event-bus decoupling as
    // `order.confirmed` above; OrdersModule never calls into DeliveryModule.
    const event: OrderLifecycleEvent = { orderId };
    await this.eventEmitter.emitAsync("order.cancelled", event);

    const finalOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: true, payment: true },
    });
    return this.toDetailView(finalOrder);
  }

  /** Cross-module read for DeliveryModule's `order.confirmed` listener — never read `orders`/`order_items` directly from another module. */
  async getOrderSnapshotForDelivery(orderId: string): Promise<OrderSnapshotForDelivery> {
    const order = await this.prisma.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
    const itemSummary = order.items
      .map((item) => `${item.productName}${item.quantity > 1 ? ` x${item.quantity}` : ""}`)
      .join(", ");
    return {
      orderId: order.id,
      userId: order.userId,
      orderNumber: order.orderNumber,
      shippingAddress: order.shippingAddress,
      itemSummary,
    };
  }

  private async initiatePaymentSafely(order: OrderWithRelations, dto: CheckoutDto): Promise<void> {
    if (!order.payment) {
      return;
    }
    try {
      await this.paymentsService.initiatePayment({
        paymentId: order.payment.id,
        orderId: order.id,
        amount: toMoney(order.totalAmount),
        currency: order.currency,
        provider: order.payment.provider,
        testCardNumber: dto.paymentMethod.type === "SIMULATED" ? dto.paymentMethod.testCardNumber : undefined,
      });
    } catch {
      // A provider-side error (e.g. Stripe misconfigured, unexpected SDK
      // failure) is still a normal "this order didn't get paid" outcome for
      // the customer, not a 500 — route it through the same idempotent path
      // so the order/stock end up consistent either way.
      await this.paymentsService.applyPaymentEvent({
        provider: order.payment.provider,
        providerEventId: `error_${order.payment.id}`,
        type: "payment.failed",
        paymentId: order.payment.id,
        failureReason: "Payment initiation failed",
      });
    }
  }

  private calculatePricing(subtotal: number) {
    return calculateOrderPricing(subtotal, {
      deliveryFeeFlat: this.configService.get("DELIVERY_FEE_FLAT", { infer: true }),
      freeDeliveryThreshold: this.configService.get("FREE_DELIVERY_THRESHOLD", { infer: true }),
      taxRate: this.configService.get("TAX_RATE", { infer: true }),
    });
  }

  private addressSnapshot(address: CustomerAddress): Record<string, unknown> {
    return {
      recipientName: address.recipientName,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      phone: address.phone,
    };
  }

  private toSummaryView(order: OrderWithRelations): OrderSummaryView {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: toMoney(order.totalAmount),
      currency: order.currency,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    };
  }

  private toDetailView(order: OrderWithRelations): OrderDetailView {
    return {
      ...this.toSummaryView(order),
      userId: order.userId,
      subtotal: toMoney(order.subtotal),
      deliveryFee: toMoney(order.deliveryFee),
      taxAmount: toMoney(order.taxAmount),
      discountAmount: toMoney(order.discountAmount),
      shippingAddress: order.shippingAddress,
      deliverySlot: order.deliverySlot,
      cancelledAt: order.cancelledAt ? order.cancelledAt.toISOString() : null,
      cancelReason: order.cancelReason,
      confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
        unitPrice: toMoney(item.unitPrice),
        quantity: item.quantity,
        lineTotal: toMoney(item.lineTotal),
      })),
      payment: order.payment
        ? { provider: order.payment.provider, status: order.payment.status, failureReason: order.payment.failureReason }
        : null,
    };
  }
}
