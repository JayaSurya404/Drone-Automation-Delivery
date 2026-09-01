import type { Kysely } from "kysely";
import type { Database } from "../../infrastructure/db/schema.js";
import type { ProductListQuery } from "@skynav/contracts";

export interface CatalogRepository {
  list(query: ProductListQuery): Promise<{ items: any[]; total: number }>;
  findById(id: string): Promise<any | null>;
  findBySlug(slug: string): Promise<any | null>;
  getCategories(): Promise<Array<{ category: string; count: number }>>;
}

export function createCatalogRepository(db: Kysely<Database>): CatalogRepository {
  return {
    async list(query) {
      let q = db.selectFrom("products").selectAll().where("is_active", "=", true);

      if (query.category) {
        q = q.where("category", "=", query.category);
      }
      if (query.featured !== undefined) {
        q = q.where("is_featured", "=", query.featured);
      }
      if (query.search) {
        const term = `%${query.search.toLowerCase()}%`;
        q = q.where((eb) =>
          eb.or([
            eb("name", "ilike", term),
            eb("description", "ilike", term),
            eb("category", "ilike", term)
          ])
        );
      }

      // Count query
      let countQ = db.selectFrom("products").select(db.fn.count("id").as("total")).where("is_active", "=", true);
      if (query.category) countQ = countQ.where("category", "=", query.category);
      if (query.featured !== undefined) countQ = countQ.where("is_featured", "=", query.featured);
      if (query.search) {
        const term = `%${query.search.toLowerCase()}%`;
        countQ = countQ.where((eb) =>
          eb.or([
            eb("name", "ilike", term),
            eb("description", "ilike", term),
            eb("category", "ilike", term)
          ])
        );
      }

      const [items, countResult] = await Promise.all([
        q.orderBy("is_featured", "desc").orderBy("name", "asc").limit(query.limit).offset(query.offset).execute(),
        countQ.executeTakeFirst()
      ]);

      const total = Number(countResult?.total ?? items.length);
      return { items, total };
    },

    async findById(id) {
      const row = await db.selectFrom("products").selectAll().where("id", "=", id).where("is_active", "=", true).executeTakeFirst();
      return row || null;
    },

    async findBySlug(slug) {
      const row = await db.selectFrom("products").selectAll().where("slug", "=", slug).where("is_active", "=", true).executeTakeFirst();
      return row || null;
    },

    async getCategories() {
      const rows = await db
        .selectFrom("products")
        .select(["category", db.fn.count("id").as("count")])
        .where("is_active", "=", true)
        .groupBy("category")
        .orderBy("category", "asc")
        .execute();

      return rows.map((r) => ({
        category: r.category,
        count: Number(r.count)
      }));
    }
  };
}
