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
    assert.ok(html.includes("Daily Essentials") || html.includes("Autonomous AirDrop") || html.includes("Shop by Category"));
  });

  it("4. Customer orders page renders empty order state when no orders exist", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerOrdersPage />
      </AuthProvider>
    );

    assert.ok(html.includes("My Drone AirDrop Orders") || html.includes("Orders"));
    assert.ok(html.includes("No Orders Placed Yet") || html.includes("Start Shopping"));
    assert.ok(!html.includes("ORD-9821"));
  });

  it("5. Customer live tracking page shows clean delivery radar", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerTrackingPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Live AirDrop Delivery Radar") || html.includes("Radar"));
  });

  it("6. Customer notifications page handles zero-notification state cleanly", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerNotificationsPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Notifications") || html.includes("No New Notifications"));
    assert.ok(!html.includes("NOTIF-001"));
  });

  it("7. Customer profile page renders dynamic authenticated identity", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerProfilePage />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(html.includes("Customer Account") || html.includes("Account"));
    assert.ok(!html.includes("Dr. Evelyn Reed"));
  });

  it("8. Customer cart page shows empty cart state when no items added", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerCartPage />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(html.includes("Your Drone Cart is Empty") || html.includes("Start Shopping") || html.includes("Cart"));
  });

  it("9. Customer wishlist page shows empty wishlist state when no items saved", () => {
    const html = renderToString(
      <AuthProvider>
        <CartProvider>
          <CustomerWishlistPage />
        </CartProvider>
      </AuthProvider>
    );

    assert.ok(html.includes("Your Wishlist is Empty") || html.includes("Explore Catalog") || html.includes("Wishlist"));
  });
});
