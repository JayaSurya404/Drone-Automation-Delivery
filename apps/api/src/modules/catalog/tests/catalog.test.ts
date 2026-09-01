import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCatalogService } from "../catalog.service.js";

describe("Catalog / Service Logic & Products", () => {
  const sampleProducts = [
    {
      id: "10000000-0000-0000-0000-000000000001",
      name: "Organic Honeycrisp Apples (1kg)",
      slug: "organic-honeycrisp-apples-1kg",
      description: "Crisp organic apples.",
      category: "Groceries",
      price_cents: 699,
      currency: "USD",
      image_url: "https://example.com/apples.jpg",
      stock_quantity: 50,
      weight_grams: 1050,
      length_cm: 15,
      width_cm: 15,
      height_cm: 15,
      is_drone_eligible: true,
      is_featured: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: "10000000-0000-0000-0000-000000000002",
      name: "Emergency First Aid Trauma Pack",
      slug: "emergency-first-aid-trauma-pack",
      description: "Hospital-grade sterile gauze.",
      category: "Pharmacy",
      price_cents: 3499,
      currency: "USD",
      image_url: "https://example.com/aid.jpg",
      stock_quantity: 25,
      weight_grams: 450,
      length_cm: 20,
      width_cm: 15,
      height_cm: 10,
      is_drone_eligible: true,
      is_featured: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  const mockRepo = {
    async list(query: any) {
      let filtered = sampleProducts;
      if (query.category) filtered = filtered.filter((p) => p.category === query.category);
      if (query.search) filtered = filtered.filter((p) => p.name.toLowerCase().includes(query.search.toLowerCase()));
      return { items: filtered, total: filtered.length };
    },
    async findById(id: string) {
      return sampleProducts.find((p) => p.id === id) || null;
    },
    async findBySlug(slug: string) {
      return sampleProducts.find((p) => p.slug === slug) || null;
    },
    async getCategories() {
      return [
        { category: "Groceries", count: 1 },
        { category: "Pharmacy", count: 1 }
      ];
    }
  };

  const service = createCatalogService(mockRepo as any);

  it("lists products and applies category filtering", async () => {
    const all = await service.listProducts({ limit: 50, offset: 0 });
    assert.equal(all.data.length, 2);

    const groceries = await service.listProducts({ category: "Groceries", limit: 50, offset: 0 });
    assert.equal(groceries.data.length, 1);
    assert.equal(groceries.data[0].slug, "organic-honeycrisp-apples-1kg");
  });

  it("retrieves product by slug and by id", async () => {
    const bySlug = await service.getProduct("emergency-first-aid-trauma-pack");
    assert.equal(bySlug.name, "Emergency First Aid Trauma Pack");

    const byId = await service.getProduct("10000000-0000-0000-0000-000000000001");
    assert.equal(byId.slug, "organic-honeycrisp-apples-1kg");
  });

  it("returns aggregated category counts", async () => {
    const categories = await service.getCategories();
    assert.equal(categories.length, 2);
    assert.equal(categories[0].category, "Groceries");
  });
});
