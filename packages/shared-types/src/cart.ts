import { z } from "zod";

export const cartItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  variantId: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  variantName: z.string(),
  unitPrice: z.number(),
  quantity: z.number(),
  lineTotal: z.number(),
  imageUrl: z.string().nullable(),
  isInStock: z.boolean(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export const cartSchema = z.object({
  id: z.string(),
  items: z.array(cartItemSchema),
  subtotal: z.number(),
  itemCount: z.number(),
});
export type Cart = z.infer<typeof cartSchema>;

export const addCartItemRequestSchema = z.object({
  variantId: z.string(),
  quantity: z.number().int().positive().max(99).default(1),
});
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>;

export const updateCartItemRequestSchema = z.object({
  quantity: z.number().int().positive().max(99),
});
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>;

export const wishlistItemSchema = z.object({
  id: z.string(),
  productId: z.string(),
  name: z.string(),
  slug: z.string(),
  price: z.number(),
  imageUrl: z.string().nullable(),
  isInStock: z.boolean(),
  createdAt: z.string(),
});
export type WishlistItem = z.infer<typeof wishlistItemSchema>;
export const wishlistListSchema = z.array(wishlistItemSchema);
