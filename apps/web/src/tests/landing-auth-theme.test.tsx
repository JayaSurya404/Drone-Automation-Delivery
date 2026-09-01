import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import Home from "../app/page.js";
import LoginPage from "../app/login/page.js";
import SignupPage from "../app/signup/page.js";
import { ThemeProvider } from "../components/theme/theme-provider.js";
import { ThemeToggle } from "../components/theme/theme-toggle.js";
import { middleware } from "../middleware.js";
import { NextRequest } from "next/server.js";

// Mock next/navigation
// Next.js components use useSearchParams, useRouter, and usePathname
describe("SkyNav Phase 1 / Landing, Authentication & Theme System Tests", () => {

  describe("1. Theme System & Zero-Flash Implementation", () => {
    it("renders ThemeProvider wrapping children with dark and light theme capabilities", () => {
      const html = renderToString(
        <ThemeProvider>
          <div data-testid="themed-child">SkyNav Aerospace Command</div>
        </ThemeProvider>
      );
      assert.ok(html.includes("SkyNav Aerospace Command"));
    });

    it("renders ThemeToggle button with theme accessibility labels and icons", () => {
      const html = renderToString(
        <ThemeProvider>
          <ThemeToggle showLabel />
        </ThemeProvider>
      );
      assert.ok(html.includes("<button"));
      assert.ok(html.includes("mode") || html.includes("Mode"));
    });
  });

  describe("2. Landing Page Visual & Functional Structure", () => {
    it("renders SkyNav brand, hero headline, and aviation logistics subtitle", () => {
      const html = renderToString(<Home />);
      assert.ok(html.includes("SkyNav"));
      assert.ok(html.includes("Aviation Logistics"));
      assert.ok(html.includes("Autonomous Delivery."));
      assert.ok(html.includes("Engineered for the Sky."));
    });

    it("renders the 6 core capability cards", () => {
      const html = renderToString(<Home />);
      assert.ok(html.includes("Autonomous Last-Mile Delivery"));
      assert.ok(html.includes("Fleet Intelligence &amp; Command") || html.includes("Fleet Intelligence & Command"));
      assert.ok(html.includes("Geospatial Routing &amp; Geofences") || html.includes("Geospatial Routing & Geofences"));
      assert.ok(html.includes("Advisory AI &amp; Weather Scoring") || html.includes("Advisory AI & Weather Scoring"));
      assert.ok(html.includes("Computer Vision Verification"));
      assert.ok(html.includes("Digital Twin Telemetry"));
    });

    it("renders the 6-stage delivery flow pipeline stepper", () => {
      const html = renderToString(<Home />);
      assert.ok(html.includes("Order Placed"));
      assert.ok(html.includes("Safety Check"));
      assert.ok(html.includes("Dispatch &amp; Launch") || html.includes("Dispatch & Launch"));
      assert.ok(html.includes("Live Telemetry"));
      assert.ok(html.includes("CV Landing &amp; Drop") || html.includes("CV Landing & Drop"));
      assert.ok(html.includes("Return to Base"));
    });

    it("renders operational preview HUD with live telemetry and pad detection", () => {
      const html = renderToString(<Home />);
      assert.ok(html.includes("DRONE-AERO-01"));
      assert.ok(html.includes("AIRBORNE"));
      assert.ok(html.includes("Altitude"));
      assert.ok(html.includes("Airspeed"));
      assert.ok(html.includes("Battery"));
      assert.ok(html.includes("YOLO Pad Detection"));
    });

    it("renders live system status metrics with zero physical hardware risk indicator", () => {
      const html = renderToString(<Home />);
      assert.ok(html.includes("Deterministic Safety Compliance"));
      assert.ok(html.includes("10 Hz"));
      assert.ok(html.includes("Streaming Telemetry Frequency"));
      assert.ok(html.includes("Physical UAV Hardware Risk"));
    });

    it("renders dual CTAs leading to Customer Portal and Operations Center", () => {
      const html = renderToString(<Home />);
      assert.ok(html.includes("Launch Customer Portal"));
      assert.ok(html.includes("Explore Operations"));
      assert.ok(html.includes('href="/signup"'));
      assert.ok(html.includes('href="/login"'));
    });
  });

  describe("3. Login Page Architecture & Security Gates", () => {
    it("renders aerospace branding and welcome back login panel", () => {
      const html = renderToString(<LoginPage />);
      assert.ok(html.includes("Autonomous aerial delivery,"));
      assert.ok(html.includes("intelligently orchestrated."));
      assert.ok(html.includes("Welcome back"));
      assert.ok(html.includes("Email / Username"));
      assert.ok(html.includes("Password"));
      assert.ok(html.includes("Sign In"));
    });

    it("does NOT expose an Admin role selector to the user", () => {
      const html = renderToString(<LoginPage />);
      assert.ok(!html.includes('select name="role"'));
      assert.ok(!html.includes('value="ADMIN"'));
      assert.ok(!html.includes("Choose role"));
    });

    it("strictly omits all demo fill buttons, shortcuts, and credentials from login page", () => {
      const html = renderToString(<LoginPage />);
      assert.ok(!html.includes("Fill Admin"));
      assert.ok(!html.includes("Fill Customer"));
      assert.ok(!html.includes("Demo Customer"));
      assert.ok(!html.includes("Quick demo access"));
      assert.ok(html.includes("Create SkyNav Account"));
    });
  });

  describe("4. Signup Page Architecture & Customer Isolation", () => {
    it("renders customer registration form with full name, email, password, and confirm password", () => {
      const html = renderToString(<SignupPage />);
      assert.ok(html.includes("Create your account"));
      assert.ok(html.includes("Full Name"));
      assert.ok(html.includes("Email Address"));
      assert.ok(html.includes("Password"));
      assert.ok(html.includes("Confirm Password"));
      assert.ok(html.includes("Complete Registration"));
    });

    it("explicitly informs user that signup creates customer account only", () => {
      const html = renderToString(<SignupPage />);
      assert.ok(html.includes("Register as a SkyNav recipient to manage drone deliveries"));
      assert.ok(html.includes("Customer access only"));
    });
  });

  describe("5. Middleware Route Protection & Role Scoping", () => {
    it("redirects unauthenticated user accessing /admin to /login", () => {
      const req = new NextRequest("http://localhost:3000/admin/fleet");
      const res = middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/login"));
    });

    it("redirects unauthenticated user accessing /customer to /login", () => {
      const req = new NextRequest("http://localhost:3000/customer/orders");
      const res = middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/login"));
    });

    it("prohibits CUSTOMER role from accessing /admin and redirects to /customer", () => {
      const req = new NextRequest("http://localhost:3000/admin/operations", {
        headers: {
          cookie: "skynav_token=test-jwt-token; skynav_role=CUSTOMER"
        }
      });
      const res = middleware(req);
      assert.equal(res.status, 307);
      assert.ok(res.headers.get("location")?.endsWith("/customer"));
    });

    it("permits authenticated ADMIN to proceed to /admin", () => {
      const req = new NextRequest("http://localhost:3000/admin/fleet", {
        headers: {
          cookie: "skynav_token=test-jwt-token; skynav_role=ADMIN"
        }
      });
      const res = middleware(req);
      // Next.js middleware passes through with 200 / empty redirect
      assert.equal(res.headers.get("location"), null);
    });

    it("permits authenticated CUSTOMER to proceed to /customer", () => {
      const req = new NextRequest("http://localhost:3000/customer/orders", {
        headers: {
          cookie: "skynav_token=test-jwt-token; skynav_role=CUSTOMER"
        }
      });
      const res = middleware(req);
      assert.equal(res.headers.get("location"), null);
    });
  });
});
