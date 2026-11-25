import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { buildSearchConditions, buildSearchOrderBy } from "./search-query.builder";
import type { ProductSearchFilters, ProductSearchResult, SearchService } from "./search.types";

interface SearchRow {
  id: string;
  total_count: bigint;
}

@Injectable()
export class PostgresSearchService implements SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchProducts(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    const conditions = buildSearchConditions(filters);
    const orderBy = buildSearchOrderBy(filters);

    const rows = await this.prisma.$queryRaw<SearchRow[]>`
      SELECT p.id, COUNT(*) OVER() AS total_count
      FROM products p
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY ${orderBy}
      LIMIT ${filters.take} OFFSET ${filters.skip}
    `;

    return {
      productIds: rows.map((row) => row.id),
      total: rows[0] ? Number(rows[0].total_count) : 0,
    };
  }
}
