import type { WishlistRepository } from "./wishlist.repository.js";
import type { AuthenticatedUser, WishlistResponse, AddWishlistRequest } from "@skynav/contracts";
import type { CatalogRepository } from "../catalog/catalog.repository.js";
import { AuthError } from "../auth/auth.service.js";

export interface WishlistService {
  getWishlist(user: AuthenticatedUser): Promise<WishlistResponse>;
  addToWishlist(user: AuthenticatedUser, input: AddWishlistRequest): Promise<WishlistResponse>;
  removeFromWishlist(user: AuthenticatedUser, productId: string): Promise<WishlistResponse>;
}

export function createWishlistService(wishlistRepo: WishlistRepository, catalogRepo: CatalogRepository): WishlistService {
  async function computeWishlistResponse(userId: string): Promise<WishlistResponse> {
    const rows = await wishlistRepo.getWishlist(userId);
    const items = rows.map((r) => ({
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
      createdAt: r.item_created_at instanceof Date ? r.item_created_at.toISOString() : String(r.item_created_at)
    }));

    return {
      items,
      total: items.length
    };
  }

  return {
    async getWishlist(user) {
      return computeWishlistResponse(user.id);
    },

    async addToWishlist(user, input) {
      const product = await catalogRepo.findById(input.productId);
      if (!product || !product.is_active) {
        throw new AuthError(404, "PRODUCT_NOT_FOUND", "Product is not available.");
      }
      await wishlistRepo.addItem(user.id, input.productId);
      return computeWishlistResponse(user.id);
    },

    async removeFromWishlist(user, productId) {
      await wishlistRepo.removeItem(user.id, productId);
      return computeWishlistResponse(user.id);
    }
  };
}
