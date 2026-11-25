import { z } from "zod";

export const inventoryItemSchema = z.object({
  id: z.string(),
  hubId: z.string(),
  hubName: z.string(),
  variantId: z.string(),
  variantSku: z.string(),
  variantName: z.string(),
  productId: z.string(),
  productName: z.string(),
  quantityOnHand: z.number(),
  lowStockThreshold: z.number(),
  isLowStock: z.boolean(),
  updatedAt: z.string(),
});
export type InventoryItem = z.infer<typeof inventoryItemSchema>;

export const paginatedInventorySchema = z.object({
  items: z.array(inventoryItemSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaginatedInventory = z.infer<typeof paginatedInventorySchema>;

export const fulfillmentHubSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  address: z.string(),
  isActive: z.boolean(),
});
export type FulfillmentHub = z.infer<typeof fulfillmentHubSchema>;

export const stockMovementTypeSchema = z.enum(["RECEIPT", "SALE", "ADJUSTMENT", "RETURN"]);
export type StockMovementType = z.infer<typeof stockMovementTypeSchema>;

export const adjustStockRequestSchema = z.object({
  quantityDelta: z.number().int().refine((n) => n !== 0, "quantityDelta must not be 0"),
  type: stockMovementTypeSchema,
  reason: z.string().max(255).optional(),
});
export type AdjustStockRequest = z.infer<typeof adjustStockRequestSchema>;
