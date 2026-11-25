export type ProductSort = "newest" | "price_asc" | "price_desc" | "name_asc" | "relevance";

export interface ProductSearchFilters {
  q?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  sort?: ProductSort;
  skip: number;
  take: number;
}

export interface ProductSearchResult {
  /** Product IDs in final result order — caller re-fetches full rows preserving this order. */
  productIds: string[];
  total: number;
}

export const SEARCH_SERVICE = Symbol("SEARCH_SERVICE");

/**
 * Adapter interface (blueprint Section P / PROJECT_CONTEXT.md adapter-everywhere
 * principle): callers depend on this, never on Postgres/FTS directly, so a
 * dedicated search engine (Meilisearch/OpenSearch) can be swapped in later
 * behind the same contract without touching CatalogService.
 */
export interface SearchService {
  searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult>;
}
