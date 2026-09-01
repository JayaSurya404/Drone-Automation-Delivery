import type { CartRepository } from "./cart.repository.js";
import type { AuthenticatedUser, CartResponse, AddToCartRequest, UpdateCartItemRequest } from "@skynav/contracts";
import type { CatalogRepository } from "../catalog/catalog.repository.js";
import { AuthError } from "../auth/auth.service.js";

export interface CartService {
  getCart(user: AuthenticatedUser): Promise<CartResponse>;
  addToCart(user: AuthenticatedUser, input: AddToCartRequest): Promise<CartResponse>;
  updateCartItem(user: AuthenticatedUser, itemId: string, input: UpdateCartItemRequest): Promise<CartResponse>;
  removeCartItem(user: AuthenticatedUser, itemId: string): Promise<CartResponse>;
  clearCart(user: AuthenticatedUser): Promise<CartResponse>;
}

export function createCartService(cartRepo: CartRepository, catalogRepo: CatalogRepository): CartService {
  async function computeCartResponse(userId: string): Promise<CartResponse> {
    const rows = await cartRepo.getCart(userId);
    let subtotalCents = 0;
    let totalWeightGrams = 0;
    let itemCount = 0;

    const items = rows.map((r) => {
      const qty = r.quantity;
      const itemSubtotal = r.price_cents * qty;
      const itemWeight = r.weight_grams * qty;
      subtotalCents += itemSubtotal;
      totalWeightGrams += itemWeight;
      itemCount += qty;

      return {
        id: r.item_id,
        productId: r.product_id,
        product: {
          id: r.product_id,
          name: r.name,
          slug: r.slug,
          description: r.description,
          category: r.category,
          priceCents: r.price_cents,
          currency: r.currency || "USD",
          imageUrl: r.image_url,
          stockQuantity: r.stock_quantity,
          weightGrams: r.weight_grams,
          lengthCm: r.length_cm,
          widthCm: r.width_cm,
          heightCm: r.height_cm,
          isDroneEligible: r.is_drone_eligible,
          isFeatured: r.is_featured,
          isActive: r.is_active,
          createdAt: r.product_created_at instanceof Date ? r.product_created_at.toISOString() : String(r.product_created_at),
          updatedAt: r.product_updated_at instanceof Date ? r.product_updated_at.toISOString() : String(r.product_updated_at)
        },
        quantity: qty,
        createdAt: r.item_created_at instanceof Date ? r.item_created_at.toISOString() : String(r.item_created_at),
        updatedAt: r.item_updated_at instanceof Date ? r.item_updated_at.toISOString() : String(r.item_updated_at)
      };
    });

    // Free drone delivery promo if subtotal > $35 (3500 cents), else standard $4.99 (499 cents)
    const deliveryFeeCents = itemCount > 0 && subtotalCents < 3500 ? 499 : 0;
    const totalCents = subtotalCents + deliveryFeeCents;
    const isDronePayloadCompliant = totalWeightGrams <= 5000;

    return {
      items,
      itemCount,
      totalWeightGrams,
      subtotalCents,
      deliveryFeeCents,
      totalCents,
      currency: "USD",
      isDronePayloadCompliant
    };
  }

  return {
    async getCart(user) {
      return computeCartResponse(user.id);
    },

    async addToCart(user, input) {
      const product = await catalogRepo.findById(input.productId);
      if (!product || !product.is_active) {
        throw new AuthError(404, "PRODUCT_NOT_FOUND", "Product is not available for purchase.");
      }
      await cartRepo.addItem(user.id, input.productId, input.quantity);
      return computeCartResponse(user.id);
    },

    async updateCartItem(user, itemId, input) {
      await cartRepo.updateQuantity(user.id, itemId, input.quantity);
      return computeCartResponse(user.id);
    },

    async removeCartItem(user, itemId) {
      await cartRepo.removeItem(user.id, itemId);
      return computeCartResponse(user.id);
    },

    async clearCart(user) {
      await cartRepo.clearCart(user.id);
      return computeCartResponse(user.id);
    }
  };
}
