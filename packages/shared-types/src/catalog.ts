import { z } from "zod";

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  parentId: z.string().nullable(),
  position: z.number(),
});
export type Category = z.infer<typeof categorySchema>;
export const categoryListSchema = z.array(categorySchema);

export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
}
export const categoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = categorySchema.extend({
  children: z.lazy(() => z.array(categoryTreeNodeSchema)),
});

export const productImageSchema = z.object({
  id: z.string(),
  url: z.string(),
  altText: z.string().nullable(),
  position: z.number(),
});
export type ProductImage = z.infer<typeof productImageSchema>;

export const productVariantSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  isActive: z.boolean(),
  isInStock: z.boolean(),
});
export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable(),
  primaryImageUrl: z.string().nullable(),
  isInStock: z.boolean(),
  createdAt: z.string(),
});
export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productDetailSchema = productSummarySchema.extend({
  images: z.array(productImageSchema),
  variants: z.array(productVariantSchema),
});
export type ProductDetail = z.infer<typeof productDetailSchema>;

export const paginatedProductsSchema = z.object({
  products: z.array(productSummarySchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});
export type PaginatedProducts = z.infer<typeof paginatedProductsSchema>;

export const productSortSchema = z.enum(["newest", "price_asc", "price_desc", "name_asc", "relevance"]);
export type ProductSort = z.infer<typeof productSortSchema>;

export const listProductsQuerySchema = z.object({
  q: z.string().optional(),
  categorySlug: z.string().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  inStockOnly: z.boolean().optional(),
  sort: productSortSchema.optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

// --- Admin (catalog management) ----------------------------------------

export const createCategoryRequestSchema = z.object({
  name: z.string().min(1).max(150),
  slug: z.string().min(1).max(150),
  description: z.string().optional(),
  parentId: z.string().optional(),
  position: z.number().optional(),
});
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;

export const updateCategoryRequestSchema = createCategoryRequestSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;

export const variantInputSchema = z.object({
  sku: z.string().min(1).max(64),
  name: z.string().min(1).max(150),
  priceOverride: z.number().optional(),
});
export type VariantInput = z.infer<typeof variantInputSchema>;

export const createProductRequestSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  description: z.string().optional(),
  basePrice: z.number().min(0),
  currency: z.string().max(3).optional(),
  categoryId: z.string().optional(),
  variants: z.array(variantInputSchema).min(1),
});
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;

export const updateProductRequestSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  basePrice: z.number().min(0).optional(),
  currency: z.string().max(3).optional(),
  categoryId: z.string().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;

/** Raw shape returned by POST/PATCH .../variants (a Prisma ProductVariant row, not the computed customer view). */
export const variantRecordSchema = z.object({
  id: z.string(),
  productId: z.string(),
  sku: z.string(),
  name: z.string(),
  priceOverride: z.union([z.number(), z.string()]).nullable(),
  isActive: z.boolean(),
});
export type VariantRecord = z.infer<typeof variantRecordSchema>;

export const updateVariantRequestSchema = z.object({
  sku: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(150).optional(),
  priceOverride: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateVariantRequest = z.infer<typeof updateVariantRequestSchema>;
