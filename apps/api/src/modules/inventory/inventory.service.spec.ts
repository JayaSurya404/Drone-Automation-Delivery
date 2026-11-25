import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { InventoryService } from "./inventory.service";

describe("InventoryService.adjustStock", () => {
  let service: InventoryService;
  let prisma: {
    inventoryItem: { findUnique: jest.Mock; update: jest.Mock };
    stockMovement: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditService: { log: jest.Mock };

  const existingItem = { id: "item-1", quantityOnHand: 10, lowStockThreshold: 5 };
  const updatedItem = {
    id: "item-1",
    hubId: "hub-1",
    hub: { name: "Downtown Hub" },
    variantId: "variant-1",
    variant: { sku: "SKU-1", name: "Default", productId: "product-1", product: { name: "Widget" } },
    quantityOnHand: 15,
    lowStockThreshold: 5,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      inventoryItem: {
        findUnique: jest.fn().mockResolvedValue(existingItem),
        update: jest.fn(),
      },
      stockMovement: { create: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([updatedItem, {}]),
    };
    auditService = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(InventoryService);
  });

  it("applies a positive adjustment and records a stock movement", async () => {
    const result = await service.adjustStock("item-1", { quantityDelta: 5, type: "RECEIPT" }, "actor-1");

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.quantityOnHand).toBe(15);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "inventory.stock_adjusted", actorId: "actor-1" }),
    );
  });

  it("rejects an adjustment that would make stock negative", async () => {
    await expect(
      service.adjustStock("item-1", { quantityDelta: -20, type: "ADJUSTMENT" }, "actor-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("throws NotFoundException for an unknown inventory item", async () => {
    prisma.inventoryItem.findUnique.mockResolvedValueOnce(null);
    await expect(
      service.adjustStock("missing", { quantityDelta: 1, type: "RECEIPT" }, "actor-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("computes isLowStock relative to the threshold", async () => {
    prisma.$transaction.mockResolvedValueOnce([{ ...updatedItem, quantityOnHand: 3, lowStockThreshold: 5 }, {}]);
    const result = await service.adjustStock("item-1", { quantityDelta: -7, type: "SALE" }, "actor-1");
    expect(result.isLowStock).toBe(true);
  });
});
