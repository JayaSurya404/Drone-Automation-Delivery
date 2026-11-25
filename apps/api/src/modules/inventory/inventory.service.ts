import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { AdjustStockDto } from "./dto/adjust-stock.dto";
import type { ListInventoryQueryDto } from "./dto/list-inventory-query.dto";

export interface StockReservationRequest {
  variantId: string;
  quantity: number;
  /** Used only to produce a readable error message on insufficient stock. */
  label?: string;
}

export interface InventoryItemView {
  id: string;
  hubId: string;
  hubName: string;
  variantId: string;
  variantSku: string;
  variantName: string;
  productId: string;
  productName: string;
  quantityOnHand: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  updatedAt: string;
}

const inventoryItemInclude = {
  hub: true,
  variant: { include: { product: true } },
} satisfies Prisma.InventoryItemInclude;

type InventoryItemWithRelations = Prisma.InventoryItemGetPayload<{ include: typeof inventoryItemInclude }>;

interface InventoryIdRow {
  id: string;
  total_count: bigint;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async listInventory(
    query: ListInventoryQueryDto,
  ): Promise<{ items: InventoryItemView[]; total: number; page: number; pageSize: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // A "quantity_on_hand <= low_stock_threshold" comparison is between two
    // columns of the same row, which Prisma's fluent `where` can't express —
    // hence the raw id lookup (same pattern as CatalogService's search path).
    const conditions: Prisma.Sql[] = [Prisma.sql`1 = 1`];
    if (query.hubId) {
      conditions.push(Prisma.sql`hub_id = ${query.hubId}`);
    }
    if (query.lowStockOnly) {
      conditions.push(Prisma.sql`quantity_on_hand <= low_stock_threshold`);
    }

    const rows = await this.prisma.$queryRaw<InventoryIdRow[]>`
      SELECT id, COUNT(*) OVER() AS total_count
      FROM inventory_items
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY updated_at DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    `;

    const [firstRow] = rows;
    if (!firstRow) {
      return { items: [], total: 0, page, pageSize };
    }

    const ids = rows.map((row) => row.id);
    const items = await this.prisma.inventoryItem.findMany({
      where: { id: { in: ids } },
      include: inventoryItemInclude,
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = ids.map((id) => byId.get(id)).filter((item): item is InventoryItemWithRelations => !!item);

    return { items: ordered.map((item) => this.toView(item)), total: Number(firstRow.total_count), page, pageSize };
  }

  async listHubs() {
    return this.prisma.fulfillmentHub.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, address: true, isActive: true },
      orderBy: { name: "asc" },
    });
  }

  /** Adjusts quantity on hand and records the change in the append-only stock_movements audit trail. */
  async adjustStock(inventoryItemId: string, dto: AdjustStockDto, actorId: string): Promise<InventoryItemView> {
    const existing = await this.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!existing) {
      throw new NotFoundException("Inventory item not found");
    }

    const newQuantity = existing.quantityOnHand + dto.quantityDelta;
    if (newQuantity < 0) {
      throw new BadRequestException("Adjustment would result in negative stock");
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: { quantityOnHand: newQuantity },
        include: inventoryItemInclude,
      }),
      this.prisma.stockMovement.create({
        data: {
          inventoryItemId,
          type: dto.type,
          quantityDelta: dto.quantityDelta,
          reason: dto.reason,
          actorId,
        },
      }),
    ]);

    await this.auditService.log({
      actorId,
      action: "inventory.stock_adjusted",
      targetType: "InventoryItem",
      targetId: inventoryItemId,
      metadata: { quantityDelta: dto.quantityDelta, type: dto.type, newQuantity },
    });

    return this.toView(updated);
  }

  /**
   * Decrements stock for each request inside the caller's own transaction
   * (`tx`) so it commits or rolls back atomically with whatever the caller
   * is doing — this is the one deliberate exception to "cross-module side
   * effects go through the event bus" (see docs/ARCHITECTURE.md): checkout's
   * "order creation and inventory changes must be transactionally safe"
   * requirement can't be satisfied by an eventually-consistent event, so the
   * write is still funneled through InventoryService's own logic, just
   * parameterized on a transaction client instead of `this.prisma`.
   *
   * Each request is filled from a single fulfillment hub (the first one,
   * ordered by quantity on hand descending, that alone can cover it) rather
   * than split across hubs — hub-aware fulfillment/routing doesn't exist
   * until Phase 5's delivery/mission planning, so splitting a line item
   * across hubs would add complexity nothing yet needs.
   *
   * Every decrement is recorded as a SALE `StockMovement` with `reason`
   * set to the caller-supplied tag (checkout uses `order:<orderId>`) so a
   * later release (see `releaseStockForOrder`) can find and reverse exactly
   * these movements without needing to be handed them back explicitly.
   */
  async reserveStock(tx: Prisma.TransactionClient, requests: StockReservationRequest[], reason: string): Promise<void> {
    for (const request of requests) {
      const candidates = await tx.inventoryItem.findMany({
        where: { variantId: request.variantId },
        orderBy: { quantityOnHand: "desc" },
      });
      const candidate = candidates.find((item) => item.quantityOnHand >= request.quantity);
      if (!candidate) {
        throw new ConflictException(`Insufficient stock for ${request.label ?? request.variantId}`);
      }

      const result = await tx.inventoryItem.updateMany({
        where: { id: candidate.id, quantityOnHand: { gte: request.quantity } },
        data: { quantityOnHand: { decrement: request.quantity } },
      });
      if (result.count === 0) {
        // Lost a race to a concurrent order between the read above and this write.
        throw new ConflictException(`Insufficient stock for ${request.label ?? request.variantId}`);
      }

      await tx.stockMovement.create({
        data: { inventoryItemId: candidate.id, type: "SALE", quantityDelta: -request.quantity, reason },
      });
    }
  }

  /** Reverses every SALE movement tagged `order:<orderId>` — used on payment failure and on order cancellation. Wraps its own transaction; use `releaseStockWithTx` instead when the caller already has one open (e.g. `OrdersService.cancelOrder()`, so the status flip and the stock release commit/rollback atomically together). */
  async releaseStockForOrder(orderId: string): Promise<void> {
    await this.prisma.$transaction((tx) => this.releaseStockWithTx(tx, orderId));
  }

  /** Phase 12 fix: extracted so `OrdersService.cancelOrder()` can join this into its own transaction — previously the order flipped to CANCELLED and the stock release ran as two separate operations, so a crash in between left a permanently-cancelled order whose stock was never returned to inventory (no retry mechanism, since a CANCELLED order can't be re-cancelled). */
  async releaseStockWithTx(tx: Prisma.TransactionClient, orderId: string): Promise<void> {
    const reason = `order:${orderId}`;
    const movements = await tx.stockMovement.findMany({ where: { reason, type: "SALE" } });
    for (const movement of movements) {
      await tx.inventoryItem.update({
        where: { id: movement.inventoryItemId },
        data: { quantityOnHand: { increment: -movement.quantityDelta } },
      });
      await tx.stockMovement.create({
        data: {
          inventoryItemId: movement.inventoryItemId,
          type: "RETURN",
          quantityDelta: -movement.quantityDelta,
          reason: `release:${orderId}`,
        },
      });
    }
  }

  private toView(item: InventoryItemWithRelations): InventoryItemView {
    return {
      id: item.id,
      hubId: item.hubId,
      hubName: item.hub.name,
      variantId: item.variantId,
      variantSku: item.variant.sku,
      variantName: item.variant.name,
      productId: item.variant.productId,
      productName: item.variant.product.name,
      quantityOnHand: item.quantityOnHand,
      lowStockThreshold: item.lowStockThreshold,
      isLowStock: item.quantityOnHand <= item.lowStockThreshold,
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}
