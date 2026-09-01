import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { AuthProvider } from "../features/auth/auth-context.js";
import { CartProvider } from "../features/commerce/cart-context.js";
import { ProductCard } from "../components/commerce/product-card.js";
import { CustomerHeader } from "../components/commerce/customer-header.js";
import CustomerLayout from "../app/customer/layout.js";

describe("Customer Ecommerce Portal / Frontend Components", () => {
  const sampleProduct = {
    id: "10000000-0000-0000-0000-000000000001",
    name: "Aashirvaad Superior MP Atta (1kg)",
    slug: "aashirvaad-superior-mp-atta-1kg",
    description: "100% pure whole wheat flour processed with traditional stone grinding.",
    category: "Groceries",
    pricePaise: 6200,
    mrpPaise: 7500,
    discountPercent: 17,
    priceCents: 6200,
    currency: "INR",
    imageUrl: "https://example.com/atta.jpg",
    stockQuantity: 50,
    weightGrams: 1000,
    isDroneEligible: true,
    isFeatured: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  it("renders ProductCard with pricing, weight, and drone delivery badge", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <ProductCard product={sampleProduct as any} />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(html.includes("Aashirvaad Superior MP Atta (1kg)"));
    assert.ok(html.includes("62"));
    assert.ok(html.includes("1.0kg") || html.includes("1000g") || html.includes("1kg"));
    assert.ok(html.includes("Drone Drop") || html.includes("12-15m"));
    assert.ok(html.includes("Groceries"));
  });

  it("renders CustomerHeader with SkyNav Store branding, search, and navigation links", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerHeader />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(html.includes("SkyNav"));
    assert.ok(html.includes("Store"));
    assert.ok(html.includes("Search atta, milk, tea, snacks"));
    assert.ok(html.includes("Cart"));
  });

  it("renders CustomerLayout wrapping content and mobile navigation", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerLayout>
          <div data-testid="store-content">Storefront Body</div>
        </CustomerLayout>
      </AuthProvider>
    );

    assert.ok(html.includes("Storefront Body"));
    assert.ok(html.includes("Store"));
    assert.ok(html.includes("Orders"));
    assert.ok(html.includes("Radar"));
    assert.ok(html.includes("Wishlist"));
    assert.ok(html.includes("Cart"));
    assert.ok(html.includes("Account"));
  });
});
