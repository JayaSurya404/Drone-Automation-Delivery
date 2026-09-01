import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToString } from "react-dom/server";
import { DEMO_DRONES, DEMO_ORDERS, DEMO_MISSIONS, DEMO_WAREHOUSE } from "../lib/demo-data.js";
import { CustomerNav } from "../components/shell/customer-nav.js";
import { AdminNav } from "../components/shell/admin-nav.js";

describe("Web Application Shell / Navigation & Demo Data", () => {
  it("renders CustomerNav with all portal routes", () => {
    const html = renderToString(<CustomerNav />);
    assert.ok(html.includes("Dashboard"));
    assert.ok(html.includes("My Orders"));
    assert.ok(html.includes("Live Tracking"));
    assert.ok(html.includes("Notifications"));
    assert.ok(html.includes("Profile &amp; Addresses") || html.includes("Profile & Addresses"));
  });

  it("renders AdminNav with operations center routes", () => {
    const html = renderToString(<AdminNav />);
    assert.ok(html.includes("Operations Center"));
    assert.ok(html.includes("UAV Fleet Management"));
    assert.ok(html.includes("Flight Missions"));
    assert.ok(html.includes("Live Radar &amp; HUD") || html.includes("Live Radar & HUD"));
    assert.ok(html.includes("Incident Alerts"));
    assert.ok(html.includes("Security &amp; Audit Logs") || html.includes("Security & Audit Logs"));
  });

  it("validates demo data integrity and coordinates", () => {
    assert.ok(DEMO_DRONES.length >= 5, "Expected at least 5 demo drones");
    for (const drone of DEMO_DRONES) {
      assert.ok(drone.callsign.startsWith("SKY-"));
      assert.ok(drone.batteryPercent >= 0 && drone.batteryPercent <= 100);
      assert.ok(drone.altitudeMeters >= 0);
      assert.ok(typeof drone.latitude === "number");
      assert.ok(typeof drone.longitude === "number");
    }

    assert.ok(DEMO_ORDERS.length >= 4, "Expected at least 4 demo orders");
    for (const order of DEMO_ORDERS) {
      assert.ok(order.orderNumber.startsWith("ORD-"));
      assert.ok(order.weightKg > 0);
      assert.ok(order.proofOfDeliveryCode.length === 4);
    }

    assert.ok(DEMO_MISSIONS.length >= 3, "Expected at least 3 demo missions");
    for (const mission of DEMO_MISSIONS) {
      assert.ok(mission.code.startsWith("MIS-"));
      assert.ok(mission.waypointsCount >= 3);
      assert.ok(mission.riskScore >= 0 && mission.riskScore <= 100);
    }

    assert.ok(DEMO_WAREHOUSE.latitude !== 0);
    assert.ok(DEMO_WAREHOUSE.longitude !== 0);
  });
});
