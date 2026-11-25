import type { ProductSearchFilters } from "./search.types";
import { buildSearchConditions, buildSearchOrderBy } from "./search-query.builder";

const baseFilters: ProductSearchFilters = { skip: 0, take: 20 };

function sqlText(fragment: { strings: readonly string[] }): string {
  return fragment.strings.join("?");
}

describe("buildSearchConditions", () => {
  it("always requires the product to be active", () => {
    const conditions = buildSearchConditions(baseFilters);
    expect(conditions).toHaveLength(1);
    expect(sqlText(conditions[0]!)).toContain("p.is_active = true");
  });

  it("adds a full-text search condition only when q is present", () => {
    const withQuery = buildSearchConditions({ ...baseFilters, q: "coffee" });
    expect(withQuery.some((c) => sqlText(c).includes("plainto_tsquery"))).toBe(true);

    const withoutQuery = buildSearchConditions(baseFilters);
    expect(withoutQuery.some((c) => sqlText(c).includes("plainto_tsquery"))).toBe(false);
  });

  it("adds a category filter only when categoryId is present", () => {
    const withCategory = buildSearchConditions({ ...baseFilters, categoryId: "cat-1" });
    expect(withCategory.some((c) => sqlText(c).includes("p.category_id"))).toBe(true);
    expect(withCategory.find((c) => sqlText(c).includes("p.category_id"))?.values).toContain("cat-1");
  });

  it("adds price range conditions only for the bounds that are set", () => {
    const minOnly = buildSearchConditions({ ...baseFilters, minPrice: 10 });
    expect(minOnly.some((c) => sqlText(c).includes("p.base_price >="))).toBe(true);
    expect(minOnly.some((c) => sqlText(c).includes("p.base_price <="))).toBe(false);

    const both = buildSearchConditions({ ...baseFilters, minPrice: 10, maxPrice: 50 });
    expect(both.some((c) => sqlText(c).includes("p.base_price >="))).toBe(true);
    expect(both.some((c) => sqlText(c).includes("p.base_price <="))).toBe(true);
  });

  it("adds an in-stock EXISTS condition only when inStockOnly is true", () => {
    const inStock = buildSearchConditions({ ...baseFilters, inStockOnly: true });
    expect(inStock.some((c) => sqlText(c).includes("EXISTS"))).toBe(true);

    const notFiltered = buildSearchConditions({ ...baseFilters, inStockOnly: false });
    expect(notFiltered.some((c) => sqlText(c).includes("EXISTS"))).toBe(false);
  });
});

describe("buildSearchOrderBy", () => {
  it("ranks by text relevance when a query is present and sort is unset or 'relevance'", () => {
    expect(sqlText(buildSearchOrderBy({ ...baseFilters, q: "chips" }))).toContain("ts_rank");
    expect(sqlText(buildSearchOrderBy({ ...baseFilters, q: "chips", sort: "relevance" }))).toContain("ts_rank");
  });

  it("honors an explicit sort even when a query is present", () => {
    expect(sqlText(buildSearchOrderBy({ ...baseFilters, q: "chips", sort: "price_asc" }))).toContain(
      "p.base_price ASC",
    );
  });

  it("maps each sort option to the expected column/direction", () => {
    expect(sqlText(buildSearchOrderBy({ ...baseFilters, sort: "price_asc" }))).toBe("p.base_price ASC");
    expect(sqlText(buildSearchOrderBy({ ...baseFilters, sort: "price_desc" }))).toBe("p.base_price DESC");
    expect(sqlText(buildSearchOrderBy({ ...baseFilters, sort: "name_asc" }))).toBe("p.name ASC");
  });

  it("defaults to newest first when no query or sort is given", () => {
    expect(sqlText(buildSearchOrderBy(baseFilters))).toBe("p.created_at DESC");
  });
});
