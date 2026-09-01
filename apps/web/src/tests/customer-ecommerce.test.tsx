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
    name: "Organic Honeycrisp Apples (1kg)",
    slug: "organic-honeycrisp-apples-1kg",
    description: "Crisp organic apples.",
    category: "Groceries",
    priceCents: 699,
    currency: "USD",
    imageUrl: "https://example.com/apples.jpg",
    stockQuantity: 50,
    weightGrams: 1050,
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

    assert.ok(html.includes("Organic Honeycrisp Apples (1kg)"));
    assert.ok(html.includes("$6.99"));
    assert.ok(html.includes("1.1kg") || html.includes("1050g"));
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
    assert.ok(html.includes("Search groceries, essentials"));
    assert.ok(html.includes("Deliver to"));
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
