import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { AuthProvider } from "../features/auth/auth-context.js";
import LoginPage from "../app/login/page.js";
import SignupPage from "../app/signup/page.js";
import CustomerDashboardPage from "../app/customer/page.js";
import CustomerOrdersPage from "../app/customer/orders/page.js";
import CustomerTrackingPage from "../app/customer/tracking/page.js";
import CustomerNotificationsPage from "../app/customer/notifications/page.js";
import CustomerProfilePage from "../app/customer/profile/page.js";

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

  it("2. Login page provides admin quick-fill and strictly excludes customer demo logins", () => {
    const html = renderToString(
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Fill Admin"));
    assert.ok(!html.includes("Fill Customer"));
    assert.ok(!html.includes("Demo Customer"));
    assert.ok(!html.includes("customer@skynav.test"));
  });

  it("3. Customer dashboard renders zero-data empty state without hardcoded mock orders", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerDashboardPage />
      </AuthProvider>
    );

    assert.ok(!html.includes("ORD-9821"));
    assert.ok(!html.includes("Emergency Blood Plasma"));
    assert.ok(html.includes("Welcome, Customer"));
    assert.ok(html.includes("New Delivery Request"));
  });

  it("4. Customer orders page renders empty order state when no orders exist", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerOrdersPage />
      </AuthProvider>
    );

    assert.ok(html.includes("My Delivery Orders"));
    assert.ok(html.includes("Request New Delivery") || html.includes("+ Request New Delivery"));
    assert.ok(!html.includes("ORD-9821"));
  });

  it("5. Customer live tracking page shows clean empty state when no missions are in transit", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerTrackingPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Live Drone Delivery Radar") || html.includes("No Deliveries Currently In Flight"));
  });

  it("6. Customer notifications page handles zero-notification state cleanly", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerNotificationsPage />
      </AuthProvider>
    );

    assert.ok(html.includes("Notifications"));
    assert.ok(!html.includes("NOTIF-001"));
  });

  it("7. Customer profile page renders dynamic authenticated identity without fake doctor names", () => {
    const html = renderToString(
      <AuthProvider>
        <CustomerProfilePage />
      </AuthProvider>
    );

    assert.ok(!html.includes("Dr. Evelyn Reed"));
    assert.ok(!html.includes("evelyn.reed@biomedlabs.test"));
    assert.ok(!html.includes("San Francisco Biomedical Institute"));
    assert.ok(html.includes("Account Details"));
    assert.ok(html.includes("Designated Landing Zone &amp; Drop Instructions") || html.includes("Designated Landing Zone & Drop Instructions"));
  });
});
