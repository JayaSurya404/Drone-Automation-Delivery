import type { CartRepository } from "./cart.repository.js";
import {
  COMMERCE_CONFIG,
  type AuthenticatedUser,
  type CartResponse,
  type AddToCartRequest,
  type UpdateCartItemRequest
} from "@skynav/contracts";
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
    let subtotalPaise = 0;
    let mrpTotalPaise = 0;
    let totalWeightGrams = 0;
    let itemCount = 0;

    const items = rows.map((r) => {
      const qty = r.quantity;
      const pricePaise = r.price_cents || 0;
      const mrpPaise = r.mrp_cents || Math.round(pricePaise * 1.15);
      const discountPercent = mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;

      const itemSubtotal = pricePaise * qty;
      const itemMrpTotal = mrpPaise * qty;
      const itemWeight = r.weight_grams * qty;

      subtotalPaise += itemSubtotal;
      mrpTotalPaise += itemMrpTotal;
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
          pricePaise,
          mrpPaise,
          discountPercent,
          priceCents: pricePaise,
          currency: r.currency || "INR",
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

    const packagingWeightGrams = itemCount > 0 ? COMMERCE_CONFIG.PACKAGING_ALLOWANCE_GRAMS : 0;
    const grossWeightGrams = totalWeightGrams + packagingWeightGrams;
    const operationalPayloadLimitGrams = COMMERCE_CONFIG.OPERATIONAL_PAYLOAD_LIMIT_GRAMS;
    const isPayloadExceeded = grossWeightGrams > operationalPayloadLimitGrams;
    const remainingCapacityGrams = Math.max(0, operationalPayloadLimitGrams - grossWeightGrams);
    const isDronePayloadCompliant = !isPayloadExceeded;

    // Free drone delivery on orders >= ₹499 (49900 paise), else ₹39 (3900 paise)
    const deliveryFeePaise =
      itemCount > 0 && subtotalPaise < COMMERCE_CONFIG.FREE_DELIVERY_THRESHOLD_PAISE
        ? COMMERCE_CONFIG.STANDARD_DELIVERY_FEE_PAISE
        : 0;
    const totalPaise = subtotalPaise + deliveryFeePaise;
    const savingsPaise = Math.max(0, mrpTotalPaise - subtotalPaise);

    return {
      items,
      itemCount,
      totalWeightGrams,
      packagingWeightGrams,
      grossWeightGrams,
      operationalPayloadLimitGrams,
      remainingCapacityGrams,
      isPayloadExceeded,
      subtotalPaise,
      deliveryFeePaise,
      totalPaise,
      savingsPaise,
      subtotalCents: subtotalPaise,
      deliveryFeeCents: deliveryFeePaise,
      totalCents: totalPaise,
      currency: "INR",
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
      if (input.quantity <= 0) {
        await cartRepo.removeItem(user.id, itemId);
      } else {
        await cartRepo.updateQuantity(user.id, itemId, input.quantity);
      }
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
