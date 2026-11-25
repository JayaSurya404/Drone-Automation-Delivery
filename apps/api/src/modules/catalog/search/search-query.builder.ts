import { Prisma } from "@prisma/client";
import type { ProductSearchFilters } from "./search.types";

/** Pure, directly-testable SQL fragment builders — kept separate from the DB call itself. */

export function buildSearchConditions(filters: ProductSearchFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`p.is_active = true`];

  if (filters.q) {
    conditions.push(
      Prisma.sql`to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '')) @@ plainto_tsquery('english', ${filters.q})`,
    );
  }
  if (filters.categoryId) {
    conditions.push(Prisma.sql`p.category_id = ${filters.categoryId}`);
  }
  if (filters.minPrice !== undefined) {
    conditions.push(Prisma.sql`p.base_price >= ${filters.minPrice}`);
  }
  if (filters.maxPrice !== undefined) {
    conditions.push(Prisma.sql`p.base_price <= ${filters.maxPrice}`);
  }
  if (filters.inStockOnly) {
    conditions.push(
      Prisma.sql`EXISTS (
        SELECT 1 FROM product_variants v
        JOIN inventory_items ii ON ii.variant_id = v.id
        WHERE v.product_id = p.id AND ii.quantity_on_hand > 0
      )`,
    );
  }

  return conditions;
}

export function buildSearchOrderBy(filters: ProductSearchFilters): Prisma.Sql {
  if (filters.q && (!filters.sort || filters.sort === "relevance")) {
    return Prisma.sql`ts_rank(to_tsvector('english', coalesce(p.name, '') || ' ' || coalesce(p.description, '')), plainto_tsquery('english', ${filters.q})) DESC`;
  }
  switch (filters.sort) {
    case "price_asc":
      return Prisma.sql`p.base_price ASC`;
    case "price_desc":
      return Prisma.sql`p.base_price DESC`;
    case "name_asc":
      return Prisma.sql`p.name ASC`;
    default:
      return Prisma.sql`p.created_at DESC`;
  }
}
