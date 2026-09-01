import type { CatalogRepository } from "./catalog.repository.js";
import type { ProductListQuery, ProductListResponse, ProductResponse } from "@skynav/contracts";
import { AuthError } from "../auth/auth.service.js";

export interface CatalogService {
  listProducts(query: ProductListQuery): Promise<ProductListResponse>;
  getProduct(idOrSlug: string): Promise<ProductResponse>;
  getCategories(): Promise<Array<{ category: string; count: number }>>;
}

export function createCatalogService(repo: CatalogRepository): CatalogService {
  function mapProduct(p: any): ProductResponse {
    const pricePaise = p.price_cents || 0;
    const mrpPaise = p.mrp_cents || Math.round(pricePaise * 1.15);
    const discountPercent = mrpPaise > pricePaise ? Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      category: p.category,
      pricePaise,
      mrpPaise,
      discountPercent,
      priceCents: pricePaise, // Compatibility alias
      currency: p.currency || "INR",
      imageUrl: p.image_url,
      stockQuantity: p.stock_quantity,
      weightGrams: p.weight_grams,
      lengthCm: p.length_cm,
      widthCm: p.width_cm,
      heightCm: p.height_cm,
      isDroneEligible: p.is_drone_eligible,
      isFeatured: p.is_featured,
      isActive: p.is_active,
      createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : String(p.created_at),
      updatedAt: p.updated_at instanceof Date ? p.updated_at.toISOString() : String(p.updated_at)
    };
  }

  return {
    async listProducts(query) {
      const { items, total } = await repo.list(query);
      return {
        data: items.map(mapProduct),
        pagination: {
          total,
          limit: query.limit,
          offset: query.offset
        }
      };
    },

    async getProduct(idOrSlug) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
      const product = isUuid ? await repo.findById(idOrSlug) : await repo.findBySlug(idOrSlug);
      if (!product) {
        throw new AuthError(404, "PRODUCT_NOT_FOUND", `Product '${idOrSlug}' not found.`);
      }
      return mapProduct(product);
    },

    async getCategories() {
      return repo.getCategories();
    }
  };
}
