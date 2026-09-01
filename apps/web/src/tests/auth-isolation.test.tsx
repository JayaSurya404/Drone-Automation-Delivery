import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { AuthProvider } from "../features/auth/auth-context.js";
import { CartProvider } from "../features/commerce/cart-context.js";
import LoginPage from "../app/login/page.js";
import SignupPage from "../app/signup/page.js";
import CustomerStorefrontPage from "../app/customer/page.js";
import CustomerOrdersPage from "../app/customer/orders/page.js";
import CustomerTrackingPage from "../app/customer/tracking/page.js";
import CustomerNotificationsPage from "../app/customer/notifications/page.js";
import CustomerProfilePage from "../app/customer/profile/page.js";
import CustomerCartPage from "../app/customer/cart/page.js";
import CustomerWishlistPage from "../app/customer/wishlist/page.js";

describe("Authentication & Account-Scoped Isolation Security Tests", () => {
  it("1. Public signup form renders only customer registration and lacks admin role selectors", () => {
    const html = renderToString(
      <AuthProvider>
        <SignupPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Create your account"));
    assert.ok(html.includes("Customer access only"));
    assert.ok(!html.includes('value="ADMIN"'));
    assert.ok(!html.includes("Admin Registration"));
  });

  it("2. Login page strictly excludes all demo logins, fill shortcuts, and credentials", () => {
    const html = renderToString(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    assert.ok(!html.includes("Fill Admin"));
    assert.ok(!html.includes("Fill Customer"));
    assert.ok(!html.includes("Demo Customer"));
    assert.ok(!html.includes("Quick demo access"));
    assert.ok(!html.includes("customer@skynav.test"));
    assert.ok(!html.includes("admin@skynav.test"));
    assert.ok(!html.includes("drone@gmail.com"));
    assert.ok(!html.includes("drone@automation"));
  });

  it("3. Customer storefront renders zero-data / real products state without hardcoded mock orders", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerStorefrontPage />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(!html.includes("ORD-9821"));
    assert.ok(!html.includes("Emergency Blood Plasma"));
    assert.ok(html.includes("Order Groceries") || html.includes("Featured Products") || html.includes("Autonomous Aerial Logistics"));
  });

  it("4. Customer orders page renders empty order state when no orders exist", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerOrdersPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Your Delivery Orders"));
    assert.ok(html.includes("No Orders Placed Yet") || html.includes("Start Shopping"));
    assert.ok(!html.includes("ORD-9821"));
  });

  it("5. Customer live tracking page shows clean empty state when no missions are in transit", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerTrackingPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Live Delivery Radar") || html.includes("No Deliveries Currently In Flight"));
  });

  it("6. Customer notifications page handles zero-notification state cleanly", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerNotificationsPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Delivery Notifications") || html.includes("No Notifications"));
    assert.ok(!html.includes("NOTIF-001"));
  });

  it("7. Customer profile page renders dynamic authenticated identity without fake doctor names", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerProfilePage />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(!html.includes("Dr. Evelyn Reed"));
    assert.ok(!html.includes("evelyn.reed@biomedlabs.test"));
    assert.ok(!html.includes("San Francisco Biomedical Institute"));
    assert.ok(html.includes("Customer Account"));
  });

  it("8. Customer cart and wishlist render clean initial states", () => {
    const cartHtml = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerCartPage />
        </CartProvider>
      </AuthProvider>
    );
    assert.ok(cartHtml.includes("Your Cart is Empty") || cartHtml.includes("Your Drone Delivery Cart"));

    const wishHtml = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerWishlistPage />
        </CartProvider>
      </AuthProvider>
    );
    assert.ok(wishHtml.includes("Your Wishlist is Empty") || wishHtml.includes("Saved Wishlist"));
  });
});
